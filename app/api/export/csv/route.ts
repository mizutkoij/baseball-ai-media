import { NextRequest } from "next/server";
import { Parser as Json2csv } from "json2csv";
import { query, unionQuery } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope"); // "player" | "team" | "game" | "player_comparison" | "team_comparison"
    const season = searchParams.get("season");
    const id = searchParams.get("id"); // playerId | teamCode | gameId
    const pfCorrection = searchParams.get("pf") === "true"; // PF補正ON/OFF

    if (!scope || !["player", "team", "game", "player_comparison", "team_comparison"].includes(scope)) {
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

    } else if (scope === "team_comparison") {
      const teams = searchParams.get("teams");
      const year = searchParams.get("year") || new Date().getFullYear().toString();
      
      if (!teams) {
        return new Response("Teams parameter is required", { status: 400 });
      }

      // Mock data for team comparison export (would be replaced with actual API call)
      const teamCodes = teams.split(',').map(code => code.trim().toUpperCase());
      
      // Generate mock comparison data
      rows = teamCodes.map((teamCode, index) => {
        const teamNames: Record<string, string> = {
          'G': '読売ジャイアンツ', 'T': '阪神タイガース', 'C': '広島東洋カープ',
          'YS': '横浜DeNAベイスターズ', 'D': '中日ドラゴンズ', 'S': '東京ヤクルトスワローズ',
          'H': 'ソフトバンクホークス', 'L': '埼玉西武ライオンズ', 'E': '東北楽天ゴールデンイーグルス',
          'M': '千葉ロッテマリーンズ', 'F': '北海道日本ハムファイターズ', 'B': 'オリックス・バファローズ'
        };

        const wRC_plus = 85 + Math.floor(Math.random() * 30);
        const ERA_minus = 90 + Math.floor(Math.random() * 20);

        const wRC_plus_neutral = pfCorrection ? wRC_plus + Math.floor(Math.random() * 20) - 10 : null;
        const ERA_minus_neutral = pfCorrection ? ERA_minus + Math.floor(Math.random() * 15) - 7 : null;
        const batting_ERA = parseFloat((3.50 + Math.random() * 1.20).toFixed(2));
        const batting_ERA_neutral = pfCorrection ? parseFloat((batting_ERA + (Math.random() - 0.5) * 0.4).toFixed(2)) : null;

        return {
          team_code: teamCode,
          team_name: teamNames[teamCode] || teamCode,
          year: parseInt(year),
          wins: 60 + Math.floor(Math.random() * 25),
          losses: 60 + Math.floor(Math.random() * 25),
          win_pct: (0.400 + Math.random() * 0.200).toFixed(3),
          rank: index + 1,
          // 打撃指標（並記+Δ）
          wRC_plus_original: wRC_plus,
          wRC_plus_neutral: wRC_plus_neutral,
          wRC_plus_delta: wRC_plus_neutral ? (wRC_plus_neutral - wRC_plus).toFixed(1) : null,
          // 投手指標（並記+Δ）
          ERA_minus_original: ERA_minus,
          ERA_minus_neutral: ERA_minus_neutral,
          ERA_minus_delta: ERA_minus_neutral ? (ERA_minus_neutral - ERA_minus).toFixed(1) : null,
          ERA_original: batting_ERA.toFixed(2),
          ERA_neutral: batting_ERA_neutral ? batting_ERA_neutral.toFixed(2) : null,
          ERA_delta: batting_ERA_neutral ? (batting_ERA_neutral - batting_ERA).toFixed(2) : null,
          // その他統計
          team_batting_AVG: (0.245 + Math.random() * 0.040).toFixed(3),
          team_batting_OPS: (0.705 + Math.random() * 0.120).toFixed(3),
          team_batting_HR: 120 + Math.floor(Math.random() * 80),
          team_batting_ISO: (0.140 + Math.random() * 0.060).toFixed(3),
          team_pitching_WHIP: (1.25 + Math.random() * 0.25).toFixed(2),
          team_pitching_FIP: (3.80 + Math.random() * 1.00).toFixed(2),
          home_wins: Math.floor((60 + Math.floor(Math.random() * 25)) * 0.55),
          away_wins: Math.floor((60 + Math.floor(Math.random() * 25)) * 0.45),
          park_factor: (0.95 + Math.random() * 0.1).toFixed(3),
          pf_correction_applied: pfCorrection ? '適用' : '未適用'
        };
      });
      
      filename = `team_comparison_${teamCodes.join('_')}_${year}_${Date.now()}.csv`;

    } else if (scope === "player_comparison") {
      const players = searchParams.get("players");
      const yearFrom = searchParams.get("from") || "2022";
      const yearTo = searchParams.get("to") || "2024";
      
      if (!players) {
        return new Response("Players parameter is required", { status: 400 });
      }

      // Mock data for player comparison export
      const playerIds = players.split(',').map(id => id.trim());
      
      rows = [];
      playerIds.forEach((playerId, playerIndex) => {
        const playerName = `選手${String.fromCharCode(65 + playerIndex)}`;
        const isBatter = playerIndex < 2;
        
        for (let year = parseInt(yearFrom); year <= parseInt(yearTo); year++) {
          if (isBatter) {
            const wRC_plus = 90 + Math.floor(Math.random() * 60);
            rows.push({
              player_id: playerId,
              player_name: playerName,
              year: year,
              primary_pos: 'B',
              games: 120 + Math.floor(Math.random() * 20),
              PA: 450 + Math.floor(Math.random() * 100),
              wRC_plus: wRC_plus,
              wRC_plus_neutral: pfCorrection ? wRC_plus + Math.floor(Math.random() * 20) - 10 : null,
              AVG: (0.250 + Math.random() * 0.100).toFixed(3),
              OPS: (0.720 + Math.random() * 0.200).toFixed(3),
              HR: 15 + Math.floor(Math.random() * 25),
              ISO: (0.150 + Math.random() * 0.100).toFixed(3),
              pf_correction_applied: pfCorrection
            });
          } else {
            const ERA_minus = 80 + Math.floor(Math.random() * 40);
            rows.push({
              player_id: playerId,
              player_name: playerName,
              year: year,
              primary_pos: 'P',
              games: 25 + Math.floor(Math.random() * 10),
              IP: (150 + Math.floor(Math.random() * 50)).toFixed(1),
              ERA: (3.00 + Math.random() * 2.00).toFixed(2),
              ERA_minus: ERA_minus,
              ERA_minus_neutral: pfCorrection ? ERA_minus + Math.floor(Math.random() * 20) - 10 : null,
              FIP: (3.50 + Math.random() * 1.50).toFixed(2),
              WHIP: (1.20 + Math.random() * 0.40).toFixed(2),
              K_9: (7.0 + Math.random() * 4.0).toFixed(1),
              pf_correction_applied: pfCorrection
            });
          }
        }
      });
      
      filename = `player_comparison_${playerIds.join('_')}_${yearFrom}-${yearTo}_${Date.now()}.csv`;
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