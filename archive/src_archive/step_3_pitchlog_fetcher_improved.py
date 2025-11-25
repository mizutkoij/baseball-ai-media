# step_3_pitchlog_fetcher_improved.py (レート制限強化・夜間バックフィル対応版)

import glob, os, re, time, pandas as pd
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from datetime import datetime, time as dt_time
import random
import json

VALID_IDX_DIR   = "data/valid_indexes"
OUTPUT_DIR      = "data/pitch_logs_improved"
DEBUG_HTML_DIR  = "data/debug_html"
CACHE_DIR       = "data/cache/pitchlogs"

# 時間帯制御
NIGHT_BACKFILL_START = dt_time(22, 0)  # 22:00
NIGHT_BACKFILL_END = dt_time(6, 0)     # 06:00
LIVE_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

# レート制限設定
MIN_DELAY = 3.0
MAX_DELAY = 8.0
CONCURRENT_LIMIT = 1  # 同時実行数制限

# Circuit breaker
CIRCUIT_BREAKER_THRESHOLD = 3
CIRCUIT_BREAKER_COOLDOWN = 180

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DEBUG_HTML_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

circuit_breaker_state = {
    'failures': 0,
    'last_failure': None,
    'is_open': False
}

def is_night_backfill_time():
    """
    夜間バックフィル時間帯かどうかチェック
    """
    current_time = datetime.now().time()
    
    # 22:00-23:59 または 00:00-06:00
    return (current_time >= NIGHT_BACKFILL_START or 
            current_time <= NIGHT_BACKFILL_END)

def should_process_game(game_id, is_backfill=False):
    """
    ゲーム処理可否の判定
    """
    current_hour = datetime.now().hour
    
    if is_backfill:
        # バックフィルは夜間のみ
        return is_night_backfill_time()
    else:
        # ライブ処理は日中のみ
        return current_hour in LIVE_HOURS

def circuit_breaker_check():
    """
    Circuit Breakerの状態をチェック
    """
    if circuit_breaker_state['is_open']:
        if circuit_breaker_state['last_failure']:
            elapsed = time.time() - circuit_breaker_state['last_failure']
            if elapsed > CIRCUIT_BREAKER_COOLDOWN:
                circuit_breaker_state['is_open'] = False
                circuit_breaker_state['failures'] = 0
                print(f"🔄 Circuit breaker recovered after {elapsed:.0f}s")
                return True
            else:
                print(f"⚠️ Circuit breaker open - {elapsed:.0f}s elapsed")
                return False
    return True

def record_failure():
    """
    失敗を記録
    """
    circuit_breaker_state['failures'] += 1
    circuit_breaker_state['last_failure'] = time.time()
    
    if circuit_breaker_state['failures'] >= CIRCUIT_BREAKER_THRESHOLD:
        circuit_breaker_state['is_open'] = True
        print(f"🚨 Circuit breaker opened after {circuit_breaker_state['failures']} failures")

def record_success():
    """
    成功を記録
    """
    circuit_breaker_state['failures'] = 0

def get_cache_key(game_id, idx):
    """
    キャッシュキーを生成
    """
    return f"{game_id}_{idx}"

def load_from_cache(cache_key):
    """
    キャッシュからデータを読み込み（30日有効）
    """
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
    
    if os.path.exists(cache_file):
        try:
            cache_age = time.time() - os.path.getmtime(cache_file)
            if cache_age < 30 * 24 * 3600:  # 30日
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Cache read error for {cache_key}: {e}")
    
    return None

def save_to_cache(cache_key, data):
    """
    データをキャッシュに保存
    """
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
    
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, default=str)
    except Exception as e:
        print(f"Cache save error for {cache_key}: {e}")

