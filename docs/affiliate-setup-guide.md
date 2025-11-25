# アフィリエイト収益システム - セットアップガイド

## 🎯 概要
負荷ゼロで既存サイト構造に差し込む収益化システムです。

## 📋 1. アフィリエイト提携申請 (30-60分)

### Amazonアソシエイト
1. **申請先**: https://affiliate.amazon.co.jp
2. **必要情報**:
   - サイトURL: `https://baseball-ai-media.vercel.app`
   - カテゴリ: スポーツ・書籍・エンターテイメント
   - 月間PV: 実績値を記入
3. **取得情報**: アソシエイトタグ (例: `baseballaimedi-22`)

### 楽天アフィリエイト
1. **申請先**: https://affiliate.rakuten.co.jp
2. **必要情報**:
   - サイト説明: NPB分析メディア
   - 主要コンテンツ: 野球統計・試合情報
3. **取得情報**: パートナーID

### バリューコマース
1. **申請先**: https://www.valuecommerce.ne.jp
2. **特徴**: Yahoo!ショッピング案件が豊富
3. **取得情報**: SID (Site ID)

### A8.net
1. **申請先**: https://www.a8.net
2. **特徴**: 球団公式ショップ・チケット案件
3. **取得情報**: メディアID

## ⚙️ 2. 設定ファイル更新

承認後、`config/affiliates.json` を更新:

```json
{
  "providers": {
    "amazon": {
      "tag": "YOUR_AMAZON_TAG",
      "enabled": true
    },
    "rakuten": {
      "partner_id": "YOUR_RAKUTEN_ID", 
      "enabled": true
    },
    "valuecommerce": {
      "sid": "YOUR_VC_SID",
      "enabled": true
    },
    "a8": {
      "media_id": "YOUR_A8_MEDIA_ID",
      "enabled": true
    }
  }
}
```

## 📊 3. 表示ポイント（既存UIに自然配置）

### /games/[gameId] (試合詳細ページ)
- **試合前60分**: 配信サービス (DAZN/パ・リーグTV)
- **試合中**: スタメン選手グッズ・先発投手関連
- **試合後**: ヒーロー選手の関連グッズ・書籍

### /games (試合一覧ページ) 
- 各試合行に「グッズ」「チケット」ボタン (最大2つ)
- 押しつけない控えめなサイズ

## 🏷️ 4. コンプライアンス対応（景表法・ステマ規制）

### 広告表示（自動実装済み）
- **rel="sponsored nofollow"** 属性付与 (Google推奨)
- **【広告・PR】** 明示表示
- **景表法表示文**: フッターに自動挿入

### 参考リンク
- [消費者庁ステマ規制Q&A](https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing/)
- [Google広告リンク属性ガイドライン](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links)

## 📈 5. メトリクス可視化

### Prometheus エンドポイント
```
GET /api/affiliate/metrics
```

### 主要指標
- **affiliate_clicks_total**: 総クリック数 (プロバイダー・カテゴリ別)
- **affiliate_clicks_today**: 今日のクリック数
- **affiliate_provider_performance**: プロバイダー別パフォーマンス

### Grafana ダッシュボード設定
1. データソース追加: `http://your-domain.com/api/affiliate/metrics`
2. パネル作成:
   ```
   Query: affiliate_clicks_total
   Legend: {{provider}} - {{category}}
   ```

## 🚀 6. 運用開始

### 段階的ロールアウト
1. **Day 1-3**: G/T/C 上位3球団でテスト
2. **Day 4-7**: 全球団展開
3. **Week 2**: A/Bテストで配置最適化

### チェックポイント
- [ ] 表示崩れなし
- [ ] クリック追跡動作
- [ ] 法的表示適切
- [ ] メトリクス収集正常

## 🔧 7. カスタマイズ方法

### 新しいプロバイダー追加
1. `config/affiliates.json` に追加
2. `lib/affiliates.ts` にURL生成ロジック追加
3. コンポーネントで利用開始

### 表示カスタマイズ
```tsx
// ミニマル表示
<AffiliateLink variant="minimal" />

// 強調表示  
<AffiliateLink variant="enhanced" />
```

## 📞 8. トラブルシューティング

### よくある問題
1. **リンクが表示されない**: `config/affiliates.json` の enabled フラグ確認
2. **クリック追跡されない**: ブラウザの広告ブロック確認
3. **403エラー**: プロバイダーのドメイン制限確認

### デバッグ方法
```bash
# 設定確認
npm run affiliate:config:check

# メトリクス確認  
curl http://localhost:3000/api/affiliate/metrics
```

---

## 🎉 完了！

システムは自動で以下を処理します：
- **適切なタイミング**でのリンク表示
- **法的要件**への自動準拠
- **パフォーマンス計測**とレポート
- **A/Bテスト**による最適化

収益化が開始されます！ 📊💰