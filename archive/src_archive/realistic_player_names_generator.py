#!/usr/bin/env python3
"""
Realistic Player Names Generator
リアルな選手名データベース生成ツール
NPB: 日本語表記、KBO: カタカナ+漢字、MLB: カタカナ+英語
"""

import sqlite3
import random
from datetime import datetime

def update_npb_players():
    """NPB選手を日本語表記に更新"""
    
    # リアルなNPB選手名（現役・過去の有名選手含む）
    npb_players = [
        # セ・リーグ
        "大谷翔平", "山田哲人", "村上宗隆", "佐藤輝明", "岡本和真",
        "森下暢仁", "高橋宏斗", "山本由伸", "今永昇太", "戸郷翔征",
        "坂本勇人", "丸佳浩", "原口文仁", "宮崎敏郎", "牧秀悟",
        "大島洋平", "平田良介", "阿部慎之助", "会澤翼", "梅野隆太郎",
        
        # パ・リーグ  
        "柳田悠岐", "吉田正尚", "近藤健介", "中村剛也", "浅村栄斗",
        "千賀滉大", "有原航平", "東浜巨", "石川歩", "岸孝之",
        "源田壮亮", "茂木栄五郎", "山川穂高", "森友哉", "甲斐拓也",
        "西川遥輝", "安田尚憲", "鈴木誠也", "秋山翔吾", "金子侑司",
        
        # 追加選手
        "菊池涼介", "田中広輔", "松山竜平", "野間峻祥", "堂林翔太",
        "小川泰弘", "岡田明丈", "九里亜蓮", "床田寛樹", "中﨑翔太",
        "誠也", "長野久義", "亀井善行", "重信慎之介", "松原聖弥",
        "高梨雄平", "戸根千明", "田口麗斗", "山口俊", "菅野智之",
        "伊藤将司", "大城卓三", "岡田悠希", "増田大輝", "湯浅京己",
        "山本泰寛", "糸原健斗", "大山悠輔", "近本光司", "木浪聖也",
        "藤浪晋太郎", "西勇輝", "青柳晃洋", "岩貞祐太", "小川一平"
    ]
    
    conn = sqlite3.connect('comprehensive_baseball_database.db')
    cursor = conn.cursor()
    
    # NPB選手を更新
    cursor.execute("SELECT player_id FROM detailed_players_master WHERE league = 'npb' LIMIT ?", (len(npb_players),))
    npb_ids = cursor.fetchall()
    
    for i, (player_id,) in enumerate(npb_ids):
        if i < len(npb_players):
            cursor.execute("""
                UPDATE detailed_players_master 
                SET full_name = ?, native_name = ?
                WHERE player_id = ?
            """, (npb_players[i], npb_players[i], player_id))
    
    conn.commit()
    conn.close()
    print(f"NPB選手名更新完了: {len(npb_ids)}名")

