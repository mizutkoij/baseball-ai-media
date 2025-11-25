import glob
import os
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
import random # randomモジュールを追加

# — 設定 —
GAME_INFO_DIR = "fetch/data/game_info"  # 日別スケジュールCSVフォルダ
OUTPUT_DIR    = "data/valid_indexes"    # 打席インデックス出力先

# 複数のUser-Agentを用意し、ランダムに選択して使用
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
]

os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_max_inning(game_id: str) -> int:
    """
    スコア表 (/score) から「何イニングまでスコアがあるか」を取得。
    """
    url = f"https://baseball.yahoo.co.jp/npb/game/{game_id}/score"
    try:
        # requests.Session() を利用
        with requests.Session() as session:
            # ランダムなUser-Agentを選択
            current_user_agent = random.choice(USER_AGENTS)
            headers = {"User-Agent": current_user_agent}
            r = session.get(url, headers=headers, timeout=10)
        r.encoding = r.apparent_encoding
        soup = BeautifulSoup(r.text, "html.parser")

        # イニング列ヘッダは <table class="bb-gameScoreTable"> の最上部にある th 要素
        ths = soup.select("table.bb-gameScoreTable thead th")
        if ths and len(ths) >= 4:
            # 先頭3列("チーム名","計","安","失") を除いた数がイニング数
            return len(ths) - 3
    except requests.exceptions.RequestException as e:
        print(f"Error fetching max inning for {game_id}: {e}. Skipping this game for max inning check.")
    except Exception as e:
        print(f"An unexpected error occurred in get_max_inning for {game_id}: {e}. Skipping this game for max inning check.")

    # fallback: 9回まで (エラー時や取得できなかった場合)
    return 9


def extract_valid_indexes(game_id: str) -> list[str]:
    """
    イニング数に合わせて candidate index を作成し、
    /score?index=… ページに splitsTable があれば採用する brute-force。
    """
    max_inn = get_max_inning(game_id)
    valid = []
    base_url = f"https://baseball.yahoo.co.jp/npb/game/{game_id}/score?index="

    # requests.Session() を利用
    with requests.Session() as session:
        for inning in range(1, max_inn + 1):
            for side in ("1", "2"):          # 表=1, 裏=2
                for batter in range(1, 10):  # 打者1番〜9番
                    prefix = f"{inning:02d}{side}{batter:02d}"
                    for suffix in ("00", "01"):  # 打席開始/中続き
                        idx = prefix + suffix
                        url = base_url + idx
                        try:
                            # ランダムなUser-Agentを選択
                            current_user_agent = random.choice(USER_AGENTS)
                            headers = {"User-Agent": current_user_agent}
                            resp = session.get(url, headers=headers, timeout=10)
                            resp.encoding = resp.apparent_encoding
                            soup = BeautifulSoup(resp.text, "html.parser")
                            # 一球速報テーブルがあるか？
                            if soup.select_one("table.bb-splitsTable"):
                                valid.append(idx)
                            else:
                                # splitsTableがない場合は、それ以降のsuffixは確認しないことが多い
                                # break
                                pass # 今回はsuffixが2種類なのでそのまま続行

                        except requests.exceptions.RequestException as e:
                            # ネットワークエラーやタイムアウトの場合
                            print(f"Network error for {url}: {e}. Skipping this index.")
                        except Exception as e:
                            # その他のエラー
                            print(f"An unexpected error occurred for {url}: {e}. Skipping this index.")
                        
                        # サーバー負荷軽減とアクセスパターンの多様化
                        # 3秒から7秒の間のランダムな時間で待機
                        sleep_time = random.uniform(3, 7)
                        print(f"Waiting for {sleep_time:.2f} seconds before next request...")
                        time.sleep(sleep_time)

    return sorted(set(valid))


