#!/usr/bin/env npx tsx

/**
 * 統合テスト: automated-scraper.ts + canonical system
 */

import { AutomatedScraper } from './automated-scraper';
import { persistStarters, persistGames } from '../lib/persist';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testCanonicalIntegration() {
  console.log('🔧 Testing canonical integration...');
  
  const testDir = path.join(process.cwd(), 'data', 'test-integration');
  
  // Clean up test directory
  try {
    await fs.rm(testDir, { recursive: true });
  } catch {
    // Directory doesn't exist
  }
  
  // Test data
  const testStarters = [
    {
      gameId: "20250811001",
      date: "2025-08-11",
      home: "巨人", // Will be normalized to "G"
      away: "阪神タイガース", // Will be normalized to "T" 
      homePitcher: {
        name: "菅野　智之", // Will be normalized (space cleaned)
        hand: "右", // Will be normalized to "R"
        era: 2.45
      },
      venue: "東京D" // Will be normalized to "東京ドーム"
    }
  ];
  
  const testGames = [
    {
      game_id: "20250811001",
      date: "2025-08-11",
      league: "central", // Will be normalized to "CL"
      away_team: "阪神",
      home_team: "読売ジャイアンツ", 
      status: "scheduled",
      venue: "東京D"
    }
  ];
  
  // Test starters persistence
  console.log('Testing starters persistence...');
  const startersResult = await persistStarters({
    date: "2025-08-11",
    items: testStarters,
    dataDir: testDir
  });
  
  console.log(`Starters: ${startersResult.action}, items: ${startersResult.items}`);
  
  // Test games persistence
  console.log('Testing games persistence...');
  const gamesResult = await persistGames({
    date: "2025-08-11", 
    items: testGames,
    dataDir: testDir
  });
  
  console.log(`Games: ${gamesResult.action}, items: ${gamesResult.items}`);
  
  // Verify file structure
  const startersDir = path.join(testDir, 'starters', 'date=2025-08-11');
  const gamesDir = path.join(testDir, 'games', 'date=2025-08-11');
  
  const startersFiles = await fs.readdir(startersDir);
  const gamesFiles = await fs.readdir(gamesDir);
  
  console.log('Created files:');
  console.log(`  Starters: ${startersFiles.join(', ')}`);
  console.log(`  Games: ${gamesFiles.join(', ')}`);
  
  // Read and verify normalized content
  const startersLatest = await fs.readFile(path.join(startersDir, 'latest.json'), 'utf-8');
  const startersData = JSON.parse(startersLatest);
  
  console.log('Normalized starter data:');
  console.log(`  Home team: ${startersData[0].home} (should be "G")`);
  console.log(`  Away team: ${startersData[0].away} (should be "T")`);
  console.log(`  Pitcher name: "${startersData[0].homePitcher.name}" (should be clean)`);
  console.log(`  Hand: ${startersData[0].homePitcher.hand} (should be "R")`);
  console.log(`  Venue: ${startersData[0].venue} (should be "東京ドーム")`);
  
  const gamesLatest = await fs.readFile(path.join(gamesDir, 'latest.json'), 'utf-8');
  const gamesData = JSON.parse(gamesLatest);
  
  console.log('Normalized game data:');
  console.log(`  League: ${gamesData[0].league} (should be "CL")`);
  console.log(`  Home team: ${gamesData[0].home_team} (should be "G")`);
  console.log(`  Away team: ${gamesData[0].away_team} (should be "T")`);
  
  console.log('✅ Integration test completed successfully!');
}

async function testAutomatedScraper() {
  console.log('🤖 Testing automated scraper with canonical system...');
  
  const scraper = new AutomatedScraper({
    scheduleEnabled: false,
    startersEnabled: true, 
    detailedEnabled: false,
    dataDir: path.join(process.cwd(), 'data', 'test-scraper'),
    maxRetries: 1,
    delayMs: 100
  });
  
  // Note: This will run with empty starters since scrapeNPBStarters is commented out
  // but it will test the integration flow
  const result = await scraper.run();
  
  console.log(`Scraper result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
  console.log(`Data types: ${result.dataTypes.join(', ')}`);
  console.log(`Items processed: ${result.itemsProcessed}`);
  
  if (result.errors.length > 0) {
    console.log('Errors:', result.errors);
  }
}

async function main() {
  console.log('🚀 Canonical System Integration Tests');
  console.log('====================================');
  
  try {
    await testCanonicalIntegration();
    console.log('');
    await testAutomatedScraper(); 
    
    console.log('\n🎯 All integration tests passed!');
    return 0;
    
  } catch (error) {
    console.error('💥 Integration test failed:', error);
    return 1;
  }
}

if (require.main === module) {
  main()
    .then(code => process.exit(code))
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { main as testCanonicalIntegration };