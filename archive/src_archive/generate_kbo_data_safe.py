#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_kbo_data_safe.py
=========================
KBO選手データを安全に生成（Unicodeエンコード問題回避）
"""

import json
import random
from datetime import datetime
import os

# KBOチーム情報（英語のみで安全に）
KBO_TEAMS = {
    'Doosan Bears': {
        'city': 'Seoul',
        'stadium': 'Jamsil Baseball Stadium',
        'founded': 1982,
        'short_name': 'Doosan'
    },
    'Hanwha Eagles': {
        'city': 'Daejeon', 
        'stadium': 'Daejeon Hanwha Life Ballpark',
        'founded': 1985,
        'short_name': 'Hanwha'
    },
    'Kia Tigers': {
        'city': 'Gwangju',
        'stadium': 'Gwangju-Kia Champions Field', 
        'founded': 1982,
        'short_name': 'KIA'
    },
    'Kiwoom Heroes': {
        'city': 'Seoul',
        'stadium': 'Gocheok Sky Dome',
        'founded': 2008,
        'short_name': 'Kiwoom'
    },
    'KT Wiz': {
        'city': 'Suwon',
        'stadium': 'Suwon kt wiz Park',
        'founded': 2013,
        'short_name': 'KT'
    },
    'LG Twins': {
        'city': 'Seoul',
        'stadium': 'Jamsil Baseball Stadium',
        'founded': 1982,
        'short_name': 'LG'
    },
    'Lotte Giants': {
        'city': 'Busan',
        'stadium': 'Sajik Baseball Stadium',
        'founded': 1982,
        'short_name': 'Lotte'
    },
    'NC Dinos': {
        'city': 'Changwon',
        'stadium': 'Changwon NC Park',
        'founded': 2013,
        'short_name': 'NC'
    },
    'Samsung Lions': {
        'city': 'Daegu',
        'stadium': 'Daegu Samsung Lions Park',
        'founded': 1982,
        'short_name': 'Samsung'
    },
    'SSG Landers': {
        'city': 'Incheon',
        'stadium': 'Incheon SSG Landers Field',
        'founded': 2000,
        'short_name': 'SSG'
    }
}

# 韓国系選手名（ローマ字）
KOREAN_PLAYER_NAMES = [
    'Kim Min-su', 'Lee Ji-hoon', 'Park Hyun-woo', 'Choi Jun-ho', 'Jung Seong-min',
    'Kang Dong-hyun', 'Cho Won-woo', 'Yoon Si-woo', 'Jang Tae-hyun', 'Lim Gun-woo',
    'Han Su-bin', 'Oh Seo-jun', 'Seo Do-yun', 'Shin Ye-jun', 'Kwon Si-on',
    'Hwang Ha-jun', 'Ahn Ju-won', 'Song Ji-woo', 'Ryu Ji-han', 'Jeon Yeon-woo',
    'Hong Jung-woo', 'Go Seung-woo', 'Moon Min-jae', 'Yang Hyun-su', 'Son Ji-min',
    'Bae Tae-yoon', 'Jo Si-won', 'Baek Min-woong', 'Heo Jae-won', 'Yoo Seung-ho',
    'Nam Woo-jin', 'Sim Kyung-ho', 'Noh Dae-han', 'Jung Min-kyu', 'Ha Joon-seo',
    'Kim Tae-woo', 'Lee Dong-wook', 'Park Sang-hyun', 'Choi Jae-sung', 'Jung Ho-seung'
]

# 外国人選手名
FOREIGN_PLAYER_NAMES = [
    'Aaron Brooks', 'Anthony Alford', 'Brett Phillips', 'Carlos Asuaje',
    'David Freese', 'Eric Thames', 'Felix Hernandez', 'Garrett Jones',
    'Henry Ramos', 'Jake Brigham', 'Jose Fernandez', 'Kevin Cron',
    'Logan Verrett', 'Mike Montgomery', 'Nick Martinez', 'Owen Miller',
    'Preston Tucker', 'Roberto Ramos', 'Socrates Brito', 'Tyler Austin',
    'Victor Caratini', 'Willie Calhoun', 'Xavier Scruggs', 'Yasiel Puig',
    'Mel Rojas Jr.', 'Addison Reed', 'Dan Straily', 'William Cuevas'
]

def generate_kbo_player(team_name, player_id):
    """KBO選手データを生成"""
    team_info = KBO_TEAMS.get(team_name, {})
    
    # 韓国人選手 (75%) vs 外国人選手 (25%)
    is_foreign = random.random() < 0.25
    
    if is_foreign:
        name = random.choice(FOREIGN_PLAYER_NAMES)
        nationality = random.choice(['USA', 'VEN', 'DOM', 'CUB', 'MEX', 'PAN'])
    else:
        name = random.choice(KOREAN_PLAYER_NAMES)
        nationality = 'KOR'
    
    # ポジション
    positions = ['Pitcher', 'Catcher', '1st Base', '2nd Base', '3rd Base', 
                'Shortstop', 'Left Field', 'Center Field', 'Right Field']
    position = random.choice(positions)
    position_abbr = random.choice(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'])
    
    # 基本情報
    age = random.randint(20, 38)
    birth_year = 2024 - age
    height = random.randint(165, 200)
    weight = random.randint(65, 110)
    
    # 投打
    bats = random.choice(['R', 'L', 'S'])
    throws = random.choice(['R', 'L'])
    
    return {
        'player_id': f"KBO_{player_id:04d}",
        'full_name': name,
        'current_team': team_name,
        'team_code': team_info.get('short_name', team_name[:3].upper()),
        'primary_position': position,
        'position_abbr': position_abbr,
        'jersey_number': random.randint(1, 99),
        'age': age,
        'birth_year': birth_year,
        'height_cm': height,
        'weight_kg': weight,
        'nationality': nationality,
        'league': 'kbo',
        'team_level': 'Pro',
        'bats': bats,
        'throws': throws,
        'career_status': 'active',
        'team_city': team_info.get('city', ''),
        'stadium': team_info.get('stadium', ''),
        'created_at': datetime.now().isoformat()
    }

def main():
    print("Generating KBO Player Database")
    print("="*50)
    
    all_players = []
    player_id_counter = 1
    
    # 各チームの選手を生成
    for team_name, team_info in KBO_TEAMS.items():
        print(f"Generating players for {team_name}")
        
        # チームあたり25-35人の選手を生成
        num_players = random.randint(25, 35)
        
        for i in range(num_players):
            player = generate_kbo_player(team_name, player_id_counter)
            all_players.append(player)
            player_id_counter += 1
            
        print(f"  Generated {num_players} players")
    
    print(f"\nTotal KBO players generated: {len(all_players)}")
    
    # チーム情報も保存
    teams_data = []
    for team_name, team_info in KBO_TEAMS.items():
        teams_data.append({
            'team_id': f"KBO_{team_info['short_name']}",
            'team_name': team_name,
            'city': team_info['city'],
            'stadium': team_info['stadium'],
            'founded': team_info['founded'],
            'league': 'kbo',
            'short_name': team_info['short_name']
        })
    
    # ディレクトリ作成
    os.makedirs('data/kbo_generated', exist_ok=True)
    
    # ファイル保存
    players_file = 'data/kbo_generated/kbo_players.json'
    with open(players_file, 'w', encoding='utf-8') as f:
        json.dump(all_players, f, indent=2, ensure_ascii=False)
    
    teams_file = 'data/kbo_generated/kbo_teams.json'
    with open(teams_file, 'w', encoding='utf-8') as f:
        json.dump(teams_data, f, indent=2, ensure_ascii=False)
    
    # サマリー
    summary = {
        'generation_date': datetime.now().isoformat(),
        'total_players': len(all_players),
        'total_teams': len(teams_data),
        'teams': list(KBO_TEAMS.keys()),
        'source': 'Generated from Wikipedia KBO team data',
        'note': 'Safe ASCII-compatible names used to avoid encoding issues'
    }
    
    summary_file = 'data/kbo_generated/generation_summary.json'
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"\nFiles created:")
    print(f"  Players: {players_file}")
    print(f"  Teams: {teams_file}")
    print(f"  Summary: {summary_file}")
    
    # チーム別統計（コンソール出力を安全に）
    print(f"\nTeam breakdown:")
    team_stats = {}
    for player in all_players:
        team = player['current_team']
        team_stats[team] = team_stats.get(team, 0) + 1
    
    for team, count in sorted(team_stats.items()):
        print(f"  {team}: {count} players")
    
    # 国籍統計
    nationality_stats = {}
    for player in all_players:
        nat = player['nationality']
        nationality_stats[nat] = nationality_stats.get(nat, 0) + 1
    
    print(f"\nNationality breakdown:")
    for nat, count in sorted(nationality_stats.items(), key=lambda x: x[1], reverse=True):
        print(f"  {nat}: {count} players")

if __name__ == "__main__":
    main()