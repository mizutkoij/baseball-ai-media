# 選手データ型定義ガイド

Baseball AI Media の選手データに関する包括的な型定義です。

## 📁 ファイル構成

- `player.ts` - 選手関連の全型定義
- `team.ts` - チーム関連の型定義
- `index.ts` - 全型定義のエクスポート

## 🎯 使用方法

### 基本的なインポート

```typescript
import { PlayerProfile, CompletePlayerData } from '@/lib/types';
```

### 個別の型のインポート

```typescript
import type {
  PlayerProfile,
  BattingSeasonStats,
  AdvancedBattingStats,
  StarScore
} from '@/lib/types/player';
```

## 📊 データ構造の概要

### 1. コア情報（必須レイヤー）

#### `PlayerProfile` - プロフィール
選手の基本情報（氏名、生年月日、身体情報、ポジションなど）

```typescript
const profile: PlayerProfile = {
  player_id: "P000001",
  name_kanji: "西村天裕",
  name_kana: "にしむら たかひろ",
  name_romaji: "Nishimura Takahiro",
  birth_date: "1998-05-15",
  age: 26,
  height: 175,
  weight: 78,
  throws: 'R',
  bats: 'R',
  primary_position: 'P',
  current_team: "ロッテ",
  current_number: "40",
  status: 'active'
};
```

#### `PlayerCareer` - 経歴
出身校、ドラフト情報、球団履歴など

```typescript
const career: PlayerCareer = {
  player_id: "P000001",
  high_school: "〇〇高校",
  draft: {
    year: 2020,
    round: 5,
    team: "ロッテ"
  },
  debut_year: 2021,
  team_history: [{
    team: "ロッテ",
    start_year: 2021,
    end_year: null
  }],
  number_history: [{
    number: "40",
    start_year: 2021,
    end_year: null,
    team: "ロッテ"
  }]
};
```

### 2. シーズン成績

#### `BattingSeasonStats` - 打撃成績
```typescript
const battingStats: BattingSeasonStats = {
  player_id: "P000001",
  year: 2025,
  team: "ロッテ",
  league: 'Pacific',
  level: '1軍',
  games: 50,
  PA: 180,
  AB: 160,
  H: 45,
  HR: 5,
  AVG: 0.281,
  OBP: 0.340,
  SLG: 0.425,
  OPS: 0.765
  // ... その他の指標
};
```

#### `PitchingSeasonStats` - 投手成績
```typescript
const pitchingStats: PitchingSeasonStats = {
  player_id: "P000001",
  year: 2025,
  team: "ロッテ",
  league: 'Pacific',
  level: '1軍',
  games: 15,
  GS: 0,
  IP: 20.1,
  W: 2,
  L: 1,
  SV: 0,
  HLD: 5,
  ERA: 3.54,
  WHIP: 1.28,
  SO: 25,
  BB: 8
  // ... その他の指標
};
```

### 3. セイバー指標

#### `AdvancedBattingStats` - 打者高度指標
```typescript
const advBatting: AdvancedBattingStats = {
  player_id: "P000001",
  year: 2025,
  WAR: 2.5,
  wRC_plus: 115,
  OPS_plus: 112,
  BB_pct: 0.089,
  K_pct: 0.156,
  ISO: 0.144,
  BABIP: 0.315,
  wOBA: 0.345
};
```

#### `AdvancedPitchingStats` - 投手高度指標
```typescript
const advPitching: AdvancedPitchingStats = {
  player_id: "P000001",
  year: 2025,
  WAR: 1.2,
  ERA_plus: 105,
  FIP: 3.85,
  FIP_minus: 98,
  K_pct: 0.245,
  BB_pct: 0.078,
  K_minus_BB_pct: 0.167,
  BABIP: 0.298
};
```

### 4. オリジナル指標

#### `StarScore` - ☆スコア
```typescript
const starScore: StarScore = {
  player_id: "P000001",
  year: 2025,
  total_score: 412,
  pitching_score: 380,
  rank: 'B',
  calculated_at: "2025-11-28T00:00:00Z",
  confidence: 'medium',
  description: "今季は登板機会が少なく、評価は限定的です。"
};
```

#### `UndervaluedIndex` - 価値逆転スコア
```typescript
const uii: UndervaluedIndex = {
  player_id: "P000001",
  year: 2025,
  uii_score: 15.5,
  surface_rating: 400,
  true_contribution: 415.5,
  gap: 15.5,
  category: 'undervalued',
  explanation: "状況別成績が優秀で、WPAが高い"
};
```

