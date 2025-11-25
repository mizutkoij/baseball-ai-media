$Root = "C:\Users\mizut\baseball-dataset"
$Out = Join-Path $Root "archive\1point02-20250802"

# Create branch and tag
Set-Location $Root
git switch -c chore/archive-1point02-20250802
git tag pre-archive-1point02-20250802

# Create archive directory
New-Item -Force -Type Directory $Out | Out-Null

# Find files with 1point02 references
$patterns = @('1point02', '1\.02')
$hits = @()

Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\(archive|\.git|node_modules)\\' } |
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

# Find files with 1point02 in filename
$named = Get-ChildItem -Path $Root -Recurse -File -Filter "*1point02*" |
  Where-Object { $_.FullName -notmatch '\\(archive|\.git)\\' } |
  Select-Object -ExpandProperty FullName

$all = ($hits + $named) | Sort-Object -Unique

# Create manifest
$manifest = @()
foreach ($path in $all) {
  $rel = $path.Substring($Root.Length+1)
  $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
  $manifest += [PSCustomObject]@{ path=$rel; sha256=$hash }
}
$manifest | ConvertTo-Json -Depth 5 | Out-File -Encoding UTF8 (Join-Path $Out "manifest.json")

# Copy files to archive
foreach ($path in $all) {
  $rel = $path.Substring($Root.Length+1)
  $dest = Join-Path $Out $rel
  New-Item -Force -ItemType Directory (Split-Path $dest) | Out-Null
  Copy-Item -LiteralPath $path -Destination $dest -Force
}

# Create README
$readme = @"
# 1point02 Archive (2025-08-02)
- This folder contains isolated files with 1point02 references
- These files are archived and should not be used in production
- manifest.json contains SHA256 hashes and file paths
- Contact: administrator for questions
"@
$readme | Out-File -Encoding UTF8 (Join-Path $Out "README.md")

Write-Host "Archived $($all.Count) files to $Out"