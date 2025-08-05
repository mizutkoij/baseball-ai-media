import { NextRequest, NextResponse } from "next/server";

// Add runtime config to prevent static generation
export const dynamic = 'force-dynamic';

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

  // Return mock CSV data
  const csvData = `season,team,league,date,venue,batting_order,position,AB,R,H,2B,3B,HR,RBI,BB,SO,SB,CS,HBP,SF,AVG,OPS
${year || '2025'},巨人,central,2025-01-01,東京ドーム,4,三塁,4,1,2,1,0,0,1,0,1,0,0,0,0,.500,1.250
# Mock data - Database functionality disabled for Vercel compatibility`;

  return new NextResponse(csvData, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="player-${playerId}-${year || 'all'}-stats.csv"`,
    },
  });
}