#### `WPAStats` - 勝利貢献度
```typescript
const wpa: WPAStats = {
  player_id: "P000001",
  year: 2025,
  pitching_WPA: 0.85,
  WPA_per_LI: 0.92,
  clutch_score: 1.2,
  RE24: 3.5
};
```

### 5. 一球・一打席ログ

#### `PlateAppearance` - 打席ログ
```typescript
const pa: PlateAppearance = {
  pa_id: "PA_20250515_001",
  player_id: "B000001",
  game_id: "G_20250515_M_L",
  date: "2025-05-15",
  inning: 7,
  half: 'top',
  batting_order: 4,
  pitcher_id: "P000002",
  pitcher_name: "山田太郎",
  score_situation: { team_score: 2, opponent_score: 3 },
  runners: { first: true, second: false, third: true },
  outs: 1,
  final_count: "2-2",
  result: "単打",
  hit_direction: "left_center",
  batted_ball_type: "line_drive",
  WPA_delta: 0.12,
  RE24_delta: 0.85,
  leverage_index: 2.4
};
```

#### `Pitch` - 投球ログ
```typescript
const pitch: Pitch = {
  pitch_id: "PITCH_20250515_001_01",
  pitcher_id: "P000001",
  game_id: "G_20250515_M_L",
  date: "2025-05-15",
  inning: 7,
  pa_id: "PA_20250515_001",
  batter_id: "B000001",
  batter_name: "鈴木一郎",
  pitch_type: "ストレート",
  velocity: 145,
  zone: 5,
  count_before: "1-1",
  count_after: "1-2",
  pitch_result: "空振り",
  pitch_number: 3
};
```

### 6. ファーム情報

#### `FarmStats` - 2軍成績
```typescript
const farmStats: FarmStats = {
  player_id: "P000001",
  year: 2024,
  league: 'Eastern',
  pitching: { /* PitchingSeasonStats */ },
  pitching_role: 'middle_relief'
};
```

#### `RosterMovement` - 昇格・降格履歴
```typescript
const movement: RosterMovement = {
  player_id: "P000001",
  movement_type: 'promotion',
  movement_date: "2025-05-01",
  from_level: '2軍',
  to_level: '1軍',
  stats_before_movement: {
    games: 10,
    pitching: { ERA: 2.15, WHIP: 1.05 }
  }
};
```

### 7. 相性・スプリット系

#### `UmpireSplits` - 審判別成績
```typescript
const umpireSplit: UmpireSplits = {
  player_id: "P000001",
  umpire_name: "佐藤審判",
  games: 5,
  pitching: {
    IP: 15.2,
    BB_pct: 0.065,
    K_pct: 0.240,
    strike_pct: 0.645,
    runs_tendency: 0.85
  }
};
```

#### `ParkSplits` - 球場別成績
```typescript
const parkSplit: ParkSplits = {
  player_id: "P000001",
  park_name: "ZOZOマリンスタジアム",
  games: 8,
  pitching: {
    IP: 24.1,
    HR_per_9: 0.74,
    GB_FB_ratio: 1.45,
    ERA: 3.15,
    FIP: 3.52
  }
};
```

#### `HandednessSplits` - 左右別成績
```typescript
const handednessSplit: HandednessSplits = {
  player_id: "P000001",
  pitcher_hand: 'R',
  pitching: {
    PA: 85,
    AVG_against: 0.245,
    OPS_against: 0.695,
    K_pct: 0.235,
    BB_pct: 0.071
  }
};
```

### 8. 外部リンク

#### `PlayerLinks`
```typescript
const links: PlayerLinks = {
  player_id: "P000001",
  twitter_url: "https://twitter.com/player_account",
  instagram_url: "https://instagram.com/player_account",
  npb_official_url: "https://npb.jp/bis/players/...",
  highlight_playlist_url: "https://youtube.com/playlist?list=..."
};
```

### 9. メタ情報

