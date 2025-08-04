import { NextRequest, NextResponse } from "next/server";

// Simple database connection (reusing existing pattern)
function getDb() {
  // Conditional import to prevent build-time issues
  const DatabaseLib = require('better-sqlite3');
  const dbPath = process.env.DB_HISTORY || './data/db_history.db';
  return new DatabaseLib(dbPath);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  const year = searchParams.get("year");
  const format = searchParams.get("format") || "csv";

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  if (format !== "csv") {
    return NextResponse.json({ error: "only csv format supported" }, { status: 400 });
  }

  try {
    const db = getDb();
    
    // Query for player batting data
    let query = `
      SELECT 
        substr(g.game_id, 1, 4) as season,
        b.team,
        b.league,
        g.date,
        g.venue,
        b.batting_order,
        b.position,
        b.AB,
        b.R,
        b.H,
        b.singles_2B as "2B",
        b.singles_3B as "3B", 
        b.HR,
        b.RBI,
        b.BB,
        b.SO,
        b.SB,
        b.CS,
        b.HBP,
        b.SF,
        b.AVG,
        b.OPS
      FROM box_batting b
      JOIN games g ON b.game_id = g.game_id
      WHERE b.player_id = ?
    `;
    
    const params = [playerId];
    
    if (year) {
      query += ` AND g.game_id LIKE ?`;
      params.push(`${year}%`);
    }
    
    query += ` ORDER BY g.date ASC`;
    
    const rows = db.prepare(query).all(...params);
    db.close();

    if (rows.length === 0) {
      return NextResponse.json({ error: "no_data_found" }, { status: 404 });
    }

    // Build CSV content
    const headers = Object.keys(rows[0]);
    let csvContent = headers.join(",") + "\n";
    
    for (const row of rows) {
      const values = headers.map(header => {
        const value = row[header];
        // Handle null/undefined values and escape quotes
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && value.includes(",")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvContent += values.join(",") + "\n";
    }

    // Check size limit (250KB)
    const MAX_SIZE = 250_000;
    const csvBuffer = new TextEncoder().encode("\uFEFF" + csvContent); // UTF-8 BOM
    
    if (csvBuffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ 
        error: "export_too_large", 
        message: "Data exceeds 250KB limit",
        rowCount: rows.length 
      }, { status: 413 });
    }

    // Log analytics event
    console.log(`CSV export: player=${playerId}, year=${year}, rows=${rows.length}, size=${csvBuffer.byteLength}bytes`);

    const filename = year 
      ? `player_${playerId}_${year}.csv`
      : `player_${playerId}_all.csv`;

    return new NextResponse(csvBuffer, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600" // 1 hour cache
      }
    });

  } catch (error: any) {
    console.error("CSV export error:", error);
    return NextResponse.json({ 
      error: "internal_error",
      message: "Failed to generate CSV export" 
    }, { status: 500 });
  }
}