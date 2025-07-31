#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
npb_schedule_today.py
NPB公式: 月別スケジュール(一軍/ファーム)から『今日の試合』だけを抽出し、
既存UIと互換の today_games.json (Snapshot) を出力する最小実装。

使い方（例）
  一軍: python3 npb_schedule_today.py --year 2025 --months 06,07,08 --league first \
         --out snapshots/today_games.json
  ファーム: python3 npb_schedule_today.py --year 2025 --months 06,07,08 --league farm \
         --out snapshots/today_games_farm.json

注意:
 - 利用規約/robots.txtの順守、穏当なアクセス（キャッシュ・スリープ）を実装。
 - 1回の実行で月ページに1リクエストずつ、当日分リンクのみ詳細1ページを必要に応じて参照。
"""

import re, os, sys, time, json, argparse, random
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

JST = timezone(timedelta(hours=9))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; baseball-ai-media/npb-schedule; +https://baseball-ai-media.vercel.app)",
    "Accept-Language": "ja,en;q=0.8",
}
FIRST_BASE = "https://npb.jp/games"
FARM_BASE  = "https://npb.jp/farm"
TIMEOUT = 20
SLEEP_RANGE = (1.2, 2.5)  # 礼儀正しく

def sleep():
    time.sleep(random.uniform(*SLEEP_RANGE))

def get(url):
    resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp

def normalize_status(text: str):
    # 代表的な表記の正規化
    t = (text or "").strip()
    # 順序重要: "試合終了"が含まれる場合はFINAL
    if "試合終了" in t or re.search(r"終了", t):
        return "FINAL"
    if "中止" in t or "ノーゲーム" in t:
        return "POSTPONED"
    if re.search(r"(回|表|裏)", t) and ("中" in t or "進行" in t):
        return "IN_PROGRESS"
    if "試合前" in t or "予定" in t or "開始" in t:
        return "SCHEDULED"
    # スコアが入っていれば進行中と解釈（保守的）
    if re.search(r"\d+\s*-\s*\d+", t):
        return "IN_PROGRESS"
    return "SCHEDULED"

def to_inning_half(text: str):
    # Parse inning and half from Japanese text
    m = re.search(r"(\d+)\s*回\s*(表|裏)", text or "")
    if not m:
        return None, None
    inn = int(m.group(1))
    half = "TOP" if m.group(2) == "表" else "BOTTOM"
    return inn, half

# Team name normalization dictionary
TEAM_NORMALIZE = {
    # NPB team name variations
    "ＤｅＮＡ": "DeNA", "ＤｅＮａ": "DeNA", "横浜": "DeNA",
    "ヤクルト": "ヤクルト", "巨人": "巨人", "ジャイアンツ": "巨人",
    "阪神": "阪神", "タイガース": "阪神", "広島": "広島", "カープ": "広島",
    "中日": "中日", "ドラゴンズ": "中日",
    "日本ハム": "日本ハム", "ファイターズ": "日本ハム", "ハム": "日本ハム",
    "楽天": "楽天", "イーグルス": "楽天", "ソフトバンク": "ソフトバンク", "ホークス": "ソフトバンク",
    "西武": "西武", "ライオンズ": "西武", "ロッテ": "ロッテ", "マリーンズ": "ロッテ",
    "オリックス": "オリックス", "バファローズ": "オリックス", "バファロー": "オリックス"
}

def normalize_team_name(name: str) -> str:
    """Normalize team name using dictionary"""
    clean = (name or "").replace("　", " ").strip()
    return TEAM_NORMALIZE.get(clean, clean)

TEAM_CLEAN = normalize_team_name

def parse_first_month(year: int, month: int):
    """Parse first team schedule from NPB games page"""
    url = f"{FIRST_BASE}/{year}/schedule_{month:02d}_detail.html"
    html = get(url).text
    sleep()
    soup = BeautifulSoup(html, "lxml")

    games = []
    # a[href*="/scores/YYYY/MMDD/"] を基準に抽出（個々の対戦ページの基点）
    for a in soup.select(f'a[href*="/scores/{year}/"]'):
        href = a.get("href", "")
        if not re.search(r"/scores/\d{4}/\d{4}/", href):
            continue
        full = urljoin("https://npb.jp", href)
        # 日付はパスから抽出
        m = re.search(r"/scores/(\d{4})/(\d{2})(\d{2})/", href)
        if not m:
            continue
        y, mm, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
        date = f"{y:04d}-{mm:02d}-{dd:02d}"

        # 近傍テキストからチーム・スコア・ステータスを緩やかに拾う
        # HTML構造は月により差があるため、まずはアンカー周辺の親要素テキストをまとめて解析
        parent = a.find_parent(["tr", "li", "div"]) or a.parent
        text = " ".join(parent.get_text(" ", strip=True).split())
        # 例パターン: "DeNA 3-1 中日 18:00 横浜 スコア→"
        score_m = re.search(r"([^\s]+)\s+(\d+)\s*-\s*(\d+)\s+([^\s]+)", text)
        if score_m:
            away_team = TEAM_CLEAN(score_m.group(1))
            away_score = int(score_m.group(2))
            home_score = int(score_m.group(3))
            home_team = TEAM_CLEAN(score_m.group(4))
        else:
            # スコアなし（試合前）のケース: "DeNA vs 中日 18:00 横浜" 的な文字列を想定
            vs_m = re.search(r"([^\s]+)\s+vs\.?\s+([^\s]+)", text, re.IGNORECASE)
            if vs_m:
                away_team = TEAM_CLEAN(vs_m.group(1))
                home_team = TEAM_CLEAN(vs_m.group(2))
            else:
                # 最後の手段: アンカー文字列で推測（構造差異対策）
                label = TEAM_CLEAN(a.get_text(" ", strip=True))
                parts = re.split(r"\s+|vs\.?", label)
                away_team = parts[0] if parts else ""
                home_team = parts[-1] if len(parts) >= 2 else ""
            away_score = home_score = None

        # 状態・回表裏のヒント
        status = normalize_status(text)
        inn, half = to_inning_half(text)

        # リンク群
        base = full if full.endswith("/") else (full + "/")
        links = {
            "index": base + "index.html",
            "pbp":   base + "playbyplay.html",
            "box":   base + "box.html",
        }

        # ID: YYYYMMDD-<home>-<away>-npb（ローマ字/日本語混在でも安定）
        game_id = f"{y:04d}{mm:02d}{dd:02d}-{home_team}-{away_team}-npb"

        # 一軍は会場/開始時刻が近傍にあるケースが多いが、確実性のため軽く拾う
        time_m = re.search(r"(\d{1,2}:\d{2})", text)
        venue_m = re.search(r"(東京ドーム|ベルーナ|横浜|甲子園|バンテリ|マツダ|楽天モバイル|札幌ドーム|ペイペイ|京セラ|神宮|他)", text)
        start_time = time_m.group(1) if time_m else None
        venue = venue_m.group(1) if venue_m else None

        games.append({
            "date": date, "league": "first", "game_id": game_id,
            "away_team": away_team, "home_team": home_team,
            "away_score": away_score, "home_score": home_score,
            "status": status, "inning": f"{inn}{'表' if half=='TOP' else '裏'}" if inn else None,
            "start_time_jst": start_time, "venue": venue,
            "links": links
        })
    return games

def parse_farm_month(year: int, month: int):
    """Parse farm team schedule from NPB farm page"""
    url = f"{FARM_BASE}/{year}/schedule_{month:02d}_detail.html"
    html = get(url).text
    sleep()
    soup = BeautifulSoup(html, "lxml")
    games = []
    for a in soup.select(f'a[href*="/bis/{year}/games/fs"]'):
        href = a.get("href", "")
        full = urljoin("https://npb.jp", href)
        # fsYYYYMMDDNNNNN.html → 日付抽出
        m = re.search(r"/bis/(\d{4})/games/fs(\d{4})(\d{2})(\d{2})\d+\.html", href)
        if not m:
            continue
        y, mm, dd = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        date = f"{y:04d}-{mm:02d}-{dd:02d}"

        parent = a.find_parent(["tr", "li", "div"]) or a.parent
        text = " ".join(parent.get_text(" ", strip=True).split())
        # 例: "イースタン DeNA vs 日本ハム 13:00 ○○" 等を緩やかに解析
        vs_m = re.search(r"([^\s]+)\s+vs\.?\s+([^\s]+)", text)
        away_team = TEAM_CLEAN(vs_m.group(1)) if vs_m else ""
        home_team = TEAM_CLEAN(vs_m.group(2)) if vs_m else ""

        time_m = re.search(r"(\d{1,2}:\d{2})", text)
        start_time = time_m.group(1) if time_m else None

        game_id = f"{y:04d}{mm:02d}{dd:02d}-{home_team}-{away_team}-farm-npb"
        games.append({
            "date": date, "league": "farm", "game_id": game_id,
            "away_team": away_team, "home_team": home_team,
            "away_score": None, "home_score": None,
            "status": "SCHEDULED", "inning": None,
            "start_time_jst": start_time, "venue": None,
            "links": { "page": full }
        })
    return games

def pick_today(games):
    today = datetime.now(JST).date().isoformat()
    return [g for g in games if g["date"] == today]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--months", type=str, required=True, help="e.g., 06,07,08")
    ap.add_argument("--league", choices=["first","farm"], required=True)
    ap.add_argument("--out", default="snapshots/today_games.json")
    ap.add_argument("--all", action="store_true", help="All days in month (default: today only)")
    args = ap.parse_args()

    months = [int(m) for m in args.months.split(",") if m.strip()]
    all_games = []
    for m in months:
        if args.league == "first":
            all_games.extend(parse_first_month(args.year, m))
        else:
            all_games.extend(parse_farm_month(args.year, m))

    games = all_games if args.all else pick_today(all_games)

    # Compatible with existing UI's "Today's Games" JSON (Snapshot format)
    payload = {
        "source": "real",           # Compatible with existing badge (provider shows NPB origin)
        "provider": "npb",
        "updated_at": datetime.now(JST).isoformat(),
        "games": len(games),
        "data": games,
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Wrote {args.out} with {len(games)} game(s).")

if __name__ == "__main__":
    main()