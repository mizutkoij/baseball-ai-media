import glob
import os
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
import random
import hashlib
import json
from urllib.robotparser import RobotFileParser
from datetime import datetime, timedelta

# — 設定 —
GAME_INFO_DIR = "fetch/data/game_info"  # 日別スケジュールCSVフォルダ
OUTPUT_DIR    = "data/valid_indexes"    # 打席インデックス出力先
CACHE_DIR     = "data/cache/indexes"    # HTMLキャッシュディレクトリ
ROBOTS_CACHE  = "data/cache/robots.txt" # robots.txtキャッシュ

# レート制限設定（強化）
MIN_DELAY = 5.0  # 最小待機時間（秒）
MAX_DELAY = 10.0 # 最大待機時間（秒）
CIRCUIT_BREAKER_THRESHOLD = 5  # 連続失敗でサーキットブレーカー作動
CIRCUIT_BREAKER_COOLDOWN = 300  # クールダウン時間（秒）

# 識別子設定
USER_AGENT = "Mozilla/5.0 (compatible; NPB-DataCollector/1.0; +contact@example.com)"
FROM_HEADER = "contact@example.com"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(os.path.dirname(ROBOTS_CACHE), exist_ok=True)

# Circuit Breaker状態
circuit_breaker_state = {
    'failures': 0,
    'last_failure': None,
    'is_open': False
}

def check_robots_txt():
    """
    robots.txtを確認して、アクセス可能かチェック
    """
    try:
        # キャッシュからrobots.txtを読み込み（24時間有効）
        if os.path.exists(ROBOTS_CACHE):
            cache_age = time.time() - os.path.getmtime(ROBOTS_CACHE)
            if cache_age < 86400:  # 24時間
                with open(ROBOTS_CACHE, 'r', encoding='utf-8') as f:
                    robots_content = f.read()
            else:
                robots_content = None
        else:
            robots_content = None
        
        if not robots_content:
            # robots.txtを取得
            response = requests.get('https://baseball.yahoo.co.jp/robots.txt', timeout=10)
            robots_content = response.text
            
            # キャッシュに保存
            with open(ROBOTS_CACHE, 'w', encoding='utf-8') as f:
                f.write(robots_content)
        
        # robots.txtをパース
        rp = RobotFileParser()
        rp.set_url('https://baseball.yahoo.co.jp/robots.txt')
        rp.read()
        
        # /npb/game/ へのアクセスが許可されているかチェック
        can_fetch = rp.can_fetch(USER_AGENT, 'https://baseball.yahoo.co.jp/npb/game/')
        
        if not can_fetch:
            print("⚠️ robots.txt により /npb/game/ へのアクセスが禁止されています")
            print("NPB公式データソースの使用を推奨します")
            return False
        
        return True
        
    except Exception as e:
        print(f"robots.txt確認エラー: {e}")
        print("robots.txtが確認できませんが、処理を継続します")
        return True

def circuit_breaker_check():
    """
    Circuit Breakerの状態をチェック
    """
    if circuit_breaker_state['is_open']:
        if circuit_breaker_state['last_failure']:
            elapsed = time.time() - circuit_breaker_state['last_failure']
            if elapsed > CIRCUIT_BREAKER_COOLDOWN:
                # クールダウン完了、回復を試行
                circuit_breaker_state['is_open'] = False
                circuit_breaker_state['failures'] = 0
                print(f"🔄 Circuit breaker recovered after {elapsed:.0f}s cooldown")
                return True
            else:
                remaining = CIRCUIT_BREAKER_COOLDOWN - elapsed
                print(f"⚠️ Circuit breaker open - {remaining:.0f}s remaining")
                return False
    
    return True

def record_success():
    """
    成功を記録してCircuit Breakerをリセット
    """
    circuit_breaker_state['failures'] = 0
    circuit_breaker_state['is_open'] = False

def record_failure():
    """
    失敗を記録してCircuit Breakerを更新
    """
    circuit_breaker_state['failures'] += 1
    circuit_breaker_state['last_failure'] = time.time()
    
    if circuit_breaker_state['failures'] >= CIRCUIT_BREAKER_THRESHOLD:
        circuit_breaker_state['is_open'] = True
        print(f"🚨 Circuit breaker opened after {circuit_breaker_state['failures']} failures")

def get_cache_path(url):
    """
    URLからキャッシュファイルパスを生成
    """
    url_hash = hashlib.md5(url.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{url_hash}.json")

def get_cached_response(url, max_age_hours=24):
    """
    キャッシュからレスポンスを取得（24時間有効）
    """
    cache_path = get_cache_path(url)
    
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            cache_time = datetime.fromisoformat(cache_data['timestamp'])
            if datetime.now() - cache_time < timedelta(hours=max_age_hours):
                return cache_data['content']
        except Exception as e:
            print(f"キャッシュ読み込みエラー: {e}")
    
    return None

def save_to_cache(url, content):
    """
    レスポンスをキャッシュに保存
    """
    cache_path = get_cache_path(url)
    
    try:
        cache_data = {
            'url': url,
            'content': content,
            'timestamp': datetime.now().isoformat()
        }
        
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False)
    except Exception as e:
        print(f"キャッシュ保存エラー: {e}")

