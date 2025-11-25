#!/bin/bash
# Baseball AI Media - nginx 설정 설치 스크립트

set -e

echo "🌐 Installing Baseball AI Media nginx configuration..."

# nginx 설치 확인
if ! command -v nginx &> /dev/null; then
    echo "❌ nginx not found. Installing..."
    sudo apt update
    sudo apt install -y nginx
fi

# 기존 default site 비활성화
sudo rm -f /etc/nginx/sites-enabled/default

# Baseball AI 설정 복사
sudo cp deploy/nginx-baseball.conf /etc/nginx/sites-available/baseball
sudo ln -sf /etc/nginx/sites-available/baseball /etc/nginx/sites-enabled/

# nginx 설정 테스트
echo "🧪 Testing nginx configuration..."
sudo nginx -t

# ulimit 증가 (systemd override)
sudo mkdir -p /etc/systemd/system/nginx.service.d
sudo tee /etc/systemd/system/nginx.service.d/override.conf > /dev/null << EOF
[Service]
LimitNOFILE=65536
EOF

# systemd reload
sudo systemctl daemon-reload

# nginx 재시작
echo "🔄 Restarting nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "✅ nginx configuration installed successfully"
echo ""
echo "🌐 Baseball AI Media accessible at:"
echo "  http://100.88.12.26/"
echo ""
echo "📊 Endpoints:"
echo "  Web App: http://100.88.12.26/"
echo "  Live API: http://100.88.12.26/live/"
echo "  Health: http://100.88.12.26/health"
echo "  Metrics: http://100.88.12.26/metrics (local only)"
echo ""
echo "📝 To view nginx logs:"
echo "  sudo tail -f /var/log/nginx/access.log"
echo "  sudo tail -f /var/log/nginx/error.log"