/**
 * アフィリエイトメトリクス API - Prometheus形式
 * Grafanaダッシュボードで可視化
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // クリック追跡APIから最新メトリクスを取得
    const baseUrl = request.headers.get('host') 
      ? `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`
      : 'http://localhost:3000';

    const clickResponse = await fetch(`${baseUrl}/api/affiliate/click`, {
      method: 'GET'
    });
    
    if (!clickResponse.ok) {
      throw new Error('Failed to fetch click metrics');
    }

    const clickData = await clickResponse.json();

    // Prometheus形式のメトリクス生成
    let prometheus = '';

    // 基本クリック数メトリクス
    prometheus += '# HELP affiliate_clicks_total Total affiliate clicks\n';
    prometheus += '# TYPE affiliate_clicks_total counter\n';

    for (const click of clickData.total_clicks || []) {
      const [provider, category] = click.key.split('_');
      prometheus += `affiliate_clicks_total{provider="${provider}",category="${category}"} ${click.value}\n`;
    }

    // 今日のクリック数
    prometheus += '\n# HELP affiliate_clicks_today Today\'s affiliate clicks\n';
    prometheus += '# TYPE affiliate_clicks_today gauge\n';

    const today = new Date().toISOString().slice(0, 10);
    for (const click of clickData.daily_clicks || []) {
      if (click.key.startsWith(today)) {
        const [date, provider, category] = click.key.split('_');
        prometheus += `affiliate_clicks_today{provider="${provider}",category="${category}"} ${click.value}\n`;
      }
    }

    // プロバイダー別パフォーマンス
    prometheus += '\n# HELP affiliate_provider_performance Provider click performance\n';
    prometheus += '# TYPE affiliate_provider_performance gauge\n';

    const providerStats = new Map<string, number>();
    for (const click of clickData.total_clicks || []) {
      const provider = click.key.split('_')[0];
      providerStats.set(provider, (providerStats.get(provider) || 0) + click.value);
    }

    for (const [provider, total] of providerStats.entries()) {
      prometheus += `affiliate_provider_performance{provider="${provider}"} ${total}\n`;
    }

    // カテゴリ別クリック率
    prometheus += '\n# HELP affiliate_category_clicks Category click distribution\n';
    prometheus += '# TYPE affiliate_category_clicks gauge\n';

    const categoryStats = new Map<string, number>();
    for (const click of clickData.total_clicks || []) {
      const category = click.key.split('_')[1];
      if (category) {
        categoryStats.set(category, (categoryStats.get(category) || 0) + click.value);
      }
    }

    for (const [category, total] of categoryStats.entries()) {
      prometheus += `affiliate_category_clicks{category="${category}"} ${total}\n`;
    }

    // メトリクス更新時刻
    prometheus += '\n# HELP affiliate_metrics_last_update_timestamp Last metrics update\n';
    prometheus += '# TYPE affiliate_metrics_last_update_timestamp gauge\n';
    prometheus += `affiliate_metrics_last_update_timestamp ${Math.floor(Date.now() / 1000)}\n`;

    return new NextResponse(prometheus, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Affiliate metrics error:', error);
    
    // エラー時もPrometheus形式で返す
    const errorMetrics = `# HELP affiliate_metrics_error Metrics collection errors
# TYPE affiliate_metrics_error gauge
affiliate_metrics_error{type="fetch_failed"} 1
affiliate_metrics_last_update_timestamp ${Math.floor(Date.now() / 1000)}
`;

    return new NextResponse(errorMetrics, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }
}