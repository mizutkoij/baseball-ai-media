// app/api/years/route.ts
export async function GET() {
  try {
    // Direct SQLite access for year data
    const Database = require('better-sqlite3');
    const db = new Database('./data/db_current.db');
    
    const years = db.prepare(`
      SELECT 
        substr(date, 1, 4) as year,
        COUNT(*) as game_count,
        MIN(date) as first_game,
        MAX(date) as last_game
      FROM games 
      GROUP BY substr(date, 1, 4) 
      ORDER BY year DESC
    `).all();
    
    db.close();

    return Response.json({ 
      years,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Years API error:', error);
    
    // Fallback data
    return Response.json({ 
      years: [
        { year: "2025", game_count: 148, first_game: "2025-07-01", last_game: "2025-08-21" },
        { year: "2020", game_count: 11, first_game: "2020-08-01", last_game: "2020-08-02" },
        { year: "2017", game_count: 93, first_game: "2017-03-31", last_game: "2017-04-30" }
      ],
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
}