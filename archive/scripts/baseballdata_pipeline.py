"""
Baseballdata.jp Scraper Pipeline (2020+)

Quickstart (Python 3.10+):

    pip install aiohttp beautifulsoup4 lxml pandas duckdb tenacity tqdm pyarrow

Run examples:

    # 1) Discover players (2020..current) and persist index + light tabs to DuckDB
    python baseballdata_pipeline.py discover --start-year 2020 --end-year auto --out data/baseball.duckdb

    # 2) Scrape light tabs for all discovered players (season pages only)
    python baseballdata_pipeline.py scrape --out data/baseball.duckdb --include-pa-logs false

    # One shot
    python baseballdata_pipeline.py run --start-year 2020 --end-year auto --out data/baseball.duckdb --include-pa-logs false

Notes:
- This is a robust *starter* pipeline focused on: ID discovery → light tabs ("", _2, _3, _4, _5, _course) → DuckDB MERGE.
- Full PA logs ("S" pages) are optional and default to OFF due to size.
- Column normalization aims to be compatible with your existing dataset (snake_case, standard naming).
- You can tune concurrency and rate-limiting via CLI flags.
"""
from __future__ import annotations

import argparse
import asyncio
import dataclasses as dc
import os
import re
import time
from datetime import datetime
from typing import Iterable, Optional

import aiohttp
import duckdb
import pandas as pd
from bs4 import BeautifulSoup
from tenacity import retry, wait_fixed, stop_after_attempt
from tqdm.asyncio import tqdm_asyncio

BASE = "https://baseballdata.jp"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0"}
DEFAULT_CONCURRENCY = 6
REQUEST_INTERVAL_SEC = 1.0  # polite rate-limit

CURRENT_YEAR = datetime.now().year

# ---- Helpers ---------------------------------------------------------------

@retry(wait=wait_fixed(1), stop=stop_after_attempt(3))
async def _get(session: aiohttp.ClientSession, url: str) -> aiohttp.ClientResponse:
    resp = await session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=25))
    # baseballdata sometimes returns 403/503 transiently; let tenacity retry
    if resp.status != 200:
        text = await resp.text(errors="ignore")
        raise RuntimeError(f"GET {url} -> {resp.status}: {text[:200]}")
    return resp

async def fetch_html(session: aiohttp.ClientSession, url: str) -> str:
    resp = await _get(session, url)
    return await resp.text(errors="ignore")

async def exists(session: aiohttp.ClientSession, url: str) -> bool:
    try:
        r = await session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=15))
        await asyncio.sleep(REQUEST_INTERVAL_SEC)
        ok = r.status == 200
        if ok:
            # quick sanity: page contains <title>
            txt = await r.text(errors="ignore")
            return "<title" in txt.lower()
        return False
    except Exception:
        return False

# ---- Data models -----------------------------------------------------------

@dc.dataclass
class PlayerIndex:
    player_id: str
    pos: str  # 'B' or 'P'
    first_year: int
    last_year: int
    is_active_npbstats: bool
    name_ja: Optional[str] = None
    name_kana: Optional[str] = None
    bats: Optional[str] = None
    throws: Optional[str] = None
    last_seen_at: float = dc.field(default_factory=lambda: time.time())

    def to_dict(self) -> dict:
        return dc.asdict(self)

# ---- Column normalization --------------------------------------------------

JP_TO_EN = {
    # common batting / pitching aggregates
    "試合": "g",
    "打席": "pa",
    "打数": "ab",
    "安打": "h",
    "二塁打": "double",
    "三塁打": "triple",
    "本塁打": "hr",
    "塁打": "tb",
    "打点": "rbi",
    "盗塁": "sb",
    "四球": "bb",
    "死球": "hbp",
    "三振": "so",
    "併殺打": "gidp",
    "犠打": "sh",
    "犠飛": "sf",
    "出塁率": "obp",
    "長打率": "slg",
    "ＯＰＳ": "ops",
    "OPS": "ops",
    "打率": "avg",
    # sabr/eye
    "BABIP": "babip",
    "IsoP": "isop",
    "IsoD": "isod",
    "BB/K": "bb_k",
    "BB%": "bb_rate",
    "K%": "k_rate",
    "GPA": "gpa",
    "NOI": "noi",
}

PERCENT_COLS = {"bb_rate", "k_rate"}

