#!/bin/bash
# Historical NPB Data Collection Deployment Script
# Target: 2017-2021 complete season data

echo "🚀 Starting NPB Historical Data Collection Deployment..."
echo "📅 Target Period: 2017-03-01 to 2021-11-30"
echo "📊 Current DB Size: $(sqlite3 data/db_current.db 'SELECT COUNT(*) FROM games;') games"
echo "⏰ Start Time: $(date)"

# Start collection process
nohup npx tsx scripts/npb-historical-scraper.ts 2017-03-01 2021-11-30 > logs/historical_collection_$(date +%Y%m%d_%H%M%S).log 2>&1 &

COLLECTION_PID=$!
echo "📝 Collection Process PID: $COLLECTION_PID"
echo $COLLECTION_PID > collection.pid

echo "✅ Deployment complete!"
echo "📝 Monitor with: tail -f logs/historical_collection_*.log"
echo "📋 Stop with: kill $(cat collection.pid)"
echo "📊 Check progress: sqlite3 data/db_current.db 'SELECT COUNT(*) FROM games;'"