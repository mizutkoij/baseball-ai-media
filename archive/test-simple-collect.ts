#!/usr/bin/env npx tsx
/**
 * シンプルな収集テスト - DB依存なし
 */

import { promises as fs } from 'fs';

async function testSimpleCollection() {
  console.log('🚀 NPBファーム収集テスト開始');
  console.log('===============================');
  
  // 環境変数確認
  console.log('📊 環境変数:');
  console.log(`  YAHOO_LEVELS: ${process.env.YAHOO_LEVELS || '未設定'}`);
  console.log(`  CONTACT_EMAIL: ${process.env.CONTACT_EMAIL || '未設定'}`);
  console.log(`  DATA_DIR: ${process.env.DATA_DIR || '未設定'}`);
  
  // データディレクトリ作成
  const dataDir = process.env.DATA_DIR || './data';
  const timelineDir = `${dataDir}/timeline/yahoo_npb2`;
  
  try {
    await fs.mkdir(timelineDir, { recursive: true });
    console.log(`✅ データディレクトリ作成: ${timelineDir}`);
  } catch (error) {
    console.log(`⚠️ ディレクトリ作成エラー: ${error}`);
  }
  
  // 基本的なHTTPテスト
  console.log('\n🌐 HTTP接続テスト:');
  try {
    const response = await fetch('https://baseball.yahoo.co.jp/npb/schedule', {
      method: 'HEAD',
      headers: {
        'User-Agent': 'NPB-ResearchBot/1.0 (+admin@baseball-ai-media.com)'
      }
    });
    
    console.log(`✅ Yahoo Baseball接続: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log('🎉 基本的なHTTP接続は正常です！');
      
      // テストファイル作成
      const testData = {
        timestamp: new Date().toISOString(),
        test: 'NPB Farm System Test',
        status: 'HTTP接続成功',
        contact: process.env.CONTACT_EMAIL
      };
      
      await fs.writeFile(`${timelineDir}/test_connection.json`, JSON.stringify(testData, null, 2));
      console.log(`✅ テストファイル作成: ${timelineDir}/test_connection.json`);
    }
    
  } catch (error) {
    console.log(`❌ HTTP接続エラー: ${error}`);
  }
  
  // システム情報
  console.log('\n💻 システム情報:');
  console.log(`  Node.js: ${process.version}`);
  console.log(`  プラットフォーム: ${process.platform}`);
  console.log(`  作業ディレクトリ: ${process.cwd()}`);
  
  console.log('\n✅ シンプル収集テスト完了！');
  console.log('次のステップ: 本格的な収集システム起動');
}

testSimpleCollection().catch(console.error);