import { NextRequest, NextResponse } from "next/server";
import { similarityCacheManager, type SimilarPlayerResult } from "@/lib/similarityCache";

// Memory cache for API responses (shorter duration since similarity cache handles the heavy lifting)
const cache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const playerId = params.id;
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "3");
  const activeOnly = searchParams.get("activeOnly") === "true";
  const sameEra = searchParams.get("sameEra") === "true";

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const cacheKey = `${playerId}_${limit}_${activeOnly}_${sameEra}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  try {
    // Use fast similarity cache for computation
    const similarPlayers = await similarityCacheManager.findSimilarPlayers(
      playerId,
      limit,
      {
        minSimilarity: 0.1, // Filter out very low similarities
        activeOnly,
        sameEra
      }
    );

    // Format response
    const result = similarPlayers.map((player) => ({
      player_id: player.player_id,
      name: player.name,
      primary_pos: player.primary_pos,
      similarity: Math.round(player.similarity * 100) / 100,
      first_year: undefined, // Could be added to cache if needed
      last_year: player.last_year,
      is_active: player.is_active,
    }));

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: now });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Similar players API error:", error);
    
    // Check if it's a cache-not-found error
    if (error.message.includes('not found in similarity cache')) {
      return NextResponse.json({ 
        error: "player_not_found",
        message: "Player not found in similarity database" 
      }, { status: 404 });
    }
    
    if (error.message.includes('Similarity cache not available')) {
      return NextResponse.json({ 
        error: "cache_not_available",
        message: "Similarity cache not available. Please try again later." 
      }, { status: 503 });
    }

    return NextResponse.json({ 
      error: "internal_error",
      message: "Failed to find similar players" 
    }, { status: 500 });
  }
}