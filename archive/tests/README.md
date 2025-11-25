# NPB Baseball AI - Testing Framework

**Phase 6: Testing/DX** の完全実装パッケージ。「壊れにくさを証明できるテスト階層＋気持ちいい開発体験」を提供します。

## 🧪 テスト構成

### 単体テスト (Unit Tests)
```bash
npm run test              # 全テスト実行
npm run test:watch        # ウォッチモード
npm run test:coverage     # カバレッジレポート
```

#### ファイル構成
- `normalize.spec.ts` - 正規化システムテスト（チーム名、選手名、球場名）
- `canonical.spec.ts` - カノニカルシステムテスト（ハッシュ安定性、衝突検出）
- `schedule-policy.spec.ts` - スケジュールポリシーテスト（JST時間、試合窓計算）
- `dom-parser.spec.ts` - DOMパーサースナップショットテスト
- `http-replay.spec.ts` - HTTPレコーディング/リプレイテスト
- `metrics-smoke.spec.ts` - Prometheusメトリクス煙幕テスト

### 統合テスト (Integration Tests)
```bash
npm run test:integration  # 統合テスト実行
```

### テストユーティリティ
- `utils/tmpfs.ts` - テスト用ファイルシステム操作
- `fixtures/npb/starters/` - NPB HTML サンプルデータ
- `setup.ts` - テスト環境セットアップ（JST設定、クリーンアップ）

## 🎯 テスト戦略

### 1. スナップショットテスト
HTMLパースロジックの回帰テスト。NPBサイトの構造変更を即座に検出。

```typescript
// DOM構造の変更を検出
expect(parsedGames).toMatchSnapshot('game-schedule-parse');
expect(pitcherInfo).toMatchSnapshot('pitcher-info');
```

### 2. HTTP レコーディング/リプレイ
ネットワークに依存しないテスト実行。CI環境での安定性確保。

```typescript
// CI環境ではモックレスポンス使用
if (!recordingMode) {
  nock.disableNetConnect();
  await setupMockedResponses();
}
```

### 3. 時間関連テスト
JST時間帯での正確なスケジューリングテスト。

```typescript
// JST時間での試合窓計算
process.env.TZ = "Asia/Tokyo";
const plan = await planFor("2025-08-11", testDataDir);
```

### 4. メトリクス煙幕テスト
Prometheusメトリクスの基本動作確認。

```typescript
// メトリクスサーバーのヘルスチェック
const response = await fetch(`${serverUrl}/health`);
expect(response.status).toBe(200);
```

## 🔄 CI/CD パイプライン

### GitHub Actions ワークフロー

#### `.github/workflows/ci.yml`
- 🔍 **Lint & Type Check** - ESLint、TypeScript検証
- 🧪 **Unit Tests** - 全単体テスト実行、カバレッジ取得
- 🔨 **Build Test** - プロダクションビルド検証
- 🔗 **Integration Tests** - メインブランチ統合テスト
- 💨 **Smoke Tests** - 本番環境動作確認
- 🛡️ **Security Scan** - npm audit、CodeQL解析
- ⚡ **Performance Test** - バンドルサイズ分析

#### `.github/workflows/deploy.yml`
- 🔍 **Pre-deployment Checks** - デプロイ前検証
- 🚀 **Deploy to Vercel** - 環境別デプロイ
- ✅ **Post-deployment Tests** - デプロイ後動作確認
- 🗄️ **Database Migration** - DB更新処理
- 📊 **Status Updates** - デプロイ状況通知

## 🚀 開発体験 (DX)

### 1. 高速テスト実行
```bash
# 変更ファイルのみテスト
npm run test:watch

# 特定ファイルのテスト
npx vitest normalize.spec.ts
```

### 2. リッチなテストUI
```bash
npm run test:ui
```
ブラウザベースのインタラクティブテストランナー。

### 3. デバッグ支援
- TypeScript完全サポート
- ソースマップによる正確なスタックトレース
- JST時間帯の自動設定

### 4. 一時ファイル管理
```typescript
// 自動クリーンアップ付きテストデータ
const testDir = await makeTmpDir("test_prefix");
await createTestDataFile(testDir, "games", "2025-08-11", gameData);
// テスト終了時に自動削除
```

## 📊 カバレッジ目標

- **Unit Tests**: 90%+ line coverage
- **Critical Paths**: 100% coverage (正規化、スケジューリング)
- **Integration Tests**: 主要APIエンドポイント網羅

## 🔧 設定ファイル

### `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000, // DB操作用
    coverage: {
      exclude: ["**/scripts/**", "**/tests/**"]
    }
  }
});
```

### `tests/setup.ts`
```typescript
// JST時間帯設定
process.env.TZ = "Asia/Tokyo";

// テスト用データディレクトリ
process.env.DATA_DIR = path.join(process.cwd(), "tmp_test_data");
```

## 🎲 モックとフィクスチャ

### HTMLフィクスチャ
- `fixtures/npb/starters/game_schedule_sample.html`
- `fixtures/npb/starters/pitcher_detail_sample.html`

### HTTPモック (nock)
```typescript
// レート制限テスト
nock('https://npb.jp')
  .persist()
  .get(/\/games\/\d{8}\/$/)
  .delay(100)
  .reply(200, htmlFixture);
```

## 🚨 アラートとモニタリング

### Discord通知
CIの成功/失敗をDiscordに自動通知。

### メトリクス監視
テスト実行時間、失敗率、カバレッジの推移を追跡。

## 📝 実行コマンドまとめ

```bash
# 基本テスト
npm test                    # 全テスト実行
npm run test:coverage       # カバレッジ付きテスト
npm run test:watch          # ファイル監視モード

# 高度なテスト
npm run test:integration    # 統合テスト
npm run test:ui            # UIテストランナー

# CI/CD
npm run lint               # Lint検証
npm run build              # プロダクションビルド
npm run metrics            # メトリクスサーバー起動
```

---

**Phase 6完了** ✅ そのままPRに切れる実装パックとして提供。安心してデプロイできる品質を実現。