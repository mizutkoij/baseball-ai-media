#!/usr/bin/env npx tsx

/**
 * 2023-2025年入団選手の詳細調査
 * - 異なるURL構造の試行
 * - より広範囲のID検索
 * - 年度ディレクトリの調査
 */

import { BaseballDataScraper } from '../lib/baseballdata-scraper';

class RecentPlayersInvestigator {
  private scraper: BaseballDataScraper;
  
  constructor() {
    this.scraper = new BaseballDataScraper();
  }

  /**
   * 2023-2025年の様々なURL構造を調査
   */
  async investigateRecentYears(): Promise<void> {
    console.log('🔍 2023-2025年入団選手の詳細調査開始');
    
    for (let entryYear = 2023; entryYear <= 2025; entryYear++) {
      console.log(`\n--- ${entryYear}年入団選手調査 ---`);
      
      await this.investigateYearStructures(entryYear);
      await this.delay(2000);
    }
  }

  /**
   * 特定年度の様々な構造を試行
   */
  private async investigateYearStructures(entryYear: number): Promise<void> {
    const idPrefix = entryYear - 2001; // 2023 -> 22, 2024 -> 23, 2025 -> 24
    const dataYear = entryYear + 1; // データが保存されている年度
    
    console.log(`  入団年: ${entryYear}, ID prefix: ${idPrefix}, データ年: ${dataYear}`);
    
    // 試行するURL構造のパターン
    const urlPatterns = [
      // 基本パターン
      `https://baseballdata.jp/${dataYear}/playerB/${idPrefix}00001.html`,
      // 現在年度パターン
      `https://baseballdata.jp/2025/playerB/${idPrefix}00001.html`,
      // 直接パターン
      `https://baseballdata.jp/playerB/${idPrefix}00001.html`,
    ];
    
    for (const [index, url] of urlPatterns.entries()) {
      try {
        console.log(`    パターン ${index + 1}: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        console.log(`      ステータス: ${response.status}`);
        
        if (response.ok) {
          const html = await response.text();
          const hasPlayerData = html.includes('選手') || html.includes('成績') || html.includes('打撃');
          console.log(`      ✅ アクセス成功! プレイヤーデータ: ${hasPlayerData ? 'あり' : 'なし'}`);
          
          if (hasPlayerData) {
            // さらに詳しく調査
            await this.detailedInvestigation(entryYear, idPrefix, dataYear, url);
            return; // 成功したパターンが見つかったら終了
          }
        } else {
          console.log(`      ❌ ${response.status}: ${response.statusText}`);
        }
        
        await this.delay(1000);
        
      } catch (error) {
        console.log(`      ❌ エラー: ${error}`);
      }
    }
    
    console.log(`    💭 ${entryYear}年: 有効なURLパターンが見つかりませんでした`);
  }

  /**
   * 成功したパターンでの詳細調査
   */
  private async detailedInvestigation(
    entryYear: number, 
    idPrefix: number, 
    dataYear: number, 
    successUrl: string
  ): Promise<void> {
    console.log(`\n🎯 ${entryYear}年詳細調査開始 (成功パターン発見)`);
    console.log(`   成功URL: ${successUrl}`);
    
    // 最初の10名を試行
    const foundPlayers: string[] = [];
    
    for (let i = 1; i <= 50; i++) {
      const playerId = `${idPrefix}${i.toString().padStart(5, '0')}`;
      const url = successUrl.replace(/\d{7}\.html$/, `${playerId}.html`);
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          if (html.includes('選手') || html.includes('成績')) {
            foundPlayers.push(playerId);
            console.log(`     ✅ 選手発見: ${playerId}`);
            
            // プレイヤー名の抽出を試行
            const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/) || 
                             html.match(/<title>([^<]+)<\/title>/);
            if (nameMatch) {
              console.log(`        名前: ${nameMatch[1].trim()}`);
            }
          }
        }
        
        await this.delay(800);
        
      } catch (error) {
        // エラーは無視して続行
      }
    }
    
    console.log(`\n📈 ${entryYear}年発見結果: ${foundPlayers.length}名`);
    if (foundPlayers.length > 0) {
      console.log(`   発見ID: ${foundPlayers.slice(0, 10).join(', ')}${foundPlayers.length > 10 ? '...' : ''}`);
      
      // このパターンでバッチ収集を推奨
      console.log(`\n💡 推奨コマンド:`);
      console.log(`   npx tsx scripts/batch_import_modern_players.ts --year ${entryYear} --max-players 200`);
    }
  }

  /**
   * 年度別ディレクトリの存在確認
   */
  async checkYearDirectories(): Promise<void> {
    console.log('\n🗂️  年度ディレクトリ調査');
    
    for (let year = 2023; year <= 2026; year++) {
      const url = `https://baseballdata.jp/${year}/`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        console.log(`  ${year}年ディレクトリ: ${response.ok ? '✅ 存在' : '❌ なし'} (${response.status})`);
        
        await this.delay(1000);
        
      } catch (error) {
        console.log(`  ${year}年ディレクトリ: ❌ エラー`);
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * メイン実行
 */
async function main() {
  try {
    const investigator = new RecentPlayersInvestigator();
    
    console.log('🚀 2023-2025年入団選手詳細調査開始');
    
    // 年度ディレクトリの調査
    await investigator.checkYearDirectories();
    
    // 各年度の詳細調査
    await investigator.investigateRecentYears();
    
    console.log('\n🎯 調査完了!');
    
  } catch (error) {
    console.error('❌ 調査中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}