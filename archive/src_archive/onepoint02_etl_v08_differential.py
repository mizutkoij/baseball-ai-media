#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
onepoint02_etl_v08_differential.py
==================================
Phase 2 仕様（差分最適化）実装版。

✓ DuckDB（`baseball.duckdb` 等）をメインDB & 状態管理(scrape_log, leaders_meta)
✓ Leaders再クロール頻度: --leaders-refresh {never,daily,weekly,monthly,always}
✓ 年度対象: --years 2023-2025 / --only-latest-year（デフォルト=直近3年）
✓ 既存ID再利用: --reuse-ids player_ids.json
✓ 差分スキップ: --only-new（scrape_logのcontent_hash一致でスキップ）
✓ Parquet / DuckDB統合（v0.7_duck機能を継承）
✓ 自動ログイン（Playwright/requests）内蔵

推奨運用（ユーザー合意済み）
----------------------------
# 日次（差分最小）
python onepoint02_etl_v08_differential.py \
  --auto-login \
  --leaders-refresh never \
  --reuse-ids player_ids.json \
  --only-latest-year \
  --only-new \
  --duckdb baseball.duckdb \
  --out data_v08

# 週次（直近3年）
python onepoint02_etl_v08_differential.py \
  --auto-login \
  --leaders-refresh weekly \
  --years 2023-2025 \
  --only-new \
  --duckdb baseball.duckdb \
  --out data_v08

# 月次フル
python onepoint02_etl_v08_differential.py \
  --auto-login \
  --leaders-refresh always \
  --years 2014-2025 \
  --duckdb baseball.duckdb \
  --out data_v08
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from http.cookiejar import MozillaCookieJar
from typing import Iterable
from urllib.parse import urlparse, urljoin, parse_qs, urlsplit

import argparse
import hashlib
import html
import io
import json
import logging
import os
import random
import re
import time

import duckdb
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests
import requests_cache
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential_jitter
from tqdm import tqdm

# ---------------------------- Consts ----------------------------
BASE = "https://1point02.jp"
LEAGUES = (0, 1)
LEADERS_CAT = {
    "bat": "pbs_standard",
    "fld": "pfs_standard",
    "pit": "pps_standard",
}
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
BLOCK_PAT = re.compile(r"(アクセスが制限されています|Too Many Requests|429|blocked)", re.I)

MIN_SLEEP, MAX_SLEEP = 30, 60  # 30-60秒に延長（安全性重視）
DISCOVERY_SLEEP = (15.0, 30.0)  # 15-30秒に延長
LEADERS_REFRESH_CHOICES = ("never", "daily", "weekly", "monthly", "always")

# ---------------------------- utils ----------------------------
def rand_sleep(a=MIN_SLEEP, b=MAX_SLEEP): 
    # 追加ランダム要素で人間らしいアクセスパターンに
    extra = random.uniform(0, 30)  # 0-30秒の追加ランダム
    time.sleep(random.uniform(a, b) + extra)

def rand_sleep_light(): 
    # 軽い処理でも十分な間隔を確保
    time.sleep(random.uniform(15.0, 45.0))
def utcnow() -> datetime: return datetime.now(timezone.utc)
def utcnow_str() -> str: return utcnow().isoformat(timespec="seconds")

# ---------------------------- DuckDB state ----------------------------
def ensure_state_tables(con: duckdb.DuckDBPyConnection):
    con.execute("""
        CREATE TABLE IF NOT EXISTS scrape_log (
          player_id TEXT,
          url TEXT,
          table_idx INTEGER,
          content_hash TEXT,
          scraped_at TIMESTAMP
        );
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS leaders_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );
    """)

def get_leaders_last_refresh(con: duckdb.DuckDBPyConnection) -> datetime | None:
    try:
        row = con.execute("SELECT value FROM leaders_meta WHERE key='last_refresh'").fetchone()
        if not row:
            return None
        return datetime.fromisoformat(row[0])
    except Exception:
        return None

def set_leaders_last_refresh(con: duckdb.DuckDBPyConnection, ts: datetime):
    con.execute("DELETE FROM leaders_meta WHERE key='last_refresh'")
    con.execute("INSERT INTO leaders_meta VALUES ('last_refresh', ?)", [ts.isoformat()])

def need_refresh(kind: str, last: datetime | None) -> bool:
    if kind == "always":
        return True
    if last is None:
        return True
    delta = utcnow() - last
    if kind == "never":
        return False
    if kind == "daily":
        return delta >= timedelta(days=1)
    if kind == "weekly":
        return delta >= timedelta(days=7)
    if kind == "monthly":
        return delta >= timedelta(days=30)
    return True