FLOAT_COLS = {
    "avg", "obp", "slg", "ops", "babip", "isop", "isod", "gpa", "noi",
}

INT_COLS = {"g", "pa", "ab", "h", "double", "triple", "hr", "tb", "rbi", "sb", "bb", "hbp", "so", "gidp", "sh", "sf"}

number_pat = re.compile(r"[-+]?\d+(?:,\d{3})*(?:\.\d+)?")


def _to_number(val: object) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if s in {"-", "—", "―", "—", "---", ""}:
        return None
    # remove %
    pct = s.endswith("%")
    m = number_pat.search(s)
    if not m:
        return None
    num = float(m.group(0).replace(",", ""))
    if pct:
        return num / 100.0
    return num


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    # rename JP→EN when possible
    rename_map = {}
    for col in list(df.columns):
        base = str(col).replace("\u3000", " ").strip()
        rename_map[col] = JP_TO_EN.get(base, base)
    ndf = df.rename(columns=rename_map)
    # attempt numeric casting
    for c in ndf.columns:
        if c in FLOAT_COLS or c in INT_COLS or c in PERCENT_COLS:
            ndf[c] = ndf[c].map(_to_number)
            if c in INT_COLS:
                ndf[c] = ndf[c].dropna().astype(int)
    return ndf

# ---- Discovery -------------------------------------------------------------

async def discover_players(start_year: int, end_year: int, concurrency: int = DEFAULT_CONCURRENCY) -> pd.DataFrame:
    """Enumerate valid player IDs for batting/pitching pages  (2020+).
    Heuristic: stop after N consecutive misses per year.
    """
    sem = asyncio.Semaphore(concurrency)
    out: list[dict] = []

    async with aiohttp.ClientSession() as session:
        for year in range(start_year, end_year + 1):
            print(f"[*] Scanning year {year}...")
            misses = 0
            n = 1
            while True:
                player_id = f"{year:04d}{n:03d}"
                url_b = f"{BASE}/playerB/{player_id}.html"
                url_p = f"{BASE}/playerP/{player_id}.html"
                async with sem:
                    # check B first, then P
                    is_b = await exists(session, url_b)
                    await asyncio.sleep(REQUEST_INTERVAL_SEC)
                    is_p = False if is_b else await exists(session, url_p)
                if not is_b and not is_p:
                    misses += 1
                    if misses >= 20:
                        break  # likely no more IDs for this year
                    n += 1
                    continue

                pos = "B" if is_b else "P"

                # Determine first/last year by probing year pages
                first_y, last_y = None, None
                for y in range(year, CURRENT_YEAR + 1):
                    y_url = f"{BASE}/{y}/player{pos}/{player_id}.html"
                    if await exists(session, y_url):
                        if first_y is None:
                            first_y = y
                        last_y = y
                    await asyncio.sleep(REQUEST_INTERVAL_SEC)

                # Fetch basic page to capture name fields (best-effort)
                base_url = f"{BASE}/player{pos}/{player_id}.html"
                name_ja = name_kana = bats = throws = None
                try:
                    html = await fetch_html(session, base_url)
                    soup = BeautifulSoup(html, "lxml")
                    title = (soup.title.text if soup.title else "").strip()
                    # title often like: "選手名 - プロフィール"; keep leftmost token
                    if title:
                        name_ja = title.split(" ")[0].split("-")[0].strip()
                    # profile small table heuristics
                    small_tables = pd.read_html(html)
                    if small_tables:
                        st0 = normalize_columns(small_tables[0])
                        for c in st0.columns:
                            pass
                except Exception:
                    pass

                is_active = await exists(session, base_url)
                rec = PlayerIndex(
                    player_id=player_id,
                    pos=pos,
                    first_year=first_y or year,
                    last_year=last_y or year,
                    is_active_npbstats=is_active,
                    name_ja=name_ja,
                    name_kana=name_kana,
                    bats=bats,
                    throws=throws,
                )
                out.append(rec.to_dict())
                print(f"  [+] Found {player_id} ({pos}): {name_ja}")
                n += 1
                misses = 0
            
            print(f"[*] Year {year} complete: {len([p for p in out if p['player_id'].startswith(str(year))])} players found")
    
    return pd.DataFrame(out)

# ---- Scraping light tabs ---------------------------------------------------

