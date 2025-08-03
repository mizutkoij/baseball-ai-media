# scripts\archive_1point02.ps1
$Root = "C:\Users\mizut\baseball-dataset"
$Out  = Join-Path $Root "archive\1point02-20250802"

# First, create branch and tag in dataset repo
Set-Location $Root
git switch -c chore/archive-1point02-20250802
git tag pre-archive-1point02-20250802

New-Item -Force -Type Directory $Out | Out-Null

# 1) 文字列参照のあるファイルを検出
$patterns = @('1point02','1point02\.jp','1\.02','1 02')
$hits = @()
Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\(archive|\.git|node_modules|__pycache__|logs)\\' } |
  ForEach-Object {
    $content = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($null -ne $content) {
      foreach ($p in $patterns) {
        if ($content -match $p) { 
          $hits += $_.FullName
          break
        }
      }
    }
  }

# 2) ファイル名に 1point02 を含むものも追加
$named = Get-ChildItem -Path $Root -Recurse -File -Filter "*1point02*" |
  Where-Object { $_.FullName -notmatch '\\(archive|\.git|node_modules)\\' } |
  Select-Object -ExpandProperty FullName
$all = ($hits + $named) | Sort-Object -Unique

# 3) マニフェスト作成（SHA256・行数）
$manifest = @()
foreach ($path in $all) {
  $rel = $path.Substring($Root.Length+1)
  $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
  $lines = (Get-Content -LiteralPath $path | Measure-Object -Line).Lines
  $manifest += [PSCustomObject]@{ path=$rel; sha256=$hash; lines=$lines }
}
$manifest | ConvertTo-Json -Depth 5 | Out-File -Encoding UTF8 (Join-Path $Out "manifest.json")

# 4) アーカイブへ階層コピー
foreach ($path in $all) {
  $rel = $path.Substring($Root.Length+1)
  $dest = Join-Path $Out $rel
  New-Item -Force -ItemType Directory (Split-Path $dest) | Out-Null
  Copy-Item -LiteralPath $path -Destination $dest -Force
}

# 5) README（由来・利用禁止・復元手順）
@"
# 1point02 Archive (2025-08-02)
- このフォルダは `1point02` 参照を含むスクリプト/データの**隔離保管**です。
- 本番・開発コードからは**参照禁止**。必要なら個別に内容を確認し、**独自実装へ置換**してください。
- manifest.json: SHA256 と相対パスの記録（監査・再現性確保）
- 連絡: （あなたの連絡先）
"@ | Out-File -Encoding UTF8 (Join-Path $Out "README_ARCHIVE.md")

Write-Host "Archived $(($all|Measure-Object).Count) files to $Out"