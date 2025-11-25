#!/bin/bash
# Baseball AI Media - 最終プリフライトチェック
# 本番稼働前の必須確認項目を自動化

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔍 Baseball AI Media - 最終プリフライトチェック開始"
echo "=================================================="

ERRORS=0
WARNINGS=0

# チェック結果表示用関数
check_ok() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

check_error() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

# 1. プロセス状態確認
echo -e "\n🔧 プロセス状態確認"
echo "==================="

if systemctl is-active --quiet baseball-nextjs.service; then
    check_ok "Next.js サービス稼働中"
else
    check_error "Next.js サービス停止中"
fi

if systemctl is-active --quiet baseball-live-api.service; then
    check_ok "Live API サービス稼働中"
else
    check_error "Live API サービス停止中"
fi

# プロセスリソース確認
NEXTJS_MEMORY=$(ps -o pid,ppid,cmd,%mem --no-headers -C node | grep "next start" | awk '{print $4}' | head -1)
LIVEAPI_MEMORY=$(ps -o pid,ppid,cmd,%mem --no-headers -C node | grep "live-server" | awk '{print $4}' | head -1)

if [ -n "$NEXTJS_MEMORY" ]; then
    if (( $(echo "$NEXTJS_MEMORY > 10.0" | bc -l) )); then
        check_warning "Next.js メモリー使用量: ${NEXTJS_MEMORY}% (高い)"
    else
        check_ok "Next.js メモリー使用量: ${NEXTJS_MEMORY}%"
    fi
fi

if [ -n "$LIVEAPI_MEMORY" ]; then
    if (( $(echo "$LIVEAPI_MEMORY > 20.0" | bc -l) )); then
        check_warning "Live API メモリー使用量: ${LIVEAPI_MEMORY}% (高い)"
    else
        check_ok "Live API メモリー使用量: ${LIVEAPI_MEMORY}%"
    fi
fi

# 2. SSE ストリーム動作確認
echo -e "\n📡 SSE ストリーム動作確認"
echo "=========================="

# Live API疎通確認
if curl -s --connect-timeout 5 http://127.0.0.1:8787/health > /dev/null; then
    check_ok "Live API 疎通確認"
else
    check_error "Live API 疎通失敗"
fi

# SSE接続確認（タイムアウト付き）
SSE_TEST=$(timeout 10 curl -s -N 'http://127.0.0.1:8787/live/test_game/stream?replay=1' | head -1 2>/dev/null || echo "TIMEOUT")

if [[ "$SSE_TEST" == *"data:"* ]]; then
    check_ok "SSE ストリーム正常"
elif [[ "$SSE_TEST" == "TIMEOUT" ]]; then
    check_warning "SSE ストリーム応答遅延"
else
    check_error "SSE ストリーム異常"
fi

# メトリクス確認
if curl -s localhost:8787/metrics | grep -q "live_sse_connections"; then
    SSE_CONNECTIONS=$(curl -s localhost:8787/metrics | grep "live_sse_connections" | awk '{print $2}' | head -1)
    check_ok "SSE 接続数監視: ${SSE_CONNECTIONS:-0} connections"
else
    check_warning "SSE メトリクス取得失敗"
fi

# 3. キャッシュ効率確認
echo -e "\n💾 キャッシュ効率確認"
echo "==================="

CACHE_RESPONSE=$(curl -s -I 'http://127.0.0.1:8787/live/summary' 2>/dev/null)

if echo "$CACHE_RESPONSE" | grep -q "X-Cache.*HIT"; then
    check_ok "キャッシュ動作確認（HIT）"
elif echo "$CACHE_RESPONSE" | grep -q "Cache-Control"; then
    check_warning "キャッシュ設定確認（MISS または初回）"
else
    check_warning "キャッシュヘッダー未確認"
fi

# API応答時間確認
RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null 'http://127.0.0.1:8787/live/summary' 2>/dev/null || echo "0")

if (( $(echo "$RESPONSE_TIME < 0.2" | bc -l) )); then
    check_ok "API応答時間: ${RESPONSE_TIME}s (良好)"
elif (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
    check_warning "API応答時間: ${RESPONSE_TIME}s (やや遅い)"
else
    check_error "API応答時間: ${RESPONSE_TIME}s (遅い)"
fi

# 4. Next.js 本番モード確認
echo -e "\n🌐 Next.js 本番モード確認"
echo "========================="

# Next.js 疎通確認
if curl -s --connect-timeout 5 http://127.0.0.1:3000 > /dev/null; then
    check_ok "Next.js 疎通確認"
    
    # 開発モードチェック
    NEXTJS_RESPONSE=$(curl -s http://127.0.0.1:3000 | head -10)
    if echo "$NEXTJS_RESPONSE" | grep -q "Development"; then
        check_error "Next.js 開発モードで稼働中"
    else
        check_ok "Next.js 本番モード確認"
    fi
else
    check_error "Next.js 疎通失敗"
fi

# systemd設定確認
if systemctl cat baseball-nextjs.service | grep -q "next start"; then
    check_ok "systemd 本番設定確認"
else
    check_warning "systemd 設定要確認"
fi

# ビルド確認
if [ -f "/opt/baseball-ai-media/.next/BUILD_ID" ]; then
    BUILD_ID=$(cat /opt/baseball-ai-media/.next/BUILD_ID)
    check_ok "本番ビルド確認: ${BUILD_ID:0:8}..."
else
    check_error "本番ビルド未確認"
fi

# 5. nginx SSE最適化確認
echo -e "\n🔀 nginx SSE最適化確認"
echo "======================="

if nginx -t &>/dev/null; then
    check_ok "nginx 設定構文確認"
else
    check_error "nginx 設定エラー"
fi

# SSE最適化設定確認
if nginx -T 2>/dev/null | grep -q "proxy_buffering off"; then
    check_ok "nginx SSE最適化設定確認"
else
    check_warning "nginx SSE最適化設定要確認"
fi

# Rate limiting確認
if nginx -T 2>/dev/null | grep -q "limit_req_zone.*sse"; then
    check_ok "nginx Rate limiting設定確認"
else
    check_warning "nginx Rate limiting設定要確認"
fi

# 6. メモリー・監視確認
echo -e "\n🧠 メモリー・監視確認"
echo "==================="

# メモリー圧迫状況
if curl -s localhost:8787/metrics | grep -q "memory_pressure_status"; then
    MEMORY_PRESSURE=$(curl -s localhost:8787/metrics | grep "memory_pressure_status" | awk '{print $2}' | head -1)
    case "$MEMORY_PRESSURE" in
        "0") check_ok "メモリー状況: GREEN" ;;
        "1") check_warning "メモリー状況: YELLOW" ;;
        "2") check_error "メモリー状況: RED" ;;
        *) check_warning "メモリー状況: 不明" ;;
    esac
else
    check_warning "メモリー監視メトリクス未確認"
fi

# モデル健全性確認
if curl -s http://127.0.0.1:3000/api/model-health | grep -q "top1_accuracy"; then
    check_ok "モデル健全性API確認"
else
    check_warning "モデル健全性API要確認"
fi

# 結果サマリー
echo -e "\n📊 プリフライトチェック結果"
echo "============================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 全チェック PASS - 本番稼働準備完了！${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  ${WARNINGS} 個の警告あり - 確認後稼働可能${NC}"
    exit 0
else
    echo -e "${RED}❌ ${ERRORS} 個のエラー、${WARNINGS} 個の警告 - 修正が必要${NC}"
    echo ""
    echo "修正後に再実行してください:"
    echo "./deploy/preflight-check.sh"
    exit 1
fi