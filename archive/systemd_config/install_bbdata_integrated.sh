#!/bin/bash
# install_bbdata_integrated.sh - Install integrated BaseballData.jp collection system

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Installing integrated BaseballData.jp collection system..."

# Stop and remove old services if they exist
echo "Cleaning up old services..."
for service in bbdata-roster bbdata-stats bbdata-gamelog; do
    sudo systemctl stop ${service}.timer 2>/dev/null || true
    sudo systemctl disable ${service}.timer 2>/dev/null || true
    sudo rm -f /etc/systemd/system/${service}.service /etc/systemd/system/${service}.timer
done

# Install new service files
echo "Installing service files..."
sudo cp "$SCRIPT_DIR/bbdata-roster.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-roster.timer" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-stats.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-stats.timer" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-gamelog.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-gamelog.timer" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-deep@.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-deep.timer" /etc/systemd/system/

echo "Setting permissions..."
sudo chmod 644 /etc/systemd/system/bbdata-*.service
sudo chmod 644 /etc/systemd/system/bbdata-*.timer

echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "Enabling timers..."
sudo systemctl enable bbdata-roster.timer
sudo systemctl enable bbdata-stats.timer
sudo systemctl enable bbdata-gamelog.timer
sudo systemctl enable bbdata-deep.timer

echo "Starting timers..."
sudo systemctl start bbdata-roster.timer
sudo systemctl start bbdata-stats.timer
sudo systemctl start bbdata-gamelog.timer
sudo systemctl start bbdata-deep.timer

echo ""
echo "✅ Integrated BaseballData.jp collection system installed successfully!"
echo ""
echo "🔄 Collection Schedule:"
echo "  Core SSR (Static):"
echo "    bbdata-roster:  Daily at 04:10 JST (選手ロスター)"
echo "    bbdata-stats:   Daily at 04:20 JST (年間成績)" 
echo "    bbdata-gamelog: Daily at 04:30 JST (ゲームログ)"
echo ""
echo "  Deep CSR (JavaScript):"
echo "    bbdata-deep:    Daily at 04:45 JST (VDUCP・条件別成績)"
echo ""
echo "📊 Integration Strategy:"
echo "  Yahoo Live:      Real-time game data (30-second intervals)"
echo "  BaseballData:    Daily detailed analysis data supplement"
echo ""
echo "🔍 Check status with:"
echo "  sudo systemctl list-timers | grep bbdata"
echo "  sudo systemctl status bbdata-roster.timer"
echo "  sudo systemctl status bbdata-deep.timer"
echo ""
echo "📋 View logs with:"
echo "  sudo journalctl -u bbdata-roster.service -f"
echo "  sudo journalctl -u bbdata-deep.service -f"
echo ""
echo "🧪 Manual test execution:"
echo "  sudo systemctl start bbdata-roster.service"
echo "  sudo systemctl start bbdata-deep@$(date +%Y-%m-%d).service"
echo ""
echo "⚙️  Environment variables (can be set in service files):"
echo "  BB_MIN_INTERVAL_SEC=15     # Rate limiting"
echo "  BB_MAX_PAGES_PER_RUN=300   # Deep collection limit"
echo "  BB_MAX_CONCURRENT=1        # Concurrent requests"