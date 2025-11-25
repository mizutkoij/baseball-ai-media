#!/usr/bin/env npx tsx

/**
 * 自動スクレイパーの統合テスト
 */

import { AutomatedScraper } from './automated-scraper';

async function testAutomatedScraper() {
  console.log('🧪 Testing automated scraper integration...');
  
  const scraper = new AutomatedScraper({
    scheduleEnabled: false,  // テスト用に無効化
    startersEnabled: false,  // テスト用に無効化
    detailedEnabled: false,  // テスト用に無効化
    dataDir: './data/test',
  });
  
  try {
    const result = await scraper.run();
    
    console.log('✅ Test completed successfully');
    console.log('Result:', {
      success: result.success,
      duration: result.duration,
      itemsProcessed: result.itemsProcessed,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });
    
    return result.success ? 0 : 1;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return 1;
  }
}

if (require.main === module) {
  testAutomatedScraper()
    .then(code => process.exit(code))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testAutomatedScraper };