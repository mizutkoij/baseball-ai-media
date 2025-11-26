"use client";

import React, { useEffect } from 'react';
import { TrendingUp, Star, Zap, Award } from 'lucide-react';

export interface PromotionData {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  promotion_type: 'rookie' | 'callup' | 'breakthrough';
  farm_stats?: {
    year: number;
    games: number;
    key_stat: number;
    key_stat_name: string;
  };
  major_stats?: {
    year: number;
    games: number;
    key_stat: number;
    key_stat_name: string;
  };
  impact_rating: 'high' | 'medium' | 'low';
  description: string;
}

interface PromotionBadgeProps {
  promotion: PromotionData;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

const PromotionBadge: React.FC<PromotionBadgeProps> = ({
  promotion,
  size = 'medium',
  showDetails = false
}) => {
  const getBadgeConfig = (type: PromotionData['promotion_type']) => {
    switch (type) {
      case 'rookie':
        return {
          icon: Star,
          bg: 'bg-gradient-to-r from-yellow-500 to-orange-500',
          text: '新人王候補',
          color: 'text-yellow-100',
          border: 'border-yellow-400/50'
        };
      case 'callup':
        return {
          icon: TrendingUp,
          bg: 'bg-gradient-to-r from-blue-500 to-purple-500',
          text: '昇格注目',
          color: 'text-blue-100',
          border: 'border-blue-400/50'
        };
      case 'breakthrough':
        return {
          icon: Zap,
          bg: 'bg-gradient-to-r from-green-500 to-teal-500',
          text: 'ブレイク',
          color: 'text-green-100',
          border: 'border-green-400/50'
        };
      default:
        return {
          icon: Award,
          bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
          text: '注目選手',
          color: 'text-purple-100',
          border: 'border-purple-400/50'
        };
    }
  };

  const getImpactColor = (impact: PromotionData['impact_rating']) => {
    switch (impact) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getSizeClasses = (size: 'small' | 'medium' | 'large') => {
    switch (size) {
      case 'small':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 'w-3 h-3',
          text: 'text-xs'
        };
      case 'large':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'w-6 h-6',
          text: 'text-base'
        };
      default:
        return {
          container: 'px-3 py-1.5 text-sm',
          icon: 'w-4 h-4',
          text: 'text-sm'
        };
    }
  };

  const config = getBadgeConfig(promotion.promotion_type);
  const sizeClasses = getSizeClasses(size);
  const IconComponent = config.icon;

  if (!showDetails) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 rounded-full ${config.bg} ${config.color} 
          ${sizeClasses.container} font-medium shadow-sm border ${config.border} group relative cursor-pointer`}
        title={promotion.description}
        onClick={() => {
          // Track analytics for badge interaction
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'promotion_badge_click', {
              player_id: promotion.player_id,
              player_name: promotion.player_name,
              team: promotion.team,
              promotion_type: promotion.promotion_type,
              impact_rating: promotion.impact_rating,
              badge_size: size
            });
          }
        }}
      >
        <IconComponent className={`${sizeClasses.icon} flex-shrink-0`} />
        <span className={sizeClasses.text}>{config.text}</span>
        
        {/* Tooltip on hover */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
          opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
          <div className="bg-black/90 text-white text-xs rounded-lg p-2 whitespace-nowrap
            border border-white/20 shadow-lg">
            <div className="font-semibold mb-1">{promotion.player_name}</div>
            <div>{promotion.description}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4"
      onClick={() => {
        // Track analytics for detailed badge view
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'promotion_badge_detail_view', {
            player_id: promotion.player_id,
            player_name: promotion.player_name,
            team: promotion.team,
            promotion_type: promotion.promotion_type,
            impact_rating: promotion.impact_rating,
            has_farm_stats: !!promotion.farm_stats,
            has_major_stats: !!promotion.major_stats
          });
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Badge Icon */}
        <div className={`${config.bg} p-2 rounded-lg flex-shrink-0`}>
          <IconComponent className="w-5 h-5 text-white" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-white">{promotion.player_name}</h4>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} 
              ${config.color} text-xs font-medium`}>
              {config.text}
            </span>
            <span className={`text-xs font-medium ${getImpactColor(promotion.impact_rating)}`}>
              {promotion.impact_rating.toUpperCase()}
            </span>
          </div>
          
          <p className="text-sm text-slate-300 mb-3">{promotion.description}</p>
          
          {/* Stats Comparison */}
          {promotion.farm_stats && promotion.major_stats && (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-slate-400 mb-1">ファーム成績</div>
                <div className="text-white font-medium">
                  {promotion.farm_stats.games}試合
                </div>
                <div className="text-slate-300">
                  {promotion.farm_stats.key_stat_name}: {promotion.farm_stats.key_stat}
                </div>
              </div>
              
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-slate-400 mb-1">一軍成績</div>
                <div className="text-white font-medium">
                  {promotion.major_stats.games}試合
                </div>
                <div className="text-slate-300">
                  {promotion.major_stats.key_stat_name}: {promotion.major_stats.key_stat}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PromotionListProps {
  promotions: PromotionData[];
  title?: string;
}

export const PromotionList: React.FC<PromotionListProps> = ({
  promotions,
  title = "昇格注目選手"
}) => {
  if (!promotions || promotions.length === 0) {
    return null;
  }

  // Track analytics for promotion list view
  React.useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag && promotions.length > 0) {
      (window as any).gtag('event', 'promotion_list_view', {
        total_promotions: promotions.length,
        rookie_count: promotions.filter(p => p.promotion_type === 'rookie').length,
        callup_count: promotions.filter(p => p.promotion_type === 'callup').length,
        breakthrough_count: promotions.filter(p => p.promotion_type === 'breakthrough').length,
        high_impact_count: promotions.filter(p => p.impact_rating === 'high').length
      });
    }
  }, [promotions]);

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp className="w-6 h-6 text-purple-500" />
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="text-sm text-slate-400">({promotions.length}人)</span>
      </div>
      
      <div className="space-y-4">
        {promotions.map((promotion, index) => (
          <PromotionBadge
            key={`${promotion.player_id}-${index}`}
            promotion={promotion}
            showDetails={true}
          />
        ))}
      </div>
      
      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-yellow-400 font-semibold">
              {promotions.filter(p => p.promotion_type === 'rookie').length}
            </div>
            <div className="text-slate-400">新人王候補</div>
          </div>
          <div>
            <div className="text-blue-400 font-semibold">
              {promotions.filter(p => p.promotion_type === 'callup').length}
            </div>
            <div className="text-slate-400">昇格注目</div>
          </div>
          <div>
            <div className="text-green-400 font-semibold">
              {promotions.filter(p => p.promotion_type === 'breakthrough').length}
            </div>
            <div className="text-slate-400">ブレイク</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionBadge;