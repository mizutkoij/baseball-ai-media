/**
 * アフィリエイトクリック追跡API
 * Prometheus メトリクス対応
 */

import { NextRequest, NextResponse } from 'next/server';

// メトリクス記録用の簡易メモリストア（プロダクションではRedis等を推奨）
class ClickMetrics {
  private static instance: ClickMetrics;
  private clicks: Map<string, number> = new Map();
  private dailyClicks: Map<string, number> = new Map();

  public static getInstance(): ClickMetrics {
    if (!ClickMetrics.instance) {
      ClickMetrics.instance = new ClickMetrics();
    }
    return ClickMetrics.instance;
  }

  recordClick(provider: string, category: string, item: string) {
    const timestamp = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    
    // 全体カウンター
    const totalKey = `${provider}_${category}`;
    this.clicks.set(totalKey, (this.clicks.get(totalKey) || 0) + 1);
    
    // 日次カウンター
    const dailyKey = `${today}_${provider}_${category}`;
    this.dailyClicks.set(dailyKey, (this.dailyClicks.get(dailyKey) || 0) + 1);

    // コンソールログ（開発用）
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Affiliate Click: ${provider}/${category}/${item}`);
    }

    return { timestamp, provider, category, item };
  }

  getMetrics() {
    return {
      total_clicks: Array.from(this.clicks.entries()).map(([key, value]) => ({
        key, value
      })),
      daily_clicks: Array.from(this.dailyClicks.entries()).map(([key, value]) => ({
        key, value
      })),
      providers: [...new Set(Array.from(this.clicks.keys()).map(k => k.split('_')[0]))],
      categories: [...new Set(Array.from(this.clicks.keys()).map(k => k.split('_')[1]))]
    };
  }

  // Prometheus形式のメトリクス出力
  getPrometheusMetrics(): string {
    let output = '# HELP affiliate_clicks_total Total affiliate clicks by provider and category\n';
    output += '# TYPE affiliate_clicks_total counter\n';

    for (const [key, value] of this.clicks.entries()) {
      const [provider, category] = key.split('_');
      output += `affiliate_clicks_total{provider="${provider}",category="${category}"} ${value}\n`;
    }

    output += '\n# HELP affiliate_daily_clicks Daily affiliate clicks\n';
    output += '# TYPE affiliate_daily_clicks gauge\n';

    const today = new Date().toISOString().slice(0, 10);
    for (const [key, value] of this.dailyClicks.entries()) {
      if (key.startsWith(today)) {
        const [date, provider, category] = key.split('_');
        output += `affiliate_daily_clicks{date="${date}",provider="${provider}",category="${category}"} ${value}\n`;
      }
    }

    return output;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, category, item, timestamp, page, referrer } = body;

    // 必須パラメータチェック
    if (!provider || !category || !item) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // メトリクス記録
    const metrics = ClickMetrics.getInstance();
    const result = metrics.recordClick(provider, category, item);

    // レスポンス
    return NextResponse.json({
      success: true,
      recorded: result,
      metadata: {
        page: page || 'unknown',
        referrer: referrer || 'direct',
        user_agent: request.headers.get('user-agent') || 'unknown',
        ip: request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            'unknown'
      }
    });

  } catch (error) {
    console.error('Affiliate click tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const metrics = ClickMetrics.getInstance();
    return NextResponse.json(metrics.getMetrics());
  } catch (error) {
    console.error('Affiliate metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}