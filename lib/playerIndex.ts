// Player Index for PBP -> Player linking
type PlayerIndex = Record<string, string>;

let indexCache: PlayerIndex | null = null;

export async function loadPlayerIndex(): Promise<PlayerIndex> {
  if (indexCache) return indexCache;
  
  try {
    const res = await fetch("/data/players/players_index.json", { 
      cache: "force-cache" 
    });
    
    if (!res.ok) {
      console.warn('Failed to load player index');
      return {};
    }
    
    const list = await res.json();
    
    // 同姓同名ケア：完全一致優先＋かな一致 fallback
    indexCache = Object.fromEntries(
      list.map((p: any) => [p.name, p.player_id])
    );
    
    return indexCache;
  } catch (error) {
    console.error('Error loading player index:', error);
    return {};
  }
}

export function clearPlayerIndexCache() {
  indexCache = null;
}

// ヘルパー関数：選手名からIDを取得
export async function getPlayerIdByName(name: string): Promise<string | null> {
  const index = await loadPlayerIndex();
  return index[name] || null;
}