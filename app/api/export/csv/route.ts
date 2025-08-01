import { NextRequest } from "next/server";
import { Parser as Json2csv } from "json2csv";
import { query, unionQuery } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope"); // "player" | "team" | "game"
    const season = searchParams.get("season");
    const id = searchParams.get("id"); // playerId | teamCode | gameId
    const pfCorrection = searchParams.get("pf") === "true"; // PF補正ON/OFF

    if (!scope || !["player", "team", "game"].includes(scope)) {
      return new Response("Invalid scope parameter", { status: 400 });
    }

    let rows: any[] = [];
    let filename = `${scope}_export_${Date.now()}.csv`;

    if (scope === "player") {
      if (!id) {
        return new Response("Player ID is required", { status: 400 });
      }
      
      // 選手の年度別統計データ
      const sql = `
        SELECT 
          b.player_id,
          b.name,
          strftime('%Y', g.date) as season,
          b.team,
          b.league,
          COUNT(DISTINCT g.game_id) as games_played,
          SUM(b.AB) as AB,
          SUM(b.R) as R,
          SUM(b.H) as H,
          SUM(b.singles_2B) as doubles,
          SUM(b.singles_3B) as triples,
          SUM(b.HR) as HR,
          SUM(b.RBI) as RBI,
          SUM(b.BB) as BB,
          SUM(b.SO) as SO,
          SUM(b.SB) as SB,
          SUM(b.CS) as CS,
          CASE WHEN SUM(b.AB) > 0 THEN ROUND(CAST(SUM(b.H) AS FLOAT) / SUM(b.AB), 3) ELSE 0 END as AVG,
          CASE WHEN SUM(b.AB) > 0 THEN ROUND((CAST(SUM(b.H) AS FLOAT) + SUM(b.BB)) / (SUM(b.AB) + SUM(b.BB)), 3) ELSE 0 END as OBP,
          CASE WHEN SUM(b.AB) > 0 THEN ROUND((CAST(SUM(b.H) AS FLOAT) + SUM(b.singles_2B) + 2*SUM(b.singles_3B) + 3*SUM(b.HR)) / SUM(b.AB), 3) ELSE 0 END as SLG
        FROM box_batting b
        JOIN games g ON b.game_id = g.game_id
        WHERE b.player_id = ?
        ${season ? "AND strftime('%Y', g.date) = ?" : ""}
        GROUP BY b.player_id, b.name, strftime('%Y', g.date), b.team, b.league
        ORDER BY strftime('%Y', g.date) DESC
      `;
      
      const params = season ? [id, season] : [id];
      rows = await unionQuery(sql, params);
      filename = `player_${id}_${season || 'all_seasons'}_${Date.now()}.csv`;
      
    } else if (scope === "team") {
      if (!id || !season) {
        return new Response("Team code and season are required", { status: 400 });
      }
      
      // チームの月別・ホーム/ビジター分割統計
      const sql = `
        SELECT 
          g.date,
          g.game_id,
          g.away_team,
          g.home_team,
          CASE WHEN g.home_team = ? THEN 'HOME' ELSE 'AWAY' END as venue_type,
          g.away_score,
          g.home_score,
          CASE 
            WHEN g.home_team = ? AND g.home_score > g.away_score THEN 'W'
            WHEN g.away_team = ? AND g.away_score > g.home_score THEN 'W'
            ELSE 'L'
          END as result,
          g.venue,
          strftime('%m', g.date) as month,
          COUNT(bb.id) as batting_records,
          COUNT(bp.id) as pitching_records
        FROM games g
        LEFT JOIN box_batting bb ON g.game_id = bb.game_id AND bb.team = ?
        LEFT JOIN box_pitching bp ON g.game_id = bp.game_id AND bp.team = ?
        WHERE (g.home_team = ? OR g.away_team = ?)
        AND strftime('%Y', g.date) = ?
        AND g.status = 'completed'
        GROUP BY g.game_id
        ORDER BY g.date DESC
      `;
      
      const params = [id, id, id, id, id, id, id, season];
      rows = await unionQuery(sql, params);
      filename = `team_${id}_${season}_${Date.now()}.csv`;
      
    } else if (scope === "game") {
      if (!id) {
        return new Response("Game ID is required", { status: 400 });
      }
      
      // 試合の打撃・投手データ統合
      const sql = `
        SELECT 
          'batting' as record_type,
          b.player_id,
          b.name,
          b.team,
          b.batting_order,
          b.position,
          b.AB,
          b.R,
          b.H,
          b.singles_2B as doubles,
          b.singles_3B as triples,
          b.HR,
          b.RBI,
          b.BB,
          b.SO,
          b.SB,
          b.CS,
          NULL as IP,
          NULL as H_allowed,
          NULL as R_allowed,
          NULL as ER,
          NULL as BB_allowed,
          NULL as SO_pitched,
          NULL as HR_allowed
        FROM box_batting b
        WHERE b.game_id = ?
        
        UNION ALL
        
        SELECT 
          'pitching' as record_type,
          p.player_id,
          p.name,
          p.team,
          NULL as batting_order,
          NULL as position,
          NULL as AB,
          NULL as R,
          NULL as H,
          NULL as doubles,
          NULL as triples,
          NULL as HR,
          NULL as RBI,
          NULL as BB,
          NULL as SO,
          NULL as SB,
          NULL as CS,
          p.IP,
          p.H as H_allowed,
          p.R as R_allowed,
          p.ER,
          p.BB as BB_allowed,
          p.SO as SO_pitched,
          p.HR_allowed
        FROM box_pitching p
        WHERE p.game_id = ?
        
        ORDER BY record_type, team, batting_order, name
      `;
      
      rows = await unionQuery(sql, [id, id]);
      filename = `game_${id}_${Date.now()}.csv`;
    }

    if (rows.length === 0) {
      return new Response("No data found", { status: 404 });
    }

    // UTF-8 BOM を追加してExcelでの文字化けを防ぐ
    const csv = new Json2csv().parse(rows);
    const csvWithBOM = '\uFEFF' + csv;

    return new Response(csvWithBOM, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      }
    });

  } catch (error) {
    console.error("CSV export error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}