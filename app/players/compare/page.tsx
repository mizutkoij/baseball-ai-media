"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Head from "next/head";
import { ArrowLeft, Search, Users, BarChart3, Target, Activity, Zap, Share2, Copy } from "lucide-react";
import { 
  comparePlayersSimilarity, 
  convertToPlayerStats, 
  type PlayerStats, 
  type ComparisonResult 
} from "@/lib/playerComparison";

interface PlayerSearchResult {
  player_id: string;
  name: string;
  primary_pos: "P" | "B";
  is_active: boolean;
  last_year?: number;
}

// Mock radar chart component (you can replace with recharts later)
const RadarChart = ({ 
  categories, 
  player1Values, 
  player2Values, 
  player1Name, 
  player2Name 
}: {
  categories: string[];
  player1Values: number[];
  player2Values: number[];
  player1Name: string;
  player2Name: string;
}) => {
  // This is a simplified radar chart visualization
  const size = 200;
  const center = size / 2;
  const maxRadius = size / 2 - 20;
  
  const angleStep = (2 * Math.PI) / categories.length;
  
  const getPoint = (value: number, index: number) => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    };
  };
  
  const player1Points = player1Values.map((value, index) => getPoint(value, index));
  const player2Points = player2Values.map((value, index) => getPoint(value, index));
  
  const createPath = (points: Array<{x: number; y: number}>) => {
    return points.map((point, index) => 
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ') + ' Z';
  };
  
  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 text-center">能力比較レーダーチャート</h3>
      <div className="flex justify-center">
        <svg width={size} height={size} className="overflow-visible">
          {/* Grid circles */}
          {[20, 40, 60, 80, 100].map(radius => (
            <circle
              key={radius}
              cx={center}
              cy={center}
              r={(radius / 100) * maxRadius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          ))}
          
          {/* Grid lines */}
          {categories.map((_, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const endX = center + maxRadius * Math.cos(angle);
            const endY = center + maxRadius * Math.sin(angle);
            return (
              <line
                key={index}
                x1={center}
                y1={center}
                x2={endX}
                y2={endY}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            );
          })}
          
          {/* Player 2 area (background) */}
          <path
            d={createPath(player2Points)}
            fill="rgba(239, 68, 68, 0.2)"
            stroke="rgb(239, 68, 68)"
            strokeWidth="2"
          />
          
          {/* Player 1 area (foreground) */}
          <path
            d={createPath(player1Points)}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="rgb(59, 130, 246)"
            strokeWidth="2"
          />
          
          {/* Data points */}
          {player1Points.map((point, index) => (
            <circle
              key={`p1-${index}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="rgb(59, 130, 246)"
            />
          ))}
          {player2Points.map((point, index) => (
            <circle
              key={`p2-${index}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="rgb(239, 68, 68)"
            />
          ))}
          
          {/* Category labels */}
          {categories.map((category, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const labelRadius = maxRadius + 15;
            const x = center + labelRadius * Math.cos(angle);
            const y = center + labelRadius * Math.sin(angle);
            return (
              <text
                key={category}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs fill-slate-300"
              >
                {category}
              </text>
            );
          })}
        </svg>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-sm text-slate-300">{player1Name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-sm text-slate-300">{player2Name}</span>
        </div>
      </div>
    </div>
  );
};

export default function PlayerComparePage() {
  const searchParams = useSearchParams();
  
  // Parse ids parameter (comma-separated) or fallback to p1/p2
  const parsePlayerIds = () => {
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(id => id.trim()).filter(id => id);
      return [ids[0] || "", ids[1] || ""];
    }
    return [searchParams.get("p1") || "", searchParams.get("p2") || ""];
  };
  
  const [playerIds, setPlayerIds] = useState(parsePlayerIds());
  const [player1Id, player2Id] = playerIds;
  
  const setPlayer1Id = (id: string) => setPlayerIds([id, playerIds[1]]);
  const setPlayer2Id = (id: string) => setPlayerIds([playerIds[0], id]);
  const [player1Data, setPlayer1Data] = useState<any>(null);
  const [player2Data, setPlayer2Data] = useState<any>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState<"player1" | "player2" | null>(null);
  const [loading, setLoading] = useState(false);

  // Update state when URL params change
  useEffect(() => {
    const newPlayerIds = parsePlayerIds();
    setPlayerIds(newPlayerIds);
  }, [searchParams]);

  // Load player data when IDs change
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!player1Id || !player2Id) return;
      
      setLoading(true);
      try {
        const [p1Response, p2Response] = await Promise.all([
          fetch(`/data/players/players/${player1Id}.json`),
          fetch(`/data/players/players/${player2Id}.json`)
        ]);
        
        if (p1Response.ok && p2Response.ok) {
          const p1Data = await p1Response.json();
          const p2Data = await p2Response.json();
          
          setPlayer1Data(p1Data);
          setPlayer2Data(p2Data);
          
          // Calculate comparison
          const p1Stats = convertToPlayerStats(p1Data);
          const p2Stats = convertToPlayerStats(p2Data);
          const comparisonResult = comparePlayersSimilarity(p1Stats, p2Stats);
          setComparison(comparisonResult);
        }
      } catch (error) {
        console.error("Error loading player data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPlayerData();
  }, [player1Id, player2Id]);

  // Search for players
  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      // This would ideally be a proper search API
      // For now, we'll simulate with a static search
      const response = await fetch('/data/players/players_index.json');
      if (response.ok) {
        const allPlayers = await response.json();
        const filtered = allPlayers
          .filter((p: any) => p.name.includes(query))
          .slice(0, 10);
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    }
  };

  const updateURL = (newPlayerIds: [string, string]) => {
    const validIds = newPlayerIds.filter(id => id);
    if (validIds.length > 0) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('ids', validIds.join(','));
      // Remove old p1/p2 params if they exist
      newUrl.searchParams.delete('p1');
      newUrl.searchParams.delete('p2');
      window.history.replaceState({}, '', newUrl.toString());
    }
  };

  const selectPlayer = (player: PlayerSearchResult) => {
    let newPlayerIds: [string, string];
    if (activeSearch === "player1") {
      newPlayerIds = [player.player_id, playerIds[1]];
      setPlayer1Id(player.player_id);
    } else if (activeSearch === "player2") {
      newPlayerIds = [playerIds[0], player.player_id];
      setPlayer2Id(player.player_id);
    } else {
      return;
    }
    
    updateURL(newPlayerIds);
    setActiveSearch(null);
    setSearchResults([]);
    setSearchQuery("");
  };

  const formatStatValue = (value: number, stat: string) => {
    if (['avg', 'obp', 'slg', 'ops', 'era', 'whip', 'fip'].includes(stat)) {
      return value.toFixed(3);
    }
    if (stat.includes('pct') || stat.includes('%')) {
      return value.toFixed(1) + '%';
    }
    return Math.round(value).toString();
  };

  const getStatDisplayName = (stat: string) => {
    const names: Record<string, string> = {
      'avg': '打率', 'obp': '出塁率', 'slg': '長打率', 'ops': 'OPS',
      'ops_plus': 'OPS+', 'wrc_plus': 'wRC+', 'iso': 'ISO',
      'bb_pct': '四球率', 'k_pct': '三振率', 'hr': '本塁打', 'rbi': '打点',
      'era': '防御率', 'whip': 'WHIP', 'fip': 'FIP', 'era_minus': 'ERA-',
      'k9': 'K/9', 'bb9': 'BB/9', 'k_minus_bb_pct': 'K-BB%', 'w': '勝利', 'ip': '投球回'
    };
    return names[stat] || stat;
  };

  const copyComparisonURL = async () => {
    const validIds = playerIds.filter(id => id);
    if (validIds.length === 0) return;
    
    const url = new URL(window.location.href);
    url.searchParams.set('ids', validIds.join(','));
    url.searchParams.delete('p1');
    url.searchParams.delete('p2');
    
    try {
      await navigator.clipboard.writeText(url.toString());
      // Show a temporary success message (you could add a toast here)
      console.log('URL copied to clipboard');
      
      // Track analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'comparison_url_copy', {
          player1_id: playerIds[0],
          player2_id: playerIds[1],
          player1_name: player1Data?.name,
          player2_name: player2Data?.name
        });
      }
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  // Generate dynamic head metadata
  const generateHeadMetadata = () => {
    if (!player1Data || !player2Data) return null;
    
    const title = `${player1Data.name} vs ${player2Data.name} - 選手比較`;
    const description = `${player1Data.name}と${player2Data.name}の詳細統計比較。コサイン類似度による統計的類似性とレーダーチャートで視覚的に比較。`;
    const validIds = playerIds.filter(id => id);
    const ogImageUrl = validIds.length === 2 
      ? `/api/og/compare?ids=${validIds.join(',')}`
      : null;
    
    return {
      title,
      description,
      ogImageUrl
    };
  };

  const headMetadata = generateHeadMetadata();

  return (
    <>
      {headMetadata && (
        <Head>
          <title>{headMetadata.title}</title>
          <meta name="description" content={headMetadata.description} />
          <meta property="og:title" content={headMetadata.title} />
          <meta property="og:description" content={headMetadata.description} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
          {headMetadata.ogImageUrl && (
            <>
              <meta property="og:image" content={headMetadata.ogImageUrl} />
              <meta property="og:image:width" content="1200" />
              <meta property="og:image:height" content="630" />
              <meta property="og:image:alt" content={headMetadata.title} />
            </>
          )}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={headMetadata.title} />
          <meta name="twitter:description" content={headMetadata.description} />
          {headMetadata.ogImageUrl && (
            <meta name="twitter:image" content={headMetadata.ogImageUrl} />
          )}
        </Head>
      )}
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/players"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              選手一覧に戻る
            </Link>
            
            {/* Share Button */}
            {player1Data && player2Data && (
              <button
                onClick={copyComparisonURL}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                比較を共有
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-8 h-8 text-purple-500" />
            <h1 className="text-4xl font-bold text-white">選手比較ツール</h1>
          </div>
          
          <p className="text-lg text-slate-300">
            2人の選手を詳細比較。コサイン類似度による統計的類似性とレーダーチャートで視覚的に比較します。
          </p>
        </div>

        {/* Player Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Player 1 Selection */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              選手1を選択
            </h3>
            
            {player1Data ? (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{player1Data.name}</h4>
                    <p className="text-sm text-slate-300">
                      {player1Data.primary_pos === "P" ? "投手" : "野手"} | 
                      {player1Data.is_active ? " 現役" : " OB"}
                    </p>
                  </div>
                  <button
                    onClick={() => setPlayer1Id("")}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    変更
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="選手名で検索..."
                    value={activeSearch === "player1" ? searchQuery : ""}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchPlayers(e.target.value);
                    }}
                    onFocus={() => setActiveSearch("player1")}
                    className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-slate-400"
                  />
                </div>
                
                {activeSearch === "player1" && searchResults.length > 0 && (
                  <div className="mt-2 bg-black/30 border border-white/20 rounded-lg max-h-60 overflow-y-auto">
                    {searchResults.map((player) => (
                      <button
                        key={player.player_id}
                        onClick={() => selectPlayer(player)}
                        className="w-full p-3 text-left hover:bg-white/5 transition-colors border-b border-white/10 last:border-b-0"
                      >
                        <div className="text-white font-medium">{player.name}</div>
                        <div className="text-sm text-slate-400">
                          {player.primary_pos === "P" ? "投手" : "野手"} | 
                          {player.is_active ? " 現役" : " OB"} |
                          {player.last_year && ` ${player.last_year}年`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Player 2 Selection */}
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-500" />
              選手2を選択
            </h3>
            
            {player2Data ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{player2Data.name}</h4>
                    <p className="text-sm text-slate-300">
                      {player2Data.primary_pos === "P" ? "投手" : "野手"} | 
                      {player2Data.is_active ? " 現役" : " OB"}
                    </p>
                  </div>
                  <button
                    onClick={() => setPlayer2Id("")}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    変更
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="選手名で検索..."
                    value={activeSearch === "player2" ? searchQuery : ""}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchPlayers(e.target.value);
                    }}
                    onFocus={() => setActiveSearch("player2")}
                    className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-slate-400"
                  />
                </div>
                
                {activeSearch === "player2" && searchResults.length > 0 && (
                  <div className="mt-2 bg-black/30 border border-white/20 rounded-lg max-h-60 overflow-y-auto">
                    {searchResults.map((player) => (
                      <button
                        key={player.player_id}
                        onClick={() => selectPlayer(player)}
                        className="w-full p-3 text-left hover:bg-white/5 transition-colors border-b border-white/10 last:border-b-0"
                      >
                        <div className="text-white font-medium">{player.name}</div>
                        <div className="text-sm text-slate-400">
                          {player.primary_pos === "P" ? "投手" : "野手"} | 
                          {player.is_active ? " 現役" : " OB"} |
                          {player.last_year && ` ${player.last_year}年`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Comparison Results */}
        {comparison && player1Data && player2Data && (
          <div className="space-y-8">
            {/* Similarity Score */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-6 h-6 text-yellow-500" />
                <h2 className="text-xl font-semibold text-white">類似度スコア</h2>
              </div>
              
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-400 mb-2">
                  {(comparison.similarity * 100).toFixed(1)}%
                </div>
                <div className="text-slate-300">
                  コサイン類似度による統計的類似性
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  {comparison.similarity > 0.8 ? "非常に似たタイプ" :
                   comparison.similarity > 0.6 ? "やや似たタイプ" :
                   comparison.similarity > 0.4 ? "異なるタイプ" : "全く異なるタイプ"}
                </div>
              </div>
            </div>

            {/* Radar Chart */}
            {comparison.radarData.categories.length > 0 && (
              <RadarChart
                categories={comparison.radarData.categories}
                player1Values={comparison.radarData.player1Values}
                player2Values={comparison.radarData.player2Values}
                player1Name={player1Data.name}
                player2Name={player2Data.name}
              />
            )}

            {/* Detailed Comparison Table */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-green-500" />
                <h2 className="text-xl font-semibold text-white">詳細比較</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-black/30 border-b border-white/20">
                      <th className="text-left p-3 font-medium text-white">指標</th>
                      <th className="text-right p-3 font-medium text-blue-400">{player1Data.name}</th>
                      <th className="text-right p-3 font-medium text-red-400">{player2Data.name}</th>
                      <th className="text-right p-3 font-medium text-white">差</th>
                      <th className="text-right p-3 font-medium text-white">差 (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.differences.slice(0, 10).map((diff, i) => (
                      <tr key={diff.stat} className={i % 2 === 0 ? "bg-black/10" : "bg-black/20"}>
                        <td className="p-3 font-medium text-white">
                          {getStatDisplayName(diff.stat)}
                        </td>
                        <td className="p-3 text-right text-blue-400">
                          {formatStatValue(diff.player1Value, diff.stat)}
                        </td>
                        <td className="p-3 text-right text-red-400">
                          {formatStatValue(diff.player2Value, diff.stat)}
                        </td>
                        <td className={`p-3 text-right font-medium ${
                          diff.difference > 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {diff.difference > 0 ? "+" : ""}{formatStatValue(Math.abs(diff.difference), diff.stat)}
                        </td>
                        <td className={`p-3 text-right font-medium ${
                          Math.abs(diff.percentDiff) > 20 ? "text-yellow-400" : "text-slate-300"
                        }`}>
                          {diff.percentDiff > 0 ? "+" : ""}{diff.percentDiff.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
            <p className="text-slate-400">選手データを読み込み中...</p>
          </div>
        )}

        {/* Enhanced Empty State / Guide */}
        {!comparison && !loading && (
          <div className="space-y-8">
            {/* Main Empty State */}
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">選手を選択してください</h3>
              <p className="text-slate-400 mb-6">
                2人の選手を選択すると、詳細な統計比較が表示されます
              </p>
              
              {/* Quick Actions */}
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/players?pos=B&active=ACTIVE"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  <Target className="w-4 h-4" />
                  現役野手から選ぶ
                </Link>
                <Link
                  href="/players?pos=P&active=ACTIVE"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  <Activity className="w-4 h-4" />
                  現役投手から選ぶ
                </Link>
                <Link
                  href="/players"
                  className="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  <Search className="w-4 h-4" />
                  全選手から探す
                </Link>
              </div>
            </div>
            
            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">類似度スコア</h4>
                <p className="text-sm text-slate-400">
                  コサイン類似度により統計的な類似性を0-100%で数値化
                </p>
              </div>
              
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-purple-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">レーダーチャート</h4>
                <p className="text-sm text-slate-400">
                  主要指標を正規化してレーダーチャートで視覚的に比較
                </p>
              </div>
              
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Share2 className="w-6 h-6 text-green-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">共有機能</h4>
                <p className="text-sm text-slate-400">
                  比較結果をURLで簡単共有。SNSでの議論にも最適
                </p>
              </div>
            </div>
            
            {/* Sample Comparisons */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-4 text-center">
                人気の比較例
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  href="/players/compare?ids=sample1,sample2"
                  className="block p-4 bg-black/30 hover:bg-black/40 border border-white/10 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">山田 哲人 vs 坂本 勇人</p>
                      <p className="text-sm text-slate-400">遊撃手の名手対決</p>
                    </div>
                    <div className="text-xs text-green-400 font-medium">93%</div>
                  </div>
                </Link>
                
                <Link
                  href="/players/compare?ids=sample3,sample4"
                  className="block p-4 bg-black/30 hover:bg-black/40 border border-white/10 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">菅野 智之 vs 今永 昇太</p>
                      <p className="text-sm text-slate-400">左右のエース対決</p>
                    </div>
                    <div className="text-xs text-green-400 font-medium">87%</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-xs text-slate-400 text-center space-y-1">
          <p>※ 類似度はコサイン類似度により算出（1.0が完全一致、0.0が完全不一致）</p>
          <p>※ レーダーチャートは正規化された指標値（0-100スケール）で表示</p>
          <p>※ 投手と野手は異なる指標で比較されます</p>
        </div>
      </div>
    </div>
    </>
  );
}