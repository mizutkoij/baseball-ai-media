'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ExternalLink, BarChart3, Target, TrendingUp, Zap, Users, Database, Sprout, Activity, Globe } from 'lucide-react';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  href: string;
  color: string;
  stats?: {
    label: string;
    value: string;
  };
  badge?: string;
  external?: boolean;
}

export default function FeatureCard({ 
  icon, 
  title, 
  description, 
  href, 
  color, 
  stats,
  badge,
  external = false 
}: FeatureCardProps) {
  const iconMap = {
    BarChart3,
    Target,
    TrendingUp,
    Zap,
    Users,
    Database,
    Sprout,
    Activity,
    Globe
  };
  
  const Icon = iconMap[icon as keyof typeof iconMap] || BarChart3;
  const [isHovered, setIsHovered] = useState(false);

  const colorClasses = {
    blue: {
      icon: 'text-blue-500',
      hover: 'hover:border-blue-500/50 hover:bg-blue-500/5',
      button: 'text-blue-400 hover:text-blue-300',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    },
    purple: {
      icon: 'text-purple-500',
      hover: 'hover:border-purple-500/50 hover:bg-purple-500/5',
      button: 'text-purple-400 hover:text-purple-300',
      badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    },
    green: {
      icon: 'text-green-500',
      hover: 'hover:border-green-500/50 hover:bg-green-500/5',
      button: 'text-green-400 hover:text-green-300',
      badge: 'bg-green-500/10 text-green-400 border-green-500/20'
    },
    yellow: {
      icon: 'text-yellow-500',
      hover: 'hover:border-yellow-500/50 hover:bg-yellow-500/5',
      button: 'text-yellow-400 hover:text-yellow-300',
      badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    },
    red: {
      icon: 'text-red-500',
      hover: 'hover:border-red-500/50 hover:bg-red-500/5',
      button: 'text-red-400 hover:text-red-300',
      badge: 'bg-red-500/10 text-red-400 border-red-500/20'
    },
    cyan: {
      icon: 'text-cyan-500',
      hover: 'hover:border-cyan-500/50 hover:bg-cyan-500/5',
      button: 'text-cyan-400 hover:text-cyan-300',
      badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
    },
    orange: {
      icon: 'text-orange-500',
      hover: 'hover:border-orange-500/50 hover:bg-orange-500/5',
      button: 'text-orange-400 hover:text-orange-300',
      badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    }
  };

  const classes = colorClasses[color as keyof typeof colorClasses];

  return (
    <div
      className={`group relative bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl ${classes.hover}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badge */}
      {badge && (
        <div className={`absolute top-4 right-4 px-2 py-1 rounded-md text-xs font-medium border ${classes.badge}`}>
          {badge}
        </div>
      )}

      {/* Icon with animation */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-lg bg-black/20 border border-white/10 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-6 h-6 ${classes.icon} transition-all duration-300 ${isHovered ? 'rotate-12' : ''}`} />
        </div>
        <h3 className="text-xl font-bold text-white group-hover:text-white transition-colors">
          {title}
        </h3>
      </div>

      {/* Description */}
      <p className="text-slate-400 mb-4 leading-relaxed">
        {description}
      </p>

      {/* Stats */}
      {stats && (
        <div className="bg-black/30 rounded-lg p-3 mb-4 border border-white/5">
          <div className="text-2xl font-bold text-white mb-1">{stats.value}</div>
          <div className="text-xs text-slate-400">{stats.label}</div>
        </div>
      )}

      {/* Action Button */}
      <Link 
        href={href}
        className={`inline-flex items-center gap-2 font-medium transition-all duration-300 ${classes.button}`}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        詳細を見る
        {external ? (
          <ExternalLink className={`w-4 h-4 transition-transform duration-300 ${isHovered ? 'translate-x-1 -translate-y-1' : ''}`} />
        ) : (
          <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
        )}
      </Link>

      {/* Hover Effect Overlay */}
      <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br ${color === 'blue' ? 'from-blue-500/5 to-transparent' : color === 'purple' ? 'from-purple-500/5 to-transparent' : color === 'green' ? 'from-green-500/5 to-transparent' : color === 'yellow' ? 'from-yellow-500/5 to-transparent' : color === 'red' ? 'from-red-500/5 to-transparent' : color === 'cyan' ? 'from-cyan-500/5 to-transparent' : 'from-orange-500/5 to-transparent'}`}></div>

      {/* Animated border */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className={`absolute inset-0 rounded-xl border-2 ${color === 'blue' ? 'border-blue-500/20' : color === 'purple' ? 'border-purple-500/20' : color === 'green' ? 'border-green-500/20' : color === 'yellow' ? 'border-yellow-500/20' : color === 'red' ? 'border-red-500/20' : color === 'cyan' ? 'border-cyan-500/20' : 'border-orange-500/20'} animate-pulse`}></div>
      </div>
    </div>
  );
}