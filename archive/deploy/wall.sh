#!/usr/bin/env bash
# Baseball AI Media - 壁打ちウォール（1秒ごとメトリクス可視化）
# 使い方: bash deploy/wall.sh [metrics-url]

URL=${1:-http://127.0.0.1:8787/metrics}
C_GRN="\033[32m"; C_YEL="\033[33m"; C_RED="\033[31m"; C_RST="\033[0m"; C_BLU="\033[34m"

echo -e "${C_BLU}⚾ Baseball AI Media - 壁打ちモニター${C_RST}"
echo "==============================================="
echo "URL: $URL"
echo "Ctrl+C で停止"
echo ""

while true; do
  M=$(curl -s --max-time 2 "$URL" 2>/dev/null)
  
  if [ -z "$M" ]; then
    printf "${C_RED}❌ メトリクス取得失敗 - サービス確認が必要${C_RST}\r"
    sleep 1
    continue
  fi
  
  # SSE接続数
  sse=$(echo "$M" | awk -F' ' '/^live_sse_connections/ {sum+=$2} END{print sum+0}')
  
  # PbP遅延 P95
  lag=$(echo "$M" | awk -F' ' '/pbp_event_lag_seconds.*quantile.*0\.95/ {print $2; exit}')
  lag=${lag:-0}
  
  # 予測鮮度 P95
  age=$(echo "$M" | awk -F' ' '/live_prediction_age_seconds.*quantile.*0\.95/ {print $2; exit}')
  age=${age:-0}
  
  # カバレッジ率
  cov_total=$(echo "$M" | awk -F' ' '/^coverage_pitches_total/ {sum+=$2} END{print sum+0}')
  exp_total=$(echo "$M" | awk -F' ' '/^expected_pitches_total/ {sum+=$2} END{print sum+0}')
  if [ "$exp_total" -gt 0 ]; then
    cov=$(echo "scale=3; $cov_total / $exp_total" | bc -l)
  else
    cov="0"
  fi
  
  # NextPitch レイテンシ P95
  nlat=$(echo "$M" | awk -F' ' '/nextpitch_predict_latency_ms.*quantile.*0\.95/ {print $2; exit}')
  nlat=${nlat:-0}
  
  # メモリー圧迫状況
  mem_pressure=$(echo "$M" | awk -F' ' '/^memory_pressure_status/ {print $2; exit}')
  mem_pressure=${mem_pressure:-0}
  
  # ガードレール作動
  guardrail=$(echo "$M" | awk -F' ' '/^guardrail_actions_total/ {sum+=$2} END{print sum+0}')
  
  # 色分け判定
  ssec=$C_GRN; [ "$sse" -gt 500 ] && ssec=$C_YEL; [ "$sse" -gt 1000 ] && ssec=$C_RED
  
  covc=$C_GRN
  if [ "$(echo "$cov < 0.98" | bc -l)" -eq 1 ]; then covc=$C_YEL; fi
  if [ "$(echo "$cov < 0.95" | bc -l)" -eq 1 ]; then covc=$C_RED; fi
  
  lagc=$C_GRN
  if [ "$(echo "$lag > 15" | bc -l)" -eq 1 ]; then lagc=$C_YEL; fi
  if [ "$(echo "$lag > 25" | bc -l)" -eq 1 ]; then lagc=$C_RED; fi
  
  agec=$C_GRN
  if [ "$(echo "$age > 10" | bc -l)" -eq 1 ]; then agec=$C_YEL; fi
  if [ "$(echo "$age > 20" | bc -l)" -eq 1 ]; then agec=$C_RED; fi
  
  nlatc=$C_GRN
  if [ "$(echo "$nlat > 80" | bc -l)" -eq 1 ]; then nlatc=$C_YEL; fi
  if [ "$(echo "$nlat > 100" | bc -l)" -eq 1 ]; then nlatc=$C_RED; fi
  
  memc=$C_GRN
  case "$mem_pressure" in
    "1") memc=$C_YEL ;;
    "2") memc=$C_RED ;;
  esac
  
  guardc=$C_GRN; [ "$guardrail" -gt 0 ] && guardc=$C_YEL; [ "$guardrail" -gt 3 ] && guardc=$C_RED
  
  # 時刻表示
  timestamp=$(date '+%H:%M:%S')
  
  # ステータス表示（1行）
  printf "${C_BLU}%s${C_RST} | SSE:%s%-4s${C_RST} | Coverage:%s%5.1f%%${C_RST} | Lag:%s%4.1fs${C_RST} | Age:%s%4.1fs${C_RST} | NextPitch:%s%3.0fms${C_RST} | Mem:%s%s${C_RST} | Guard:%s%s${C_RST}\r" \
    "$timestamp" \
    "$ssec" "$sse" \
    "$covc" "$(echo "$cov * 100" | bc -l)" \
    "$lagc" "$lag" \
    "$agec" "$age" \
    "$nlatc" "$nlat" \
    "$memc" "$mem_pressure" \
    "$guardc" "$guardrail"
  
  sleep 1
done