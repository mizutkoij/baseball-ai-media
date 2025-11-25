#!/usr/bin/env python3
"""
Yahoo scraper の INSERT 文修正スクリプト
"""

import re

# 修正内容
old_pattern = r'''INSERT OR IGNORE INTO pitch_data 
                                \(game_id, index_code, pitcher_name, batter_name, pitch_sequence,
                                 pitch_type, velocity, result, count, zone, runners\)
                                VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)'''

new_pattern = '''INSERT OR IGNORE INTO pitch_data 
                                (game_id, index_code, pitcher_name, batter_name, pitch_sequence,
                                 pitch_type, velocity, result, count_balls, count_strikes, zone_name, runners)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''

# ファイル読み込み
with open('yahoo_scraper_production_ready.py', 'r', encoding='utf-8') as f:
    content = f.read()

# パターン置換
content_fixed = re.sub(
    r"INSERT OR IGNORE INTO pitch_data.*?VALUES.*?\)",
    new_pattern,
    content,
    flags=re.DOTALL
)

# pitch辞書のアクセス部分も修正が必要
# count -> count_balls, count_strikes に分割
# zone -> zone_name に変更
content_fixed = content_fixed.replace(
    "pitch['count'], pitch['zone'], pitch['runners']",
    "pitch.get('count_balls', 0), pitch.get('count_strikes', 0), pitch.get('zone_name', ''), pitch['runners']"
)

# ファイル書き込み
with open('yahoo_scraper_production_ready_fixed.py', 'w', encoding='utf-8') as f:
    f.write(content_fixed)

print("✅ Yahoo scraper修正完了")
print("修正ファイル: yahoo_scraper_production_ready_fixed.py")