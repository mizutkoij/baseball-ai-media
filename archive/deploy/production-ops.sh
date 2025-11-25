#!/bin/bash
# Baseball AI Media - 本番運用スクリプト
# ローリングデプロイ・ロールバック・SLO監視を統合

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_DIR="/opt/baseball-ai-media"
MODELS_DIR="$BASE_DIR/models/nextpitch"
CONFIG_DIR="$BASE_DIR/config"

usage() {
    echo "Baseball AI Media - 本番運用スクリプト"
    echo ""
    echo "使用方法:"
    echo "  $0 deploy <model-version> <config-version>   # ローリングデプロイ"
    echo "  $0 rollback <model-version> <config-version> # ロールバック"
    echo "  $0 status                                    # 現在の状況確認"
    echo "  $0 slo-check                                 # SLO/アラート確認"
    echo "  $0 smoke-test                                # スモークテスト"
    echo ""
    echo "例:"
    echo "  $0 deploy v20250812_1430 v20250812_1430"
    echo "  $0 rollback v20250811_1200 v20250811_1200"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 現在のバージョン確認
get_current_versions() {
    local model_version=""
    local config_version=""
    
    if [ -L "$MODELS_DIR/current" ]; then
        model_version=$(basename "$(readlink "$MODELS_DIR/current")")
    fi
    
    if [ -L "$CONFIG_DIR/live-params.json" ]; then
        config_file=$(basename "$(readlink "$CONFIG_DIR/live-params.json")")
        config_version=$(echo "$config_file" | sed 's/live-params\.\(.*\)\.json/\1/')
    fi
    
    echo "model:$model_version config:$config_version"
}

# バージョン存在確認
check_version_exists() {
    local model_version="$1"
    local config_version="$2"
    
    if [ ! -d "$MODELS_DIR/versions/$model_version" ]; then
        log_error "モデルバージョン $model_version が存在しません"
        return 1
    fi
    
    if [ ! -f "$CONFIG_DIR/versions/live-params.$config_version.json" ]; then
        log_error "設定バージョン $config_version が存在しません"
        return 1
    fi
    
    return 0
}

# アトミック切り替え
atomic_switch() {
    local model_version="$1"
    local config_version="$2"
    
    log_info "アトミック切り替え実行..."
    
    cd "$BASE_DIR"
    
    # シンボリックリンク作成
    ln -sfn "versions/$model_version" "$MODELS_DIR/current"
    ln -sfn "versions/live-params.$config_version.json" "$CONFIG_DIR/live-params.json"
    
    # 権限確認
    chown -h baseball:baseball "$MODELS_DIR/current"
    chown -h baseball:baseball "$CONFIG_DIR/live-params.json"
    
    log_success "シンボリックリンク更新完了"
    
    # 設定リロード
    log_info "設定リロード実行..."
    if curl -fsS -X POST http://127.0.0.1:8787/admin/reload-params; then
        log_success "設定リロード完了"
    else
        log_error "設定リロード失敗"
        return 1
    fi
    
    return 0
}

# スモークテスト実行
smoke_test() {
    local errors=0
    
    log_info "スモークテスト開始..."
    
    # API疎通確認
    if curl -fs http://127.0.0.1:8787/health > /dev/null; then
        log_success "Live API疎通確認"
    else
        log_error "Live API疎通失敗"
        ((errors++))
    fi
    
    if curl -fs http://127.0.0.1:3000 > /dev/null; then
        log_success "Next.js疎通確認"
    else
        log_error "Next.js疎通失敗"
        ((errors++))
    fi
    
    # パフォーマンス指標確認
    local metrics=$(curl -s localhost:8787/metrics)
    
    if echo "$metrics" | grep -q "rolling_logloss_10m"; then
        local logloss=$(echo "$metrics" | grep "rolling_logloss_10m" | awk '{print $2}' | head -1)
        if (( $(echo "$logloss < 1.0" | bc -l) )); then
            log_success "LogLoss正常: $logloss"
        else
            log_warning "LogLoss高い: $logloss"
        fi
    else
        log_warning "LogLossメトリクス未確認"
    fi
    
    # SSE配信確認
    local sse_test=$(timeout 5 curl -s -N 'http://127.0.0.1:8787/live/test_game/stream?replay=1' | head -1 2>/dev/null || echo "FAIL")
    if [[ "$sse_test" == *"data:"* ]]; then
        log_success "SSE配信確認"
    else
        log_warning "SSE配信要確認"
    fi
    
    # 予測API確認
    if curl -fs 'http://127.0.0.1:8787/live/test_game/latest' | grep -q "winProb"; then
        log_success "予測API確認"
    else
        log_warning "予測API要確認"
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "スモークテスト完了"
        return 0
    else
        log_error "スモークテストで $errors 個のエラー"
        return 1
    fi
}

# SLO/アラート確認
slo_check() {
    log_info "SLO/アラート確認開始..."
    
    local metrics=$(curl -s localhost:8787/metrics)
    local warnings=0
    
    # PbP遅延確認
    if echo "$metrics" | grep -q "pbp_event_lag_seconds.*quantile.*0.95"; then
        local pbp_lag=$(echo "$metrics" | grep "pbp_event_lag_seconds.*quantile.*0.95" | awk '{print $2}')
        if (( $(echo "$pbp_lag > 15" | bc -l) )); then
            log_warning "PbP遅延高い: ${pbp_lag}s (目標: <15s)"
            ((warnings++))
        else
            log_success "PbP遅延正常: ${pbp_lag}s"
        fi
    fi
    
    # カバレッジ率確認
    local coverage_total=$(echo "$metrics" | grep "coverage_pitches_total" | awk '{print $2}' | head -1)
    local expected_total=$(echo "$metrics" | grep "expected_pitches_total" | awk '{print $2}' | head -1)
    
    if [ -n "$coverage_total" ] && [ -n "$expected_total" ] && [ "$expected_total" -gt 0 ]; then
        local coverage_rate=$(echo "scale=3; $coverage_total / $expected_total" | bc)
        if (( $(echo "$coverage_rate < 0.98" | bc -l) )); then
            log_warning "カバレッジ率低い: $(echo "$coverage_rate * 100" | bc)% (目標: >98%)"
            ((warnings++))
        else
            log_success "カバレッジ率正常: $(echo "$coverage_rate * 100" | bc)%"
        fi
    fi
    
    # 予測レイテンシ確認
    if echo "$metrics" | grep -q "nextpitch_predict_latency_ms.*quantile.*0.95"; then
        local predict_latency=$(echo "$metrics" | grep "nextpitch_predict_latency_ms.*quantile.*0.95" | awk '{print $2}')
        if (( $(echo "$predict_latency > 80" | bc -l) )); then
            log_warning "予測レイテンシ高い: ${predict_latency}ms (目標: <80ms)"
            ((warnings++))
        else
            log_success "予測レイテンシ正常: ${predict_latency}ms"
        fi
    fi
    
    # メモリー圧迫確認
    if echo "$metrics" | grep -q "memory_pressure_status"; then
        local memory_pressure=$(echo "$metrics" | grep "memory_pressure_status" | awk '{print $2}')
        case "$memory_pressure" in
            "0") log_success "メモリー状況: GREEN" ;;
            "1") log_warning "メモリー状況: YELLOW"; ((warnings++)) ;;
            "2") log_error "メモリー状況: RED"; ((warnings++)) ;;
        esac
    fi
    
    # ガードレール作動確認
    if echo "$metrics" | grep -q "guardrail_actions_total"; then
        local guardrail_actions=$(echo "$metrics" | grep "guardrail_actions_total" | awk '{print $2}' | head -1)
        if [ "$guardrail_actions" -gt 0 ]; then
            log_warning "ガードレール作動履歴: $guardrail_actions 回"
            ((warnings++))
        else
            log_success "ガードレール正常"
        fi
    fi
    
    if [ $warnings -eq 0 ]; then
        log_success "全SLO項目正常"
    else
        log_warning "$warnings 個のSLO警告あり"
    fi
    
    return $warnings
}

