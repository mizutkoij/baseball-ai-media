/**
 * アフィリエイトシステム - 負荷ゼロで既存サイトに差し込み
 * 景表法対応・rel=sponsored・クリック追跡機能付き
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface AffiliateConfig {
  providers: Record<string, {
    name: string;
    tag?: string;
    partner_id?: string;
    sid?: string;
    media_id?: string;
    enabled: boolean;
    tracking: string;
  }>;
  teams: Record<string, {
    name: string;
    shop?: Record<string, string>;
    tickets?: Record<string, string>;
  }>;
  generic: Record<string, {
    name: string;
    [provider: string]: string;
  }>;
  disclosure: {
    text_jp: string;
    text_short: string;
    required_by_law: boolean;
    updated: string;
  };
  settings: {
    click_tracking: boolean;
    conversion_tracking: boolean;
    a_b_testing: {
      enabled: boolean;
      variants: string[];
    };
    display_rules: {
      game_page: {
        pre_game_minutes: number;
        during_game: boolean;
        post_game_hours: number;
      };
      max_links_per_page: number;
      rotation_enabled: boolean;
    };
  };
}

class AffiliateManager {
  private config: AffiliateConfig;
  private static instance: AffiliateManager;

  private constructor() {
    try {
      const configPath = join(process.cwd(), 'config', 'affiliates.json');
      const configData = readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.error('Failed to load affiliate config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  public static getInstance(): AffiliateManager {
    if (!AffiliateManager.instance) {
      AffiliateManager.instance = new AffiliateManager();
    }
    return AffiliateManager.instance;
  }

  private getDefaultConfig(): AffiliateConfig {
    return {
      providers: {},
      teams: {},
      generic: {},
      disclosure: {
        text_jp: 'アフィリエイト参加中',
        text_short: '※紹介料を得ることがあります',
        required_by_law: true,
        updated: new Date().toISOString().slice(0, 10)
      },
      settings: {
        click_tracking: false,
        conversion_tracking: false,
        a_b_testing: { enabled: false, variants: [] },
        display_rules: {
          game_page: { pre_game_minutes: 60, during_game: true, post_game_hours: 2 },
          max_links_per_page: 3,
          rotation_enabled: false
        }
      }
    };
  }

  /**
   * チーム関連商品リンクを取得
   */
  getTeamShopLink(teamCode: string, provider: string = 'amazon'): string | null {
    const team = this.config.teams[teamCode];
    if (!team || !team.shop || !team.shop[provider]) {
      return null;
    }

    const baseUrl = team.shop[provider];
    return this.addTracking(baseUrl, provider, 'team_shop', teamCode);
  }

  /**
   * チケット関連リンクを取得
   */
  getTeamTicketLink(teamCode: string, provider: string = 'valuecommerce'): string | null {
    const team = this.config.teams[teamCode];
    if (!team || !team.tickets || !team.tickets[provider]) {
      return null;
    }

    const baseUrl = team.tickets[provider];
    return this.addTracking(baseUrl, provider, 'team_tickets', teamCode);
  }

  /**
   * 汎用商品リンクを取得
   */
  getGenericLink(category: string, provider: string = 'amazon'): string | null {
    const generic = this.config.generic[category];
    if (!generic || !generic[provider]) {
      return null;
    }

    const baseUrl = generic[provider];
    return this.addTracking(baseUrl, provider, 'generic', category);
  }

  /**
   * 選手関連グッズリンクを生成
   */
  getPlayerGoodsLink(playerName: string, teamCode: string, provider: string = 'amazon'): string | null {
    if (provider === 'amazon' && this.config.providers.amazon?.enabled) {
      const searchQuery = encodeURIComponent(`${playerName} 野球 グッズ`);
      const tag = this.config.providers.amazon.tag;
      const baseUrl = `https://www.amazon.co.jp/s?k=${searchQuery}&tag=${tag}`;
      return this.addTracking(baseUrl, provider, 'player_goods', `${playerName}_${teamCode}`);
    }

    if (provider === 'rakuten' && this.config.providers.rakuten?.enabled) {
      const searchQuery = encodeURIComponent(`${playerName} 野球 グッズ`);
      const partnerId = this.config.providers.rakuten.partner_id;
      const baseUrl = `https://hb.afl.rakuten.co.jp/hgc/${partnerId}/?pc=https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F${searchQuery}%2F`;
      return this.addTracking(baseUrl, provider, 'player_goods', `${playerName}_${teamCode}`);
    }

    return null;
  }

  /**
   * 配信サービスリンクを取得（試合前60分用）
   */
  getStreamingLink(service: string = 'dazn'): string | null {
    const streaming = this.config.generic.streaming;
    if (!streaming || !streaming[service]) {
      return null;
    }

    const baseUrl = streaming[service];
    return this.addTracking(baseUrl, 'a8', 'streaming', service);
  }

  /**
   * クリック追跡パラメーターを追加
   */
  private addTracking(url: string, provider: string, category: string, item: string): string {
    if (!this.config.settings.click_tracking) {
      return url;
    }

    const separator = url.includes('?') ? '&' : '?';
    const trackingParams = [
      `utm_source=baseball-ai-media`,
      `utm_medium=affiliate`,
      `utm_campaign=${category}`,
      `utm_content=${item}`,
      `af_provider=${provider}`,
      `af_timestamp=${Date.now()}`
    ].join('&');

    return `${url}${separator}${trackingParams}`;
  }

  /**
   * 適切なリンク属性を取得（SEO・法的対応）
   */
  getLinkAttributes(): { rel: string; target: string } {
    return {
      rel: 'sponsored nofollow', // Google推奨のアフィリエイトリンク属性
      target: '_blank' // 別タブで開く
    };
  }

  /**
   * 広告表示タイミング判定
   */
  shouldShowAffiliateLink(gameStatus: string, gameTime?: Date): boolean {
    if (!gameTime) return true;

    const now = new Date();
    const timeDiff = (gameTime.getTime() - now.getTime()) / (1000 * 60); // 分

    const rules = this.config.settings.display_rules.game_page;

    switch (gameStatus) {
      case 'SCHEDULED':
        return timeDiff <= rules.pre_game_minutes && timeDiff >= -60; // 試合前60分～試合後60分
      case 'LIVE':
      case 'IN_PROGRESS':
        return rules.during_game;
      case 'FINISHED':
        const hoursAfter = Math.abs(timeDiff) / 60;
        return hoursAfter <= rules.post_game_hours;
      default:
        return true;
    }
  }

  /**
   * A/Bテスト用バリアント選択
   */
  getDisplayVariant(userId?: string): string {
    if (!this.config.settings.a_b_testing.enabled) {
      return 'default';
    }

    const variants = this.config.settings.a_b_testing.variants;
    if (variants.length === 0) return 'default';

    // ユーザーIDがない場合はランダム
    if (!userId) {
      return variants[Math.floor(Math.random() * variants.length)];
    }

    // ユーザーIDベースの一貫性のあるハッシュ
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }

    return variants[Math.abs(hash) % variants.length];
  }

  /**
   * 法的表示文言を取得
   */
  getDisclosureText(short: boolean = false): string {
    return short ? this.config.disclosure.text_short : this.config.disclosure.text_jp;
  }

  /**
   * 有効なプロバイダー一覧を取得
   */
  getEnabledProviders(): string[] {
    return Object.entries(this.config.providers)
      .filter(([_, config]) => config.enabled)
      .map(([provider]) => provider);
  }

  /**
   * メトリクス記録用のクリックイベント生成
   */
  recordClick(provider: string, category: string, item: string): void {
    if (typeof window !== 'undefined' && this.config.settings.click_tracking) {
      // クライアントサイドでメトリクス送信
      fetch('/api/affiliate/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          category,
          item,
          timestamp: Date.now(),
          page: window.location.pathname,
          referrer: document.referrer
        })
      }).catch(console.error);
    }
  }
}

// シングルトンインスタンス
export const affiliateManager = AffiliateManager.getInstance();

// 型定義をエクスポート
export type { AffiliateConfig };