def safe_request(url, session):
    """
    レート制限・エラーハンドリング・キャッシュ対応のリクエスト
    """
    # Circuit Breaker チェック
    if not circuit_breaker_check():
        return None
    
    # キャッシュ確認
    cached_content = get_cached_response(url)
    if cached_content:
        record_success()
        return cached_content
    
    # レート制限
    sleep_time = random.uniform(MIN_DELAY, MAX_DELAY)
    print(f"  Waiting {sleep_time:.1f}s before request...")
    time.sleep(sleep_time)
    
    try:
        headers = {
            'User-Agent': USER_AGENT,
            'From': FROM_HEADER,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        response = session.get(url, headers=headers, timeout=15)
        
        # ステータスコード確認
        if response.status_code == 429:
            # Too Many Requests - Retry-Afterヘッダーを確認
            retry_after = response.headers.get('Retry-After')
            if retry_after:
                wait_time = int(retry_after)
                print(f"⚠️ Rate limited (429) - waiting {wait_time}s as requested")
                time.sleep(wait_time)
            else:
                # 指数バックオフ
                wait_time = min(300, 2 ** circuit_breaker_state['failures'])
                print(f"⚠️ Rate limited (429) - exponential backoff {wait_time}s")
                time.sleep(wait_time)
            
            record_failure()
            return None
        
        elif response.status_code == 503:
            # Service Unavailable
            print(f"⚠️ Service unavailable (503) - backing off")
            record_failure()
            return None
        
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        
        # キャッシュに保存
        save_to_cache(url, response.text)
        record_success()
        
        return response.text
        
    except requests.exceptions.RequestException as e:
        print(f"Request error for {url}: {e}")
        record_failure()
        return None

def extract_index_links_from_score_page(game_id: str, session: requests.Session) -> list[str]:
    """
    リンクスキャン方式: /score ページから全ての有効なindexリンクを抽出
    """
    score_url = f"https://baseball.yahoo.co.jp/npb/game/{game_id}/score"
    
    print(f"📋 Scanning index links from score page: {game_id}")
    
    html = safe_request(score_url, session)
    if not html:
        print(f"  ❌ Failed to fetch score page for {game_id}")
        return []
    
    soup = BeautifulSoup(html, "html.parser")
    
    # 打席選択のセレクトボックスやリンクからindexを抽出
    valid_indexes = set()
    
    # 方法1: selectタグのoptionからindex値を抽出
    select_tags = soup.find_all('select')
    for select in select_tags:
        options = select.find_all('option')
        for option in options:
            if 'value' in option.attrs:
                value = option['value']
                # indexの形式をチェック（例: 010100, 010200 など）
                if re.match(r'\d{6}', value):
                    valid_indexes.add(value)
    
    # 方法2: ?index= を含むリンクからindex値を抽出
    links = soup.find_all('a', href=True)
    for link in links:
        href = link['href']
        match = re.search(r'[?&]index=(\d{6})', href)
        if match:
            valid_indexes.add(match.group(1))
    
    # 方法3: JavaScriptで動的に生成される場合の対応
    # data-index 属性やクラス名からindex値を推測
    data_elements = soup.find_all(attrs={'data-index': True})
    for elem in data_elements:
        index_value = elem['data-index']
        if re.match(r'\d{6}', index_value):
            valid_indexes.add(index_value)
    
    sorted_indexes = sorted(list(valid_indexes))
    
    if sorted_indexes:
        print(f"  ✅ Found {len(sorted_indexes)} index links via scanning")
        return sorted_indexes
    else:
        print(f"  ⚠️ No index links found via scanning - falling back to adjacent navigation")
        return extract_via_adjacent_navigation(game_id, session)

def extract_via_adjacent_navigation(game_id: str, session: requests.Session) -> list[str]:
    """
    隣接遷移方式: 最初のindexから「前/次」リンクを辿って全打席をカバー
    """
    print(f"🔄 Using adjacent navigation for {game_id}")
    
    # 開始点を見つける（通常は最初の打席: 010100）
    start_indexes = ['010100', '010101', '010200', '020100']
    
    valid_indexes = set()
    visited = set()
    
    for start_idx in start_indexes:
        if start_idx in visited:
            continue
            
        current_idx = start_idx
        base_url = f"https://baseball.yahoo.co.jp/npb/game/{game_id}/score?index="
        
        while current_idx and current_idx not in visited:
            visited.add(current_idx)
            url = base_url + current_idx
            
            html = safe_request(url, session)
            if not html:
                break
            
            soup = BeautifulSoup(html, "html.parser")
            
            # splitsTableがあれば有効なindex
            if soup.select_one("table.bb-splitsTable"):
                valid_indexes.add(current_idx)
                print(f"  ✅ Valid index found: {current_idx}")
            
            # 次のindexを探す
            next_idx = None
            
            # 「次へ」リンクを探す
            next_links = soup.find_all('a', href=True)
            for link in next_links:
                href = link['href']
                text = link.get_text(strip=True)
                
                if '次' in text or 'next' in text.lower():
                    match = re.search(r'[?&]index=(\d{6})', href)
                    if match:
                        next_idx = match.group(1)
                        break
            
            # リンクが見つからない場合は順序推測
            if not next_idx:
                next_idx = guess_next_index(current_idx)
            
            current_idx = next_idx
            
            # 無限ループ防止
            if len(visited) > 500:  # 異常に多い場合は停止
                print(f"  ⚠️ Too many indexes visited, stopping navigation")
                break
    
    return sorted(list(valid_indexes))

def guess_next_index(current_idx: str) -> str:
    """
    現在のindexから次のindexを推測
    """
    if len(current_idx) != 6:
        return None
    
    try:
        inning = int(current_idx[:2])
        side = int(current_idx[2])
        batter = int(current_idx[3:5])
        pitch = int(current_idx[5])
        
        # 同じ打席の次の球
        if pitch == 0:
            return f"{inning:02d}{side}{batter:02d}01"
        
        # 次の打者
        if batter < 9:
            return f"{inning:02d}{side}{batter+1:02d}00"
        
        # 次のイニング（表→裏、裏→次イニング表）
        if side == 1:
            return f"{inning:02d}2{1:02d}00"
        else:
            return f"{inning+1:02d}1{1:02d}00"
            
    except ValueError:
        return None

def extract_valid_indexes(game_id: str) -> list[str]:
    """
    改善版: リンクスキャン + 隣接遷移でindexを抽出
    """
    with requests.Session() as session:
        # まずリンクスキャンを試行
        indexes = extract_index_links_from_score_page(game_id, session)
        
        # リンクスキャンで見つからない場合は隣接遷移
        if not indexes:
            indexes = extract_via_adjacent_navigation(game_id, session)
        
        return indexes

def main():
    print("▶ Step 2 (Improved): Extracting valid indexes via link scanning")
    
    # robots.txt確認
    if not check_robots_txt():
        print("❌ robots.txtによりアクセスが制限されています")
        print("NPB公式データソースを優先して使用してください")
        return
    
    # 日別CSVを読み込んで結合
    csvs = sorted(glob.glob(os.path.join(GAME_INFO_DIR, "*.csv")))
    if not csvs:
        raise FileNotFoundError(f"No CSV files found in {GAME_INFO_DIR}. Please run step_1_schedule_scraper.py first.")

    dataframes = []
    for p in csvs:
        try:
            if os.path.getsize(p) == 0:
                continue
            df_temp = pd.read_csv(p, dtype=str)
            if not df_temp.empty:
                dataframes.append(df_temp)
        except Exception as e:
            print(f"Error reading {p}: {e}")

    if not dataframes:
        print("⚠ No valid game info data found")
        return

    df = pd.concat(dataframes, ignore_index=True)

    # 試合終了している最新の試合をテスト対象にする
    df['試合日_dt'] = pd.to_datetime(df['試合日'])
    df_sorted = df.sort_values(by='試合日_dt', ascending=False)
    
    test_row = None
    for index, row in df_sorted.iterrows():
        if row["試合状態"] == "試合終了":
            test_row = row
            break
            
    if test_row is None:
        print("⚠ 処理できる『試合終了』の試合が見つかりませんでした")
        return

    test_gid = test_row["game_id"]
    print(f"🎯 Testing improved extraction for game_id={test_gid}")
    
    start_time = time.time()
    indexes = extract_valid_indexes(test_gid)
    elapsed = time.time() - start_time
    
    if indexes:
        out = os.path.join(OUTPUT_DIR, f"valid_indexes_{test_gid}.csv")
        pd.DataFrame(indexes, columns=["index"]).to_csv(out, index=False, encoding="utf-8-sig")
        print(f"✅ Extracted {len(indexes)} indexes in {elapsed:.1f}s → {out}")
        
        # リクエスト削減効果を表示
        estimated_old_requests = 9 * 9 * 2 * 2 * get_max_inning(test_gid)  # 旧方式の推定リクエスト数
        actual_requests = circuit_breaker_state.get('total_requests', len(indexes) + 1)
        reduction = max(0, estimated_old_requests - actual_requests)
        
        print(f"📊 Request reduction: {reduction} fewer requests vs brute-force")
        print(f"🔄 Circuit breaker state: {circuit_breaker_state['failures']} failures")
    else:
        print(f"⚠ No indexes found for game_id={test_gid}")

def get_max_inning(game_id: str) -> int:
    """
    スコア表から最大イニング数を取得（キャッシュ対応）
    """
    url = f"https://baseball.yahoo.co.jp/npb/game/{game_id}/score"
    
    try:
        with requests.Session() as session:
            html = safe_request(url, session)
            if not html:
                return 9
                
            soup = BeautifulSoup(html, "html.parser")
            ths = soup.select("table.bb-gameScoreTable thead th")
            if ths and len(ths) >= 4:
                return len(ths) - 3
    except Exception as e:
        print(f"Error getting max inning for {game_id}: {e}")
    
    return 9

if __name__ == "__main__":
    main()