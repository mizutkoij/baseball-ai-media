#!/bin/bash
# install_bbdata_systemd.sh - Install BaseballData.jp collection systemd services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Installing BaseballData.jp systemd services..."

# Install service files
sudo cp "$SCRIPT_DIR/bbdata-roster.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-roster.timer" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-stats.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-stats.timer" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-gamelog.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/bbdata-gamelog.timer" /etc/systemd/system/

echo "Setting permissions..."
sudo chmod 644 /etc/systemd/system/bbdata-*.service
sudo chmod 644 /etc/systemd/system/bbdata-*.timer

echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "Enabling timers..."
sudo systemctl enable bbdata-roster.timer
sudo systemctl enable bbdata-stats.timer
sudo systemctl enable bbdata-gamelog.timer

echo "Starting timers..."
sudo systemctl start bbdata-roster.timer
sudo systemctl start bbdata-stats.timer
sudo systemctl start bbdata-gamelog.timer

echo ""
echo "BaseballData.jp collection services installed successfully!"
echo ""
echo "Schedule:"
echo "  bbdata-roster:  Daily at 04:10 JST"
echo "  bbdata-stats:   Daily at 04:20 JST"
echo "  bbdata-gamelog: Daily at 04:30 JST"
echo ""
echo "Check status with:"
echo "  sudo systemctl status bbdata-roster.timer"
echo "  sudo systemctl status bbdata-stats.timer"
echo "  sudo systemctl status bbdata-gamelog.timer"
echo ""
echo "View logs with:"
echo "  sudo journalctl -u bbdata-roster.service -f"
echo "  sudo journalctl -u bbdata-stats.service -f"
echo "  sudo journalctl -u bbdata-gamelog.service -f"
echo ""
echo "Manual execution:"
echo "  sudo systemctl start bbdata-roster.service"
echo "  sudo systemctl start bbdata-stats.service"
echo "  sudo systemctl start bbdata-gamelog.service"