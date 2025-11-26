"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, ExternalLink } from "lucide-react";

interface SimilarPlayer {
  player_id: string;
  name: string;
  primary_pos: "P" | "B";
  similarity: number;
  first_year?: number;
  last_year?: number;
  is_active?: boolean;
}

interface SimilarPlayersProps {
  playerId: string;
  playerName: string;
  limit?: number;
}

export default function SimilarPlayers({ playerId, playerName, limit = 3 }: SimilarPlayersProps) {
  const [similarPlayers, setSimilarPlayers] = useState<SimilarPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSimilarPlayers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/players/${playerId}/similar?limit=${limit}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch similar players");
        }
        
        const data = await response.json();
        setSimilarPlayers(data);
      } catch (err) {
        console.error("Error fetching similar players:", err);
        setError("似ている選手の取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSimilarPlayers();
  }, [playerId, limit]);

  const handleSimilarPlayerClick = (targetPlayerId: string, targetPlayerName: string, similarity: number) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'similar_player_click', {
        source_player_id: playerId,
        target_player_id: targetPlayerId,
        source_player_name: playerName,
        target_player_name: targetPlayerName,
        similarity_score: similarity
      });
    }
  };

  const handleCompareClick = (targetPlayerId: string, targetPlayerName: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'compare_from_similar_click', {
        source_player_id: playerId,
        target_player_id: targetPlayerId,
        source_player_name: playerName,
        target_player_name: targetPlayerName
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-white">似ている選手</h3>
        </div>
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 bg-slate-600 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || similarPlayers.length === 0) {
    return (
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-white">似ている選手</h3>
        </div>
        <div className="text-slate-400 text-sm">
          {error || "類似する選手が見つかりませんでした"}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-white">似ている選手</h3>
        <span className="text-xs text-slate-400 ml-auto">類似度基準</span>
      </div>
      <div className="space-y-3">
        {similarPlayers.map((player, index) => (
          <div key={player.player_id} className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs font-medium text-slate-400 w-4 text-center">
                {index + 1}
              </span>
              <Link
                href={`/players/${player.player_id}`}
                className="text-sm text-amber-400 hover:text-amber-300 font-medium truncate"
                onClick={() => handleSimilarPlayerClick(player.player_id, player.name, player.similarity)}
              >
                {player.name}
              </Link>
              <span className="text-xs text-green-400 font-medium">
                {Math.round(player.similarity * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {player.last_year && (
                <span className="text-xs text-slate-400">
                  {player.is_active ? '現役' : player.last_year}
                </span>
              )}
              <Link
                href={`/players/compare?ids=${playerId},${player.player_id}`}
                className="text-xs text-blue-400 hover:text-blue-300 p-1 hover:bg-blue-400/10 rounded transition-colors"
                title="比較する"
                onClick={() => handleCompareClick(player.player_id, player.name)}
              >
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-white/10">
        <Link
          href={`/players/compare?ids=${playerId}`}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).gtag) {
              (window as any).gtag('event', 'compare_page_from_similar', {
                player_id: playerId,
                player_name: playerName
              });
            }
          }}
        >
          選手比較ページで詳細に比較 →
        </Link>
      </div>
    </div>
  );
}