# ---------------------------- session/login ----------------------------
def enable_cache(out_dir: str, days: int):
    requests_cache.install_cache(
        cache_name=os.path.join(out_dir, "o102_cache"),
        backend="sqlite",
        expire_after=timedelta(days=days),
    )

def new_session(cookie_file: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Referer": BASE})
    if os.path.exists(cookie_file):
        cj = MozillaCookieJar(cookie_file)
        cj.load(ignore_discard=True, ignore_expires=True)
        for c in cj:
            s.cookies.set(c.name, c.value, domain=c.domain, path=c.path)
    return s

def detect_logged_out(html_text: str) -> bool:
    return ("btnLogin" in html_text) or ("ログイン" in html_text and "会員" in html_text)

def reload_cookie(sess: requests.Session, cookie_file: str):
    cj = MozillaCookieJar(cookie_file)
    cj.load(ignore_discard=True, ignore_expires=True)
    sess.cookies.clear()
    for c in cj:
        sess.cookies.set(c.name, c.value, domain=c.domain, path=c.path)

def playwright_login(cookie_file: str, email: str, password: str):
    from o102_login_playwright import login_and_dump
    login_and_dump(cookie_file, email, password)

def requests_login(cookie_file: str, email: str, password: str):
    from o102_login_requests import login_and_dump_cookie
    login_and_dump_cookie(email, password, cookie_file)

def auto_login(sess: requests.Session, args):
    logging.warning("Auto login triggered...")
    if args.login_method == "playwright":
        playwright_login(args.cookie, args.email, args.password)
    else:
        requests_login(args.cookie, args.email, args.password)
    reload_cookie(sess, args.cookie)
    logging.info("Auto login done.")

@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=120, max=3600))
def safe_get(sess: requests.Session, url: str, args, **kwargs) -> requests.Response:
    r = sess.get(url, timeout=30, **kwargs)
    r.encoding = r.apparent_encoding or "utf-8"
    if r.status_code in (403, 429) or BLOCK_PAT.search(r.text):
        logging.error("BLOCKED (%s): %s", r.status_code, url)
        raise RuntimeError("blocked")

    if args.auto_login and detect_logged_out(r.text):
        auto_login(sess, args)
        r = sess.get(url, timeout=30, **kwargs)
        r.encoding = r.apparent_encoding or "utf-8"
        if detect_logged_out(r.text):
            raise RuntimeError("still logged out after auto-login")
    return r

# ---------------------------- ID / years ----------------------------
def parse_years_arg(args) -> Iterable[int]:
    if args.only_latest_year:
        return [datetime.now().year]
    if args.years:
        m = re.fullmatch(r"(\d{4})-(\d{4})", args.years)
        if not m:
            raise SystemExit("--years は 2023-2025 のような形式で指定してください")
        start, end = int(m.group(1)), int(m.group(2))
        if start > end:
            start, end = end, start
        return range(start, end + 1)
    now = datetime.now().year
    return range(now - 2, now + 1)  # 直近3年デフォルト

def collect_player_ids(sess: requests.Session, args, years: Iterable[int]) -> set[str]:
    ids: set[str] = set()
    
    # 総数計算
    total_requests = len(list(years)) * len(LEAGUES) * len(LEADERS_CAT)
    logging.info("Players ID収集開始: %d リクエスト予定", total_requests)
    
    with tqdm(total=total_requests, desc="Player IDs収集", unit="req") as pbar:
        for year in years:
            for lg in LEAGUES:
                for cat in LEADERS_CAT.values():
                    params = {"sn": year, "lg": lg, "cp": 101, "sl": 1, "pn": 0}
                    url = f"{BASE}/op/gnav/leaders/pl/{cat}.aspx"
                    resp = safe_get(sess, url, args, params=params)
                    found = re.findall(r"pl=(\d{6,})", resp.text)
                    
                    lg_name = "セ" if lg == 0 else "パ"
                    logging.info("year=%s lg=%s(%s) %s -> %d ids", year, lg, lg_name, cat, len(found))
                    ids.update(found)
                    
                    pbar.set_postfix({
                        'year': year, 
                        'league': lg_name, 
                        'total_ids': len(ids)
                    })
                    pbar.update(1)
                    
                    rand_sleep()
    
    logging.info("Player ID収集完了: %d 人", len(ids))
    return ids

# ---------------------------- URL discover ----------------------------
def sanitize_href(href: str) -> str:
    href = html.unescape(href)
    href = href.split("&title=")[0]
    return href.strip("'\"")

def extract_player_id_from_url(url: str) -> str | None:
    qs = parse_qs(urlsplit(url).query)
    if "pl" in qs:
        return qs["pl"][0]
    m = re.search(r"pl=(\d+)", url)
    return m.group(1) if m else None

