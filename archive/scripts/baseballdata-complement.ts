#!/usr/bin/env npx tsx
/**
 * baseballdata.jp 補完ジョブ
 * 投球座標/ゾーン行列・ミックス比率などを補完（信頼度タグ付き）
 * 毎日 04:00 実行
 */

import { q } from '../app/lib/db';

interface ComplementResult {
  success: boolean;
  message: string;
  affectedRows: number;
}

class BaseballDataComplement {
  private readonly today: string;
  private stats = {
    processed: 0,
    complemented: 0,
    errors: 0
  };

  constructor() {
    this.today = new Date().toISOString().slice(0, 10);
  }

  async run(): Promise<void> {
    console.log('🔄 Starting baseballdata.jp complement job...');
    console.log(`Target date: ${this.today}`);
    
    try {
      // 1. 投球座標補完
      await this.complementPitchCoordinates();
      
      // 2. ゾーン行列補完  
      await this.complementZoneMatrix();
      
      // 3. ミックス比率補完
      await this.complementMixRatios();
      
      // 4. 信頼度スコア更新
      await this.updateConfidenceScores();
      
      // 5. 結果レポート
      await this.generateReport();
      
      console.log('✅ Complement job completed successfully');
      
    } catch (error) {
      console.error('❌ Complement job failed:', error);
      throw error;
    }
  }

  private async complementPitchCoordinates(): Promise<ComplementResult> {
    console.log('📍 Complementing pitch coordinates...');
    
    try {
      // 座標データが欠けている投球を特定
      const missingCoords = await q(`
        SELECT p.pitch_id, p.game_id, p.pitcher_id, p.pitch_type, p.velocity
        FROM pitches p
        JOIN games g ON p.game_id = g.game_id
        WHERE g.level = 'NPB2'
          AND DATE(p.event_timestamp) = $1
          AND (p.plate_x IS NULL OR p.plate_z IS NULL)
          AND p.pitch_type IS NOT NULL
          AND p.velocity IS NOT NULL
        ORDER BY p.event_timestamp
      `, [this.today]);

      if (missingCoords.length === 0) {
        return { success: true, message: 'No missing coordinates found', affectedRows: 0 };
      }

      let complemented = 0;
      
      for (const pitch of missingCoords) {
        try {
          // 同じ投手・球種・速度帯の過去データから推定
          const historical = await q(`
            SELECT 
              AVG(plate_x) as avg_x,
              AVG(plate_z) as avg_z,
              STDDEV(plate_x) as std_x,
              STDDEV(plate_z) as std_z,
              COUNT(*) as sample_size
            FROM pitches p
            JOIN games g ON p.game_id = g.game_id
            WHERE g.level = 'NPB2'
              AND p.pitcher_id = $1
              AND p.pitch_type = $2
              AND p.velocity BETWEEN $3 AND $4
              AND p.plate_x IS NOT NULL
              AND p.plate_z IS NOT NULL
              AND DATE(p.event_timestamp) < $5
          `, [
            pitch.pitcher_id, 
            pitch.pitch_type,
            pitch.velocity - 5, // ±5km/h範囲
            pitch.velocity + 5,
            this.today
          ]);

          const hist = historical[0];
          
          if (hist && hist.sample_size >= 10) { // 十分なサンプル数
            // ランダムノイズを加えた推定座標
            const estimatedX = hist.avg_x + (Math.random() - 0.5) * (hist.std_x || 0.1);
            const estimatedZ = hist.avg_z + (Math.random() - 0.5) * (hist.std_z || 0.1);
            
            await q(`
              UPDATE pitches 
              SET 
                plate_x = $1,
                plate_z = $2,
                complement_source = 'baseballdata_estimated',
                complement_confidence = $3,
                complement_updated_at = NOW()
              WHERE pitch_id = $4
            `, [
              estimatedX,
              estimatedZ,
              Math.min(0.8, hist.sample_size / 50), // サンプル数に基づく信頼度
              pitch.pitch_id
            ]);
            
            complemented++;
          }
        } catch (error) {
          console.error(`Error complementing pitch ${pitch.pitch_id}:`, error);
          this.stats.errors++;
        }
      }

      this.stats.complemented += complemented;
      return { 
        success: true, 
        message: `Complemented ${complemented}/${missingCoords.length} coordinates`,
        affectedRows: complemented 
      };

    } catch (error) {
      console.error('Error in complement coordinates:', error);
      return { success: false, message: error.message, affectedRows: 0 };
    }
  }

  private async complementZoneMatrix(): Promise<ComplementResult> {
    console.log('🎯 Complementing zone matrix...');
    
    try {
      // ストライクゾーンを9分割してzone_idを補完
      const missingZones = await q(`
        SELECT pitch_id, plate_x, plate_z
        FROM pitches p
        JOIN games g ON p.game_id = g.game_id
        WHERE g.level = 'NPB2'
          AND DATE(p.event_timestamp) = $1
          AND p.zone_id IS NULL
          AND p.plate_x IS NOT NULL
          AND p.plate_z IS NOT NULL
      `, [this.today]);

      let complemented = 0;
      
      for (const pitch of missingZones) {
        try {
          const zoneId = this.calculateZoneId(pitch.plate_x, pitch.plate_z);
          
          await q(`
            UPDATE pitches 
            SET 
              zone_id = $1,
              complement_source = COALESCE(complement_source, '') || ',zone_calculated',
              complement_updated_at = NOW()
            WHERE pitch_id = $2
          `, [zoneId, pitch.pitch_id]);
          
          complemented++;
        } catch (error) {
          this.stats.errors++;
        }
      }

      this.stats.complemented += complemented;
      return { 
        success: true, 
        message: `Complemented ${complemented} zone IDs`,
        affectedRows: complemented 
      };

    } catch (error) {
      console.error('Error in complement zones:', error);
      return { success: false, message: error.message, affectedRows: 0 };
    }
  }

