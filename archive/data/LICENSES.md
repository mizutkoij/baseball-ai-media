# 📜 ライセンス・出典管理

## データソース

### NPB公式サイト
- **URL**: https://npb.jp/
- **利用範囲**: 公開試合結果・選手成績のみ
- **収集方法**: 手動または自動スクレイピング（robots.txt遵守）
- **ライセンス**: 公開情報の分析・統計算出に利用
- **制限**: 元データの再配布・複製禁止

## 統計手法・概念

### セイバーメトリクス指標
- **wOBA（weighted On-Base Average）**: 
  - 出典: "The Book" (Tango, Lichtman, Dolphin, 2007)
  - 概念: FanGraphs.com 解説記事
  - 実装: 当サイト独自の係数推定・算出
  
- **FIP（Fielding Independent Pitching）**:
  - 出典: Voros McCracken (2001), Baseball Prospectus
  - 概念: 一般的な統計理論
  - 実装: 当サイト独自の定数推定・算出

- **ピタゴラス勝率**:
  - 出典: Bill James (1980s)
  - 概念: 統計学の一般理論
  - 実装: 当サイト独自の係数調整

### パークファクター
- **手法**: 一般的な球場補正理論
- **出典**: "The Book" 球場効果分析手法
- **実装**: NPBデータによる独自推定

## 引用・参考文献

### 学術・理論
- Tango, T., Lichtman, M., Dolphin, A. (2007). "The Book: Playing the Percentages in Baseball"
- James, Bill (1982). "Baseball Abstract"
- McCracken, Voros (2001). "Pitching and Defense: How Much Control Do Hurlers Have?"

### 概念解説サイト（参考のみ）
- FanGraphs.com: セイバーメトリクス用語解説
- Baseball Reference: 統計指標定義
- 注: 文章の複製なし、概念理解のみに利用

## 当サイトのオリジナル要素

### 独自実装
- **NPB向け係数推定**: wOBA weights, FIP constant 等
- **日本語UI**: 完全独自デザイン・文章
- **データパイプライン**: 自作のスクレイピング・算出システム
- **可視化**: オリジナルチャート・テーブル設計

### ライセンス
- **コード**: MIT License（第三者コード除く）
- **データ**: CC BY-SA 4.0（算出結果のみ）
- **UI/デザイン**: All Rights Reserved

## 法的遵守

### データ収集
- robots.txt完全遵守
- 適切なUser-Agent設定
- レート制限実装（1秒間隔以上）
- 公開情報のみ取得

### 著作権
- 第三者データベースの複製なし
- 短い引用は出典明記
- Fair Use原則遵守

### プライバシー
- 個人情報非収集
- 公開統計のみ利用
- GDPR・個人情報保護法遵守

## 更新履歴

### 2025-07-31
- 初版作成
- 第三者データソース転用痕跡完全除去
- 独自データ方針明文化

---

**📝 注意**: このファイルは全データソース・引用の透明性確保のため、定期的に更新されます。