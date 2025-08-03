# 🏃‍♂️ Baseball AI Media 運用ランブック

NPB分析サイトの日常運用・緊急対応・定期メンテナンスの完全ガイド

## 📋 運用概要

### システム構成
- **Frontend**: Next.js 14 on Vercel
- **Backend**: FastAPI on 100.88.12.26:8000  
- **Database**: SQLite (現在) + DuckDB (history)
- **品質保証**: 195テスト (ゴールデン174 + 不変条件12 + システム9)
- **監視**: リアルタイム品質ダッシュボード

### 運用方針
- **無停止原則**: フェイルオープンシステムで100%稼働継続
- **品質優先**: 65.5%成功率維持・自動品質ゲート
- **透明性**: 全ての係数・計算式・データソース公開

---

## 🔄 日常運用 (毎日・自動)

### CI Nightly 自動実行
**時刻**: JST 0:15 (GitHub Actions cron)  
**内容**: 195テスト + UI密度WARN + 品質レポート

```bash
# 手動実行確認コマンド
npm run test:golden        # ゴールデンサンプル174テスト
npm test -- __tests__/game-invariants.test.ts  # 不変条件12テスト
npm run check:uidensity    # UI密度4ページチェック
```

### 失敗時の自動対応
1. **フェイルオープン発動**
   - 最新の良いバージョンに自動ピンニング
   - 本番サービス継続 (CI exit 0)
   - public/status/quality.json に degraded マーク

2. **Discord通知** (予定)
   - `#quality-alerts` チャンネルに即座通知
   - 失敗内容・ピン版・復旧手順を自動投稿

3. **監視ダッシュボード更新**
   - `/about/methodology` の QualityStatus が degraded 表示
   - Vercel Analytics で異常検知

### 正常時の確認項目
✅ 品質ステータス: `healthy`  
✅ 成功率: 126/186 (65.5%) 以上維持  
✅ UI密度: 4ページ全てPASS推奨  
✅ フェイルオープン: ピンモード OFF

---

## 📊 週次チェック (毎週・5分)

### 1. 品質ダッシュボード目視確認
```
👀 確認URL: https://baseball-ai-media.vercel.app/about/methodology
```

**チェック項目:**
- [ ] QualityStatus が `healthy` 表示
- [ ] 最終更新が1週間以内
- [ ] テスト成功率が65%以上
- [ ] ピンモードが OFF (degraded でない)

### 2. サンプリング診断実行
```bash
# 任意チームの直近5試合を診断
npm run debug:game -- --team 巨人 --latest 5
npm run debug:game -- --team 阪神 --latest 5

# 特定ゲームの詳細分析  
npm run debug:game -- --game 20240801001
```

**期待結果:**
- Box合計 = スコアボード (R/H/HR の±2誤差内)
- AB/BB/SO集計の整合性
- 投打クロス検証の成功

### 3. 外部連携確認
- [ ] Vercel デプロイメント正常
- [ ] FastAPI サーバー (100.88.12.26:8000) 応答確認
- [ ] データベース接続・クエリ性能

---

## 🗓 月次メンテナンス (毎月・15分)

### 1. ゴールデンサンプル期待値更新
**タイミング**: 月初第1営業日  
**目的**: 実データ変化に追従・品質基準の適正化

```bash
# 1. 現在の成功率確認
npm run test:golden

# 2. 失敗要因分析
npm run debug:game -- --team <失敗チーム> --latest 10

# 3. data/golden_samples.json の期待値調整
# - 選手成績の範囲を実績に合わせて±10%調整
# - 新規有力選手の追加検討
# - 引退・移籍選手の除外検討

# 4. 更新コミット
git add data/golden_samples.json
git commit -m "update: ゴールデンサンプル月次更新 v2.X"
```

**PR確認ポイント:**
- 📊 必ず quality diff が表示される
- 🧪 成功率の向上が確認できる  
- 📈 回帰・悪化がないこと

### 2. 定数ドリフト確認
**対象**: `config/league_constants.json`  
**閾値**: ±7%の変動で要確認

```bash
# パークファクター確認
cat config/league_constants.json | grep -A5 "park_factors"

# wOBA係数ドリフト確認  
cat config/league_constants.json | grep -A10 "woba_weights"
```

**Action Required条件:**
- 単一球場のPF が 0.93未満 or 1.07超過
- wOBA係数の年間変動が±0.05超過
- BB/HBP/1B/2B/3B/HR係数の一貫性検証

### 3. データ品質レポート
```bash
# データ完全性チェック
npm test -- __tests__/game-invariants.test.ts

# UI密度改善状況  
npm run check:uidensity

# 新規ページの品質確認
npm run debug:game -- --latest 1  # 最新ゲームの整合性
```

---

## 🚨 緊急対応プロトコル

### 品質ゲート全面失敗
**症状**: 成功率が50%未満に急落・大量テスト失敗