# デプロイ実行
deploy() {
    local model_version="$1"
    local config_version="$2"
    
    if [ -z "$model_version" ] || [ -z "$config_version" ]; then
        log_error "バージョン指定が必要です"
        usage
        exit 1
    fi
    
    log_info "ローリングデプロイ開始: model=$model_version, config=$config_version"
    
    # バージョン存在確認
    if ! check_version_exists "$model_version" "$config_version"; then
        exit 1
    fi
    
    # 現在のバージョン記録
    local current_versions=$(get_current_versions)
    log_info "現在のバージョン: $current_versions"
    
    # アトミック切り替え
    if ! atomic_switch "$model_version" "$config_version"; then
        log_error "切り替え失敗"
        exit 1
    fi
    
    # スモークテスト
    sleep 3  # 少し待機
    if ! smoke_test; then
        log_error "スモークテスト失敗 - ロールバックを検討してください"
        echo "ロールバックコマンド:"
        echo "  $0 rollback ${current_versions//:/ }"
        exit 1
    fi
    
    log_success "デプロイ完了: model=$model_version, config=$config_version"
    
    # SLO確認（警告レベル）
    slo_check
}

# ロールバック実行
rollback() {
    local model_version="$1"
    local config_version="$2"
    
    if [ -z "$model_version" ] || [ -z "$config_version" ]; then
        log_error "ロールバック先バージョン指定が必要です"
        usage
        exit 1
    fi
    
    log_info "緊急ロールバック開始: model=$model_version, config=$config_version"
    
    # バージョン存在確認
    if ! check_version_exists "$model_version" "$config_version"; then
        exit 1
    fi
    
    # アトミック切り替え
    if ! atomic_switch "$model_version" "$config_version"; then
        log_error "ロールバック失敗"
        exit 1
    fi
    
    # 簡易確認
    sleep 2
    if curl -fs http://127.0.0.1:8787/health > /dev/null; then
        log_success "ロールバック完了: model=$model_version, config=$config_version"
    else
        log_error "ロールバック後にAPI疎通失敗"
        exit 1
    fi
}

# 現在の状況確認
status() {
    log_info "現在の状況確認"
    
    # バージョン情報
    local current_versions=$(get_current_versions)
    echo "現在のバージョン: $current_versions"
    
    # サービス状況
    echo ""
    echo "サービス状況:"
    systemctl status baseball-nextjs.service --no-pager -l | head -5
    systemctl status baseball-live-api.service --no-pager -l | head -5
    
    # リソース使用量
    echo ""
    echo "リソース使用量:"
    free -h | grep Mem
    df -h /opt/baseball-ai-media | tail -1
    
    # 最新ログ
    echo ""
    echo "最新ログ (Live API):"
    journalctl -u baseball-live-api -n 3 --no-pager
    
    echo ""
    echo "最新ログ (Next.js):"
    journalctl -u baseball-nextjs -n 3 --no-pager
}

# メイン処理
case "$1" in
    deploy)
        deploy "$2" "$3"
        ;;
    rollback)
        rollback "$2" "$3"
        ;;
    status)
        status
        ;;
    slo-check)
        slo_check
        ;;
    smoke-test)
        smoke_test
        ;;
    *)
        usage
        exit 1
        ;;
esac