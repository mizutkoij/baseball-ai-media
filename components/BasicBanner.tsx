// components/BasicBanner.tsx
"use client";

import { useState, useEffect } from "react";

export default function BasicBanner() {
  const isBasic = process.env.NEXT_PUBLIC_BASIC_MODE === "true";
  const [nextUpdate, setNextUpdate] = useState<string>("");
  
  useEffect(() => {
    // 次回更新時刻を計算（JST 04:00-06:00窓）
    const now = new Date();
    const jstOffset = 9 * 60; // JST = UTC+9
    const jstNow = new Date(now.getTime() + jstOffset * 60 * 1000);
    
    let nextWindow = new Date(jstNow);
    nextWindow.setHours(4, 0, 0, 0); // 04:00 JST
    
    if (jstNow.getHours() >= 6) {
      // 今日の窓が過ぎていれば明日
      nextWindow.setDate(nextWindow.getDate() + 1);
    }
    
    setNextUpdate(nextWindow.toLocaleString("ja-JP", { 
      month: "numeric", 
      day: "numeric", 
      hour: "2-digit", 
      minute: "2-digit" 
    }));
  }, []);
  
  if (!isBasic) return null;
  
  return (
    <div className="w-full bg-yellow-100 border border-yellow-300 text-yellow-900 text-sm p-3 rounded mb-4">
      <div className="flex items-center justify-between">
        <div>
          🔄 <b>Basicモード</b> で動作中（外部データ一時停止）
        </div>
        <div className="text-xs opacity-75">
          次回更新予定: {nextUpdate}
        </div>
      </div>
    </div>
  );
}