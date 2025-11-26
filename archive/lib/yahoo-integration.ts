import Database from 'better-sqlite3';

// Yahoo データベース接続
export function getYahooConnection(): Database.Database {
  const dbPath = process.env.YAHOO_DB_PATH || './data/yahoo_scraping/database/yahoo_baseball.db';
  // better-sqlite3 is synchronous, which is simpler for this script's context.
  return new Database(dbPath);
}

// NPB メインデータベース接続
function getNPBConnection(): Database.Database {
  const dbPath = process.env.COMPREHENSIVE_DB_PATH || './comprehensive_baseball_database.db';
  return new Database(dbPath);
}

export interface YahooGameData {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  venue: string;
  status: string;
  league: string;
  processed: number;
  url?: string;
}

export interface YahooPitchData {
  game_id: string;
  index_code: string;
  pitch_sequence: number;
  pitcher_name: string;
  batter_name: string;
  pitch_type: string;
  velocity: number;
  zone_name: string;
  result: string;
  count_balls: number;
  count_strikes: number;
  runners: string;
  inning: number;
  side: string;
  outs: number;
}

export class YahooDataIntegrator {
  private yahooDb: Database.Database | null;
  private npbDb: Database.Database;

  constructor() {
    this.yahooDb = null;
    this.npbDb = getNPBConnection();
  }

  connect() {
    if (!this.yahooDb) {
        this.yahooDb = getYahooConnection();
    }
  }

  disconnect() {
    if (this.yahooDb) {
      this.yahooDb.close();
      this.yahooDb = null;
    }
    if (this.npbDb && this.npbDb.open) {
      this.npbDb.close();
    }
  }

  /**
   * Yahoo で収集された試合データを取得
   */
  getYahooGames(options: {
    processed?: boolean;
    date?: string;
    limit?: number;
  } = {}) {
    this.connect();

    let query = 'SELECT * FROM games';
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.processed !== undefined) {
      conditions.push('processed = ?');
      params.push(options.processed ? 1 : 0);
    }

