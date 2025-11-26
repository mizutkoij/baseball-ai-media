import React from 'react';
import Link from 'next/link';

interface PlayerStats {
  games?: number;
  PA?: number;
  wRC_plus?: number;
  OPS?: number;
  HR?: number;
  SB?: number;
  AVG?: number;
  // Pitching stats
  ERA?: number;
  WHIP?: number;
  FIP?: number;
  innings?: number;
}

interface PlayerCardData {
  id: string;
  name: string;
  team: string;
  position: string;
  age?: number;
  stats?: PlayerStats;
  photo_url?: string;
}

interface PlayerCardProps {
  data: PlayerCardData | null;
  loading?: boolean;
  error?: Error | null;
  className?: string;
}

export default function PlayerCard({ data, loading = false, error, className = "" }: PlayerCardProps) {
  
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-gray-500">選手データを取得中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-md border border-red-200 p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-500 mr-2">⚠️</div>
            <div>
              <h6 className="font-semibold text-red-800">データ取得エラー</h6>
              <p className="text-red-600 text-sm mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="text-6xl text-gray-300 mb-4">👤</div>
          <h5 className="text-gray-500 font-medium">選手が見つかりません</h5>
        </div>
      </div>
    );
  }

  const isPitcher = data.position === 'P';
  const stats = data.stats || {};

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {data.photo_url ? (
              <img 
                src={data.photo_url} 
                alt={data.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-500 text-xl">👤</span>
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-gray-900">{data.name}</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                  {data.team}
                </span>
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                  {data.position}
                </span>
                {data.age && (
                  <span className="text-gray-500">{data.age}歳</span>
                )}
              </div>
            </div>
          </div>
          <Link
            href={`/players/${data.id}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            詳細 →
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {isPitcher ? (
            <>
              {stats.ERA !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.ERA?.toFixed(2) || '-'}</div>
                  <div className="text-xs text-gray-500">ERA</div>
                </div>
              )}
              {stats.WHIP !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.WHIP?.toFixed(2) || '-'}</div>
                  <div className="text-xs text-gray-500">WHIP</div>
                </div>
              )}
              {stats.FIP !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.FIP?.toFixed(2) || '-'}</div>
                  <div className="text-xs text-gray-500">FIP</div>
                </div>
              )}
            </>
          ) : (
            <>
              {stats.wRC_plus !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.wRC_plus || '-'}</div>
                  <div className="text-xs text-gray-500">wRC+</div>
                </div>
              )}
              {stats.OPS !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.OPS?.toFixed(3) || '-'}</div>
                  <div className="text-xs text-gray-500">OPS</div>
                </div>
              )}
              {stats.HR !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.HR || '-'}</div>
                  <div className="text-xs text-gray-500">HR</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Games played */}
        {stats.games && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <span className="text-sm text-gray-600">
              {stats.games}試合出場
              {stats.PA && ` • ${stats.PA}打席`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}