// components/WarLeadersContainer.tsx
"use client";

import { useState, useEffect } from "react";
import { getWarLeaders } from "@/lib/api";
import WarLeadersCard from "./WarLeadersCard";
import { SkeletonList } from "./SkeletonCard";

export default function WarLeadersContainer() {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const result = await getWarLeaders(10);
        setData(result?.data ?? []);
        setSource(result?.source ?? "unknown");
      } catch (error) {
        console.error("Failed to fetch WAR leaders:", error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-5 h-5 bg-blue-400 rounded animate-pulse" />
          <h2 className="text-xl font-bold">WAR Leaders</h2>
        </div>
        <SkeletonList />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* データソース表示 */}
      {source && (
        <div className="absolute top-2 right-2 z-10">
          <span className={`text-xs px-2 py-1 rounded ${
            source === "mock" ? "bg-yellow-500/20 text-yellow-400" :
            source.includes("neutral") ? "bg-blue-500/20 text-blue-400" :
            "bg-green-500/20 text-green-400"
          }`}>
            {source === "mock" ? "Mock" : "Live"}
          </span>
        </div>
      )}
      <WarLeadersCard data={data || []} />
    </div>
  );
}