import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Game of the Day selection logic
function selectGameOfTheDay(games: any[]): any | null {
  if (!games || games.length === 0) return null;

  // Priority scoring factors
  const scoreGame = (game: any) => {
    let score = 0;
    
    // Factor 1: Game status priority
    if (game.status === 'live' || game.status === 'inprogress') {
      score += 100; // Highest priority for live games
    } else if (game.status === 'scheduled' || game.status === 'pregame') {
      score += 50; // Upcoming games
    } else if (game.status === 'final') {
      score += 10; // Completed games (lower priority)
    }

    // Factor 2: Prime time bonus (18:00-20:00 JST)
    if (game.start_time_jst) {
      const startTime = new Date(`${game.date}T${game.start_time_jst}`);
      const hour = startTime.getHours();
      if (hour >= 18 && hour <= 20) {
        score += 30;
      }
    }

    // Factor 3: Popular teams bonus (Giants, Tigers, Dragons, etc.)
    const popularTeams = ['巨人', 'ジャイアンツ', '阪神', 'タイガース', '中日', 'ドラゴンズ', '広島', 'カープ'];
    const homeTeamPopular = popularTeams.some(team => 
      game.home_team?.includes(team) || game.home_team?.toLowerCase().includes(team.toLowerCase())
    );
    const awayTeamPopular = popularTeams.some(team => 
      game.away_team?.includes(team) || game.away_team?.toLowerCase().includes(team.toLowerCase())
    );
    
    if (homeTeamPopular || awayTeamPopular) {
      score += 20;
    }

    // Factor 4: Close game bonus (score difference <= 2)
    if (game.home_score !== null && game.away_score !== null) {
      const scoreDiff = Math.abs(game.home_score - game.away_score);
      if (scoreDiff <= 2) {
        score += 25;
      } else if (scoreDiff <= 5) {
        score += 10;
      }
    }

    // Factor 5: Weekend bonus
    const gameDate = new Date(game.date);
    const dayOfWeek = gameDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      score += 15;
    }

    return score;
  };

  // Score all games and find the highest
  const scoredGames = games.map(game => ({
    ...game,
    selection_score: scoreGame(game)
  }));

  // Sort by score (descending) and take the first one
  scoredGames.sort((a, b) => b.selection_score - a.selection_score);
  
  return scoredGames[0] || null;
}

// Generate Game of the Day description
function generateGameDescription(game: any): string {
  if (!game) return '';

  const descriptions = [];
  
  // Basic matchup
  descriptions.push(`${game.away_team} vs ${game.home_team}`);
  
  // Status-specific descriptions
  if (game.status === 'live' || game.status === 'inprogress') {
    if (game.inning) {
      descriptions.push(`${game.inning}進行中`);
    }
    if (game.home_score !== null && game.away_score !== null) {
      descriptions.push(`${game.away_score}-${game.home_score}`);
    }
  } else if (game.status === 'scheduled') {
    if (game.start_time_jst) {
      descriptions.push(`${game.start_time_jst}開始予定`);
    }
  } else if (game.status === 'final') {
    if (game.home_score !== null && game.away_score !== null) {
      descriptions.push(`最終スコア ${game.away_score}-${game.home_score}`);
    }
  }
  
  // Venue information
  if (game.venue) {
    descriptions.push(`@${game.venue}`);
  }

  return descriptions.join(' | ');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league') || 'first';
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    // Load today's games data
    const snapshotPath = path.join(process.cwd(), 'snapshots', 
      league === 'farm' ? 'today_games_farm.json' : 'today_games.json');
    
    if (!fs.existsSync(snapshotPath)) {
      return NextResponse.json({
        source: "error",
        league: league,
        date: date,
        game_of_the_day: null,
        selection_reason: "No games data available",
        ts: new Date().toISOString()
      });
    }

    const gamesData = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const games = gamesData.data || [];

    // Filter games for the specified date
    const todayGames = games.filter((game: any) => game.date === date);

    // Select Game of the Day
    const selectedGame = selectGameOfTheDay(todayGames);

    if (!selectedGame) {
      return NextResponse.json({
        source: gamesData.source || "snapshot",
        league: league,
        date: date,
        total_games: todayGames.length,
        game_of_the_day: null,
        selection_reason: "No suitable games found for selection",
        ts: new Date().toISOString()
      });
    }

    // Generate response
    const response = {
      source: gamesData.source || "snapshot",
      league: league,
      date: date,
      total_games: todayGames.length,
      game_of_the_day: {
        game_id: selectedGame.game_id,
        date: selectedGame.date,
        start_time_jst: selectedGame.start_time_jst,
        status: selectedGame.status,
        inning: selectedGame.inning,
        away_team: selectedGame.away_team,
        home_team: selectedGame.home_team,
        away_score: selectedGame.away_score,
        home_score: selectedGame.home_score,
        venue: selectedGame.venue,
        league: selectedGame.league,
        selection_score: selectedGame.selection_score,
        description: generateGameDescription(selectedGame),
        ogp_title: `今日の注目試合: ${selectedGame.away_team} vs ${selectedGame.home_team}`,
        ogp_description: generateGameDescription(selectedGame)
      },
      selection_criteria: {
        live_game_bonus: 100,
        scheduled_game_bonus: 50,
        prime_time_bonus: 30,
        close_game_bonus: 25,
        popular_team_bonus: 20,
        weekend_bonus: 15
      },
      ts: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in game-of-the-day API:', error);
    
    return NextResponse.json({
      source: "error",
      league: league,
      date: date,
      game_of_the_day: null,
      selection_reason: "API error occurred",
      error: error instanceof Error ? error.message : 'Unknown error',
      ts: new Date().toISOString()
    }, { status: 500 });
  }
}