import fs from "fs/promises";
import path from "path";

// This is the structure the app expects for the player index page.
// We will generate our 2025 data to match this structure.
type PlayerIndex = {
  player_id: string;
  name: string;
  name_kana?: string;
  primary_pos: "P" | "B";
  first_year?: number;
  last_year?: number;
  is_active: boolean;
  active_confidence?: string;
  url?: string;
  // Add a new field to distinguish between leagues
  league: "1-gun" | "farm" | "both";
};

// This is a simplified structure of our scraped data.
// We only care about whether pitching or batting stats exist.
type PlayerStats = {
  pitching?: any;
  batting?: any;
};

// The root directory where the scraped 2025 data is located.
// Note: This path is outside the current project, so it's hardcoded.
const DATA_ROOT = "C:/Users/mizut/baseball-ai-media/output/2025";

// The output path for our new JSON index file.
const OUTPUT_PATH = path.join(
  __dirname,
  "../public/data/players/players_2025_all.json"
);

async function main() {
  console.log("Starting to generate 2025 player index...");

  const playersMap = new Map<string, PlayerIndex>();

  try {
    const teams = await fs.readdir(DATA_ROOT);
    for (const team of teams) {
      const teamPath = path.join(DATA_ROOT, team);
      if (!(await fs.stat(teamPath)).isDirectory()) continue;

      const players = await fs.readdir(teamPath);
      for (const playerDir of players) {
        const playerPath = path.join(teamPath, playerDir);
        if (!(await fs.stat(playerPath)).isDirectory()) continue;

        const playerId = playerDir; // e.g., "28_Togo_Shosei"
        const playerName = playerDir.split("_").slice(1).join(" "); // "Togo Shosei"

        let hasMain = false;
        let hasFarm = false;
        let primaryPos: "P" | "B" = "B"; // Default to batter

        // Check for main stats
        const mainStatsPath = path.join(playerPath, "main_stats.json");
        try {
          const mainStatsContent = await fs.readFile(mainStatsPath, "utf-8");
          const stats: PlayerStats = JSON.parse(mainStatsContent);
          if (stats.pitching && Object.keys(stats.pitching).length > 0) {
            primaryPos = "P";
          }
          hasMain = true;
        } catch (e) {
          // main_stats.json doesn't exist, that's fine
        }

        // Check for farm stats
        const farmStatsPath = path.join(playerPath, "farm_stats.json");
        try {
          const farmStatsContent = await fs.readFile(farmStatsPath, "utf-8");
          const stats: PlayerStats = JSON.parse(farmStatsContent);
          // If we haven't determined position yet, check farm stats
          if (!hasMain && stats.pitching && Object.keys(stats.pitching).length > 0) {
            primaryPos = "P";
          }
          hasFarm = true;
        } catch (e) {
          // farm_stats.json doesn't exist, that's fine
        }
        
        if (hasMain || hasFarm) {
            let league: "1-gun" | "farm" | "both" = "farm";
            if (hasMain && hasFarm) {
                league = "both";
            } else if (hasMain) {
                league = "1-gun";
            }

            const player: PlayerIndex = {
                player_id: playerId,
                name: playerName,
                primary_pos: primaryPos,
                is_active: true,
                active_confidence: "確定", // Assume active
                first_year: 2025,
                last_year: 2025,
                league: league,
            };
            
            // Use a map to handle cases where a player might be processed twice
            // (though the current loop structure prevents this)
            if (!playersMap.has(playerId)) {
                playersMap.set(playerId, player);
            }
        }
      }
    }

    const allPlayers = Array.from(playersMap.values());
    
    // Sort players by name for consistency
    allPlayers.sort((a, b) => a.name.localeCompare(b.name));

    await fs.writeFile(OUTPUT_PATH, JSON.stringify(allPlayers, null, 2));

    console.log(`Successfully generated player index with ${allPlayers.length} players.`);
    console.log(`File saved to: ${OUTPUT_PATH}`);

  } catch (error) {
    console.error("Error generating player index:", error);
  }
}

main();
