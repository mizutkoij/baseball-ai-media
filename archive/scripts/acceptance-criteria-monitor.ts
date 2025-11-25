#!/usr/bin/env npx tsx
/**
 * NPB2 受け入れ基準監視システム
 * Go/No-Go判定の自動化
 */

import { q } from '../app/lib/db';

interface CriteriaResult {
  metric: string;
  value: number | string;
  threshold: string;
  status: 'GO' | 'NO-GO';
  details?: any;
}

class AcceptanceCriteriaMonitor {
  private results: CriteriaResult[] = [];
  private discordWebhook = process.env.DISCORD_WEBHOOK_URL;

  async run(): Promise<boolean> {
    console.log('🔍 Starting acceptance criteria monitoring...');
    
    try {
      // 1. Yahoo 304キャッシュ率チェック
      await this.checkYahoo304Ratio();
      
      // 2. Yahoo 429エラー率チェック  
      await this.checkYahoo429Rate();
      
      // 3. PBPイベント遅延チェック
      await this.checkPBPLag();
      
      // 4. 試合カバレッジチェック
      await this.checkGameCoverage();
      
      // 5. DB成長監視
      await this.checkDatabaseGrowth();
      
      // 6. 最終判定とレポート
      const overallStatus = await this.generateFinalDecision();
      
      // 7. Discord通知
      if (this.discordWebhook) {
        await this.sendDiscordNotification(overallStatus);
      }
      
      return overallStatus;
      
    } catch (error) {
      console.error('❌ Monitoring failed:', error);
      throw error;
    }
  }

  private async checkYahoo304Ratio(): Promise<void> {
    try {
      const result = await q(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN response_code = 304 THEN 1 ELSE 0 END) as cached_requests,
          ROUND(
            CAST(SUM(CASE WHEN response_code = 304 THEN 1 ELSE 0 END) AS DECIMAL) / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as yahoo_304_ratio
        FROM request_logs 
        WHERE source = 'yahoo' 
          AND created_at >= CURRENT_DATE - INTERVAL '1 day'
      `);

      const ratio = result[0]?.yahoo_304_ratio || 0;
      
      this.results.push({
        metric: 'Yahoo 304 Cache Ratio',
        value: `${ratio}%`,
        threshold: '≥ 60%',
        status: ratio >= 60 ? 'GO' : 'NO-GO',
        details: {
          total_requests: result[0]?.total_requests || 0,
          cached_requests: result[0]?.cached_requests || 0
        }
      });

      console.log(`📊 Yahoo 304 Ratio: ${ratio}% (${ratio >= 60 ? '✅' : '❌'})`);
      
    } catch (error) {
      console.error('Error checking Yahoo 304 ratio:', error);
      this.results.push({
        metric: 'Yahoo 304 Cache Ratio',
        value: 'ERROR',
        threshold: '≥ 60%',
        status: 'NO-GO'
      });
    }
  }

  private async checkYahoo429Rate(): Promise<void> {
    try {
      const result = await q(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN response_code = 429 THEN 1 ELSE 0 END) as rate_limited_requests,
          ROUND(
            CAST(SUM(CASE WHEN response_code = 429 THEN 1 ELSE 0 END) AS DECIMAL) / 
            NULLIF(COUNT(*), 0) * 100, 3
          ) as yahoo_429_rate
        FROM request_logs 
        WHERE source = 'yahoo' 
          AND created_at >= CURRENT_DATE - INTERVAL '1 day'
      `);

      const rate = result[0]?.yahoo_429_rate || 0;
      
      this.results.push({
        metric: 'Yahoo 429 Rate Limit',
        value: `${rate}%`,
        threshold: '≤ 1%',
        status: rate <= 1.0 ? 'GO' : 'NO-GO',
        details: {
          total_requests: result[0]?.total_requests || 0,
          rate_limited: result[0]?.rate_limited_requests || 0
        }
      });

      console.log(`🚦 Yahoo 429 Rate: ${rate}% (${rate <= 1.0 ? '✅' : '❌'})`);
      
    } catch (error) {
      console.error('Error checking Yahoo 429 rate:', error);
      this.results.push({
        metric: 'Yahoo 429 Rate Limit',
        value: 'ERROR',
        threshold: '≤ 1%',
        status: 'NO-GO'
      });
    }
  }

