#!/bin/bash
# Discord webhook環境設定スクリプト
# 使用法: source deploy/discord-env.sh

echo "🔧 Setting up Discord webhook environment..."

# 本番用3チャンネル構成
export DISCORD_WEBHOOK_STATUS="https://discord.com/api/webhooks/1405380800437813350/xLYpiMbcfa_1SBHpYLqzQ389Q9rLv6bHZ_xS5SVmmlVGzy9NzB5zQnRASjkSw-Wbvwya"
export DISCORD_WEBHOOK_DATA="https://discord.com/api/webhooks/1405380809682190356/8_kedcI3XrkUBp3kLr4YrY2U34fhEyOYOEj1vLGZP1Nz1xg1QsC3kohaSt2TTQgSGw3K"
export DISCORD_WEBHOOK_ALERTS="https://discord.com/api/webhooks/1405380815579517040/070CZfIH-efja2xUKoflscIw2LZLHE1z0FgBrtjib4M5ikTGQv1IomVRBQZ5K-SNjKA9"

echo "✅ Discord webhooks configured:"
echo "   STATUS:  ${DISCORD_WEBHOOK_STATUS:0:50}..."
echo "   DATA:    ${DISCORD_WEBHOOK_DATA:0:50}..."
echo "   ALERTS:  ${DISCORD_WEBHOOK_ALERTS:0:50}..."

# systemd環境ファイル作成関数
setup_systemd_env() {
    echo "📝 Creating systemd environment file..."
    
    sudo tee /etc/default/baseball-discord.env >/dev/null <<EOF
# Discord Webhooks for Baseball AI Media
DISCORD_WEBHOOK_STATUS=https://discord.com/api/webhooks/1405380800437813350/xLYpiMbcfa_1SBHpYLqzQ389Q9rLv6bHZ_xS5SVmmlVGzy9NzB5zQnRASjkSw-Wbvwya
DISCORD_WEBHOOK_DATA=https://discord.com/api/webhooks/1405380809682190356/8_kedcI3XrkUBp3kLr4YrY2U34fhEyOYOEj1vLGZP1Nz1xg1QsC3kohaSt2TTQgSGw3K
DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/1405380815579517040/070CZfIH-efja2xUKoflscIw2LZLHE1z0FgBrtjib4M5ikTGQv1IomVRBQZ5K-SNjKA9
EOF
    
    sudo chmod 600 /etc/default/baseball-discord.env
    echo "✅ systemd environment file created at /etc/default/baseball-discord.env"
    
    echo ""
    echo "📋 To use with systemd services, add this line to your .service files:"
    echo "   EnvironmentFile=/etc/default/baseball-discord.env"
    echo ""
    echo "Then reload and restart:"
    echo "   sudo systemctl daemon-reload"
    echo "   sudo systemctl restart your-service.service"
}

# スモークテスト関数
smoke_test() {
    echo "🧪 Running Discord webhook smoke tests..."
    
    # ステータステスト
    echo "Testing STATUS webhook..."
    curl -s -H 'Content-Type: application/json' \
        -d '{"embeds":[{"title":"🚀 Production Setup","description":"Discord integration active","color":3066993,"timestamp":"'$(date -Iseconds)'"}]}' \
        "$DISCORD_WEBHOOK_STATUS" && echo " ✅ STATUS OK" || echo " ❌ STATUS FAILED"
    
    sleep 1
    
    # データテスト
    echo "Testing DATA webhook..."
    cat >/tmp/smoke_test.json <<'JSON'
{"source":"smoke_test","timestamp":"'$(date -Iseconds)'","data":{"status":"production_ready","channels":3}}
JSON
    
    curl -s -F 'payload_json={"content":"📎 Production setup test"}' \
         -F 'file=@/tmp/smoke_test.json;type=application/json;filename=smoke_test.json' \
         "$DISCORD_WEBHOOK_DATA" && echo " ✅ DATA OK" || echo " ❌ DATA FAILED"
    
    sleep 1
    
    # アラートテスト
    echo "Testing ALERTS webhook..."
    curl -s -H 'Content-Type: application/json' \
        -d '{"content":"@here","embeds":[{"title":"🚨 Alert Test","description":"Alert channel configured successfully","color":15158332,"timestamp":"'$(date -Iseconds)'"}]}' \
        "$DISCORD_WEBHOOK_ALERTS" && echo " ✅ ALERTS OK" || echo " ❌ ALERTS FAILED"
    
    rm -f /tmp/smoke_test.json
    echo ""
    echo "🎉 Smoke test completed! Check your Discord channels."
}

# 使用法表示
usage() {
    echo ""
    echo "🚀 Discord Integration Setup Complete"
    echo ""
    echo "Available commands:"
    echo "  setup_systemd_env  - Create systemd environment file"
    echo "  smoke_test         - Test all webhook channels"
    echo ""
    echo "Example usage:"
    echo "  source deploy/discord-env.sh"
    echo "  setup_systemd_env"
    echo "  smoke_test"
}

# 引数に応じて実行
case "${1:-}" in
    "systemd")
        setup_systemd_env
        ;;
    "test")
        smoke_test
        ;;
    "all")
        setup_systemd_env
        smoke_test
        ;;
    *)
        usage
        ;;
esac