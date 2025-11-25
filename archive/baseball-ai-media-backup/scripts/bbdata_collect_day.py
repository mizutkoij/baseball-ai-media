# scripts/bbdata_collect_day.py
import argparse, csv, gzip, json, time
from pathlib import Path
import sys; sys.path.append(".")
from datetime import datetime
from lib.bbdata_client import BBDataClient
from lib.bbdata_extractors import parse_dashboard_for_player_links, parse_playerP_summary, parse_detail_for_pitches
from lib.discord_csv_notifier import send_csv  # 既存の連携を使用（DATA webhook）
from typing import Dict

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True, help="YYYY-MM-DD")
    ap.add_argument("--out", default="data/bbdata", help="output root")
    ap.add_argument("--sleep-sec", type=float, default=15.0)
    ap.add_argument("--max-pages", type=int, default=400)
    ap.add_argument("--discord", action="store_true")
    args = ap.parse_args()

    day = args.date.replace("-", "")
    out_root = Path(args.out) / f"date={args.date}"
    out_root.mkdir(parents=True, exist_ok=True)
    client = BBDataClient(Path(args.out), min_interval_sec=args.sleep_sec)

    # 1) dashboard → プレイヤーページリンク収集
    dash_url = f"https://baseballdata.jp/dashboard.html"
    html = client.fetch(dash_url, cache_key=f"dashboard_{day}")
    links = [lk for lk in parse_dashboard_for_player_links(html) if lk.date == day]
    # リンクが多すぎる場合に備え上限
    links = links[: args.max_pages]

    # 2) 各プレイヤーページ（summary + detail）収集＆解析
    all_rows = []
    for i, lk in enumerate(links, 1):
        try:
            htmlP = client.fetch(lk.url, cache_key=f"{lk.date}_{lk.pid}_{lk.kind}")
            if lk.kind == "P":
                summary = parse_playerP_summary(htmlP)
                (out_root / f"{lk.date}_{lk.pid}_summary.json").write_text(
                    json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                # detailページも追う（存在すれば）
                detail_url = lk.url.replace("P.html", "detail.html")
                htmlD = client.fetch(detail_url, cache_key=f"{lk.date}_{lk.pid}_detail")
                detail = parse_detail_for_pitches(htmlD)
                (out_root / f"{lk.date}_{lk.pid}_detail.json").write_text(
                    json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                # CSV行（座標ありのみ）
                for p in detail.get("pitches", []):
                    row = {
                        "date": args.date,
                        "pid": lk.pid,
                        "balls": p.get("balls"),
                        "strikes": p.get("strikes"),
                        "velocity_kmh": p.get("velocity_kmh"),
                        "pitch_type": p.get("pitch_type"),
                        "x_px": p.get("x_px"),
                        "y_px": p.get("y_px"),
                    }
                    all_rows.append(row)

        except Exception as e:
            # 失敗はスキップ（HTMLは保存済み）／ノイズを出し過ぎない
            (out_root / "errors.log").open("a", encoding="utf-8").write(f"{lk.url}\t{e}\n")
            continue

    # 3) CSV出力（座標）
    if all_rows:
        csv_path = out_root / f"bbdata_pitches_{args.date}.csv"
        with csv_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(all_rows[0].keys()))
            w.writeheader(); w.writerows(all_rows)
        # gzip圧縮
        gz = out_root / f"{csv_path.name}.gz"
        with gzip.open(gz, "wt", encoding="utf-8") as gzf:
            with csv_path.open("r", encoding="utf-8") as src:
                gzf.write(src.read())
        if args.discord:
            send_csv(None, str(gz), title=f"BBData pitches {args.date}")

    # 4) 実績サマリ
    (out_root / "_summary.json").write_text(
        json.dumps({"date": args.date, "links": len(links), "pitches": len(all_rows)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

if __name__ == "__main__":
    main()
