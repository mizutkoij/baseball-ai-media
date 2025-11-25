import { fetchComprehensiveGameData, fetchMultipleDetailedGames } from './fetch_comprehensive_npb_data';
import { getAllGameUrls } from './fetch_all_npb_2025_simple';

// 全試合の詳細データを取得するメイン関数
async function fetchAllDetailedNPBData() {
  console.log('🚀 NPB 2025年全試合詳細データ取得開始！');
  
  try {
    // 既存のシンプルスクレイピングから試合URLリストを取得
    console.log('📅 全試合URL取得中...');
    const gameUrls = await getAllGameUrls();
    
    if (gameUrls.length === 0) {
      console.log('❌ 試合URLが見つかりませんでした');
      return;
    }
    
    console.log(`📊 対象試合数: ${gameUrls.length}試合`);
    
    // 詳細データ一括取得実行
    await fetchMultipleDetailedGames(gameUrls);
    
  } catch (error) {
    console.error(`❌ メイン処理エラー: ${error.message}`);
  }
}

// 部分的な詳細データ取得（テスト用）
async function fetchPartialDetailedData(limit: number = 50) {
  console.log(`🧪 部分的詳細データ取得テスト: 最大${limit}試合`);
  
  try {
    const gameUrls = await getAllGameUrls();
    const limitedUrls = gameUrls.slice(0, limit);
    
    console.log(`📊 テスト対象: ${limitedUrls.length}試合`);
    await fetchMultipleDetailedGames(limitedUrls);
    
  } catch (error) {
    console.error(`❌ 部分取得エラー: ${error.message}`);
  }
}

// サンプル詳細データ取得（高品質なサンプル）
async function fetchSampleDetailedData() {
  console.log('🎯 サンプル詳細データ取得');
  
  // 興味深い試合を選択
  const sampleUrls = [
    '/scores/2025/0801/g-db-14/',   // 巨人 vs DeNA (高得点試合)
    '/scores/2025/0622/db-m-03/',   // DeNA vs ロッテ (9-10 の接戦)
    '/scores/2025/0705/f-e-13/',    // 日本ハム vs 楽天 (12-1 の大差)
    '/scores/2025/0611/m-c-02/',    // ロッテ vs 広島 (0-0 の引き分け)
    '/scores/2025/0612/h-g-03/',    // ソフトバンク vs 巨人 (0-0)
    '/scores/2025/0708/l-e-10/',    // 西武 vs 楽天 (2-7)
    '/scores/2025/0709/m-f-12/',    // ロッテ vs 日本ハム (1-13)
    '/scores/2025/0606/t-b-01/',    // 阪神 vs オリックス (1-0 僅差)
    '/scores/2025/0703/t-g-15/',    // 阪神 vs 巨人 (3-2 好ゲーム)
    '/scores/2025/0706/f-e-14/'     // 日本ハム vs 楽天 (8-6 激戦)
  ];
  
  console.log(`📊 サンプル試合: ${sampleUrls.length}試合`);
  await fetchMultipleDetailedGames(sampleUrls);
}

// コマンドライン引数に基づく実行制御
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  
  switch (mode) {
    case 'all':
      await fetchAllDetailedNPBData();
      break;
    case 'partial':
      const limit = args[1] ? parseInt(args[1]) : 50;
      await fetchPartialDetailedData(limit);
      break;
    case 'sample':
      await fetchSampleDetailedData();
      break;
    default:
      console.log('📋 使用方法:');
      console.log('  npx tsx fetch_all_detailed_npb_data.ts all       # 全試合詳細データ取得');
      console.log('  npx tsx fetch_all_detailed_npb_data.ts partial [数] # 部分取得 (デフォルト50試合)');
      console.log('  npx tsx fetch_all_detailed_npb_data.ts sample    # サンプル取得 (10試合)');
      
      // デフォルトはサンプル取得
      await fetchSampleDetailedData();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { 
  fetchAllDetailedNPBData,
  fetchPartialDetailedData, 
  fetchSampleDetailedData
};