def update_kbo_players():
    """KBO選手をカタカナ+漢字に更新"""
    
    # リアルなKBO選手名（カタカナ + 漢字）
    kbo_players = [
        # Doosan Bears
        ("ヤン・ウィジ", "梁義智"), ("ホ・ギョンミン", "許京珉"), ("チョ・スハン", "曺秀韓"),
        ("パク・ゴンウ", "朴建雨"), ("イ・ユチャン", "李裕燦"), ("キム・ジェファン", "金在煥"),
        
        # Kia Tigers  
        ("チェ・ヒョンウ", "崔賢雨"), ("キム・ドヨン", "金度然"), ("ナ・ソンボム", "羅成範"),
        ("ソッキ・ナ", "羅誠懃"), ("オ・ユファン", "吳侑桓"), ("パク・チャンホ", "朴贊浩"),
        
        # LG Twins
        ("キム・ヒョンス", "金賢洙"), ("ムン・ボギョン", "文博景"), ("オ・ジファン", "吳志煥"),
        ("ユ・ガンナム", "柳康男"), ("イ・ミンホ", "李民浩"), ("류중일", "柳仲逸"),
        
        # Samsung Lions
        ("キム・サンス", "金相洙"), ("パク・ビョンホ", "朴炳鎬"), ("강민호", "姜珉濠"),
        ("김헌곤", "金憲坤"), ("원태인", "元太仁"), ("백정현", "白政炫"),
        
        # NC Dinos
        ("ソン・ソンムン", "孫聖文"), ("パク・ミンウ", "朴民宇"), ("김성욱", "金成昱"),
        ("마틴", "マーティン"), ("양의지", "梁義智"), ("임창용", "林昌勇"),
        
        # Hanwha Eagles
        ("チェ・ジェフン", "崔在勳"), ("하주석", "河周錫"), ("김인환", "金仁煥"),
        ("김태균", "金泰均"), ("송광민", "宋光民"), ("정우람", "鄭佑任"),
        
        # Lotte Giants
        ("이대호", "李大浩"), ("손아섭", "孫雅燮"), ("전준우", "田俊佑"),
        ("나성범", "羅誠範"), ("고승민", "高承民"), ("윤동희", "尹東熙"),
        
        # SSG Landers
        ("최정", "崔正"), ("한유섬", "韓裕 summarize"), ("박성한", "朴成漢"),
        ("김강민", "金江珉"), ("오원석", "吳元錫"), ("문승원", "文承元"),
        
        # KT Wiz
        ("강백호", "姜白虎"), ("황재균", "黃載鈞"), ("송민섭", "宋民燮"),
        ("김민혁", "金民赫"), ("고영표", "高榮杓"), ("배정대", "裵正大"),
        
        # Kiwoom Heroes
        ("김하성", "金河成"), ("이정후", "李政厚"), ("박동원", "朴東源"),
        ("서건창", "徐建昌"), ("김웅빈", "金雄彬"), ("원종현", "元鍾賢")
    ]
    
    conn = sqlite3.connect('comprehensive_baseball_database.db')
    cursor = conn.cursor()
    
    # KBO選手を更新
    cursor.execute("SELECT player_id FROM detailed_players_master WHERE league = 'kbo' LIMIT ?", (len(kbo_players),))
    kbo_ids = cursor.fetchall()
    
    for i, (player_id,) in enumerate(kbo_ids):
        if i < len(kbo_players):
            katakana_name, hanja_name = kbo_players[i]
            display_name = f"{katakana_name} ({hanja_name})"
            cursor.execute("""
                UPDATE detailed_players_master 
                SET full_name = ?, native_name = ?
                WHERE player_id = ?
            """, (display_name, hanja_name, player_id))
    
    conn.commit()
    conn.close()
    print(f"KBO選手名更新完了: {len(kbo_ids)}名")

