#!/usr/bin/env npx tsx
/**
 * 対決予測ライブ統合テスト
 * SSEストリームでmatchupイベントを受信確認
 */

import fetch from "node-fetch";

async function main() {
  const gameId = process.argv[2] || "20250812_G-T_01";
  const port = process.env.LIVE_PORT || "8789";
  const url = `http://localhost:${port}/live/${gameId}/stream?replay=1`;
  
  console.log("🚿 SSE connecting...");
  console.log(`URL: ${url}`);
  
  try {
    const res = await fetch(url);
    
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    console.log("✅ Connected to SSE stream");
    console.log("📡 Listening for events (matchup events will be highlighted)...");
    console.log("=" + "=".repeat(60));
    
    let buffer = "";
    let eventCount = 0;
    
    res.body.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      
      // SSE イベントの解析
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // 不完全な行は残しておく
      
      let currentEvent: { event?: string; id?: string; data?: string } = {};
      
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent.event = line.substring(7);
        } else if (line.startsWith("id: ")) {
          currentEvent.id = line.substring(4);
        } else if (line.startsWith("data: ")) {
          currentEvent.data = line.substring(6);
        } else if (line === "" && currentEvent.event && currentEvent.data) {
          // イベント完了
          eventCount++;
          
          if (currentEvent.event === "matchup") {
            console.log(`\n🎯 MATCHUP EVENT #${eventCount} (ID: ${currentEvent.id})`);
            console.log("📊 " + "=".repeat(50));
            
            try {
              const data = JSON.parse(currentEvent.data);
              console.log(`⚾ Batter: ${data.batterId} vs Pitcher: ${data.pitcherId}`);
              console.log(`📈 Reach Probability: ${(data.p_reach * 100).toFixed(1)}%`);
              console.log(`🎯 Confidence: ${data.conf.toUpperCase()}`);
              console.log(`⏰ Timestamp: ${data.ts}`);
              console.log(`🏟️ Game: ${data.gameId}, PA: ${data.pa_seq}`);
              
              if (data.features) {
                console.log(`🔧 Features: ${Object.keys(data.features).length} dimensions`);
                console.log(`   - Inning: ${data.features.inning}, Outs: ${data.features.outs}`);
                console.log(`   - Score Diff: ${data.features.scoreDiff}, Leverage: ${data.features.leverage?.toFixed(2)}`);
              }
            } catch (e) {
              console.log("Raw data:", currentEvent.data);
            }
            
            console.log("=".repeat(60));
          } else if (currentEvent.event === "update") {
            // 通常の勝率更新は簡潔に
            try {
              const data = JSON.parse(currentEvent.data);
              console.log(`⚡ Win Prob Update: ${(data.p_home * 100).toFixed(1)}% (${data.inning}回${data.top ? '表' : '裏'})`);
            } catch (e) {
              console.log(`⚡ Update Event (ID: ${currentEvent.id})`);
            }
          } else {
            console.log(`📟 Event: ${currentEvent.event} (ID: ${currentEvent.id})`);
          }
          
          currentEvent = {};
        } else if (line.startsWith(": ")) {
          // ハートビート
          process.stdout.write("💓");
        }
      }
    });
    
    res.body.on("end", () => {
      console.log("\n🔌 Stream ended");
    });
    
    res.body.on("error", (error) => {
      console.error("❌ Stream error:", error.message);
    });
    
    // 10秒後に終了（テスト用）
    setTimeout(() => {
      console.log("\n⏰ Test timeout reached, disconnecting...");
      res.body.destroy();
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    
    if (error.message.includes("ECONNREFUSED")) {
      console.log("\n💡 Troubleshooting:");
      console.log("   • Make sure live server is running: npm run serve:live");
      console.log("   • Check if port 8787 is available");
      console.log("   • Verify game data exists in data/predictions/live/");
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });
}