#!/bin/bash
# Baseball AI Media - 最後の2チェック（本番投球前）

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "⚾ Baseball AI Media - 最終投球前チェック"
echo "=========================================="

# 1) 本番 Next.js がdevバナー無しで稼働確認
echo -e "\n🌐 チェック1: Next.js本番モード確認"
echo "=================================="

NEXTJS_CHECK=$(timeout 10 curl -s 127.0.0.1:3000 2>/dev/null | head -1 || echo "CONNECTION_FAILED")

if [[ "$NEXTJS_CHECK" == "CONNECTION_FAILED" ]]; then
    echo -e "${RED}❌ Next.js接続失敗 - サービス確認が必要${NC}"
    echo "確認コマンド: systemctl status baseball-nextjs"
    exit 1
elif echo "$NEXTJS_CHECK" | grep -qi "development\|dev"; then
    echo -e "${RED}❌ Next.js開発モードで稼働中！${NC}"
    echo "修正必要: npm run build && systemctl restart baseball-nextjs"
    exit 1
else
    echo -e "${GREEN}✅ Next.js本番モード確認 - devバナー無し${NC}"
fi

# 2) ロールバック速度テスト（演習）
echo -e "\n🔄 チェック2: ロールバック30秒テスト"
echo "=================================="

# 現在のバージョン取得
CURRENT_MODEL=""
CURRENT_CONFIG=""

if [ -L "/opt/baseball-ai-media/models/nextpitch/current" ]; then
    CURRENT_MODEL=$(basename "$(readlink /opt/baseball-ai-media/models/nextpitch/current)")
fi

if [ -L "/opt/baseball-ai-media/config/live-params.json" ]; then
    CONFIG_FILE=$(basename "$(readlink /opt/baseball-ai-media/config/live-params.json)")
    CURRENT_CONFIG=$(echo "$CONFIG_FILE" | sed 's/live-params\.\(.*\)\.json/\1/')
fi

if [ -z "$CURRENT_MODEL" ] || [ -z "$CURRENT_CONFIG" ]; then
    echo -e "${YELLOW}⚠️ 現在のバージョン確認できず - ロールバックテストスキップ${NC}"
    echo "手動確認: ls -la /opt/baseball-ai-media/models/nextpitch/current"
else
    echo "現在のバージョン: model=$CURRENT_MODEL, config=$CURRENT_CONFIG"
    
    # 利用可能なバージョン確認
    AVAILABLE_MODELS=($(ls -1 /opt/baseball-ai-media/models/nextpitch/versions/ 2>/dev/null || echo ""))
    AVAILABLE_CONFIGS=($(ls -1 /opt/baseball-ai-media/config/versions/live-params.*.json 2>/dev/null | sed 's/.*live-params\.\(.*\)\.json/\1/' || echo ""))
    
    if [ ${#AVAILABLE_MODELS[@]} -ge 2 ] && [ ${#AVAILABLE_CONFIGS[@]} -ge 2 ]; then
        # テスト用バージョン選択（現在と異なる最新）
        TEST_MODEL=""
        TEST_CONFIG=""
        
        for model in "${AVAILABLE_MODELS[@]}"; do
            if [ "$model" != "$CURRENT_MODEL" ]; then
                TEST_MODEL="$model"
                break
            fi
        done
        
        for config in "${AVAILABLE_CONFIGS[@]}"; do
            if [ "$config" != "$CURRENT_CONFIG" ]; then
                TEST_CONFIG="$config"
                break
            fi
        done
        
        if [ -n "$TEST_MODEL" ] && [ -n "$TEST_CONFIG" ]; then
            echo "ロールバックテスト実行: $TEST_MODEL / $TEST_CONFIG → $CURRENT_MODEL / $CURRENT_CONFIG"
            
            # タイマー開始
            START_TIME=$(date +%s)
            
            # テストバージョンに切り替え
            echo "  → テストバージョンに切り替え..."
            if ./deploy/production-ops.sh deploy "$TEST_MODEL" "$TEST_CONFIG" >/dev/null 2>&1; then
                
                # 元に戻す（ロールバック）
                echo "  → 元バージョンにロールバック..."
                if ./deploy/production-ops.sh rollback "$CURRENT_MODEL" "$CURRENT_CONFIG" >/dev/null 2>&1; then
                    
                    END_TIME=$(date +%s)
                    ROLLBACK_TIME=$((END_TIME - START_TIME))
                    
                    if [ $ROLLBACK_TIME -le 30 ]; then
                        echo -e "${GREEN}✅ ロールバック成功: ${ROLLBACK_TIME}秒 (目標: ≤30秒)${NC}"
                    else
                        echo -e "${YELLOW}⚠️ ロールバック完了: ${ROLLBACK_TIME}秒 (目標超過)${NC}"
                    fi
                else
                    echo -e "${RED}❌ ロールバック失敗${NC}"
                    exit 1
                fi
            else
                echo -e "${RED}❌ テストデプロイ失敗${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️ テスト用バージョン不足 - ロールバックテストスキップ${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ 利用可能バージョン不足 - ロールバックテストスキップ${NC}"
    fi
fi

# 最終確認
echo -e "\n🎯 最終確認"
echo "=========="

# サービス状況
NEXTJS_STATUS=$(systemctl is-active baseball-nextjs 2>/dev/null || echo "inactive")
LIVEAPI_STATUS=$(systemctl is-active baseball-live-api 2>/dev/null || echo "inactive")

if [ "$NEXTJS_STATUS" = "active" ] && [ "$LIVEAPI_STATUS" = "active" ]; then
    echo -e "${GREEN}✅ 全サービス稼働中${NC}"
else
    echo -e "${RED}❌ サービス状態異常: Next.js=$NEXTJS_STATUS, Live-API=$LIVEAPI_STATUS${NC}"
    exit 1
fi

# nginx確認
if nginx -t >/dev/null 2>&1; then
    echo -e "${GREEN}✅ nginx設定正常${NC}"
else
    echo -e "${RED}❌ nginx設定エラー${NC}"
    exit 1
fi

echo -e "\n${GREEN}🚀 最終チェック完了 - 投球開始準備OK！${NC}"
echo ""
echo "ゲームデー運用コマンド:"
echo "  T-24h: npx tsx scripts/game-day-ops.ts T-24h"
echo "  T-0:   npx tsx scripts/game-day-ops.ts T-0"
echo "  Live:  npx tsx scripts/game-day-ops.ts Live"
echo ""
echo "⚾ いよいよ開幕です！Baseball AI Media 投球開始！ 🚀"