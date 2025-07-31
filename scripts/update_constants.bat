@echo off
REM NPB Constants Update Batch
REM 日次0:30 JST実行用

cd /d "%~dp0"

echo [%DATE% %TIME%] Starting NPB Constants Update...

REM Python環境の確認
python --version
if errorlevel 1 (
    echo Python not found in PATH
    exit /b 1
)

REM 必要パッケージの確認
python -c "import duckdb, numpy; print('Required packages OK')"
if errorlevel 1 (
    echo Installing required packages...
    pip install duckdb numpy
)

REM 定数更新実行
python update_constants_batch.py
set UPDATE_RESULT=%errorlevel%

if %UPDATE_RESULT% == 0 (
    echo [%DATE% %TIME%] Constants update completed successfully
) else (
    echo [%DATE% %TIME%] Constants update failed with code %UPDATE_RESULT%
)

REM ログファイルの確認
if exist constants_update.log (
    echo Last 10 lines of log:
    powershell "Get-Content constants_update.log -Tail 10"
)

exit /b %UPDATE_RESULT%