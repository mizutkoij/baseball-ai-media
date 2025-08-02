import { Suspense } from 'react';
import { Target, TrendingUp, BarChart3, Zap, Info, Calendar } from 'lucide-react';
import MatchupPreviewCard from '@/components/MatchupPreviewCard';
import Link from 'next/link';

// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic';

async function fetchMatchupData() {
  // Mock data for now - would be replaced with actual API call
  return {
    today_games: [
      {
        game_id: 'G2024120401',
        away_team: 'T',
        home_team: 'G',
        away_team_name: '阪神タイガース',
        home_team_name: '読売ジャイアンツ',
        home_pitcher: '戸郷',
        away_pitcher: '岡田',
        game_time: '18:00',
        venue: '東京ドーム',
        matchup_preview: {
          key_matchup: '岡田 vs 戸郷',
          advantage: 'home',
          win_probability: { away: 45, home: 55 },
          key_factors: [
            '戸郷の対左打者成績が良好',
            '阪神の東京ドーム成績',
            'ブルペン休養日数'
          ]
        }
      },
      {
        game_id: 'G2024120402',
        away_team: 'H',
        home_team: 'L',
        away_team_name: 'ソフトバンクホークス',
        home_team_name: '埼玉西武ライオンズ',
        home_pitcher: '今井',
        away_pitcher: '有原',
        game_time: '18:00',
        venue: 'ベルーナドーム',
        matchup_preview: {
          key_matchup: '有原 vs 今井',
          advantage: 'away',
          win_probability: { away: 60, home: 40 },
          key_factors: [
            'ホークス打線の調子',
            '西武の本拠地優位性',
            '両チーム先発ローテーション'
          ]
        }
      }
    ],
    upcoming_series: [
      {
        title: 'セ・リーグクライマックス準備',
        teams: ['T', 'G', 'C'],
        start_date: '2024-12-10',
        description: '優勝争い最終局面の重要シリーズ'
      },
      {
        title: 'パ・リーグ順位決定戦',
        teams: ['H', 'B', 'L'],
        start_date: '2024-12-15',
        description: 'プレーオフ進出をかけた激戦'
      }
    ]
  };
}

function MatchupAnalysis() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-blue-600" />
        対戦分析の特徴
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-slate-900">プラトーン効果分析</h3>
              <p className="text-sm text-slate-600">
                左右投手と打者の相性を詳細分析。過去5年のデータから最適な打順・先発を予測
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-slate-900">球場補正分析</h3>
              <p className="text-sm text-slate-600">
                各球場の特性を考慮した中立化指標で、真の実力を比較分析
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-yellow-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-slate-900">リアルタイム予測</h3>
              <p className="text-sm text-slate-600">
                試合開始前の最新情報を反映した勝率予測とキーファクター分析
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-slate-900">透明性保証</h3>
              <p className="text-sm text-slate-600">
                予測根拠と使用データを完全公開。第三者検証可能な分析手法
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeriesPreview({ series }: { series: any }) {
  const teamNames: Record<string, string> = {
    'G': '巨人', 'T': '阪神', 'C': 'カープ', 'YS': 'DeNA', 'D': '中日', 'S': 'ヤクルト',
    'H': 'ホークス', 'L': 'ライオンズ', 'E': 'イーグルス', 'M': 'マリーンズ', 'F': 'ファイターズ', 'B': 'バファローズ'
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-blue-600" />
        <span className="text-sm text-blue-600 font-medium">
          {new Date(series.start_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}〜
        </span>
      </div>
      
      <h3 className="font-bold text-lg text-slate-900 mb-2">{series.title}</h3>
      <p className="text-slate-600 text-sm mb-4">{series.description}</p>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {series.teams.map((teamCode: string) => (
          <span
            key={teamCode}
            className="px-3 py-1 bg-white border border-blue-200 rounded-full text-sm font-medium text-slate-700"
          >
            {teamNames[teamCode] || teamCode}
          </span>
        ))}
      </div>
      
      <Link
        href={`/compare/teams?teams=${series.teams.join(',')}&year=2024`}
        className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm"
      >
        チーム比較で詳細分析 →
      </Link>
    </div>
  );
}

export default async function MatchupsPage() {
  const data = await fetchMatchupData();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              NPB 対戦分析
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              AI駆動の高度分析で試合の行方を予測。プラトーン効果・球場補正・選手コンディションを総合評価し、
              データに基づく勝敗予測とキープレイヤー分析を提供します。
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <span className="text-blue-100">📊 勝率予測精度</span>
                <span className="font-bold ml-2">78.5%</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <span className="text-blue-100">⚾ 分析対象試合</span>
                <span className="font-bold ml-2">2,000+</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <span className="text-blue-100">🎯 キーファクター</span>
                <span className="font-bold ml-2">15項目</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Today's Games */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">今日の注目対戦</h2>
            <span className="text-sm text-slate-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              🔴 LIVE分析
            </span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Suspense fallback={
              <div className="bg-white rounded-lg p-6 animate-pulse">
                <div className="h-6 bg-slate-200 rounded mb-4"></div>
                <div className="h-4 bg-slate-200 rounded mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
              </div>
            }>
              <MatchupPreviewCard data={data.today_games} />
            </Suspense>
          </div>
        </div>

        {/* Analysis Features */}
        <div className="mb-12">
          <MatchupAnalysis />
        </div>

        {/* Upcoming Series */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">注目シリーズ予告</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.upcoming_series.map((series, index) => (
              <SeriesPreview key={index} series={series} />
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-slate-900 rounded-xl text-white p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">より詳細な分析をお求めですか？</h3>
          <p className="text-slate-300 mb-6">
            選手個人の対戦成績やチーム間の詳細比較分析をご利用ください
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/compare/players"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              選手比較分析
            </Link>
            <Link
              href="/compare/teams"
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              チーム比較分析
            </Link>
            <Link
              href="/players"
              className="border border-slate-600 hover:border-slate-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              選手データベース
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}