import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// モデル健全性メトリクス取得API
export async function GET(request: NextRequest) {
  try {
    // モデル評価結果ファイルを読み込み
    const metricsPath = path.join(process.cwd(), 'data', 'model-metrics.json');
    
    let currentMetrics;
    try {
      const metricsContent = await fs.readFile(metricsPath, 'utf-8');
      currentMetrics = JSON.parse(metricsContent);
    } catch (error) {
      // ファイルが存在しない場合はダミーデータを返す
      currentMetrics = {
        top1_accuracy: 0.68,
        top3_accuracy: 0.89,
        cross_entropy: 1.25,
        ece: 0.08,
        timestamp: new Date().toISOString()
      };
    }
    
    // 前日比較データの読み込み
    let previousMetrics;
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      
      const prevMetricsPath = path.join(
        process.cwd(), 
        'data', 
        'daily-metrics', 
        `model-metrics-${yesterdayStr}.json`
      );
      
      const prevContent = await fs.readFile(prevMetricsPath, 'utf-8');
      previousMetrics = JSON.parse(prevContent);
    } catch (error) {
      // 前日データが無い場合は null
      previousMetrics = null;
    }
    
    // レスポンス構築
    const response = {
      ...currentMetrics,
      previous: previousMetrics
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Model health API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch model health metrics' },
      { status: 500 }
    );
  }
}

// モデル健全性メトリクス更新API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      top1_accuracy,
      top3_accuracy,
      cross_entropy,
      ece
    } = body;
    
    // バリデーション
    if (typeof top1_accuracy !== 'number' || typeof top3_accuracy !== 'number' ||
        typeof cross_entropy !== 'number' || typeof ece !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metrics format' },
        { status: 400 }
      );
    }
    
    const metrics = {
      top1_accuracy,
      top3_accuracy,
      cross_entropy,
      ece,
      timestamp: new Date().toISOString()
    };
    
    // 現在のメトリクス保存
    const metricsPath = path.join(process.cwd(), 'data', 'model-metrics.json');
    await fs.mkdir(path.dirname(metricsPath), { recursive: true });
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
    
    // 日次アーカイブ保存
    const today = new Date().toISOString().slice(0, 10);
    const dailyMetricsPath = path.join(
      process.cwd(), 
      'data', 
      'daily-metrics', 
      `model-metrics-${today}.json`
    );
    
    await fs.mkdir(path.dirname(dailyMetricsPath), { recursive: true });
    await fs.writeFile(dailyMetricsPath, JSON.stringify(metrics, null, 2));
    
    return NextResponse.json({ success: true, metrics });
    
  } catch (error) {
    console.error('Model health update error:', error);
    return NextResponse.json(
      { error: 'Failed to update model health metrics' },
      { status: 500 }
    );
  }
}