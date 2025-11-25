'use client';

import React from 'react';
import { affiliateManager } from '@/lib/affiliates';
import { ExternalLink, ShoppingCart, Ticket } from 'lucide-react';

interface AffiliateLinkProps {
  type: 'team_shop' | 'team_tickets' | 'player_goods' | 'generic' | 'streaming';
  teamCode?: string;
  playerName?: string;
  category?: string;
  provider?: string;
  variant?: 'default' | 'minimal' | 'enhanced';
  className?: string;
  children?: React.ReactNode;
}

export default function AffiliateLink({ 
  type, 
  teamCode, 
  playerName, 
  category, 
  provider = 'amazon',
  variant = 'default',
  className = '',
  children 
}: AffiliateLinkProps) {
  // リンクURL取得
  const getAffiliateUrl = (): string | null => {
    switch (type) {
      case 'team_shop':
        return teamCode ? affiliateManager.getTeamShopLink(teamCode, provider) : null;
      case 'team_tickets':
        return teamCode ? affiliateManager.getTeamTicketLink(teamCode, provider) : null;
      case 'player_goods':
        return (playerName && teamCode) ? 
          affiliateManager.getPlayerGoodsLink(playerName, teamCode, provider) : null;
      case 'generic':
        return category ? affiliateManager.getGenericLink(category, provider) : null;
      case 'streaming':
        return affiliateManager.getStreamingLink(category || 'dazn');
      default:
        return null;
    }
  };

  // デフォルトテキスト生成
  const getDefaultText = (): string => {
    switch (type) {
      case 'team_shop':
        return 'グッズを見る';
      case 'team_tickets':
        return 'チケットを探す';
      case 'player_goods':
        return `${playerName || '選手'}グッズ`;
      case 'generic':
        return '商品を見る';
      case 'streaming':
        return '視聴する';
      default:
        return 'リンク';
    }
  };

  // アイコン取得
  const getIcon = () => {
    switch (type) {
      case 'team_shop':
      case 'player_goods':
      case 'generic':
        return <ShoppingCart className="w-4 h-4" />;
      case 'team_tickets':
        return <Ticket className="w-4 h-4" />;
      case 'streaming':
        return <ExternalLink className="w-4 h-4" />;
      default:
        return <ExternalLink className="w-4 h-4" />;
    }
  };

  const url = getAffiliateUrl();
  if (!url) return null;

  const linkAttributes = affiliateManager.getLinkAttributes();
  
  // クリック追跡
  const handleClick = () => {
    affiliateManager.recordClick(
      provider, 
      type, 
      teamCode || playerName || category || 'unknown'
    );
  };

  // バリアント別スタイル
  const getVariantStyles = (): string => {
    const baseStyles = 'inline-flex items-center gap-2 transition-colors duration-200';
    
    switch (variant) {
      case 'minimal':
        return `${baseStyles} text-sm text-blue-600 hover:text-blue-800 underline`;
      case 'enhanced':
        return `${baseStyles} px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200`;
      default:
        return `${baseStyles} px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium`;
    }
  };

  return (
    <div className="affiliate-container">
      <a
        href={url}
        {...linkAttributes}
        onClick={handleClick}
        className={`${getVariantStyles()} ${className}`}
      >
        {getIcon()}
        <span>{children || getDefaultText()}</span>
      </a>
      
      {variant !== 'minimal' && (
        <div className="text-xs text-gray-500 mt-1">
          {affiliateManager.getDisclosureText(true)}
        </div>
      )}
    </div>
  );
}

// 便利なプリセットコンポーネント

export function TeamShopLink({ teamCode, className }: { teamCode: string; className?: string }) {
  return (
    <AffiliateLink
      type="team_shop"
      teamCode={teamCode}
      provider="amazon"
      variant="default"
      className={className}
    />
  );
}

export function TeamTicketLink({ teamCode, className }: { teamCode: string; className?: string }) {
  return (
    <AffiliateLink
      type="team_tickets"
      teamCode={teamCode}
      provider="valuecommerce"
      variant="default"
      className={className}
    />
  );
}

export function PlayerGoodsLink({ 
  playerName, 
  teamCode, 
  className 
}: { 
  playerName: string; 
  teamCode: string; 
  className?: string; 
}) {
  return (
    <AffiliateLink
      type="player_goods"
      playerName={playerName}
      teamCode={teamCode}
      provider="amazon"
      variant="default"
      className={className}
    />
  );
}

export function StreamingLink({ 
  service = 'dazn',
  className 
}: { 
  service?: string;
  className?: string; 
}) {
  return (
    <AffiliateLink
      type="streaming"
      category={service}
      provider="a8"
      variant="enhanced"
      className={className}
    >
      {service === 'dazn' ? 'DAZN で視聴' : 'パ・リーグTVで視聴'}
    </AffiliateLink>
  );
}