def update_mlb_players():
    """MLB選手をカタカナ+英語に更新"""
    
    # リアルなMLB選手名（カタカナ + 英語）
    mlb_players = [
        # アメリカンリーグ
        ("マイク・トラウト", "Mike Trout"), ("アーロン・ジャッジ", "Aaron Judge"), 
        ("ホセ・アルトゥーベ", "Jose Altuve"), ("アレックス・ブレグマン", "Alex Bregman"),
        ("ボー・ビシェット", "Bo Bichette"), ("ブラディミール・ゲレーロJr.", "Vladimir Guerrero Jr."),
        ("フランシスコ・リンドア", "Francisco Lindor"), ("コーリー・シーガー", "Corey Seager"),
        ("サルバドール・ペレス", "Salvador Perez"), ("ベッツ・ムーキー", "Mookie Betts"),
        
        # ナショナルリーグ  
        ("ロナルド・アクーニャJr.", "Ronald Acuna Jr."), ("フアン・ソト", "Juan Soto"),
        ("フレディ・フリーマン", "Freddie Freeman"), ("マニー・マチャド", "Manny Machado"),
        ("ポール・ゴールドシュミット", "Paul Goldschmidt"), ("ノーラン・アレナド", "Nolan Arenado"),
        ("フェルナンド・タティスJr.", "Fernando Tatis Jr."), ("ザック・ウィーラー", "Zack Wheeler"),
        ("シェーン・ビーバー", "Shane Bieber"), ("ゲリット・コール", "Gerrit Cole"),
        
        # 投手
        ("サイ・ヤング", "Cy Young"), ("ジェイコブ・デグロム", "Jacob deGrom"),
        ("マックス・シャーザー", "Max Scherzer"), ("クレイトン・カーショー", "Clayton Kershaw"),
        ("アローリディス・チャップマン", "Aroldis Chapman"), ("ホシュエ・ヘイダー", "Josh Hader"),
        ("エマニュエル・クラス", "Emmanuel Clase"), ("ライアム・ヘンドリックス", "Liam Hendriks"),
        
        # 捕手・内野手
        ("J.T.リアルムート", "J.T. Realmuto"), ("ウィル・スミス", "Will Smith"),
        ("ピート・アロンソ", "Pete Alonso"), ("マット・オルソン", "Matt Olson"),
        ("ホセ・ラミレス", "Jose Ramirez"), ("ザンダー・ボガーツ", "Xander Bogaerts"),
        ("トレイ・ターナー", "Trea Turner"), ("ガレイベル・トレス", "Gleyber Torres"),
        
        # 外野手
        ("マイク・ヤストジェムスキー", "Mike Yastrzemski"), ("ジョージ・スプリンガー", "George Springer"),
        ("バイロン・バクストン", "Byron Buxton"), ("ケビン・キアマイアー", "Kevin Kiermaier"),
        ("ハンター・レンフロー", "Hunter Renfroe"), ("ニック・カステラノス", "Nick Castellanos"),
        ("トミー・ファム", "Tommy Pham"), ("ジェシー・ウィンカー", "Jesse Winker"),
        
        # 新星・若手
        ("ウラジミール・ゲレーロ3世", "Vladimir Guerrero III"), ("フリオ・ロドリゲス", "Julio Rodriguez"),
        ("ライリー・グリーン", "Riley Greene"), ("ボビー・ウィット・ジュニア", "Bobby Witt Jr."),
        ("スペンサー・ストライダー", "Spencer Strider"), ("ローガン・ウェブ", "Logan Webb")
    ]
    
    conn = sqlite3.connect('comprehensive_baseball_database.db')
    cursor = conn.cursor()
    
    # MLB選手を更新
    cursor.execute("SELECT player_id FROM detailed_players_master WHERE league = 'MLB' LIMIT ?", (len(mlb_players),))
    mlb_ids = cursor.fetchall()
    
    for i, (player_id,) in enumerate(mlb_ids):
        if i < len(mlb_players):
            katakana_name, english_name = mlb_players[i]
            display_name = f"{katakana_name} ({english_name})"
            cursor.execute("""
                UPDATE detailed_players_master 
                SET full_name = ?, native_name = ?
                WHERE player_id = ?
            """, (display_name, english_name, player_id))
    
    conn.commit()
    conn.close()
    print(f"MLB選手名更新完了: {len(mlb_ids)}名")

def verify_names_update():
    """選手名更新の確認"""
    conn = sqlite3.connect('comprehensive_baseball_database.db')
    
    print("\n=== 選手名更新確認 ===")
    
    # 各リーグのサンプル選手名表示
    for league in ['npb', 'kbo', 'MLB']:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT full_name, native_name 
            FROM detailed_players_master 
            WHERE league = ? 
            LIMIT 5
        """, (league,))
        
        players = cursor.fetchall()
        print(f"\n{league.upper()}選手例:")
        for full_name, native_name in players:
            print(f"  {full_name} ({native_name})")
    
    conn.close()

if __name__ == "__main__":
    print("リアルな選手名データベース更新開始...")
    
    # NPB: 日本語表記
    update_npb_players()
    
    # KBO: カタカナ + 漢字  
    update_kbo_players()
    
    # MLB: カタカナ + 英語
    update_mlb_players()
    
    # 更新結果確認
    verify_names_update()
    
    print("\n✅ 選手名データベース更新完了！")
    print("localhost:3000で新しい選手名が確認できます")