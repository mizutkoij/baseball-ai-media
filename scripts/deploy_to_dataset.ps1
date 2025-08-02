# Deploy forbidden scanner and archive tools to baseball-dataset
$DatasetRoot = "C:\Users\mizut\baseball-dataset"
$MediaRoot = "C:\Users\mizut\baseball-ai-media"

# Check if dataset directory exists
if (-not (Test-Path $DatasetRoot)) {
    Write-Error "baseball-dataset directory not found at $DatasetRoot"
    exit 1
}

Write-Host "Deploying tools to baseball-dataset..."

# Create branch and tag in dataset
Set-Location $DatasetRoot
git switch -c chore/archive-1point02-20250802
git tag pre-archive-1point02-20250802

# Create tools directory
New-Item -Force -Type Directory "$DatasetRoot\tools" | Out-Null

# Copy Python scanner
Copy-Item "$MediaRoot\tools\scan_forbidden.py" "$DatasetRoot\tools\" -Force

# Copy archive script (if exists)
if (Test-Path "$MediaRoot\scripts\simple_archive.ps1") {
    Copy-Item "$MediaRoot\scripts\simple_archive.ps1" "$DatasetRoot\tools\" -Force
}

# Create GitHub Actions directory and workflow
New-Item -Force -Type Directory "$DatasetRoot\.github\workflows" | Out-Null

$workflowContent = @"
name: Forbidden Scan
on: 
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: 
          python-version: '3.11'
      - name: Run forbidden token scan
        run: python tools/scan_forbidden.py
"@

$workflowContent | Out-File -Encoding UTF8 "$DatasetRoot\.github\workflows\forbidden.yml"

# Run initial scan
Write-Host "Running initial forbidden token scan..."
Set-Location $DatasetRoot
python tools\scan_forbidden.py

Write-Host "Deployment complete. Check scan results above."