  private async checkPBPLag(): Promise<void> {
    try {
      const result = await q(`
        SELECT 
          COUNT(*) as total_events,
          ROUND(EXTRACT(EPOCH FROM (
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (created_at - event_timestamp))
          )), 2) as lag_p95_seconds
        FROM pitches 
        WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
          AND event_timestamp IS NOT NULL
          AND created_at IS NOT NULL
      `);

      const lagP95 = result[0]?.lag_p95_seconds || 0;
      
      this.results.push({
        metric: 'PBP Event Lag P95',
        value: `${lagP95}s`,
        threshold: '≤ 15s',
        status: lagP95 <= 15 ? 'GO' : 'NO-GO',
        details: {
          total_events: result[0]?.total_events || 0
        }
      });

      console.log(`⏱️  PBP Lag P95: ${lagP95}s (${lagP95 <= 15 ? '✅' : '❌'})`);
      
    } catch (error) {
      console.error('Error checking PBP lag:', error);
      this.results.push({
        metric: 'PBP Event Lag P95',
        value: 'ERROR',
        threshold: '≤ 15s',
        status: 'NO-GO'
      });
    }
  }

  private async checkGameCoverage(): Promise<void> {
    try {
      const result = await q(`
        WITH coverage AS (
          SELECT 
            g.game_id,
            g.status,
            COUNT(p.pitch_id) as actual_pitches,
            280 as expected_pitches,
            ROUND(COUNT(p.pitch_id)::DECIMAL / 280 * 100, 2) as coverage_ratio
          FROM games g
          LEFT JOIN pitches p ON g.game_id = p.game_id
          WHERE g.level = 'NPB2'
            AND g.status = 'FINISHED'
            AND g.date >= CURRENT_DATE - INTERVAL '1 day'
          GROUP BY g.game_id, g.status
        )
        SELECT 
          COUNT(*) as finished_games,
          ROUND(AVG(coverage_ratio), 2) as avg_coverage,
          COUNT(CASE WHEN coverage_ratio >= 98 THEN 1 END) as games_meeting_threshold
        FROM coverage
      `);

      const avgCoverage = result[0]?.avg_coverage || 0;
      const finishedGames = result[0]?.finished_games || 0;
      const meetingThreshold = result[0]?.games_meeting_threshold || 0;
      
      this.results.push({
        metric: 'Game Coverage',
        value: `${avgCoverage}%`,
        threshold: '≥ 98%',
        status: avgCoverage >= 98 ? 'GO' : 'NO-GO',
        details: {
          finished_games: finishedGames,
          games_meeting_threshold: meetingThreshold
        }
      });

      console.log(`🎯 Game Coverage: ${avgCoverage}% (${avgCoverage >= 98 ? '✅' : '❌'})`);
      
    } catch (error) {
      console.error('Error checking game coverage:', error);
      this.results.push({
        metric: 'Game Coverage',
        value: 'ERROR',
        threshold: '≥ 98%',
        status: 'NO-GO'
      });
    }
  }

