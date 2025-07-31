@echo off
REM NPB Today Games Update Script for Windows
REM Run this batch file every 30 minutes during game hours (9:00-23:00)

cd /d "C:\Users\mizut\baseball-ai-media"

REM Get current month and year
for /f "tokens=1-2 delims=/" %%a in ('date /t') do (
    set month=%%a
    set year=%%b
)

REM Clean up month format (remove leading zero if present)
if "%month:~0,1%"=="0" set month=%month:~1%

REM Create log directory if it doesn't exist
if not exist "logs" mkdir logs

REM Run NPB scraper for current month
python scripts/npb_schedule_today.py --year %year% --months %month% --league first --out snapshots/today_games.json >> logs/npb_schedule.log 2>&1

REM Check if successful
if errorlevel 1 (
    echo ERROR: NPB scraper failed at %date% %time% >> logs/npb_schedule.log
) else (
    echo SUCCESS: NPB data updated at %date% %time% >> logs/npb_schedule.log
)

REM Optional: Update farm games if needed
REM python scripts/npb_schedule_today.py --year %year% --months %month% --league farm --out snapshots/today_games_farm.json >> logs/npb_schedule.log 2>&1

echo NPB update completed at %date% %time%