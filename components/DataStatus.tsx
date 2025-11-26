// components/DataStatus.tsx
"use client";

import { useState, useEffect } from "react";

export default function DataStatus() {
  const [healthData, setHealthData] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  
  useEffect(() => {
    // Skip API calls during build time
    if (typeof window === 'undefined') {
      return;
    }
    
    const fetchHealth = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL;
        const res = await fetch(`${base}/health`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setHealthData(data);
          
          // タイムスタンプを日本時間で表示
          const timestamp = new Date(data.timestamp);
          setLastUpdate(timestamp.toLocaleString("ja-JP", {
            month: "2-digit",
            day: "2-digit", 
            hour: "2-digit",
            minute: "2-digit"
          }));
        }
      } catch (error) {
        // APIエラー時はモック表示
        setLastUpdate("Mock");
      }
    };
    
    fetchHealth();
    // 5分毎に更新
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  if (!lastUpdate) return null;
  
  const isHealthy = healthData?.status === "healthy";
  const isBasicMode = healthData?.basic_mode;
  
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`px-2 py-1 rounded text-xs font-mono ${
        isHealthy ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
      }`}>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isHealthy ? "bg-green-500" : "bg-gray-400"
          }`} />
          <span>
            {isBasicMode ? "Basic" : "Live"} | {lastUpdate}
          </span>
        </div>
      </div>
    </div>
  );
}