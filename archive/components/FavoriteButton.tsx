'use client';

import { useState } from 'react';
import { Heart, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePersonalization } from '@/hooks/usePersonalization';

interface FavoriteButtonProps {
  type: 'player' | 'team';
  id: string;
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onFavoriteChange?: (isFavorite: boolean) => void;
}

export default function FavoriteButton({ 
  type, 
  id, 
  name, 
  className = '', 
  size = 'md',
  showLabel = false,
  onFavoriteChange 
}: FavoriteButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { authState } = useAuth();
  const { 
    isFavoritePlayer, 
    isFavoriteTeam, 
    toggleFavoritePlayer, 
    toggleFavoriteTeam 
  } = usePersonalization();

  const isFavorite = type === 'player' ? isFavoritePlayer(id) : isFavoriteTeam(id);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsUpdating(true);
    
    try {
      if (type === 'player') {
        await toggleFavoritePlayer(id);
      } else {
        await toggleFavoriteTeam(id);
      }
      
      onFavoriteChange?.(!isFavorite);
    } catch (error) {
      console.error('Failed to update favorite:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isUpdating}
      className={`
        group relative flex items-center gap-2 rounded-lg transition-all duration-200 
        ${isFavorite 
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
          : 'bg-black/20 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30'
        }
        ${showLabel ? 'px-3 py-2' : `p-2 ${sizeClasses[size]}`}
        ${isUpdating ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}
        ${className}
      `}
      title={isFavorite ? `${name}をお気に入りから削除` : `${name}をお気に入りに追加`}
    >
      {/* Heart Icon */}
      <div className="relative">
        <Heart 
          className={`
            ${iconSizeClasses[size]} transition-all duration-200
            ${isFavorite ? 'fill-current' : 'fill-none'}
            ${isUpdating ? 'animate-pulse' : ''}
          `}
        />
        
        {/* Animation overlay */}
        {!isFavorite && (
          <Plus 
            className={`
              absolute inset-0 ${iconSizeClasses[size]} opacity-0 group-hover:opacity-50 transition-opacity
            `}
          />
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <span className="font-medium text-sm">
          {isFavorite ? 'お気に入り済み' : 'お気に入りに追加'}
        </span>
      )}

      {/* Tooltip for small sizes */}
      {!showLabel && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-slate-800 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap">
            {isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-l-transparent border-r-transparent border-t-slate-800"></div>
        </div>
      )}

      {/* Login prompt for unauthenticated users */}
      {!authState.isAuthenticated && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-blue-600 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap">
            ログインして保存しよう
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-l-transparent border-r-transparent border-t-blue-600"></div>
        </div>
      )}
    </button>
  );
}