def main():
    # — 日別CSVを読み込んで結合 —
    csvs = sorted(glob.glob(os.path.join(GAME_INFO_DIR, "*.csv")))
    if not csvs:
        raise FileNotFoundError(f"No CSV files found in {GAME_INFO_DIR}. Please run step_1_schedule_scraper.py first.")

    # デバッグ用出力 (前回追加したもの)
    print(f"現在設定されているGAME_INFO_DIR: {GAME_INFO_DIR}")
    print(f"globで検出されたCSVファイルパス:")
    if csvs:
        for csv_path in csvs:
            print(f"  - {csv_path}")
            if os.path.exists(csv_path):
                print(f"    ファイルサイズ: {os.path.getsize(csv_path)} bytes")
            else:
                print(f"    ファイルが見つかりません: {csv_path}")
    else:
        print(f"  ⚠ {GAME_INFO_DIR} にCSVファイルが見つかりませんでした。パスを確認してください。")

    dataframes = []
    for p in csvs:
        try:
            # ファイルサイズが0バイトの場合はスキップ
            if os.path.getsize(p) == 0:
                print(f"Skipping empty file (0 bytes, likely no games on this day): {p}")
                continue

            # CSVを読み込み、空のDataFrameでなければ追加
            df_temp = pd.read_csv(p, dtype=str)
            if not df_temp.empty:
                dataframes.append(df_temp)
            else:
                # ファイルサイズは0ではないが、ヘッダーのみでデータ行がない場合
                print(f"Skipping CSV file with no data rows (only header): {p}")
        except pd.errors.EmptyDataError:
            # pandasが空ファイルまたは列なしと判断した場合
            print(f"Skipping CSV file with no columns to parse (EmptyDataError): {p}")
        except Exception as e:
            # その他の予期せぬエラー
            print(f"An unexpected error occurred while reading {p}: {e}. Skipping this file.")

    if not dataframes:
        print("⚠ No valid game info data found across all CSVs after filtering empty files.")
        print("   Ensure step_1_schedule_scraper.py has run successfully and generated data.")
        return

    df = pd.concat(dataframes, ignore_index=True)

    # — テスト: 最新の「試合終了」の試合をターゲットにする —
    # '試合日' 列を datetime 型に変換し、日付の新しい順にソート
    df['試合日_dt'] = pd.to_datetime(df['試合日'])
    df_sorted = df.sort_values(by='試合日_dt', ascending=False)
    
    # 試合終了している最初の試合を探す
    test_row = None
    for index, row in df_sorted.iterrows():
        # "試合中止" や "ノーゲーム" ではない "試合終了" の試合を探す
        if row["試合状態"] == "試合終了" and "中止" not in row["試合状態"] and "ノーゲーム" not in row["試合状態"]:
            test_row = row
            break
            
    if test_row is None:
        print("⚠ 処理できる『試合終了』の試合が見つかりませんでした。")
        print("   step_1_schedule_scraper.py で取得期間やVALID_STATUSを確認してください。")
        print("   または、取得したCSVファイル内に『試合終了』の試合データが含まれていない可能性があります。")
        return

    test_gid = test_row["game_id"]
    test_status = test_row["試合状態"]

    print(f"▶ Test extracting for game_id={test_gid} (Status: {test_status})")
    idxs = extract_valid_indexes(test_gid)
    if not idxs:
        print(f"⚠ No plate appearances found for test game_id={test_gid}.")
    else:
        out = os.path.join(OUTPUT_DIR, f"valid_indexes_{test_gid}.csv")
        pd.DataFrame(idxs, columns=["index"])\
          .to_csv(out, index=False, encoding="utf-8-sig")
        print(f"✅ Extracted {len(idxs)} indexes → {out}")
        print(idxs)

    # — 本番用: 全試合ループに拡大する場合は、この上のテスト部分をコメントアウトし、下の行のコメントを解除してください —
    # for _, row in df.iterrows():
    #     gid, status = row["game_id"], row["試合状態"]
    #     if "中止" in status or "ノーゲーム" in status: # 中止やノーゲームの試合はスキップ
    #         print(f"▶ Skipping game_id={gid} (Status: {status})")
    #         continue
    #     
    #     print(f"▶ Extracting for game_id={gid} (Status: {status})")
    #     all_idxs = extract_valid_indexes(gid)
    #     if all_idxs:
    #         outp = os.path.join(OUTPUT_DIR, f"valid_indexes_{gid}.csv")
    #         pd.DataFrame(all_idxs, columns=["index"])\
    #           .to_csv(outp, index=False, encoding="utf-8-sig")
    #         print(f"   ✅ {len(all_idxs)} indexes saved to {outp}")
    #     else:
    #         print(f"   ⚠ No plate appearances found for game_id={gid}.")

if __name__ == "__main__":
    main()