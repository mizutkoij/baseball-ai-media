#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Today Games API with Highlights Count
"""

from fastapi import FastAPI, Query, HTTPException, Path, Request
from fastapi.middleware.cors import CORSMiddleware
import duckdb
import logging
from datetime import datetime, timezone
import uvicorn
import os
import json

# Configuration
DB_PATH = "duckdb/baseball.duckdb"
WPA_HIGHLIGHT_THRESHOLD = float(os.getenv("WPA_HIGHLIGHT_THRESHOLD", "0.08"))

logger = logging.getLogger(__name__)
app = FastAPI(title="Baseball AI Enhanced API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": "enhanced-highlights"}

@app.get("/api/today-games")
async def get_today_games(league: str = Query(None)):
    try:
        con = duckdb.connect(DB_PATH, read_only=True)
        
        # Build the WHERE clause for league filtering
        where_clause = ""
        params = []
        if league:
            where_clause = "WHERE league = ?"
            params.append(league)
        
        # Get today games
        games = con.execute(f"""
            SELECT game_id, date, start_time_jst, status, inning, 
                   away_team, home_team, away_score, home_score, venue, tv, league
            FROM v_today_games {where_clause} ORDER BY start_time_jst
        """, params).fetchall()
        
        # Get highlights count for each game
        highlights = con.execute("""
            WITH hi AS (
                SELECT game_id, COUNT(*) AS highlights_count, MAX(ts) AS last_highlight_ts
                FROM pbp_events
                WHERE ABS(COALESCE(wpa, 0)) >= ?
                GROUP BY game_id
            )
            SELECT game_id, highlights_count, last_highlight_ts FROM hi
        """, [WPA_HIGHLIGHT_THRESHOLD]).fetchall()
        
        con.close()
        
        # Create highlights dictionary
        highlights_dict = {row[0]: {"count": row[1], "last_ts": row[2]} for row in highlights}
        
        # Build response data
        data = [
            {
                "game_id": row[0],
                "date": row[1],
                "start_time_jst": row[2],
                "status": row[3],
                "inning": row[4],
                "away_team": row[5],
                "home_team": row[6],
                "away_score": row[7],
                "home_score": row[8],
                "venue": row[9],
                "tv": row[10],
                "league": row[11],
                "highlights_count": highlights_dict.get(row[0], {}).get("count", 0),
                "last_highlight_ts": highlights_dict.get(row[0], {}).get("last_ts")
            }
            for row in games
        ]
        
        return {
            "source": "real",
            "ts": datetime.now(timezone.utc).isoformat(),
            "wpa_threshold": WPA_HIGHLIGHT_THRESHOLD,
            "league": league,
            "games": len(data),
            "data": data
        }
    except Exception as e:
        logger.error(f"Today games error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/today-games-live")
async def get_today_games_live():
    return await get_today_games()

# Include other endpoints
@app.get("/api/pbp")
async def get_pbp(game_id: str = Query(...), limit: int = Query(50)):
    try:
        con = duckdb.connect(DB_PATH, read_only=True)
        events = con.execute("""
            SELECT game_id, ts, inning, half, batter, pitcher, pitch_seq, result,
                   count_b, count_s, count_o, bases, away_runs, home_runs,
                   wp_v2_after, re_after, wpa
            FROM pbp_events WHERE game_id = ? ORDER BY pitch_seq DESC LIMIT ?
        """, [game_id, limit]).fetchall()
        con.close()
        
        event_list = [{
            "game_id": r[0], "ts": r[1], "inning": r[2], "half": r[3],
            "batter": r[4], "pitcher": r[5], "pitch_seq": r[6], "result": r[7],
            "count_b": r[8], "count_s": r[9], "count_o": r[10], "bases": r[11],
            "away_runs": r[12], "home_runs": r[13], "wp_v2_after": r[14],
            "re_after": r[15], "wpa": r[16]
        } for r in events]
        
        return {
            "source": "real", "game_id": game_id, "total_events": len(event_list),
            "events": event_list, "last_updated": event_list[0]["ts"] if event_list else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pbp/highlights/{game_id}")
async def get_pbp_highlights(game_id: str = Path(...), wpa_threshold: float = Query(0.15), limit: int = Query(10)):
    try:
        con = duckdb.connect(DB_PATH, read_only=True)
        highlights = con.execute("""
            WITH ordered AS (
                SELECT *, wp_v2_after - LAG(wp_v2_after) OVER (PARTITION BY game_id ORDER BY pitch_seq) AS wpa_calc
                FROM pbp_events WHERE game_id = ? AND wp_v2_after IS NOT NULL
            ),
            filtered AS (SELECT * FROM ordered WHERE ABS(COALESCE(wpa_calc, 0)) >= ?)
            SELECT pitch_seq, inning, half, batter, pitcher, result, bases, away_runs, home_runs, wp_v2_after, wpa_calc as wpa, ts
            FROM filtered ORDER BY ABS(wpa_calc) DESC, pitch_seq DESC LIMIT ?
        """, [game_id, wpa_threshold, limit]).fetchall()
        con.close()
        
        events = [{
            "pitch_seq": r[0], "inning": r[1], "half": r[2], "batter": r[3] or "Unknown",
            "pitcher": r[4] or "Unknown", "result": r[5] or "", "bases": r[6] or "---",
            "away_runs": r[7] or 0, "home_runs": r[8] or 0, "wp_after": r[9], "wpa": r[10], "ts": r[11]
        } for r in highlights]
        
        return {"source": "real", "game_id": game_id, "threshold": wpa_threshold, "events": events, "count": len(events)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pbp/wp-series")
async def get_wp_series(game_id: str = Query(...), limit: int = Query(120)):
    try:
        con = duckdb.connect(DB_PATH, read_only=True)
        wp_data = con.execute("""
            SELECT pitch_seq, ts, wp_v2_after AS wp
            FROM pbp_events WHERE game_id = ? AND wp_v2_after IS NOT NULL
            ORDER BY pitch_seq ASC LIMIT ?
        """, [game_id, limit]).fetchall()
        con.close()
        
        points = [{"pitch_seq": r[0], "ts": r[1], "wp": r[2]} for r in wp_data]
        return {"source": "real", "game_id": game_id, "points": points, "count": len(points)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pbp/stream/{game_id}")
async def stream_pbp(game_id: str = Path(...), request: Request = None):
    """SSE endpoint for real-time PBP events"""
    from fastapi.responses import StreamingResponse
    import asyncio
    
    SSE_ENABLE = os.getenv("SSE_ENABLE", "true").lower() == "true"
    if not SSE_ENABLE:
        raise HTTPException(status_code=503, detail="SSE not enabled")
    
    async def event_generator():
        last_pitch_seq = None
        connection_start = datetime.now(timezone.utc)
        
        try:
            while True:
                if request and await request.is_disconnected():
                    break
                
                con = duckdb.connect(DB_PATH, read_only=True)
                try:
                    events = con.execute("""
                        SELECT pitch_seq, ts, inning, half, batter, pitcher, result, 
                               count_b, count_s, count_o, bases, away_runs, home_runs,
                               wp_v2_after, wpa
                        FROM pbp_events 
                        WHERE game_id = ? 
                        ORDER BY pitch_seq DESC 
                        LIMIT 1
                    """, [game_id]).fetchall()
                    
                    if events:
                        event = events[0]
                        current_pitch_seq = event[0]
                        
                        if last_pitch_seq is None or current_pitch_seq > last_pitch_seq:
                            last_pitch_seq = current_pitch_seq
                            
                            event_data = {
                                "game_id": game_id,
                                "pitch_seq": event[0],
                                "ts": str(event[1]),
                                "inning": event[2],
                                "half": event[3],
                                "batter": event[4] or "Unknown",
                                "pitcher": event[5] or "Unknown", 
                                "result": event[6] or "",
                                "count_b": event[7] or 0,
                                "count_s": event[8] or 0,
                                "count_o": event[9] or 0,
                                "bases": event[10] or "---",
                                "away_runs": event[11] or 0,
                                "home_runs": event[12] or 0,
                                "wp_v2_after": event[13],
                                "wpa": event[14],
                                "sse_timestamp": datetime.now(timezone.utc).isoformat()
                            }
                            
                            yield f"data: {json.dumps(event_data, default=str)}\n\n"
                
                finally:
                    con.close()
                
                await asyncio.sleep(2.0)
                
        except Exception as e:
            logger.error(f"SSE error for {game_id}: {e}")
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)