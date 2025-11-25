'use client';

import { useState } from 'react';
import { 
  Crown, Star, Zap, BarChart3, Download, Share2, 
  Lock, CheckCircle, Sparkles, TrendingUp, Users,
  Award, Target, Database, Palette, Settings
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface PremiumFeature {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: 'analytics' | 'data' | 'social' | 'customization';
  isPremiumOnly: boolean;
  available: boolean;
}

const premiumFeatures: PremiumFeature[] = [
  // Analytics Features
  {
    id: 'advanced_metrics',
    name: '高度セイバーメトリクス',
    description: 'wRC+, FIP, WAR, BABIP等のプレミアム指標へのアクセス',
    icon: BarChart3,
    category: 'analytics',
    isPremiumOnly: true,
    available: true
  },
  {
    id: 'custom_formulas',
    name: 'カスタム指標計算',
    description: '独自の計算式でオリジナル指標を作成',
    icon: Settings,
    category: 'analytics',
    isPremiumOnly: true,
    available: true
  },
  {
    id: 'trend_analysis',
    name: 'トレンド分析',
    description: '選手の成績推移とパフォーマンス予測',
    icon: TrendingUp,
    category: 'analytics',
    isPremiumOnly: true,
    available: true
  },

  // Data Features
  {
    id: 'unlimited_export',
    name: '無制限データエクスポート',
    description: 'CSV, Excel, JSON形式でのデータ出力制限なし',
    icon: Download,
    category: 'data',
    isPremiumOnly: true,
    available: true
  },
  {
    id: 'api_access',
    name: 'APIアクセス',
    description: 'リアルタイムデータへのプログラム的アクセス',
    icon: Database,
    category: 'data',
    isPremiumOnly: true,
    available: false
  },
  {
    id: 'historical_data',
    name: '過去データアーカイブ',
    description: '2011年以降の全試合・成績データへのアクセス',
    icon: Archive,
    category: 'data',
    isPremiumOnly: true,
    available: true
  },

  // Social Features
  {
    id: 'custom_leaderboards',
    name: 'カスタムリーダーボード作成',
    description: '独自の指標と条件でランキングを作成・共有',
    icon: Award,
    category: 'social',
    isPremiumOnly: true,
    available: true
  },
  {
    id: 'prediction_insights',
    name: '予測分析レポート',
    description: 'AI予測の詳細解析とパフォーマンス履歴',
    icon: Target,
    category: 'social',
    isPremiumOnly: true,
    available: true
  },
  {
    id: 'private_sharing',
    name: 'プライベート共有',
    description: '限定公開でのデータ・分析結果共有',
    icon: Share2,
    category: 'social',
    isPremiumOnly: true,
    available: false
  },

  // Customization
  {
    id: 'custom_themes',
    name: 'カスタムテーマ',
    description: 'ダークモード・カラーテーマのパーソナライゼーション',
    icon: Palette,
    category: 'customization',
    isPremiumOnly: true,
    available: false
  },
  {
    id: 'priority_support',
    name: '優先サポート',
    description: '機能リクエストと技術サポートの優先対応',
    icon: Users,
    category: 'customization',
    isPremiumOnly: true,
    available: true
  }
];

// Temporary Archive icon replacement
const Archive = Database;

interface PremiumCardProps {
  showUpgrade?: boolean;
  size?: 'compact' | 'full';
}

export default function PremiumFeatures({ showUpgrade = true, size = 'full' }: PremiumCardProps) {
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const { authState } = useAuth();

  const categories = [
    { id: 'all', name: 'すべて', icon: Star },
    { id: 'analytics', name: '分析機能', icon: BarChart3 },
    { id: 'data', name: 'データ機能', icon: Database },
    { id: 'social', name: 'ソーシャル機能', icon: Users },
    { id: 'customization', name: 'カスタマイズ', icon: Settings }
  ];

  const filteredFeatures = activeCategory === 'all' 
    ? premiumFeatures 
    : premiumFeatures.filter(f => f.category === activeCategory);

  const availableCount = premiumFeatures.filter(f => f.available).length;
  const totalCount = premiumFeatures.length;

  if (size === 'compact') {
    return (
      <div className="bg-gradient-to-r from-yellow-600/20 to-purple-600/20 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <div>
              <div className="font-semibold text-white text-sm">Baseball AI Pro</div>
              <div className="text-xs text-slate-400">高度な分析機能とデータアクセス</div>
            </div>
          </div>
          {!authState.user?.isPremium && showUpgrade && (
            <button className="bg-gradient-to-r from-yellow-600 to-purple-600 hover:from-yellow-700 hover:to-purple-700 text-white font-medium px-4 py-2 rounded text-sm transition-all">
              アップグレード
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-purple-600 rounded-full flex items-center justify-center">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-purple-500 bg-clip-text text-transparent">
              Baseball AI Pro
            </h1>
            <p className="text-slate-400">プロ仕様の野球分析プラットフォーム</p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{availableCount}</div>
              <div className="text-sm text-slate-400">利用可能な機能</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">∞</div>
              <div className="text-sm text-slate-400">データエクスポート</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">24/7</div>
              <div className="text-sm text-slate-400">優先サポート</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {categories.map(category => {
            const IconComponent = category.icon;
            const isActive = activeCategory === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span className="text-sm font-medium">{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFeatures.map(feature => {
          const IconComponent = feature.icon;
          
          return (
            <div
              key={feature.id}
              className={`bg-black/20 backdrop-blur-md border rounded-lg p-6 transition-all ${
                feature.available
                  ? 'border-white/10 hover:border-yellow-500/30'
                  : 'border-slate-700/50 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    feature.available
                      ? 'bg-gradient-to-r from-yellow-500/20 to-purple-500/20'
                      : 'bg-slate-700/50'
                  }`}>
                    <IconComponent className={`w-5 h-5 ${
                      feature.available ? 'text-yellow-400' : 'text-slate-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${
                      feature.available ? 'text-white' : 'text-slate-500'
                    }`}>
                      {feature.name}
                    </h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {feature.isPremiumOnly && (
                    <Crown className="w-4 h-4 text-yellow-400" />
                  )}
                  {feature.available ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>

              {/* Description */}
              <p className={`text-sm leading-relaxed ${
                feature.available ? 'text-slate-300' : 'text-slate-500'
              }`}>
                {feature.description}
              </p>

              {/* Status */}
              <div className="mt-4 pt-4 border-t border-white/10">
                {feature.available ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>利用可能</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Zap className="w-4 h-4" />
                    <span>開発予定</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pricing & CTA */}
      {showUpgrade && !authState.user?.isPremium && (
        <div className="bg-gradient-to-r from-yellow-600/20 to-purple-600/20 border border-yellow-500/30 rounded-lg p-8 text-center">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-4">Baseball AI Pro にアップグレード</h3>
            <p className="text-slate-300 mb-6">
              プロレベルの野球分析機能とデータアクセスで、より深いインサイトを獲得
            </p>
            
            {/* Pricing */}
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6 mb-6 inline-block">
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-400 mb-2">
                  ¥980
                  <span className="text-lg font-normal text-slate-400">/月</span>
                </div>
                <div className="text-sm text-slate-400 mb-4">
                  初回30日間無料トライアル
                </div>
                
                {/* Key Benefits */}
                <div className="text-left space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">全ての高度セイバーメトリクス</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">無制限データエクスポート</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">カスタムリーダーボード作成</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">優先サポート</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-gradient-to-r from-yellow-600 to-purple-600 hover:from-yellow-700 hover:to-purple-700 text-white font-medium px-8 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2">
              <Crown className="w-5 h-5" />
              30日間無料で始める
            </button>
            <button className="border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white bg-transparent hover:bg-white/5 font-medium px-8 py-3 rounded-lg transition-all duration-200">
              詳細を見る
            </button>
          </div>
          
          <p className="text-xs text-slate-500 mt-4">
            いつでもキャンセル可能 • クレジットカード不要でトライアル開始
          </p>
        </div>
      )}

      {/* Current Pro User */}
      {authState.user?.isPremium && (
        <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/30 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="w-8 h-8 text-yellow-400" />
            <div>
              <h3 className="text-xl font-bold text-white">Baseball AI Pro メンバー</h3>
              <p className="text-green-400 text-sm">すべての機能をご利用いただけます</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl font-bold text-yellow-400">{availableCount}</div>
              <div className="text-slate-400">利用可能機能</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">∞</div>
              <div className="text-slate-400">エクスポート制限なし</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}