# NPB Scraper PowerShell Runner for Windows
# Usage: .\run-cron-scraper.ps1 <task_name>

param(
    [Parameter(Position=0)]
    [string]$TaskName = "help",
    
    [Parameter(Position=1)]
    [int]$Days = 7
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$DataDir = if ($env:DATA_DIR) { $env:DATA_DIR } else { Join-Path $ProjectDir "data" }
$LogDir = Join-Path $DataDir "logs"
$LockFile = Join-Path $DataDir "scraper.lock"

# Ensure directories exist
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

if (!(Test-Path (Split-Path $LockFile))) {
    New-Item -ItemType Directory -Path (Split-Path $LockFile) -Force | Out-Null
}

# Log file
$LogFile = Join-Path $LogDir "cron-$(Get-Date -Format 'yyyy-MM-dd').log"

# Helper functions
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$TaskName] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

function Show-Help {
    Write-Host @"
NPB Scraper PowerShell Runner

Usage: .\run-cron-scraper.ps1 <task_name> [options]

Available tasks:
  smart              - Smart scheduler (recommended for scheduled tasks)
  morning-update     - Morning schedule and starters update
  afternoon-starters - Afternoon starters update
  evening-results    - Evening results and detailed data
  backfill [days]    - Backfill missing data (default: 7 days)
  test              - Test run
  help              - Show this help

Examples:
  .\run-cron-scraper.ps1 smart
  .\run-cron-scraper.ps1 backfill 7
  .\run-cron-scraper.ps1 test

Environment Variables:
  DATA_DIR     - Data directory (default: PROJECT_DIR/data)
  DRY_RUN      - Set to 'true' for dry run mode
  VERBOSE      - Set to 'true' for verbose output

"@
}

function Test-Dependencies {
    if (!(Get-Command npx -ErrorAction SilentlyContinue)) {
        Write-Log "ERROR: npx is not installed or not in PATH"
        exit 1
    }
    
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Log "ERROR: Node.js is not installed or not in PATH"
        exit 1
    }
    
    $packageJson = Join-Path $ProjectDir "package.json"
    if (!(Test-Path $packageJson)) {
        Write-Log "ERROR: package.json not found in project directory: $ProjectDir"
        exit 1
    }
}

function Test-Lock {
    if (Test-Path $LockFile) {
        $lockInfo = Get-Item $LockFile
        $ageMinutes = ((Get-Date) - $lockInfo.LastWriteTime).TotalMinutes
        
        if ($ageMinutes -gt 60) {
            Write-Log "Removing stale lock file (age: $([math]::Round($ageMinutes, 1)) minutes)"
            Remove-Item $LockFile -Force
        } else {
            Write-Log "Another scraper instance may be running (lock age: $([math]::Round($ageMinutes, 1)) minutes)"
            Write-Log "If you're sure no other instance is running, delete: $LockFile"
            exit 0
        }
    }
    
    # Create lock file with current process ID
    Set-Content -Path $LockFile -Value $PID
}

function Invoke-Task {
    param([string]$Command)
    
    Write-Log "Starting task: $TaskName"
    Write-Log "Command: $Command"
    Write-Log "Working directory: $ProjectDir"
    Write-Log "Data directory: $DataDir"
    
    # Set environment variables
    $env:DATA_DIR = $DataDir
    if (!$env:NODE_ENV) { $env:NODE_ENV = "production" }
    
    # Change to project directory
    Push-Location $ProjectDir
    
    try {
        $startTime = Get-Date
        
        # Execute command
        if ($env:DRY_RUN -eq "true") {
            Write-Log "DRY RUN: Would execute: $Command"
            $exitCode = 0
        } else {
            $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $Command -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$LogFile.tmp" -RedirectStandardError "$LogFile.err"
            $exitCode = $process.ExitCode
            
            # Append output to log
            if (Test-Path "$LogFile.tmp") {
                Get-Content "$LogFile.tmp" | Add-Content $LogFile
                Remove-Item "$LogFile.tmp" -Force
            }
            
            if (Test-Path "$LogFile.err") {
                Get-Content "$LogFile.err" | Add-Content $LogFile
                Remove-Item "$LogFile.err" -Force
            }
        }
        
        $duration = ((Get-Date) - $startTime).TotalSeconds
        
        if ($exitCode -eq 0) {
            Write-Log "Task completed successfully ($([math]::Round($duration, 1))s)"
        } else {
            Write-Log "Task failed with exit code $exitCode ($([math]::Round($duration, 1))s)"
        }
        
        return $exitCode
        
    } finally {
        Pop-Location
    }
}

# Main execution
try {
    switch ($TaskName.ToLower()) {
        "help" {
            Show-Help
            exit 0
        }
        
        "smart" {
            Test-Dependencies
            Test-Lock
            $exitCode = Invoke-Task "npx tsx scripts/smart-scheduler.ts"
        }
        
        "morning-update" {
            Test-Dependencies
            Test-Lock
            $exitCode = Invoke-Task "npx tsx scripts/automated-scraper.ts --schedule-only"
        }
        
        "afternoon-starters" {
            Test-Dependencies
            Test-Lock
            $exitCode = Invoke-Task "npx tsx scripts/automated-scraper.ts --starters-only"
        }
        
        "evening-results" {
            Test-Dependencies
            Test-Lock
            $exitCode = Invoke-Task "npx tsx scripts/automated-scraper.ts --detailed-only"
        }
        
        "backfill" {
            Test-Dependencies
            Test-Lock
            $exitCode = Invoke-Task "npx tsx scripts/smart-scheduler.ts --backfill $Days"
        }
        
        "test" {
            Test-Dependencies
            Test-Lock
            $exitCode = Invoke-Task "echo 'Test execution successful'"
        }
        
        default {
            Write-Log "ERROR: Unknown task: $TaskName"
            Write-Log "Available tasks: smart, morning-update, afternoon-starters, evening-results, backfill, test, help"
            exit 1
        }
    }
    
} finally {
    # Clean up lock file
    if (Test-Path $LockFile) {
        Remove-Item $LockFile -Force
    }
}

Write-Log "Script completed with exit code: $exitCode"
exit $exitCode