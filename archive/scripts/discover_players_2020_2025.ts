#!/usr/bin/env npx tsx

/**
 * BaseballData.jp プレイヤーディスカバリ (2020-2025)
 * 
 * 3フェーズアプローチの「ディスカバリフェーズ」
 * 目的：有効なplayer_idとページ種別（B/P）を効率的に確定
 * 
 * 使用方法:
 * npx tsx scripts/discover_players_2020_2025.ts
 */

import fs from 'fs/promises';
import path from 'path';

interface PlayerIndex {
  player_id: string;
  pos: 'B' | 'P';
  entry_year: number;
  year_number: number;
  first_year: number;
  last_year: number;
  name?: string;
  team?: string;
  position?: string;
  is_active: boolean;
  discovered_at: string;
}

interface DiscoveryResult {
  total_discovered: number;
  by_year: Record<number, number>;
  by_position: { batters: number; pitchers: number };
  players: PlayerIndex[];
  processing_time_ms: number;
}

class PlayerDiscovery {
  private baseUrl = 'https://baseballdata.jp';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private delayMs = 800; // 効率的だが礼儀正しいレート制限
  
  /**
   * HEAD リクエストで存在確認（軽量）
   */
  private async exists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': this.userAgent }
      });
      
      // ヘッドでは200でない場合、軽量GETで再確認
      if (response.status !== 200 && response.status !== 404) {
        const getResponse = await fetch(url, {
          headers: { 'User-Agent': this.userAgent }
        });
        const text = await getResponse.text();
        return getResponse.ok && text.includes('<title>') && !text.includes('エラー');
      }
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 特定年の選手を効率的にスキャン
   */
  async scanYear(year: number): Promise<PlayerIndex[]> {
    const players: PlayerIndex[] = [];
    let consecutiveMisses = 0;
    const maxConsecutiveMisses = 30; // より長めの終了条件
    
    console.log(`🔍 ${year}年入団選手スキャン開始`);
    
    for (let i = 1; i <= 400; i++) { // より広めの範囲
      const playerId = `${year}${i.toString().padStart(3, '0')}`;
      
      // 打者チェック
      const batterUrl = `${this.baseUrl}/playerB/${playerId}.html`;
      const isPitcher = await this.exists(batterUrl);
      
      let found = false;
      let pos: 'B' | 'P' | null = null;
      
      if (isPitcher) {
        pos = 'B';
        found = true;
      } else {
        // 投手チェック
        const pitcherUrl = `${this.baseUrl}/playerP/${playerId}.html`;
        const isPlayer = await this.exists(pitcherUrl);
        
        if (isPlayer) {
          pos = 'P';
          found = true;
        }
      }
      
      if (found && pos) {
        // 基本情報を取得
        const playerInfo = await this.getPlayerBasicInfo(playerId, pos);
        
        players.push({
          player_id: playerId,
          pos,
          entry_year: year,
          year_number: i,
          first_year: playerInfo?.first_year || year,
          last_year: playerInfo?.last_year || new Date().getFullYear(),
          name: playerInfo?.name,
          team: playerInfo?.team,
          position: playerInfo?.position,
          is_active: playerInfo?.is_active || false,
          discovered_at: new Date().toISOString()
        });
        
        consecutiveMisses = 0;
        console.log(`  ✅ ${playerId} (${pos}) ${playerInfo?.name || 'Unknown'}`);
      } else {
        consecutiveMisses++;
      }
      
      // 早期終了判定
      if (consecutiveMisses >= maxConsecutiveMisses) {
        console.log(`  🔚 ${consecutiveMisses}回連続未発見のため${year}年スキャン終了`);
        break;
      }
      
      // 10回ごとに進捗表示
      if (i % 10 === 0) {
        console.log(`  📊 ${i}までスキャン完了: ${players.length}名発見`);
      }
      
      // レート制限
      await this.delay(this.delayMs);
    }
    
    console.log(`✅ ${year}年スキャン完了: ${players.length}名発見`);
    return players;
  }

  /**
   * 選手の基本情報を取得
   */
  private async getPlayerBasicInfo(playerId: string, pos: 'B' | 'P'): Promise<{
    name?: string;
    team?: string;
    position?: string;
    first_year?: number;
    last_year?: number;
    is_active: boolean;
  } | null> {
    try {
      const url = `${this.baseUrl}/player${pos}/${playerId}.html`;
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent }
      });
      
      if (!response.ok) return null;
      
      const html = await response.text();
      
      // 簡単なパース（cheerio使わずに軽量化）
      const nameMatch = html.match(/<title>([^<]+)/);
      const teamMatch = html.match(/(ヤクルト|巨人|阪神|中日|広島|ベイスターズ|ソフトバンク|ロッテ|日ハム|楽天|オリックス|西武)/);
      
      let name = nameMatch?.[1]?.trim().split(/[\s\-【】]/)?.[0] || undefined;
      if (name && name.includes('年度')) {
        name = name.replace(/^\d+年度\s*/, '');
      }
      
      const team = teamMatch?.[1] || undefined;
      const position = pos === 'P' ? 'P' : undefined; // 投手以外は詳細取得せず
      
      // 年度範囲チェック（軽量版）
      const currentYear = new Date().getFullYear();
      let first_year = parseInt(playerId.substring(0, 4));
      let last_year = currentYear;
      
      return {
        name,
        team,
        position,
        first_year,
        last_year,
        is_active: html.includes('成績') && !html.includes('エラー')
      };
      
    } catch (error) {
      return null;
    }
  }

  /**
   * 2020-2025年の全選手をディスカバリ
   */
  async discoverAll(): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const allPlayers: PlayerIndex[] = [];
    const byYear: Record<number, number> = {};
    
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2020; year <= Math.min(currentYear, 2025); year++) {
      years.push(year);
    }
    
    console.log(`🚀 BaseballData.jp プレイヤーディスカバリ開始`);
    console.log(`📅 対象年度: ${years.join(', ')}`);
    
    for (const year of years) {
      const yearPlayers = await this.scanYear(year);
      allPlayers.push(...yearPlayers);
      byYear[year] = yearPlayers.length;
      
      // 年間処理後の小休止
      await this.delay(this.delayMs * 2);
    }
    
    const processingTime = Date.now() - startTime;
    const batters = allPlayers.filter(p => p.pos === 'B').length;
    const pitchers = allPlayers.filter(p => p.pos === 'P').length;
    
    return {
      total_discovered: allPlayers.length,
      by_year: byYear,
      by_position: { batters, pitchers },
      players: allPlayers,
      processing_time_ms: processingTime
    };
  }

  /**
   * 結果をファイルに保存
   */
  async saveResults(result: DiscoveryResult, outputDir: string = './data/discovery'): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().slice(0, 10);
    
    // 1. 完全な結果をJSON保存
    const fullResultPath = path.join(outputDir, `players_discovery_${timestamp}.json`);
    await fs.writeFile(fullResultPath, JSON.stringify(result, null, 2));
    
    // 2. プレイヤーインデックスのみをCSV風で保存
    const indexPath = path.join(outputDir, `players_index_2020_2025.json`);
    await fs.writeFile(indexPath, JSON.stringify(result.players, null, 2));
    
    // 3. サマリーレポート
    const reportPath = path.join(outputDir, `discovery_report_${timestamp}.txt`);
    const report = `
BaseballData.jp プレイヤーディスカバリ結果 (${timestamp})
==============================================

📊 総計
- 発見した選手: ${result.total_discovered}名
- 処理時間: ${Math.round(result.processing_time_ms / 1000)}秒
- 平均処理速度: ${Math.round(result.total_discovered / (result.processing_time_ms / 1000))}名/秒

👥 ポジション別
- 打者 (B): ${result.by_position.batters}名
- 投手 (P): ${result.by_position.pitchers}名

📅 年度別
${Object.entries(result.by_year)
  .map(([year, count]) => `- ${year}年入団: ${count}名`)
  .join('\n')}

📁 出力ファイル
- 完全結果: ${fullResultPath}
- プレイヤーインデックス: ${indexPath}
- このレポート: ${reportPath}
`;
    
    await fs.writeFile(reportPath, report);
    
    console.log(`\n📁 結果保存完了:`);
    console.log(`  - ${fullResultPath}`);
    console.log(`  - ${indexPath}`);
    console.log(`  - ${reportPath}`);
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
    const discovery = new PlayerDiscovery();
    
    console.log('🏁 BaseballData.jp プレイヤーディスカバリ開始');
    
    const result = await discovery.discoverAll();
    
    console.log('\n🎉 ディスカバリ完了！');
    console.log(`📊 合計 ${result.total_discovered}名の選手を発見`);
    console.log(`⚾ 打者: ${result.by_position.batters}名, 投手: ${result.by_position.pitchers}名`);
    console.log(`⏱️  処理時間: ${Math.round(result.processing_time_ms / 1000)}秒`);
    
    // 結果保存
    await discovery.saveResults(result);
    
    console.log('\n✅ プレイヤーディスカバリフェーズ完了');
    console.log('💡 次のステップ: 軽量タブ収集フェーズを実行してください');
    
  } catch (error) {
    console.error('❌ ディスカバリ中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}