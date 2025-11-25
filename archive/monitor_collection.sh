#!/bin/bash
# Collection Monitoring Script

echo "📊 NPB Historical Data Collection Monitor"
echo "========================================="

while true; do
  echo ""
  echo "⏰ $(date) - Collection Status:"
  
  # Check if collection process is running
  if [ -f collection.pid ]; then
    PID=$(cat collection.pid)
    if ps -p $PID > /dev/null 2>&1; then
      echo "✅ Collection process running (PID: $PID)"
    else
      echo "❌ Collection process stopped"
      rm -f collection.pid
    fi
  else
    echo "ℹ️ No active collection process"
  fi
  
  # Show current DB size
  GAME_COUNT=$(sqlite3 data/db_current.db 'SELECT COUNT(*) FROM games;' 2>/dev/null || echo "0")
  echo "📊 Current DB size: $GAME_COUNT games"
  
  # Show yearly distribution
  echo "📈 Year distribution:"
  sqlite3 data/db_current.db "SELECT substr(date,1,4) as year, COUNT(*) as games FROM games GROUP BY substr(date,1,4) ORDER BY year DESC;" 2>/dev/null || echo "  Database error"
  
  # Show recent log entries
  echo "📝 Recent progress:"
  if ls logs/historical_collection_*.log 1> /dev/null 2>&1; then
    tail -5 logs/historical_collection_*.log | grep -E "(Found|Processing|games|✅)" | tail -3
  else
    echo "  No log files found"
  fi
  
  echo "----------------------------------------"
  sleep 60  # Check every minute
done