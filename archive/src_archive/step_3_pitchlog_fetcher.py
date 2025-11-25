# step_3_pitchlog_fetcher_playwright.py (修正版)

import glob, os, re, time, pandas as pd
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

VALID_IDX_DIR   = "data/valid_indexes"
OUTPUT_DIR      = "data/pitch_logs_playwright"
DEBUG_HTML_DIR  = "data/debug_html"  # ★変更点: デバッグHTML用のベースディレクトリを定義
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DEBUG_HTML_DIR, exist_ok=True) # ベースディレクトリも作成

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

def fetch_pitches_for_index(page, game_id, idx):
    """
    指定されたgame_idとindexの一球速報、配球チャート、打者/投手/走者データを取得する。
    """
    url = f"https://baseball.yahoo.co.jp/npb/game/{game_id}/score?index={idx}"
    page.goto(url, timeout=30000)

    # ★変更点: 試合ごとのHTML保存用ディレクトリを作成
    game_html_dir = os.path.join(DEBUG_HTML_DIR, game_id)
    os.makedirs(game_html_dir, exist_ok=True)

    try:
        page.wait_for_selector("div#async-fieldBody", timeout=20000)
    except Exception as e:
        print(f"   Error: div#async-fieldBody not found for {url}. Saving HTML for inspection.")
        # ★変更点: 保存先を試合別ディレクトリに変更
        error_html_path = os.path.join(game_html_dir, f"error_{idx}_no_main_content.html")
        with open(error_html_path, "w", encoding="utf-8") as f:
            f.write(page.content())
        return []

    html = page.content()
    # ★変更点: 保存先を試合別ディレクトリに変更
    success_html_path = os.path.join(game_html_dir, f"success_{idx}_full.html")
    with open(success_html_path, "w", encoding="utf-8") as f:
        f.write(html)
        
    soup = BeautifulSoup(html, "html.parser")

    # --- (以降の解析ロジックは変更なし) ---
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
        print(f"   Warning: Extracted headers do not match for {url}. Headers: {headers}")
        return []

    rows = table.select("tbody tr")
    
    pitch_logs = []
    if not headers:
        print(f"   Error: Headers list is empty for {url}")
        return []

    for i, tr in enumerate(rows, start=1):
        if not tr.select_one("td span.bb-icon__ballCircle"):
            continue 

        cells = [td.text.strip() for td in tr.select("td")]
        
        if len(cells) != len(headers):
            print(f"   Warning: Cell count ({len(cells)}) does not match header count ({len(headers)}) for pitch {i} in {url}.")
            continue
            
        rec = dict(zip(headers, cells))
        if '球速' in rec and rec['球速'] == '-':
            rec['球速'] = None 
            print(f"   Set speed to None for pitch {i} in {url} as it was '-'.")

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
        else:
            print(f"   Warning: Could not extract coordinates from style for pitch {no} in {url}")

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

    for rec in pitch_logs:
        no = rec["pitch_no"]
        if no in locs:
            x, y = locs[no]
            rec["x_px"], rec["y_px"] = x, y
            rec["zone"] = classify_zone(y, x)
        else:
            rec["x_px"] = rec["y_px"] = rec["zone"] = None
            print(f"   Warning: Pitch {no} from {url} has no corresponding pitch chart location.")

    return pitch_logs

def main():
    print("▶ Step 3 (Playwright): Fetching pitch logs + charts")
    csvs = sorted(glob.glob(f"{VALID_IDX_DIR}/valid_indexes_*.csv"))
    if not csvs:
        raise FileNotFoundError(f"No valid_indexes CSVs in {VALID_IDX_DIR}. Run step_2 first.")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True) 
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36")

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
            if os.path.exists(out_csv):
                print(f"   Output file already exists for game_id={game_id}. Skipping: {out_csv}")
                continue

            print(f"\n◆ game_id={game_id}")
            df_idx = pd.read_csv(path, dtype=str)
            all_logs = []
            
            for i, idx in enumerate(df_idx["index"]):
                if i % 10 == 0 or i == len(df_idx["index"]) - 1:
                    print(f"   Processing index {i+1}/{len(df_idx['index'])}: {idx}", end='\r')
                
                recs = fetch_pitches_for_index(page, game_id, idx)
                if recs:
                    all_logs.extend(recs)
                time.sleep(0.2)

            if all_logs:
                df_logs = pd.DataFrame(all_logs)
                df_logs.to_csv(out_csv, index=False, encoding="utf-8-sig")
                print(f"\n   ✅ Saved {len(df_logs)} records → {out_csv}")
            else:
                print(f"\n   ⚠ No pitch logs collected for game_id={game_id}")

        browser.close()
    print("\n🎯 Step 3 Complete — check the pitch_logs_playwright folder.")

if __name__ == "__main__":
    main()