async def read_tables_from_url(session: aiohttp.ClientSession, url: str) -> list[pd.DataFrame]:
    html = await fetch_html(session, url)
    await asyncio.sleep(REQUEST_INTERVAL_SEC)
    try:
        dfs = pd.read_html(html, flavor="bs4")
    except ValueError:
        return []
    return [normalize_columns(df) for df in dfs]


def _merge_duckdb(conn: duckdb.DuckDBPyConnection, table: str, df: pd.DataFrame, key_cols: list[str]):
    if df.empty:
        return
    conn.register("df", df)
    cols = ", ".join(df.columns)
    # Create table if not exists with schema inferred from df
    conn.execute(f"CREATE TABLE IF NOT EXISTS {table} AS SELECT * FROM df WHERE 0=1;")
    # Upsert via DELETE+INSERT for simplicity (DuckDB MERGE requires 0.10+)
    where = " AND ".join([f"t.{k} = d.{k}" for k in key_cols])
    conn.execute(f"DELETE FROM {table} t USING df d WHERE {where};")
    conn.execute(f"INSERT INTO {table} SELECT {cols} FROM df;")
    conn.unregister("df")


async def scrape_light_tabs_for_player(session: aiohttp.ClientSession, conn: duckdb.DuckDBPyConnection, player_id: str, pos: str, years: Iterable[int]):
    base = f"{BASE}/player{pos}/{player_id}"
    suffixes = ["", "_2", "_3", "_4", "_5", "_course"]

    season_rows = []
    sabr_rows = []
    split_rows = []
    course_rows = []

    for y in years:
        for suf in suffixes:
            url = f"{BASE}/{y}/player{pos}/{player_id}{suf}.html"
            try:
                tables = await read_tables_from_url(session, url)
            except Exception:
                tables = []
            if not tables:
                continue

            # Heuristics per suffix
            if suf == "":
                # Season aggregates — pick the first table row that looks like season totals.
                # If multiple tables exist, concatenate candidates.
                for df in tables:
                    candidate_cols = {"g", "pa", "ab", "h", "hr", "bb", "so"}
                    if len(candidate_cols & set(df.columns)) >= 3:
                        row = {k: df[k].iloc[0] if k in df.columns else None for k in JP_TO_EN.values()}
                        row.update({"player_id": player_id, "season": y, "pos": pos})
                        season_rows.append(row)
            elif suf == "_2":
                # Sabr/eye metrics
                for df in tables:
                    # extract known sabr columns if present
                    keys = {"babip", "isop", "isod", "bb_k", "bb_rate", "k_rate", "gpa", "noi"}
                    if len(keys & set(df.columns)) >= 2:
                        row = {k: (df[k].iloc[0] if k in df.columns else None) for k in keys}
                        row.update({"player_id": player_id, "season": y})
                        sabr_rows.append(row)
            elif suf in {"_3", "_4", "_5"}:
                split_type = {"_3": "situational", "_4": "count", "_5": "vs_team"}[suf]
                # Assume first column is the key
                for df in tables:
                    if df.empty:
                        continue
                    key_col = str(df.columns[0])
                    for _, r in df.iterrows():
                        rec = r.to_dict()
                        rec = {JP_TO_EN.get(k, str(k)): _to_number(v) if k != key_col else v for k, v in rec.items()}
                        split_rows.append({
                            **{k: rec.get(k) for k in ["g","pa","ab","h","hr","bb","so","avg","obp","slg","ops"]},
                            "player_id": player_id,
                            "season": y,
                            "split_type": split_type,
                            "split_key": r[key_col],
                        })
            elif suf == "_course":
                # Zone grid-like table; keep as-is with zone label in first column
                for df in tables:
                    if df.empty:
                        continue
                    key_col = str(df.columns[0])
                    metric_cols = [c for c in df.columns if c != key_col]
                    for _, r in df.iterrows():
                        rec = {"player_id": player_id, "season": y, "zone": r[key_col]}
                        for m in metric_cols:
                            k = JP_TO_EN.get(str(m), str(m))
                            rec[k] = _to_number(r[m])
                        course_rows.append(rec)

    # Write to DuckDB
    if season_rows:
        _merge_duckdb(conn, "season_stats", pd.DataFrame(season_rows), ["player_id", "season"])
    if sabr_rows:
        _merge_duckdb(conn, "sabr_eye", pd.DataFrame(sabr_rows), ["player_id", "season"])
    if split_rows:
        _merge_duckdb(conn, "splits", pd.DataFrame(split_rows), ["player_id", "season", "split_type", "split_key"])
    if course_rows:
        _merge_duckdb(conn, "course_stats", pd.DataFrame(course_rows), ["player_id", "season", "zone"])