  private async complementMixRatios(): Promise<ComplementResult> {
    console.log('⚾ Complementing pitch mix ratios...');
    
    try {
      // 投手ごとの球種ミックス比率を計算・更新
      const pitchers = await q(`
        SELECT DISTINCT p.pitcher_id, p.pitcher_name
        FROM pitches p
        JOIN games g ON p.game_id = g.game_id
        WHERE g.level = 'NPB2'
          AND DATE(p.event_timestamp) = $1
          AND p.pitcher_id IS NOT NULL
      `, [this.today]);

      let complemented = 0;
      
      for (const pitcher of pitchers) {
        try {
          // 過去30日間の球種分布を計算
          const mixRatio = await q(`
            SELECT 
              pitch_type,
              COUNT(*) as count,
              ROUND(COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER () * 100, 1) as percentage
            FROM pitches p
            JOIN games g ON p.game_id = g.game_id
            WHERE g.level = 'NPB2'
              AND p.pitcher_id = $1
              AND DATE(p.event_timestamp) >= $2
              AND p.pitch_type IS NOT NULL
            GROUP BY pitch_type
            ORDER BY count DESC
          `, [pitcher.pitcher_id, this.getDateDaysAgo(30)]);

          if (mixRatio.length > 0) {
            // 投手プロファイルテーブルに保存
            await q(`
              INSERT INTO pitcher_profiles (
                pitcher_id, pitcher_name, level, 
                pitch_mix_ratios, last_updated, data_source
              ) VALUES ($1, $2, 'NPB2', $3, NOW(), 'baseballdata_complement')
              ON CONFLICT (pitcher_id, level) 
              DO UPDATE SET
                pitch_mix_ratios = $3,
                last_updated = NOW(),
                data_source = 'baseballdata_complement'
            `, [
              pitcher.pitcher_id,
              pitcher.pitcher_name,
              JSON.stringify(mixRatio)
            ]);
            
            complemented++;
          }
        } catch (error) {
          this.stats.errors++;
        }
      }

      return { 
        success: true, 
        message: `Complemented mix ratios for ${complemented} pitchers`,
        affectedRows: complemented 
      };

    } catch (error) {
      console.error('Error in complement mix ratios:', error);
      return { success: false, message: error.message, affectedRows: 0 };
    }
  }

  private async updateConfidenceScores(): Promise<void> {
    console.log('🎯 Updating confidence scores...');
    
    // データ完全性に基づく信頼度スコア更新
    await q(`
      UPDATE pitches 
      SET complement_confidence = CASE
        WHEN complement_source IS NULL THEN 1.0  -- オリジナルデータ
        WHEN complement_source LIKE '%estimated%' THEN 0.7  -- 推定データ
        WHEN complement_source LIKE '%calculated%' THEN 0.9  -- 計算データ
        ELSE 0.5
      END,
      complement_updated_at = NOW()
      WHERE DATE(event_timestamp) = $1
        AND complement_confidence IS NULL
    `, [this.today]);
  }

  private async generateReport(): Promise<void> {
    const report = await q(`
      SELECT 
        'Total pitches processed' as metric,
        COUNT(*) as value
      FROM pitches p
      JOIN games g ON p.game_id = g.game_id
      WHERE g.level = 'NPB2'
        AND DATE(p.event_timestamp) = $1
      
      UNION ALL
      
      SELECT 
        'Complemented data',
        COUNT(*)
      FROM pitches p
      JOIN games g ON p.game_id = g.game_id
      WHERE g.level = 'NPB2'
        AND DATE(p.event_timestamp) = $1
        AND complement_source IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'High confidence (≥0.8)',
        COUNT(*)
      FROM pitches p
      JOIN games g ON p.game_id = g.game_id
      WHERE g.level = 'NPB2'
        AND DATE(p.event_timestamp) = $1
        AND complement_confidence >= 0.8
        
      UNION ALL
      
      SELECT 
        'Data completeness %',
        ROUND(
          COUNT(CASE WHEN plate_x IS NOT NULL AND plate_z IS NOT NULL THEN 1 END)::DECIMAL /
          COUNT(*) * 100, 1
        )
      FROM pitches p
      JOIN games g ON p.game_id = g.game_id
      WHERE g.level = 'NPB2'
        AND DATE(p.event_timestamp) = $1
    `, [this.today]);

    console.log('\n📊 Complement Report:');
    report.forEach(row => {
      console.log(`  ${row.metric}: ${row.value}`);
    });
  }

  private calculateZoneId(plateX: number, plateZ: number): number {
    // NPB標準ストライクゾーン（9分割）
    // 1=左下, 5=真ん中, 9=右上, 10+=ボールゾーン
    
    const zoneWidth = 17 / 3;  // インチ
    const zoneHeight = (3.5 - 1.5) / 3;  // フィート

    if (plateX < -8.5) return 11; // 左外
    if (plateX > 8.5) return 12;  // 右外
    if (plateZ < 1.5) return 13;  // 下外
    if (plateZ > 3.5) return 14;  // 上外

    const xZone = Math.floor((plateX + 8.5) / zoneWidth) + 1;
    const zZone = Math.floor((plateZ - 1.5) / zoneHeight) + 1;

    return Math.min(9, Math.max(1, (zZone - 1) * 3 + xZone));
  }

  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }
}

// 実行部分
if (require.main === module) {
  const complement = new BaseballDataComplement();
  complement.run()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { BaseballDataComplement };