    if (options.date) {
      conditions.push('date = ?');
      params.push(options.date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return this.yahooDb!.prepare(query).all(...params) as YahooGameData[];
  }

  /**
   * 特定試合の詳細な一球速報データを取得
   */
  getGamePitchData(gameId: string) {
    this.connect();

    const stmt = this.yahooDb!.prepare(`
      SELECT * FROM pitch_data 
      WHERE game_id = ? 
      ORDER BY inning, side, pitch_sequence
    `);

    return stmt.all(gameId) as YahooPitchData[];
  }
  
    /**
   * Yahoo チーム名を NPB 標準チーム名にマッピング
   */
  private mapYahooTeamToNPB(yahooTeam: string): string {
    const teamMapping: { [key: string]: string } = {
      '楽天': '東北楽天ゴールデンイーグルス',
      '日本ハム': '北海道日本ハムファイターズ',
      'ソフトバンク': '福岡ソフトバンクホークス',
      'ロッテ': '千葉ロッテマリーンズ',
      '西武': '埼玉西武ライオンズ',
      'オリックス': 'オリックス・バファローズ',
      '巨人': '読売ジャイアンツ',
      '阪神': '阪神タイガース',
      '中日': '中日ドラゴンズ',
      'DeNA': '横浜DeNAベイスターズ',
      '広島': '広島東洋カープ',
      'ヤクルト': '東京ヤクルトスワローズ'
    };

    return teamMapping[yahooTeam] || yahooTeam;
  }

  /**
   * Yahoo試合データをNPBデータベースに統合
   */
  integrateGameData(yahooGame: YahooGameData) {
    try {
      const npbHomeTeam = this.mapYahooTeamToNPB(yahooGame.home_team);
      const npbAwayTeam = this.mapYahooTeamToNPB(yahooGame.away_team);

      // NPB データベースに試合情報を挿入/更新
      const insertGame = this.npbDb.prepare(`
        INSERT OR REPLACE INTO games (
          game_id, date, home_team, away_team, venue, 
          status, league, data_source, yahoo_game_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const npbGameId = `yahoo_${yahooGame.game_id}`;
      
      insertGame.run(
        npbGameId,
        yahooGame.date,
        npbHomeTeam,
        npbAwayTeam,
        yahooGame.venue,
        yahooGame.status,
        'npb',
        'yahoo',
        yahooGame.game_id
      );

      return npbGameId;
    } catch (error) {
      console.error('Game integration error:', error);
      throw error;
    }
  }

  /**
   * 一球速報データをNPBデータベースに統合
   */
  integratePitchData(gameId: string, pitches: YahooPitchData[]) {
    try {
      const npbGameId = `yahoo_${gameId}`;

      // 既存の一球速報データを削除
      const deletePitches = this.npbDb.prepare(
        'DELETE FROM pitch_by_pitch WHERE game_id = ?'
      );
      deletePitches.run(npbGameId);

      // 新しい一球速報データを挿入
      const insertPitch = this.npbDb.prepare(`
        INSERT INTO pitch_by_pitch (
          game_id, inning, side, pitch_sequence, pitcher_name, batter_name,
          pitch_type, velocity, zone, result, balls, strikes, runners, outs,
          data_source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'yahoo', CURRENT_TIMESTAMP)
      `);

      const insertMany = this.npbDb.transaction((pitches: YahooPitchData[]) => {
        for (const pitch of pitches) {
          insertPitch.run(
            npbGameId,
            pitch.inning,
            pitch.side,
            pitch.pitch_sequence,
            pitch.pitcher_name,
            pitch.batter_name,
            pitch.pitch_type,
            pitch.velocity,
            pitch.zone_name,
            pitch.result,
            pitch.count_balls,
            pitch.count_strikes,
            pitch.runners,
            pitch.outs
          );
        }
      });

      insertMany(pitches);
      
      return pitches.length;
    } catch (error) {
      console.error('Pitch data integration error:', error);
      throw error;
    }
  }

  /**
   * Yahoo データの完全同期
   */
  syncAllData(options: { onProgress?: (progress: any) => void } = {}) {
    try {
      this.connect();

      // 処理済みYahoo試合を取得
      const processedGames = this.getYahooGames({ processed: true });
      
      let syncedGames = 0;
      let syncedPitches = 0;

      for (const game of processedGames) {
        try {
          // 試合データ統合
          const npbGameId = this.integrateGameData(game);
          
          // 一球速報データ統合
          const pitches = this.getGamePitchData(game.game_id);
          if (pitches.length > 0) {
            const pitchCount = this.integratePitchData(game.game_id, pitches);
            syncedPitches += pitchCount;
          }

          syncedGames++;

          // 進捗報告
          if (options.onProgress) {
            options.onProgress({
              current: syncedGames,
              total: processedGames.length,
              game: game,
              pitches: pitches.length
            });
          }

        } catch (error) {
          console.error(`Failed to sync game ${game.game_id}:`, error);
        }
      }

      return {
        synced_games: syncedGames,
        synced_pitches: syncedPitches,
        total_games: processedGames.length
      };

    } finally {
      this.disconnect();
    }
  }

    /**
   * 同期統計情報取得
   */
    getSyncStats() {
        try {
          this.connect();
    
          const yahooStats = this.yahooDb!.prepare(`
            SELECT 
              COUNT(*) as total_games,
              COUNT(CASE WHEN processed = 1 THEN 1 END) as processed_games,
              COUNT(CASE WHEN processed = 0 THEN 1 END) as pending_games
            FROM games
          `).get() as any;
    
          const yahooPitchStats = this.yahooDb!.prepare(`
            SELECT 
              COUNT(*) as total_pitches,
              COUNT(DISTINCT game_id) as games_with_pitches
            FROM pitch_data
          `).get() as any;
    
          // NPB データベースでのYahoo由来データ
          const npbYahooGames = this.npbDb.prepare(`
            SELECT COUNT(*) as count FROM games WHERE data_source = 'yahoo'
          `).get() as { count: number };
    
          const npbYahooPitches = this.npbDb.prepare(`
            SELECT COUNT(*) as count FROM pitch_by_pitch WHERE data_source = 'yahoo'
          `).get() as { count: number };
    
          return {
            yahoo: {
              games: yahooStats,
              pitches: yahooPitchStats
            },
            npb_integrated: {
              games: npbYahooGames.count,
              pitches: npbYahooPitches.count
            },
            sync_rate: yahooStats.processed_games > 0 ? 
              (npbYahooGames.count / yahooStats.processed_games * 100).toFixed(1) : '0.0'
          };
    
        } finally {
          this.disconnect();
        }
      }
}

export default YahooDataIntegrator;