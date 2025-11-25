#!/usr/bin/env node
// Direct API test without Next.js server

import Database from 'better-sqlite3';
import path from 'path';

// NPB team information with enhanced metadata
const NPB_TEAMS = {
  'G': { code: 'G', shortName: '巨人', fullName: '読売ジャイアンツ', league: 'central', primaryColor: '#FF6600' },
  'T': { code: 'T', shortName: '阪神', fullName: '阪神タイガース', league: 'central', primaryColor: '#FFE500' },
  'C': { code: 'C', shortName: '広島', fullName: '広島東洋カープ', league: 'central', primaryColor: '#DC143C' },
  'DB': { code: 'DB', shortName: 'DeNA', fullName: '横浜DeNAベイスターズ', league: 'central', primaryColor: '#006BB0' },
  'S': { code: 'S', shortName: 'ヤクルト', fullName: '東京ヤクルトスワローズ', league: 'central', primaryColor: '#3A5FCD' },
  'D': { code: 'D', shortName: '中日', fullName: '中日ドラゴンズ', league: 'central', primaryColor: '#003DA5' },
  'H': { code: 'H', shortName: 'ソフトバンク', fullName: '福岡ソフトバンクホークス', league: 'pacific', primaryColor: '#FFD700' },
  'L': { code: 'L', shortName: '西武', fullName: '埼玉西武ライオンズ', league: 'pacific', primaryColor: '#00008B' },
  'E': { code: 'E', shortName: '楽天', fullName: '東北楽天ゴールデンイーグルス', league: 'pacific', primaryColor: '#8B0000' },
  'M': { code: 'M', shortName: 'ロッテ', fullName: '千葉ロッテマリーンズ', league: 'pacific', primaryColor: '#000080' },
  'B': { code: 'B', shortName: 'オリックス', fullName: 'オリックス・バファローズ', league: 'pacific', primaryColor: '#003DA5' },
  'F': { code: 'F', shortName: '日本ハム', fullName: '北海道日本ハムファイターズ', league: 'pacific', primaryColor: '#87CEEB' }
};

async function testBattingStatsAPI() {
  console.log('🧪 Testing Batting Stats API Logic...');
  
  // Simulate API parameters
  const year = 2024;
  const limit = 5;
  const sort = 'batting_average';
  const order = 'desc';
  
  try {
    const dbPath = path.join(process.cwd(), 'data', 'db_enhanced.db');
    const db = new Database(dbPath, { readonly: true });
    
    try {
      // Build SQL query with filters
      let whereClause = 'WHERE year = ?';
      const params: any[] = [year];
      
      const sortColumn = 'batting_average';
      const sortOrder = 'DESC';
      
      console.log('📊 Executing query...');
      
      const query = `
        SELECT 
          player_id, name, team_code, team_name, league, position, year,
          games, plate_appearances, at_bats, runs, hits, doubles, triples, 
          home_runs, total_bases, rbis, stolen_bases, caught_stealing,
          sacrifice_hits, sacrifice_flies, walks, intentional_walks,
          hit_by_pitch, strikeouts, double_plays,
          batting_average, on_base_percentage, slugging_percentage, ops,
          woba, wrc_plus, babip, iso,
          data_quality_score, last_updated, data_source
        FROM enhanced_batting_stats 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}, name ASC
        LIMIT ?
      `;
      
      params.push(limit);
      
      console.log(`SQL: ${query}`);
      console.log(`Params: ${JSON.stringify(params)}`);
      
      const players = db.prepare(query).all(...params);
      
      console.log(`✅ Query successful: ${players.length} players found`);
      
      // Enhance player data with team metadata
      const enhancedPlayers = players.map((player: any) => {
        const teamInfo = NPB_TEAMS[player.team_code as keyof typeof NPB_TEAMS];
        return {
          ...player,
          team_full_name: teamInfo?.fullName || player.team_name,
          team_short_name: teamInfo?.shortName || player.team_code,
          team_league: teamInfo?.league || player.league,
          team_color: teamInfo?.primaryColor || '#888888',
          // Calculate additional metrics
          singles: player.hits - player.doubles - player.triples - player.home_runs,
          extra_base_hits: player.doubles + player.triples + player.home_runs,
          total_plate_appearances: player.plate_appearances || (player.at_bats + player.walks + player.hit_by_pitch + player.sacrifice_flies + player.sacrifice_hits)
        };
      });
      
      console.log('🎯 Enhanced Players:');
      enhancedPlayers.forEach((player, i) => {
        console.log(`  ${i+1}. ${player.name} (${player.team_short_name}) - 打率: ${player.batting_average.toFixed(3)}, 品質: ${player.data_quality_score}%`);
      });
      
      // Calculate league statistics
      const allPlayersQuery = `
        SELECT batting_average, home_runs, rbis, ops, woba, games 
        FROM enhanced_batting_stats 
        WHERE year = ? AND games >= 20
      `;
      
      const allPlayers = db.prepare(allPlayersQuery).all(year);
      
      const leagueAverages = {
        batting_average: allPlayers.length > 0 ? 
          Math.round((allPlayers.reduce((sum, p) => sum + p.batting_average, 0) / allPlayers.length) * 1000) / 1000 : 0,
        home_runs: allPlayers.length > 0 ? 
          Math.round((allPlayers.reduce((sum, p) => sum + p.home_runs, 0) / allPlayers.length) * 10) / 10 : 0,
        rbis: allPlayers.length > 0 ? 
          Math.round((allPlayers.reduce((sum, p) => sum + p.rbis, 0) / allPlayers.length) * 10) / 10 : 0,
        ops: allPlayers.length > 0 ? 
          Math.round((allPlayers.reduce((sum, p) => sum + p.ops, 0) / allPlayers.length) * 1000) / 1000 : 0
      };
      
      console.log('📈 League Averages:', leagueAverages);
      
      const response = {
        year,
        sort_by: sortColumn,
        sort_order: order,
        limit,
        players: enhancedPlayers,
        summary: {
          total_players: enhancedPlayers.length,
          total_qualified_players: allPlayers.length,
          league_averages: leagueAverages,
          data_quality: {
            average_score: enhancedPlayers.length > 0 ? 
              Math.round((enhancedPlayers.reduce((sum, p) => sum + p.data_quality_score, 0) / enhancedPlayers.length) * 10) / 10 : 0,
            high_quality_count: enhancedPlayers.filter(p => p.data_quality_score >= 90).length
          }
        },
        source: 'enhanced_npb_scraper'
      };
      
      console.log('✅ API Response Generated Successfully!');
      console.log(`📊 Summary: ${response.summary.total_players} players, ${response.summary.data_quality.average_score}% avg quality`);
      
    } finally {
      db.close();
    }

  } catch (error) {
    console.error('❌ API Test failed:', error);
  }
}

// Run the test
testBattingStatsAPI().catch(console.error);