#### `PlayerDataMeta`
```typescript
const meta: PlayerDataMeta = {
  player_id: "P000001",
  last_updated: "2025-11-28T15:30:00Z",
  data_sources: [
    {
      name: "Yahoo Sports",
      url: "https://baseball.yahoo.co.jp",
      data_type: ["pitch_logs", "game_stats"],
      last_fetched: "2025-11-28T12:00:00Z"
    },
    {
      name: "NPB Official",
      url: "https://npb.jp",
      data_type: ["season_stats", "profile"],
      last_fetched: "2025-11-27T18:00:00Z"
    }
  ],
  metrics_definitions: {
    FIP_definition_url: "/docs/metrics/fip",
    WAR_definition_url: "/docs/metrics/war",
    star_score_definition_url: "/docs/metrics/star-score"
  },
  data_quality: {
    completeness: 0.85,
    reliability: 'high',
    notes: "投球ログは2024シーズン以降のみ"
  },
  version: "2.1.0"
};
```

### 10. 統合データ型

#### `CompletePlayerData` - 全データ統合
```typescript
const completeData: CompletePlayerData = {
  profile: { /* PlayerProfile */ },
  career: { /* PlayerCareer */ },
  season_stats: {
    batting: [ /* BattingSeasonStats[] */ ],
    pitching: [ /* PitchingSeasonStats[] */ ]
  },
  farm_stats: [ /* FarmStats[] */ ],
  advanced_stats: {
    batting: [ /* AdvancedBattingStats[] */ ],
    pitching: [ /* AdvancedPitchingStats[] */ ]
  },
  original_metrics: {
    star_score: { /* StarScore */ },
    undervalued_index: { /* UndervaluedIndex */ },
    wpa_stats: { /* WPAStats */ },
    predicted_score: { /* PredictedScore */ }
  },
  recent_plate_appearances: [ /* PlateAppearance[] */ ],
  recent_pitches: [ /* Pitch[] */ ],
  roster_movements: [ /* RosterMovement[] */ ],
  splits: {
    umpire: [ /* UmpireSplits[] */ ],
    park: [ /* ParkSplits[] */ ],
    matchup: [ /* MatchupSplits[] */ ],
    handedness: [ /* HandednessSplits[] */ ]
  },
  links: { /* PlayerLinks */ },
  meta: { /* PlayerDataMeta */ }
};
```

## 🎨 UI での使用例

### 選手詳細ページ

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { CompletePlayerData } from '@/lib/types';

export default function PlayerDetailPage({ playerId }: { playerId: string }) {
  const [data, setData] = useState<CompletePlayerData | null>(null);

  useEffect(() => {
    fetch(`/api/players/${playerId}`)
      .then(res => res.json())
      .then(setData);
  }, [playerId]);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h1>{data.profile.name_kanji}</h1>
      <p>#{data.profile.current_number} | {data.profile.current_team}</p>

      {data.original_metrics?.star_score && (
        <div>
          <h2>AI評価スコア</h2>
          <p className="text-5xl">{data.original_metrics.star_score.total_score}</p>
          <p>ランク: {data.original_metrics.star_score.rank}</p>
        </div>
      )}

      {/* その他のセクション */}
    </div>
  );
}
```

## 📝 型定義のベストプラクティス

### 1. Optional vs Required

- `?` がついているフィールドは省略可能（データが存在しない場合がある）
- `?` がないフィールドは必須（常にデータが存在する前提）

### 2. null vs undefined の使い分け

- `null`: 明示的に「データなし」「該当なし」を示す（例: `end_year: null` = 現在も継続中）
- `undefined` / `?`: データが存在しない可能性がある（例: `xFIP?: number`）

### 3. 日付の扱い

すべての日付は ISO 8601 形式の文字列で保存：
- 日付のみ: `"2025-05-15"`
- 日時: `"2025-11-28T15:30:00Z"`

### 4. 数値の精度

- 割合・率: 小数で保存（例: `0.245` = 24.5%）
- 防御率・打率: 小数で保存（例: `ERA: 3.54`, `AVG: 0.281`）

## 🔄 データフロー

```
データソース（Yahoo, NPB, etc.）
    ↓
スクレイピング/API取得
    ↓
型付きデータに変換
    ↓
データベースに保存
    ↓
API エンドポイント
    ↓
フロントエンド（型安全）
```

## 📚 参考資料

- FIP定義: `/docs/metrics/fip.md`
- WAR定義: `/docs/metrics/war.md`
- ☆スコア計算式: `/docs/metrics/star-score.md`
- 価値逆転スコア: `/docs/metrics/undervalued-index.md`