def discover_views(sess: requests.Session, pl: str, args, years: Iterable[int]) -> list[str]:
    seed = f"{BASE}/op/gnav/player/stats/player_stats_bs.aspx?pl={pl}"
    resp = safe_get(sess, seed, args)
    soup = BeautifulSoup(resp.text, "lxml")
    urls: set[str] = {seed}
    for a in soup.select("a[href]"):
        href = sanitize_href(a["href"])
        if urlparse(href).netloc not in ("", "1point02.jp"):
            continue
        if not href.startswith("/op/gnav/player/"):
            continue
        urls.add(urljoin(BASE, href))
    final: list[str] = []
    for u in urls:
        if "gamelog" in u and "sn=" not in u:
            final.extend([f"{u}&sn={y}" for y in years])
        else:
            final.append(u)
    return final

# ---------------------------- save / hash ----------------------------
def sanitize_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*#]', "_", name)

def df_hash(df: pd.DataFrame) -> str:
    b = df.to_csv(index=False).encode("utf-8")
    return hashlib.md5(b).hexdigest()

def to_parquet(df: pd.DataFrame, path: str):
    table = pa.Table.from_pandas(df, preserve_index=False)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pq.write_table(table, path)

def maybe_to_csv(df: pd.DataFrame, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_csv(path, index=False, encoding="utf-8-sig")

def already_scraped(con: duckdb.DuckDBPyConnection, player_id: str, url: str, table_idx: int, content_hash: str) -> bool:
    row = con.execute(
        """
        SELECT 1 FROM scrape_log
        WHERE player_id=? AND url=? AND table_idx=? AND content_hash=?
        LIMIT 1
        """,
        [player_id, url, table_idx, content_hash]
    ).fetchone()
    return row is not None

def upsert_scrape_log(con: duckdb.DuckDBPyConnection, player_id: str, url: str, table_idx: int, content_hash: str):
    con.execute(
        "INSERT INTO scrape_log VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
        [player_id, url, table_idx, content_hash]
    )

def save_tables(sess: requests.Session, url: str, out_dir: str, args, con: duckdb.DuckDBPyConnection):
    try:
        resp = safe_get(sess, url, args)
        dfs = pd.read_html(io.StringIO(resp.text))
        if not dfs:
            logging.warning("No table found for %s", url)
            return
        pl = extract_player_id_from_url(url)
        scraped_at = utcnow_str()

        for i, df in enumerate(dfs):
            df.insert(0, "table_idx", i)
            df.insert(0, "url", url)
            df.insert(0, "player_id", pl)
            df.insert(0, "scraped_at", scraped_at)

            content_hash = df_hash(df)

            if args.only_new and already_scraped(con, pl or "", url, i, content_hash):
                logging.debug("SKIP (only_new): %s [tbl=%d]", url, i)
                continue

            fname_base = sanitize_filename(url.replace(BASE + "/", ""))
            if len(dfs) > 1:
                fname_base += f"_tbl{i}"

            if args.out_format in ("parquet", "both"):
                ppath = os.path.join(out_dir, "parquet", fname_base + ".parquet")
                to_parquet(df, ppath)
            if args.out_format in ("csv", "both"):
                cpath = os.path.join(out_dir, "csv", fname_base + ".csv")
                maybe_to_csv(df, cpath)

            upsert_scrape_log(con, pl or "", url, i, content_hash)

    except Exception as e:
        logging.error("%s: %s", url, e)

# ---------------------------- DuckDB view ----------------------------
def create_view_all_frames(db_path: str, parquet_root: str, view_name: str = "all_frames"):
    con = duckdb.connect(db_path)
    pattern = os.path.join(parquet_root, "**/*.parquet").replace("\\", "/")
    con.execute(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_parquet('{pattern}');")
    con.close()
    logging.info("DuckDB view created: %s -> %s", db_path, view_name)

# ---------------------------- IDs cache ----------------------------
def dump_player_ids_json(ids: Iterable[str], path: str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted(list(ids)), f, ensure_ascii=False, indent=2)

def load_player_ids_json(path: str) -> set[str]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return set(map(str, data))

# ---------------------------- main ----------------------------
def main():
    ap = argparse.ArgumentParser()

    # Output & DB
    ap.add_argument("--out", default="data_v08")
    ap.add_argument("--out-format", choices=["parquet", "csv", "both"], default="parquet")
    ap.add_argument("--duckdb", default="baseball.duckdb", help="メイン DB（scrape_log を含む）")

    # Parallel & cache
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--cache-days", type=int, default=14)

    # Login
    ap.add_argument("--cookie", default="cookie.txt")
    ap.add_argument("--auto-login", action="store_true")
    ap.add_argument("--email", default=os.environ.get("O102_EMAIL"))
    ap.add_argument("--password", default=os.environ.get("O102_PASSWORD"))
    ap.add_argument("--login-method", choices=["playwright", "requests"], default="playwright")

    # Differential
    ap.add_argument("--leaders-refresh", choices=LEADERS_REFRESH_CHOICES, default="weekly")
    ap.add_argument("--reuse-ids", dest="reuse_ids", default=None, help="Leaders を叩かず、この JSON の ID を使う")
    ap.add_argument("--only-new", action="store_true", help="scrape_log に同一 content_hash があればスキップ")
    ap.add_argument("--only-latest-year", action="store_true")
    ap.add_argument("--years", default=None, help="例: 2023-2025 （only-latest-year より優先）")

    # Debug
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(format="%(asctime)s %(levelname)s: %(message)s",
                        level=logging.INFO, datefmt="%Y-%m-%d %H:%M:%S")

    if args.auto_login and (not args.email or not args.password):
        logging.error("--auto-login を使う場合は --email / --password か環境変数が必要です")
        return 1

    years = list(parse_years_arg(args))
    logging.info("Target years: %s", years)

    # DuckDB state
    os.makedirs(os.path.dirname(args.duckdb) or ".", exist_ok=True)
    con = duckdb.connect(args.duckdb)
    ensure_state_tables(con)

    # Cache
    os.makedirs(args.out, exist_ok=True)
    enable_cache(args.out, args.cache_days)

    # Session
    sess = new_session(args.cookie)

    # Dry-run
    if args.dry_run:
        test_url = f"{BASE}/op/gnav/leaders/pl/pbs_standard.aspx?sn={years[-1]}&lg=0&cp=101&sl=1&pn=0"
        try:
            r = safe_get(sess, test_url, args)
            logging.info("dry-run OK, len=%d", len(r.text))
        except Exception as e:
            logging.error("dry-run NG: %s", e)
        finally:
            con.close()
        return 0

    # Player IDs
    if args.reuse_ids and os.path.exists(args.reuse_ids):
        player_ids = load_player_ids_json(args.reuse_ids)
        logging.info("Loaded %d player_ids from %s", len(player_ids), args.reuse_ids)
    else:
        last = get_leaders_last_refresh(con)
        if need_refresh(args.leaders_refresh, last):
            logging.info("Refreshing leaders (policy=%s, last=%s)", args.leaders_refresh, last)
            player_ids = collect_player_ids(sess, args, years)
            if args.reuse_ids:
                dump_player_ids_json(player_ids, args.reuse_ids)
            set_leaders_last_refresh(con, utcnow())
        else:
            if not args.reuse_ids or not os.path.exists(args.reuse_ids):
                logging.error("leaders-refresh says no refresh, but --reuse-ids not provided or missing")
                con.close()
                return 1
            player_ids = load_player_ids_json(args.reuse_ids)
            logging.info("[no refresh] Loaded %d player_ids from %s", len(player_ids), args.reuse_ids)

    # Download
    logging.info("データ収集開始: %d 選手", len(player_ids))
    total_processed = 0
    total_skipped = 0
    total_errors = 0
    
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = []
        
        # プログレスバー用に全URL数を事前計算
        all_urls = []
        logging.info("URL発見中...")
        for pl in tqdm(player_ids, desc="URL発見", unit="選手"):
            try:
                views = discover_views(sess, pl, args, years)
                for view in views:
                    all_urls.append((pl, view))
                rand_sleep_light()
            except Exception as e:
                logging.error("URL発見エラー (選手%s): %s", pl, e)
        
        logging.info("発見URL数: %d", len(all_urls))
        
        # 実際の処理
        with tqdm(total=len(all_urls), desc="データ収集", unit="page") as pbar:
            for pl, view in all_urls:
                futures.append(ex.submit(save_tables, sess, view, args.out, args, con))
                
            for f in as_completed(futures):
                try:
                    result = f.result()
                    total_processed += 1
                    pbar.set_postfix({
                        'processed': total_processed,
                        'errors': total_errors
                    })
                except Exception as e:
                    total_errors += 1
                    logging.error("処理エラー: %s", e)
                finally:
                    pbar.update(1)
    
    logging.info("データ収集完了: 処理=%d, エラー=%d", total_processed, total_errors)

    con.close()

    # Build DuckDB view
    if args.out_format in ("parquet", "both"):
        parquet_root = os.path.join(args.out, "parquet")
        if os.path.isdir(parquet_root):
            create_view_all_frames(args.duckdb, parquet_root)

    logging.info("DONE.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
