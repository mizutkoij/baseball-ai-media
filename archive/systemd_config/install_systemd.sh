#!/bin/bash
# install_systemd.sh - NPB Scraper SystemD Installation

echo "🚀 Installing NPB Scraper SystemD Services"
echo "==========================================="

# 1. Install environment file
echo "1️⃣ Installing environment file..."
sudo cp npb-scraper-env /etc/default/npb-scraper
sudo chmod 644 /etc/default/npb-scraper

# 2. Install service files
echo "2️⃣ Installing service files..."
sudo cp npb-step1.service /etc/systemd/system/
sudo cp npb-step1.timer /etc/systemd/system/
sudo cp npb-step2.service /etc/systemd/system/
sudo cp npb-step2.timer /etc/systemd/system/
sudo cp npb-step3-live.service /etc/systemd/system/

# 3. Set permissions
sudo chmod 644 /etc/systemd/system/npb-step*.{service,timer}

# 4. Reload systemd
echo "3️⃣ Reloading systemd daemon..."
sudo systemctl daemon-reload

# 5. Enable and start services
echo "4️⃣ Enabling services..."
sudo systemctl enable npb-step1.timer
sudo systemctl enable npb-step2.timer
sudo systemctl enable npb-step3-live.service

echo "5️⃣ Starting services..."
sudo systemctl start npb-step1.timer
sudo systemctl start npb-step2.timer
sudo systemctl start npb-step3-live.service

# 6. Show status
echo ""
echo "✅ Installation complete! Status:"
echo "================================="
systemctl list-timers | grep npb-step
systemctl status npb-step3-live --no-pager -l

echo ""
echo "📊 Monitoring commands:"
echo "======================"
echo "systemctl list-timers | grep npb-step"
echo "journalctl -u npb-step3-live -n 200 -f"
echo "tail -f ~/baseball-ai-media/logs/*.log"