1. **即座確認 (2分以内)**
   ```bash
   # 失敗原因の特定
   npm run test:golden 2>&1 | grep "GOLDEN SAMPLE FAILURE"
   
   # スキーマ問題 vs データ問題の判別
   grep "SCHEMA FALLBACK" <test-output>
   ```

2. **フェイルオープン確認 (3分以内)**
   ```bash
   # ピンモード状態確認
   cat .reports/last_good_version.txt
   cat public/status/quality.json
   
   # サービス継続性確認
   curl -s https://baseball-ai-media.vercel.app/about/methodology | grep "degraded"
   ```

3. **根本原因修正 (30分以内)**
   - **データベース問題**: SQLite/DuckDB接続・スキーマ変更の確認
   - **計算ロジック問題**: wOBA係数・パークファクター異常値
   - **外部要因**: NPB公式データの構造変更・API仕様変更

4. **復旧手順**
   ```bash
   # 修正後のテスト実行
   npm run test:golden
   
   # 成功確認後のピン解除
   unset CONSTANTS_PIN
   rm .reports/last_good_version.txt  # 自動再生成される
   
   # 正常化確認
   npm test
   ```

### データ異常・外れ値対応
**症状**: 特定選手・チームの統計値が常識外

1. **問題特定**
   ```bash
   # 該当選手/チームの詳細診断
   npm run debug:game -- --team <異常チーム> --date <日付>
   npm run debug:game -- --game <該当ゲーム>
   ```

2. **一時除外 (緊急回避)**
   ```bash
   # config/invariants.config.json の exclude セクション編集
   {
     "exclude": {
       "games": ["20240801001"],  # 問題ゲーム除外
       "teams": ["異常チーム"],     # 該当チーム一時除外
       "players": ["問題選手ID"]   # 該当選手一時除外
     }
   }
   ```

3. **根本修正後の復旧**
   - exclude セクションをクリア
   - テスト正常化確認
   - 品質レポートの健全性確認

---

## 📈 直近1-2週間の改善施策 (P0)

### コンテンツ密度の即時底上げ

#### 1. `/players/[id]` 必須化対応
**目標**: 2024要約＋基本4指標の安定表示

```typescript
// 実装例: app/players/[id]/page.tsx
const playerMinimumContent = {
  summary: "2024年シーズン要約",
  metrics: ["WAR", "OPS", "wRC+", "HR"],
  fallback: "直近3試合＋簡易バイオ"
}
```

**チェックポイント:**
- [ ] データ不足時のフォールバック動作
- [ ] OG画像の自動生成確認
- [ ] meta description の適切性

#### 2. `/teams/[year]/[team]` 強化
**目標**: 順位バッジ＋主力5人の常時表示

- [ ] 順位バッジの リアルタイム表示
- [ ] 主力5人選手のカード表示
- [ ] OG画像・メタ情報の最適化

#### 3. `/players` & `/records` 導入強化
**目標**: 密度WARN解消・SEO最適化

- [ ] 1段落導入文の常時表示
- [ ] フィルター・検索機能の可視性向上
- [ ] 内部リンク・関連記事の充実

#### 4. SEO・インデックス最適化
- [ ] `robots.txt` 新設パス全登録
- [ ] `sitemap.xml` 動的ページ対応
- [ ] `/compare/teams` クエリは `noindex` 維持

---

## 📞 エスカレーション・連絡先

### 緊急度レベル
- **P0 (即座)**: 全サービス停止・データ破損・セキュリティ侵害
- **P1 (1時間)**: 品質ゲート全面失敗・計算ロジック異常
- **P2 (4時間)**: 特定機能障害・パフォーマンス劣化
- **P3 (24時間)**: UI問題・軽微なデータ不整合

### 責任者・連絡先
- **システム管理**: @mizutkoij
- **品質保証**: GitHub Issues で追跡
- **緊急時**: /privacy ページに記載の連絡先

### 関連資源
- **品質ダッシュボード**: `/about/methodology`
- **技術文書**: `/docs/*.md` 
- **設定管理**: `/config/*.json` (CODEOWNERS保護)
- **CI/CD**: `.github/workflows/golden.yml`

---

## 🎯 成功指標・KPI

### 品質KPI
- **テスト成功率**: 65.5% (126/186) 以上維持
- **稼働継続率**: 100% (フェイルオープン保証)
- **品質レスポンス**: 異常検知5分以内・報告24時間以内
- **データ更新**: 試合終了後24時間以内反映

### 運用KPI  
- **月次更新**: ゴールデンサンプル適正化
- **定数管理**: ±7%閾値内でのドリフト管理
- **文書化**: 全手順の自動化・再現可能性
- **透明性**: 計算式・係数・データソース100%公開

**NPB分析における新しいスタンダードを目指して - 安心の本番運用体制完成！** 🎉