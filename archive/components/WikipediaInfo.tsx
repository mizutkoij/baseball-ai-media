"use client";

import { useState, useEffect } from "react";
import { ExternalLink, BookOpen, Calendar, Star, Search, ChevronDown, ChevronUp } from "lucide-react";

interface WikipediaData {
  found: boolean;
  data?: {
    title: string;
    extract: string;
    description?: string;
    url: string;
    thumbnail?: string;
    birth_date?: string | null;
    career_highlights?: string[];
    search_results?: Array<{
      title: string;
      description: string;
      url: string;
    }>;
  };
  searchUrl?: string;
  message?: string;
}

interface WikipediaInfoProps {
  playerName: string;
  playerId?: string;
  nameKana?: string;
  className?: string;
}

export default function WikipediaInfo({ playerName, playerId, nameKana, className = "" }: WikipediaInfoProps) {
  const [wikiData, setWikiData] = useState<WikipediaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWikipediaInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let response;
        let data;
        
        // キャッシュAPIを優先的に使用
        if (playerId) {
          try {
            response = await fetch(`/api/wikipedia-cache/${playerId}`);
            if (response.ok) {
              data = await response.json();
              setWikiData(data);
              setIsLoading(false);
              return;
            }
          } catch (cacheError) {
            console.log('Cache API failed, falling back to direct API');
          }
        }
        
        // フォールバック：直接API
        response = await fetch(`/api/wikipedia/${encodeURIComponent(playerName)}`);
        data = await response.json();
        
        if (response.ok) {
          setWikiData(data);
        } else {
          setError(data.message || 'Wikipedia情報の取得に失敗しました');
        }
      } catch (err) {
        console.error('Wikipedia fetch error:', err);
        setError('Wikipedia情報の取得中にエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    if (playerName) {
      fetchWikipediaInfo();
    }
  }, [playerName]);

  if (isLoading) {
    return (
      <div className={`bg-gradient-to-r from-amber-900/20 to-orange-900/20 backdrop-blur-md border border-amber-500/20 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-amber-400 animate-pulse" />
          <h3 className="font-semibold text-amber-300">Wikipedia情報</h3>
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-amber-400/20 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-amber-400/20 rounded animate-pulse w-1/2"></div>
          <div className="h-4 bg-amber-400/20 rounded animate-pulse w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error || !wikiData) {
    return (
      <div className={`bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-md border border-slate-600/20 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-300">Wikipedia検索</h3>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          {error || 'Wikipedia情報を取得できませんでした'}
        </p>
        <a
          href={`https://ja.wikipedia.org/wiki/Special:Search/${encodeURIComponent(playerName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 underline"
        >
          <ExternalLink className="w-4 h-4" />
          Wikipediaで検索する
        </a>
      </div>
    );
  }

  if (!wikiData.found) {
    return (
      <div className={`bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-md border border-slate-600/20 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-300">Wikipedia検索</h3>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          {wikiData.message || '該当するWikipediaページが見つかりませんでした'}
        </p>
        <a
          href={wikiData.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 underline"
        >
          <ExternalLink className="w-4 h-4" />
          Wikipediaで検索する
        </a>
      </div>
    );
  }

  const { data } = wikiData;
  if (!data) return null;

  return (
    <div className={`bg-gradient-to-r from-amber-900/20 to-orange-900/20 backdrop-blur-md border border-amber-500/20 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-amber-300">Wikipedia情報</h3>
          <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
            外部情報
          </span>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-amber-400 hover:text-amber-300 transition-colors"
          title={isExpanded ? "折りたたむ" : "展開する"}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 基本情報 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          {data.thumbnail && (
            <img
              src={data.thumbnail}
              alt={data.title}
              className="w-16 h-16 rounded-lg object-cover border border-amber-500/30"
            />
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-white text-sm mb-1">{data.title}</h4>
            {data.description && (
              <p className="text-xs text-amber-200/80 mb-2">{data.description}</p>
            )}
            
            {/* 基本データ */}
            <div className="flex flex-wrap gap-3 text-xs">
              {data.birth_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-200">{data.birth_date}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 概要 */}
        <div className="text-sm text-slate-200 leading-relaxed">
          <p className={`${!isExpanded ? 'max-h-10 overflow-hidden' : ''}`}>
            {data.extract || 'Wikipedia情報を取得しました。'}
          </p>
        </div>

        {/* 展開時の詳細情報 */}
        {isExpanded && (
          <div className="space-y-3 pt-3 border-t border-amber-500/20">
            {/* 経歴ハイライト */}
            {data.career_highlights && data.career_highlights.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <h5 className="font-medium text-amber-300 text-sm">野球経歴</h5>
                </div>
                <ul className="space-y-1">
                  {data.career_highlights.map((highlight, index) => (
                    <li key={index} className="text-xs text-slate-200 pl-2 border-l border-amber-500/30">
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 関連検索結果 */}
            {data.search_results && data.search_results.length > 0 && (
              <div>
                <h5 className="font-medium text-amber-300 text-sm mb-2">関連ページ</h5>
                <div className="space-y-1">
                  {data.search_results.map((result, index) => (
                    <a
                      key={index}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      {result.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wikipedia リンク */}
        <div className="pt-2 border-t border-amber-500/20">
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Wikipediaで全文を読む
          </a>
        </div>
      </div>
    </div>
  );
}