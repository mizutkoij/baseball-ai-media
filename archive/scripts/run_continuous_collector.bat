@echo off
REM continuous_collector.bat - 継続実行用Windowsバッチファイル

echo Baseball Data Continuous Collector
echo =====================================

cd /d "C:\Users\mizut\baseball-ai-media"

REM 初回セットアップ確認
if not exist "collection_status.db" (
    echo Setting up collection targets...
    python scripts\continuous_collector.py --init
)

REM メイン実行ループ
:main_loop
echo.
echo [%date% %time%] Starting collection cycle...

REM 1回実行
python scripts\continuous_collector.py --single

REM エラーチェック
if %errorlevel% neq 0 (
    echo [%date% %time%] Error occurred, waiting 30 minutes...
    timeout /t 1800 /nobreak
) else (
    echo [%date% %time%] Cycle completed successfully
)

REM 次のサイクルまで待機（5分）
echo [%date% %time%] Waiting for next cycle...
timeout /t 300 /nobreak

goto main_loop

REM 終了処理
:end
echo [%date% %time%] Collector stopped
pause