#!/bin/bash

# Baseball AI Media API Server - Deployment Script
# Usage: ./deploy.sh [server-ip]

SERVER_IP=${1:-133.18.111.227}
SERVER_USER="root"
REMOTE_DIR="/opt/baseball-ai-media"

echo "🚀 Deploying Baseball AI Media API Server to ${SERVER_IP}"

# Check if SSH key is available
if ! ssh -q ${SERVER_USER}@${SERVER_IP} exit; then
    echo "❌ Cannot connect to server. Please check SSH access."
    exit 1
fi

echo "📦 Step 1: Creating remote directory..."
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${REMOTE_DIR}/api-server ${REMOTE_DIR}/output"

echo "📤 Step 2: Uploading API server files..."
scp -r package.json server.js README.md ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/api-server/

echo "📤 Step 3: Uploading output data..."
echo "   (This may take several minutes for large datasets)"
rsync -avz --progress ../output/ ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/output/

echo "📦 Step 4: Installing dependencies..."
ssh ${SERVER_USER}@${SERVER_IP} "cd ${REMOTE_DIR}/api-server && npm install --production"

echo "⚙️  Step 5: Setting up systemd service..."
ssh ${SERVER_USER}@${SERVER_IP} "cat > /etc/systemd/system/baseball-api.service << 'EOFSERVICE'
[Unit]
Description=Baseball AI Media API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${REMOTE_DIR}/api-server
Environment=\"PORT=3001\"
Environment=\"OUTPUT_DIR=${REMOTE_DIR}/output\"
Environment=\"NODE_ENV=production\"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOFSERVICE
"

echo "🔄 Step 6: Reloading and restarting service..."
ssh ${SERVER_USER}@${SERVER_IP} "systemctl daemon-reload && systemctl enable baseball-api && systemctl restart baseball-api"

echo "⏳ Waiting for service to start..."
sleep 3

echo "🔍 Step 7: Checking service status..."
ssh ${SERVER_USER}@${SERVER_IP} "systemctl status baseball-api --no-pager -l"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 API Endpoints:"
echo "   Health: http://${SERVER_IP}:3001/health"
echo "   Teams:  http://${SERVER_IP}:3001/api/teams?year=2025"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    ssh ${SERVER_USER}@${SERVER_IP} 'journalctl -u baseball-api -f'"
echo "   Restart:      ssh ${SERVER_USER}@${SERVER_IP} 'systemctl restart baseball-api'"
echo "   Stop:         ssh ${SERVER_USER}@${SERVER_IP} 'systemctl stop baseball-api'"
echo ""
echo "🧪 Testing API..."
curl -s http://${SERVER_IP}:3001/health | head -20

exit 0