def adaptive_delay():
    """
    適応的な遅延（失敗回数に応じて増加）
    """
    base_delay = random.uniform(MIN_DELAY, MAX_DELAY)
    failure_multiplier = 1 + (circuit_breaker_state['failures'] * 0.5)
    actual_delay = min(base_delay * failure_multiplier, 30.0)  # 最大30秒
    
    print(f"  Adaptive delay: {actual_delay:.1f}s (failures: {circuit_breaker_state['failures']})")
    time.sleep(actual_delay)

def classify_zone(top, left):
    """
    ピクセル座標からゾーンを分類する
    """
    if top < 60:      v = "高め"
    elif top < 120:   v = "中"
    else:             v = "低め"
    if left < 60:     h = "外角"
    elif left < 120:  h = "真ん中"
    else:             h = "内角"
    return f"{h}{v}"

def fetch_pitches_for_index_with_cache(page, game_id, idx):
    """
    キャッシュ対応版の投球データ取得
    """
    cache_key = get_cache_key(game_id, idx)
    
    # キャッシュから確認
    cached_data = load_from_cache(cache_key)
    if cached_data is not None:
        print(f"  📄 Cache hit for {idx}")
        record_success()
        return cached_data
    
    # Circuit breaker確認
    if not circuit_breaker_check():
        return []
    
    # 適応的遅延
    adaptive_delay()
    
    url = f"https://baseball.yahoo.co.jp/npb/game/{game_id}/score?index={idx}"
    
    try:
        page.goto(url, timeout=30000)
        
        # 試合ごとのHTML保存用ディレクトリを作成
        game_html_dir = os.path.join(DEBUG_HTML_DIR, game_id)
        os.makedirs(game_html_dir, exist_ok=True)

        try:
            page.wait_for_selector("div#async-fieldBody", timeout=20000)
        except Exception as e:
            print(f"   Error: div#async-fieldBody not found for {url}")
            record_failure()
            
            # エラーHTML保存
            error_html_path = os.path.join(game_html_dir, f"error_{idx}_no_main_content.html")
            with open(error_html_path, "w", encoding="utf-8") as f:
                f.write(page.content())
            return []

        html = page.content()
        
        # 成功HTML保存（デバッグ用）
        if random.random() < 0.1:  # 10%の確率で保存
            success_html_path = os.path.join(game_html_dir, f"success_{idx}_sample.html")
            with open(success_html_path, "w", encoding="utf-8") as f:
                f.write(html)
                
        soup = BeautifulSoup(html, "html.parser")

        # データ抽出ロジック（元のコードと同じ）
        batter_name = None
        batter_hand = None
        pitcher_name = None
        pitcher_hand = None
        runner_on_1b = False
        runner_on_2b = False
        runner_on_3b = False

        batter_card = soup.select_one("div#batter table.ct")
        if batter_card:
            batter_name_tag = batter_card.select_one("td.nm a")
            if batter_name_tag:
                batter_name = batter_name_tag.get_text(strip=True)
            batter_hand_tag = batter_card.select_one("td.dominantHand")
            if batter_hand_tag:
                batter_hand = batter_hand_tag.get_text(strip=True)

        pitcher_card = soup.select_one("div#pit div#pitcherR table.ct")
        if pitcher_card:
            pitcher_name_tag = pitcher_card.select_one("td.nm a")
            if pitcher_name_tag:
                pitcher_name = pitcher_name_tag.get_text(strip=True)
            pitcher_hand_tag = pitcher_card.select_one("td.dominantHand")
            if pitcher_hand_tag:
                pitcher_hand = pitcher_hand_tag.get_text(strip=True)

        base_div = soup.select_one("div#field div#base")
        if base_div and 'class' in base_div.attrs:
            base_class = base_div['class'][0] 
            runner_on_1b = '1' in base_class[1]
            runner_on_2b = '1' in base_class[2]
            runner_on_3b = '1' in base_class[3]

        pitch_details_section = soup.select_one("section.bb-splits__item:has(h3.bb-head02__title:-soup-contains('詳しい投球内容'))")
        
        table = None
        if pitch_details_section:
            table = pitch_details_section.select_one("table.bb-splitsTable:has(thead)")
        
        if not table:
            all_splits_tables = soup.select("table.bb-splitsTable")
            for tbl in all_splits_tables:
                ths_text = [th.text.strip() for th in tbl.select("thead th")]
                if "投球数" in ths_text and "球種" in ths_text and "球速" in ths_text and "結果" in ths_text:
                    table = tbl
                    break

        if not table:
            print(f"   Warning: No valid pitch log table found for {url}")
            record_failure()
            return []

        head_row = table.select_one("thead tr")
        if not head_row:
            print(f"   Warning: No header row found for {url}")
            return []

        headers = []
        for th in head_row.select("th.bb-splitsTable__head"):
            th_text = th.text.strip()
            colspan = int(th.get('colspan', 1))
            
            if colspan > 1:
                if th_text == "投球数":
                    headers.append("投球数_打席内")
                    headers.append("投球数_合計")
                else:
                    for i in range(colspan):
                        headers.append(f"{th_text}_{i+1}")
            else:
                headers.append(th_text)

        if len(headers) != 5 or not all(keyword in headers for keyword in ["球種", "球速", "結果"]):
            print(f"   Warning: Invalid headers for {url}. Headers: {headers}")
            return []

        rows = table.select("tbody tr")
        
        pitch_logs = []
        for i, tr in enumerate(rows, start=1):
            if not tr.select_one("td span.bb-icon__ballCircle"):
                continue 

            cells = [td.text.strip() for td in tr.select("td")]
            
            if len(cells) != len(headers):
                print(f"   Warning: Cell/header mismatch for pitch {i} in {url}")
                continue
                
            rec = dict(zip(headers, cells))
            if '球速' in rec and rec['球速'] == '-':
                rec['球速'] = None

            rec.update({
                "game_id": game_id,
                "index": idx,
                "pitch_no": str(rec["投球数_打席内"]),
                "打者名": batter_name,
                "打者利き腕": batter_hand,
                "投手名": pitcher_name,
                "投手利き腕": pitcher_hand,
                "走者1塁": runner_on_1b,
                "走者2塁": runner_on_2b,
                "走者3塁": runner_on_3b,
            })
            pitch_logs.append(rec)

        # 配球チャート座標の抽出
        locs = {}
        for span in soup.select("div#pitchesDetail div.bb-allocationChart span.bb-icon__ballCircle"):
            no_tag = span.select_one("span.bb-icon__number")
            if not no_tag: continue
            no = no_tag.text.strip()
            style = span.get("style")
            if not style: continue
            
            top_match  = re.search(r"top:(\d+\.?\d*)px", style)
            left_match = re.search(r"left:(\d+\.?\d*)px", style)

            if top_match and left_match:
                top  = float(top_match.group(1))
                left = float(left_match.group(1))
                locs[no] = (left, top)

        for span in soup.select("div.next div.bb-allocationChart span.bb-icon__ballCircle"):
            no_tag = span.select_one("span.bb-icon__number")
            if not no_tag: continue
            no = no_tag.text.strip()
            style = span.get("style")
            if not style: continue
            
            top_match  = re.search(r"top:(\d+\.?\d*)px", style)
            left_match = re.search(r"left:(\d+\.?\d*)px", style)

            if top_match and left_match:
                top  = float(top_match.group(1))
                left = float(left_match.group(1))
                locs[no] = (left, top)

        # 座標とゾーンを追加
        for rec in pitch_logs:
            no = rec["pitch_no"]
            if no in locs:
                x, y = locs[no]
                rec["x_px"], rec["y_px"] = x, y
                rec["zone"] = classify_zone(y, x)
            else:
                rec["x_px"] = rec["y_px"] = rec["zone"] = None

        # キャッシュに保存
        save_to_cache(cache_key, pitch_logs)
        record_success()
        
        return pitch_logs
        
    except Exception as e:
        print(f"   Error fetching {url}: {e}")
        record_failure()
        return []