async def scrape_light_tabs(index_df: pd.DataFrame, outdb: str, concurrency: int = DEFAULT_CONCURRENCY):
    conn = duckdb.connect(outdb)
    sem = asyncio.Semaphore(concurrency)

    async with aiohttp.ClientSession() as session:
        async def worker(rec: dict):
            years = list(range(int(rec["first_year"]), int(rec["last_year"]) + 1))
            async with sem:
                await scrape_light_tabs_for_player(session, conn, rec["player_id"], rec["pos"], years)

        tasks = [worker(r._asdict() if hasattr(r, "_asdict") else r) for r in index_df.to_dict("records")]
        for f in tqdm_asyncio.as_completed(tasks), "Scraping":
            await f
    conn.close()

# ---- Optional: PA logs (S pages) skeleton ---------------------------------

async def scrape_pa_logs_for_player(session: aiohttp.ClientSession, conn: duckdb.DuckDBPyConnection, player_id: str, pos: str, years: Iterable[int]):
    # NOTE: left as a stub; implement after confirming the exact HTML layout of S pages.
    # Idea: parse a large table where each row is a PA; create pa_logs with normalized columns.
    return

# ---- CLI -------------------------------------------------------------------

def cmd_discover(args):
    start = args.start_year
    end = CURRENT_YEAR if args.end_year == "auto" else int(args.end_year)
    index_df = asyncio.run(discover_players(start, end, concurrency=args.concurrency))
    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    # Save index parquet and DuckDB copy
    index_path = os.path.join(os.path.dirname(args.out), "players_index.parquet")
    index_df.to_parquet(index_path)

    conn = duckdb.connect(args.out)
    _merge_duckdb(conn, "players_index", index_df, ["player_id"])  # upsert by player_id
    conn.close()
    print(f"Discovered {len(index_df)} players. Index saved to: {index_path} and {args.out} (table players_index)")


def cmd_scrape(args):
    conn = duckdb.connect(args.out)
    try:
        index_df = conn.execute("SELECT * FROM players_index").df()
    except Exception as e:
        raise SystemExit("players_index not found in DB. Run discover first.") from e
    conn.close()

    # Reduce index to 2020+ just in case
    index_df = index_df[index_df["first_year"] >= 2020].copy()

    asyncio.run(scrape_light_tabs(index_df, args.out, concurrency=args.concurrency))

    if str(args.include_pa_logs).lower() in {"1", "true", "yes"}:
        print("PA logs collection is not implemented in this stub. Add later if needed.")


def cmd_run(args):
    # discover → scrape (light tabs)
    start = args.start_year
    end = CURRENT_YEAR if args.end_year == "auto" else int(args.end_year)
    index_df = asyncio.run(discover_players(start, end, concurrency=args.concurrency))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    conn = duckdb.connect(args.out)
    _merge_duckdb(conn, "players_index", index_df, ["player_id"])  # upsert
    conn.close()

    asyncio.run(scrape_light_tabs(index_df, args.out, concurrency=args.concurrency))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="baseballdata.jp scraper (2020+) — discovery & light tabs")
    sub = ap.add_subparsers(dest="cmd")

    ap_d = sub.add_parser("discover")
    ap_d.add_argument("--start-year", type=int, default=2020)
    ap_d.add_argument("--end-year", default="auto")
    ap_d.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    ap_d.add_argument("--out", type=str, default="data/baseball.duckdb")
    ap_d.set_defaults(func=cmd_discover)

    ap_s = sub.add_parser("scrape")
    ap_s.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    ap_s.add_argument("--out", type=str, default="data/baseball.duckdb")
    ap_s.add_argument("--include-pa-logs", default=False)
    ap_s.set_defaults(func=cmd_scrape)

    ap_r = sub.add_parser("run")
    ap_r.add_argument("--start-year", type=int, default=2020)
    ap_r.add_argument("--end-year", default="auto")
    ap_r.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    ap_r.add_argument("--out", type=str, default="data/baseball.duckdb")
    ap_r.add_argument("--include-pa-logs", default=False)
    ap_r.set_defaults(func=cmd_run)

    args = ap.parse_args()
    if not getattr(args, "cmd", None):
        ap.print_help()
    else:
        args.func(args)