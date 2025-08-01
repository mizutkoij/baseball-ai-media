#!/bin/bash
# check_disk.sh — Pre-backfill disk space validation
# Prevents backfill if disk usage exceeds limits

set -e

LIMIT_GB=1
DATA_DIR="data"
HISTORY_DB="$DATA_DIR/db_history.db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking disk space before backfill..."

# Check if data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}⚠️  Data directory '$DATA_DIR' not found - creating it${NC}"
    mkdir -p "$DATA_DIR"
fi

# Get disk usage in GB
if [ -f "$HISTORY_DB" ]; then
    USAGE_BYTES=$(stat -f%z "$HISTORY_DB" 2>/dev/null || stat -c%s "$HISTORY_DB" 2>/dev/null || echo "0")
    USAGE_GB=$(echo "scale=2; $USAGE_BYTES / 1024 / 1024 / 1024" | bc -l 2>/dev/null || echo "0")
    
    echo "📊 History DB size: ${USAGE_GB} GB"
else
    USAGE_GB=0
    echo "📊 History DB not found - assuming fresh install"
fi

# Check against limit
if (( $(echo "$USAGE_GB > $LIMIT_GB" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${RED}❌ History DB at ${USAGE_GB} GB exceeds ${LIMIT_GB} GB limit${NC}"
    echo "   Consider archiving old data or increasing the limit"
    exit 1
fi

# Check total data directory size
if [ -d "$DATA_DIR" ]; then
    TOTAL_SIZE_MB=$(du -sm "$DATA_DIR" 2>/dev/null | cut -f1 || echo "0")
    TOTAL_SIZE_GB=$(echo "scale=2; $TOTAL_SIZE_MB / 1024" | bc -l 2>/dev/null || echo "0")
    
    echo "📊 Total data directory: ${TOTAL_SIZE_GB} GB"
    
    if (( $(echo "$TOTAL_SIZE_GB > $(echo "$LIMIT_GB * 2" | bc -l)" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${YELLOW}⚠️  Total data directory approaching 2x limit (${TOTAL_SIZE_GB} GB)${NC}"
        echo "   Consider cleanup of temporary files"
    fi
fi

# Check available disk space
AVAILABLE_GB=$(df . | tail -1 | awk '{print $4}' | xargs -I {} echo "scale=2; {} / 1024 / 1024" | bc -l 2>/dev/null || echo "1000")

echo "💾 Available disk space: ${AVAILABLE_GB} GB"

if (( $(echo "$AVAILABLE_GB < 0.5" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${RED}❌ Available disk space (${AVAILABLE_GB} GB) is critically low${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Disk space check passed${NC}"
echo "   Current usage: ${USAGE_GB} GB / ${LIMIT_GB} GB limit"
echo "   Available: ${AVAILABLE_GB} GB"

exit 0