def main():
    print("▶ Step 3 (Improved): Fetching pitch logs with enhanced rate limiting")
    
    # 時間帯チェック
    current_hour = datetime.now().hour
    is_backfill = len(glob.glob(f"{OUTPUT_DIR}/pitch_logs_*.csv")) > 0
    
    if not should_process_game("test", is_backfill):
        if is_backfill:
            print(f"⏰ Backfill processing is only allowed during night hours (22:00-06:00)")
        else:
            print(f"⏰ Live processing is only allowed during day hours (07:00-21:00)")
        print(f"Current time: {datetime.now().strftime('%H:%M')}")
        return
    
    csvs = sorted(glob.glob(f"{VALID_IDX_DIR}/valid_indexes_*.csv"))
    if not csvs:
        raise FileNotFoundError(f"No valid_indexes CSVs in {VALID_IDX_DIR}. Run step_2 first.")

    print(f"🕐 Processing at {datetime.now().strftime('%H:%M')} ({'backfill' if is_backfill else 'live'} mode)")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        )
        
        context = browser.new_context(
            user_agent="Mozilla/5.0 (compatible; NPB-DataCollector/1.0; +contact@example.com)",
            viewport={'width': 1280, 'height': 720},
            extra_http_headers={
                'From': 'contact@example.com'
            }
        )
        
        page = context.new_page()
        processed_game_ids = set()

        for path in csvs:
            file_name = os.path.basename(path)
            game_id_match = re.search(r"valid_indexes_(\d+)\.csv$", file_name)
            if not game_id_match:
                print(f"   Skipping malformed CSV path: {path}")
                continue
            game_id = game_id_match.group(1)

            if game_id in processed_game_ids:
                print(f"   Skipping already processed game_id={game_id}")
                continue
            processed_game_ids.add(game_id)

            out_csv = f"{OUTPUT_DIR}/pitch_logs_{game_id}.csv"
            if os.path.exists(out_csv) and not is_backfill:
                print(f"   Output file exists for game_id={game_id}, skipping")
                continue

            if not should_process_game(game_id, is_backfill):
                print(f"   Skipping game_id={game_id} due to time restrictions")
                continue

            print(f"\n◆ Processing game_id={game_id}")
            df_idx = pd.read_csv(path, dtype=str)
            all_logs = []
            
            cache_hits = 0
            for i, idx in enumerate(df_idx["index"]):
                if i % 5 == 0 or i == len(df_idx["index"]) - 1:
                    print(f"   Processing index {i+1}/{len(df_idx['index'])}: {idx}", end='\r')
                
                recs = fetch_pitches_for_index_with_cache(page, game_id, idx)
                if recs:
                    all_logs.extend(recs)
                    if load_from_cache(get_cache_key(game_id, idx)):
                        cache_hits += 1

            if all_logs:
                df_logs = pd.DataFrame(all_logs)
                df_logs.to_csv(out_csv, index=False, encoding="utf-8-sig")
                print(f"\n   ✅ Saved {len(df_logs)} records → {out_csv}")
                print(f"   📊 Cache hits: {cache_hits}/{len(df_idx)} ({cache_hits/len(df_idx)*100:.1f}%)")
            else:
                print(f"\n   ⚠ No pitch logs collected for game_id={game_id}")

            # Circuit breaker が開いている場合は処理を停止
            if circuit_breaker_state['is_open']:
                print(f"🚨 Circuit breaker is open, stopping processing")
                break

        context.close()
        browser.close()
        
    print(f"\n🎯 Step 3 Complete — check {OUTPUT_DIR}")
    print(f"📊 Final circuit breaker state: {circuit_breaker_state['failures']} failures")

if __name__ == "__main__":
    main()