#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db_enhanced.db');

try {
  console.log('📊 Testing Enhanced Database...');
  console.log(`Database path: ${dbPath}`);
  
  const db = new Database(dbPath, { readonly: true });
  
  try {
    // Test basic table structure
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('🔍 Tables:', tables);
    
    // Check player count
    const countResult = db.prepare('SELECT COUNT(*) as count FROM enhanced_batting_stats').get() as { count: number };
    console.log(`👥 Total players: ${countResult.count}`);
    
    // Check sample data
    const samplePlayers = db.prepare('SELECT name, team_code, batting_average, data_quality_score FROM enhanced_batting_stats LIMIT 5').all();
    console.log('🏆 Sample players:', samplePlayers);
    
    // Test the API query
    const apiTestQuery = `
      SELECT 
        player_id, name, team_code, batting_average, home_runs, rbis, ops,
        data_quality_score
      FROM enhanced_batting_stats 
      WHERE year = 2024
      ORDER BY batting_average DESC 
      LIMIT 3
    `;
    
    const apiTestResults = db.prepare(apiTestQuery).all();
    console.log('🎯 API Test Results:', apiTestResults);
    
  } finally {
    db.close();
  }
  
  console.log('✅ Database test completed successfully!');
  
} catch (error) {
  console.error('❌ Database test failed:', error);
}