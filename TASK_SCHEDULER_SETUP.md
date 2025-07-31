# Windows Task Scheduler設定手順

## NPB今日の試合データの自動更新設定

### 1. Task Schedulerを開く

1. `Win + R` → `taskschd.msc` と入力してEnter
2. または「スタートメニュー」→「Task Scheduler」で検索

### 2. 基本タスクの作成

1. 右側の「操作」パネルで「基本タスクの作成」をクリック
2. 以下の情報を入力：

**基本タスクの作成ウィザード**
- **名前**: `NPB Today Games Update`
- **説明**: `NPB公式サイトから今日の試合情報を30分間隔で取得`

### 3. トリガーの設定

**トリガー**を「毎日」に設定：
- **開始日**: 今日の日付
- **開始時刻**: `09:00:00`
- **間隔**: 毎日繰り返し

### 4. 操作の設定

**操作**を「プログラムの開始」に設定：
- **プログラム/スクリプト**: `C:\Users\mizut\baseball-ai-media\scripts\update_today_games.bat`
- **開始場所**: `C:\Users\mizut\baseball-ai-media`

### 5. 高度な設定

「完了」の前に「完了時にプロパティダイアログを開く」にチェックを入れ、以下を設定：

**全般タブ**
- 「ユーザーがログオンしているかどうかに関わらず実行する」を選択
- 「最上位の特権で実行する」にチェック

**トリガータブ**
- 作成したトリガーを選択し「編集」
- **詳細設定**で以下を設定：
  - 「間隔」: `30分間`
  - 「期間」: `14時間` (9:00-23:00)
  - 「有効期限」: 設定しない

**条件タブ**
- 「コンピューターをAC電源で使用している場合のみタスクを開始する」のチェックを外す
- 「コンピューターの電源をバッテリに切り替える場合はタスクを停止する」のチェックを外す

**設定タブ**
- 「要求時にタスクを実行を許可する」にチェック
- 「タスクが失敗した場合の再起動間隔」: `1分`
- 「再起動を試行する回数」: `3`

### 6. テスト実行

1. タスクを右クリック → 「実行」
2. `C:\Users\mizut\baseball-ai-media\logs\npb_schedule.log` でログを確認
3. `C:\Users\mizut\baseball-ai-media\snapshots\today_games.json` が更新されていることを確認

## 動作確認

### ログファイルの場所
```
C:\Users\mizut\baseball-ai-media\logs\npb_schedule.log
```

### スナップショットファイルの場所
```
C:\Users\mizut\baseball-ai-media\snapshots\today_games.json
```

### 手動実行コマンド
```cmd
cd "C:\Users\mizut\baseball-ai-media"
scripts\update_today_games.bat
```

## トラブルシューティング

### エラーが発生する場合

1. **Python パスの確認**
   ```cmd
   where python
   ```

2. **依存関係の確認**
   ```cmd
   pip install requests beautifulsoup4 lxml
   ```

3. **権限の確認**
   - バッチファイルを管理者権限で実行

4. **ネットワーク接続の確認**
   - NPB公式サイト（https://npb.jp）へのアクセス確認

### ログの確認方法

```cmd
type "C:\Users\mizut\baseball-ai-media\logs\npb_schedule.log"
```

最新の10行を確認：
```cmd
powershell "Get-Content 'C:\Users\mizut\baseball-ai-media\logs\npb_schedule.log' -Tail 10"
```

## 注意事項

- NPB公式サイトの利用規約を遵守すること
- 過度なアクセスを避けるため、30分間隔を推奨
- サイト構造の変更により動作しなくなる可能性があること