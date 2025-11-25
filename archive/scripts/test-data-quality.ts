#!/usr/bin/env npx tsx

/**
 * Data Quality Foundation テスト
 * Zodスキーマバリデーションの動作確認
 */

import { validateStarters, validateGames, validateKeyPlays, type StarterRecord, type GameData, type KeyPlay } from '../lib/schemas';
import { NPBDataValidator } from '../lib/data-validator';

async function testZodValidation() {
  console.log('🔍 Testing Zod schema validation...');
  
  // 正常なスターターデータ
  const validStarter: StarterRecord = {
    gameId: "20250811001",
    date: "2025-08-11",
    league: "CL",
    home: "G",
    away: "T",
    homePitcher: {
      name: "菅野智之",
      hand: "R",
      era: 2.45,
    },
    awayPitcher: {
      name: "青柳晃洋", 
      hand: "R",
      era: 3.21,
    },
    confidence: 0.95,
    source: "npb_official",
  };
  
  // 無効なスターターデータ
  const invalidStarter = {
    gameId: "",  // 無効（空文字）
    date: "2025-13-40",  // 無効な日付
    league: "XX",  // 無効なリーグ
    home: "ZZ",  // 無効なチームID
    away: "YY",  // 無効なチームID
    confidence: 1.5,  // 無効（範囲外）
  };
  
  const testData = [validStarter, invalidStarter];
  const result = validateStarters(testData);
  
  console.log(`   Valid starters: ${result.valid.length}`);
  console.log(`   Invalid starters: ${result.invalid.length}`);
  console.log(`   Validation rate: ${(result.summary.validationRate * 100).toFixed(1)}%`);
  
  if (result.invalid.length > 0) {
    console.log('   First error:', result.invalid[0].error.issues[0].message);
  }
  
  return result.summary;
}

async function testGameValidation() {
  console.log('⚾ Testing game data validation...');
  
  // 正常な試合データ
  const validGame: GameData = {
    game_id: "20250811G001",
    date: "2025-08-11",
    league: "CL",
    away_team: "T",
    home_team: "G",
    venue: "東京ドーム",
    status: "final",
    away_score: 3,
    home_score: 5,
    updated_at: new Date().toISOString(),
  };
  
  // 無効な試合データ
  const invalidGame = {
    game_id: "",  // 無効
    date: "invalid-date",  // 無効
    league: "INVALID",  // 無効
    away_team: "INVALID",  // 無効
    home_team: "INVALID",  // 無効
    status: "unknown",  // 無効
    updated_at: "not-iso-string",  // 構文的には有効だが意味的に無効
  };
  
  const result = validateGames([validGame, invalidGame]);
  
  console.log(`   Valid games: ${result.valid.length}`);
  console.log(`   Invalid games: ${result.invalid.length}`);
  console.log(`   Validation rate: ${(result.summary.validationRate * 100).toFixed(1)}%`);
  
  return result.summary;
}

async function testKeyPlayValidation() {
  console.log('🎯 Testing key play validation...');
  
  // 正常なキープレー
  const validKeyPlay: KeyPlay = {
    inning: 9,
    half: "bottom",
    team: "G",
    description: "サヨナラタイムリーヒット",
    re24: 1.2,
    wpa: 0.85,
    leverage: 2.3,
  };
  
  // 無効なキープレー
  const invalidKeyPlay = {
    inning: 16,  // 無効（範囲外）
    half: "middle",  // 無効
    team: "INVALID",  // 無効
    description: "",  // 無効（空文字）
    wpa: 2.0,  // 無効（範囲外）
  };
  
  const result = validateKeyPlays([validKeyPlay, invalidKeyPlay]);
  
  console.log(`   Valid key plays: ${result.valid.length}`);
  console.log(`   Invalid key plays: ${result.invalid.length}`);
  console.log(`   Validation rate: ${(result.summary.validationRate * 100).toFixed(1)}%`);
  
  return result.summary;
}

async function testValidatorIntegration() {
  console.log('🔧 Testing NPBDataValidator integration...');
  
  const validator = new NPBDataValidator();
  
  // テスト用のスターターデータ
  const testStarters: StarterRecord[] = [
    {
      gameId: "20250811001",
      date: "2025-08-11",
      home: "G",
      away: "T",
      homePitcher: { name: "菅野智之", hand: "R" },
      awayPitcher: { name: "青柳晃洋", hand: "R" },
    },
  ];
  
  const result = await validator.validateStarters(testStarters);
  
  console.log(`   Validation result: ${result.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`   Data quality: ${result.dataQuality}`);
  console.log(`   Errors: ${result.errors.length}`);
  console.log(`   Warnings: ${result.warnings.length}`);
  
  return {
    isValid: result.isValid,
    dataQuality: result.dataQuality,
    errorCount: result.errors.length,
  };
}

async function main() {
  console.log('🚀 Data Quality Foundation Testing');
  console.log('==================================');
  
  const results = {
    starters: await testZodValidation(),
    games: await testGameValidation(),
    keyPlays: await testKeyPlayValidation(),
    validator: await testValidatorIntegration(),
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Starter Validation: ${results.starters.validationRate >= 0.5 ? '✅' : '❌'} (${(results.starters.validationRate * 100).toFixed(1)}%)`);
  console.log(`Game Validation: ${results.games.validationRate >= 0.5 ? '✅' : '❌'} (${(results.games.validationRate * 100).toFixed(1)}%)`);
  console.log(`KeyPlay Validation: ${results.keyPlays.validationRate >= 0.5 ? '✅' : '❌'} (${(results.keyPlays.validationRate * 100).toFixed(1)}%)`);
  console.log(`Validator Integration: ${results.validator.isValid ? '✅' : '❌'} (${results.validator.dataQuality})`);
  
  const allPassed = results.starters.validationRate >= 0.5 &&
                   results.games.validationRate >= 0.5 &&
                   results.keyPlays.validationRate >= 0.5 &&
                   results.validator.isValid;
  
  console.log(`\n🎯 Overall Data Quality Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
  
  return allPassed ? 0 : 1;
}

if (require.main === module) {
  main()
    .then(code => process.exit(code))
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { main as testDataQuality };