  private async checkDatabaseGrowth(): Promise<void> {
    try {
      const result = await q(`
        WITH pitch_growth AS (
          SELECT 
            date_trunc('hour', created_at) as hour_slot,
            COUNT(*) as new_pitches
          FROM pitches 
          WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
          GROUP BY hour_slot
          ORDER BY hour_slot
        ),
        growth_check AS (
          SELECT 
            hour_slot,
            new_pitches,
            LAG(new_pitches) OVER (ORDER BY hour_slot) as prev_pitches,
            CASE 
              WHEN LAG(new_pitches) OVER (ORDER BY hour_slot) IS NULL THEN true
              WHEN new_pitches >= LAG(new_pitches) OVER (ORDER BY hour_slot) * 0.5 THEN true
              ELSE false
            END as is_growing
          FROM pitch_growth
        )
        SELECT 
          COUNT(*) as hours_checked,
          COUNT(CASE WHEN NOT is_growing THEN 1 END) as declining_hours,
          SUM(new_pitches) as total_new_pitches
        FROM growth_check
      `);

      const decliningHours = result[0]?.declining_hours || 0;
      const hoursChecked = result[0]?.hours_checked || 0;
      const totalNewPitches = result[0]?.total_new_pitches || 0;
      
      this.results.push({
        metric: 'Database Growth',
        value: decliningHours === 0 ? 'Monotonic' : `${decliningHours} declining hours`,
        threshold: 'Monotonic increase',
        status: decliningHours === 0 ? 'GO' : 'NO-GO',
        details: {
          hours_checked: hoursChecked,
          total_new_pitches: totalNewPitches
        }
      });

      console.log(`📈 DB Growth: ${decliningHours === 0 ? 'Monotonic' : `${decliningHours} declines`} (${decliningHours === 0 ? '✅' : '❌'})`);
      
    } catch (error) {
      console.error('Error checking database growth:', error);
      this.results.push({
        metric: 'Database Growth',
        value: 'ERROR',
        threshold: 'Monotonic increase',
        status: 'NO-GO'
      });
    }
  }

  private async generateFinalDecision(): Promise<boolean> {
    const failedCriteria = this.results.filter(r => r.status === 'NO-GO').length;
    const totalCriteria = this.results.length;
    
    const overallStatus = failedCriteria === 0;
    
    console.log('\n🎯 === ACCEPTANCE CRITERIA SUMMARY ===');
    console.log(`Overall Decision: ${overallStatus ? 'GO ✅' : 'NO-GO ❌'}`);
    console.log(`Failed Criteria: ${failedCriteria}/${totalCriteria}`);
    console.log('');
    
    this.results.forEach(result => {
      const statusIcon = result.status === 'GO' ? '✅' : '❌';
      console.log(`${statusIcon} ${result.metric}: ${result.value} (threshold: ${result.threshold})`);
    });
    
    return overallStatus;
  }

  private async sendDiscordNotification(overallStatus: boolean): Promise<void> {
    try {
      const failedCriteria = this.results.filter(r => r.status === 'NO-GO');
      const emoji = overallStatus ? '✅' : '❌';
      const status = overallStatus ? 'GO' : 'NO-GO';
      
      let message = `${emoji} **NPB2 Acceptance Criteria: ${status}**\n\n`;
      
      // 失敗した基準があれば詳細表示
      if (failedCriteria.length > 0) {
        message += `⚠️ **Failed Criteria (${failedCriteria.length}):**\n`;
        failedCriteria.forEach(criteria => {
          message += `• ${criteria.metric}: ${criteria.value} (need: ${criteria.threshold})\n`;
        });
        message += '\n';
      }
      
      // 全体サマリ
      message += '**All Criteria:**\n';
      this.results.forEach(result => {
        const statusIcon = result.status === 'GO' ? '✅' : '❌';
        message += `${statusIcon} ${result.metric}: ${result.value}\n`;
      });
      
      message += `\n*Checked at: ${new Date().toISOString()}*`;

      const payload = {
        content: message,
        username: 'NPB2 Quality Monitor'
      };

      const response = await fetch(this.discordWebhook!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('Failed to send Discord notification:', response.statusText);
      }
      
    } catch (error) {
      console.error('Error sending Discord notification:', error);
    }
  }
}

// CLI実行部分
if (require.main === module) {
  const monitor = new AcceptanceCriteriaMonitor();
  monitor.run()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { AcceptanceCriteriaMonitor };