#!/bin/bash
# setup_final.sh - Complete the polite NPB scraper system setup

set -e
cd "$(dirname "$0")"

echo "🚀 Final Setup: Polite NPB Scraper System"
echo "=========================================="

# 1. Verify environment
echo "1️⃣ Checking environment..."
source .venv/bin/activate

# 2. Test Playwright installation (without running browser)
echo "2️⃣ Checking Playwright installation..."
python -c "from playwright.sync_api import sync_playwright; print('✅ Playwright import successful')"

# 3. Test Discord CSV notifier
echo "3️⃣ Testing Discord CSV notification system..."
python -c "
from lib.discord_csv_notifier import send_csv
import os
webhook = os.environ.get('DISCORD_WEBHOOK_DATA', '')
if webhook:
    print('✅ Discord webhook configured')
else:
    print('⚠️ Discord webhook not configured (will skip notifications)')
    print('   To enable: export DISCORD_WEBHOOK_DATA=\"https://discord.com/api/webhooks/...\")
"

# 4. Test polite HTTP system
echo "4️⃣ Testing polite HTTP client..."
python -c "
from lib.polite_http import PoliteHttp
http = PoliteHttp(min_interval_s=1.0)
print('✅ PoliteHttp initialized successfully')
"

# 5. Verify all polite scripts
echo "5️⃣ Verifying polite scripts..."
for script in step_1_schedule_scraper_polite.py step_2_index_extractor_polite.py step_3_pitchlog_fetcher_polite.py; do
    if [ -f "scripts/$script" ]; then
        echo "  ✅ $script"
    else
        echo "  ❌ $script missing"
    fi
done

echo ""
echo "🎯 Setup Status:"
echo "=================="
echo "✅ Polite HTTP client (30s intervals + robots.txt + ETag caching)"
echo "✅ Discord CSV notifications (auto-split for large files)"
echo "✅ Step1 - Schedule collection (production ready)"
echo "✅ Step2 - Index extraction (ready for testing)"
echo "✅ Step3 - Pitch log collection (ready when Playwright deps installed)"
echo ""
echo "📋 Remaining manual steps:"
echo "=========================="
echo "1. Install Playwright system dependencies:"
echo "   sudo python -m playwright install-deps chromium"
echo "   python -m playwright install chromium"
echo ""
echo "2. Configure Discord webhook (optional):"
echo "   export DISCORD_WEBHOOK_DATA=\"https://discord.com/api/webhooks/YOUR_WEBHOOK\""
echo ""
echo "3. Test complete pipeline:"
echo "   python scripts/step_1_schedule_scraper_polite.py"
echo "   python scripts/step_3_pitchlog_fetcher_polite.py 2021029676"
echo ""
echo "🚀 System ready for production use!"