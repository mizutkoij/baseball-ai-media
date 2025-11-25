import Link from "next/link";
import { TrendingUp, Target, BarChart3, Zap, Sprout, Globe, Users, Calendar, Trophy, Activity, Database } from "lucide-react";
import TodaysGames from "../components/TodaysGames";
import ProspectWatch from "../components/ProspectWatch";
import LeagueSelector from "../components/LeagueSelector";
import ModernHero from "@/components/ModernHero";
import FeatureCard from "@/components/FeatureCard";
import StatsDashboard from "@/components/StatsDashboard";
import { Suspense } from "react";

// Force dynamic rendering to prevent build-time API calls
export const dynamic = 'force-dynamic';

export default function HomePage({ searchParams }: { searchParams: { filter?: string; league?: string } }) {
  const isNPB2Mode = searchParams?.filter === 'NPB2';
  const currentLeague = (searchParams?.league || 'npb') as 'npb' | 'mlb' | 'kbo' | 'international';
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* League Selector */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-8">
          <LeagueSelector currentLeague={currentLeague} showDescription={true} />
        </div>
      </div>

      {/* Modern Hero Section */}
      <ModernHero currentLeague={currentLeague} isNPB2Mode={isNPB2Mode} />

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Stats Dashboard */}
        <div className="mb-16">
          <StatsDashboard league={currentLeague} />
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              機能・分析ツール
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              高度な野球分析とAI予測で、あなたの野球観戦をより深く
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={BarChart3}
              title="リアルタイム順位表"
              description="セ・リーグ、パ・リーグの最新順位と勝敗記録を瞬時に更新"
              href={`/standings?league=${currentLeague}`}
              color="blue"
              stats={{
                label: "更新頻度",
                value: "5分毎"
              }}
              badge="ライブ"
            />

            <FeatureCard
              icon={Target}
              title="試合情報"
              description="スクレイピングデータによる正確な試合結果・スケジュール"
              href={`/games?league=${currentLeague}`}
              color="purple"
              stats={{
                label: "対応試合",
                value: "1,200+"
              }}
            />

            <FeatureCard
              icon={TrendingUp}
              title="ランキング"
              description="wRC+・ERA-等主要指標のTOP20プレイヤー"
              href={`/rankings?league=${currentLeague}`}
              color="green"
              stats={{
                label: "追跡指標",
                value: "25+"
              }}
            />

            <FeatureCard
              icon={Zap}
              title="チーム比較"
              description="チーム間の詳細データ比較分析とマッチアップ予測"
              href="/teams/compare"
              color="yellow"
              stats={{
                label: "分析項目",
                value: "40+"
              }}
            />

            <FeatureCard
              icon={Users}
              title="選手比較"
              description="選手同士の成績・能力値の詳細比較"
              href="/players/compare"
              color="red"
              stats={{
                label: "選手データ",
                value: "850+"
              }}
            />

            <FeatureCard
              icon={Database}
              title="対戦分析"
              description="チーム間H2H成績・直近10試合の詳細分析"
              href="/matchups"
              color="cyan"
              stats={{
                label: "分析精度",
                value: "89%"
              }}
              badge="AI"
            />

            {currentLeague === 'npb' && (
              <FeatureCard
                icon={Sprout}
                title="NPB2 ファーム"
                description="ファームリーグ試合・有望株監視（Prospect Watch）"
                href="/?filter=NPB2"
                color="orange"
                stats={{
                  label: "有望株",
                  value: "120+"
                }}
                badge="注目"
              />
            )}

            <FeatureCard
              icon={Activity}
              title="高度分析"
              description="セイバーメトリクス・WAR・FIP等の詳細指標"
              href="/analytics"
              color="purple"
              stats={{
                label: "分析モデル",
                value: "12"
              }}
              badge="PRO"
            />

            <FeatureCard
              icon={Globe}
              title="国際比較"
              description="NPB・MLB・KBO横断での選手・チーム比較"
              href="/?league=international"
              color="blue"
              stats={{
                label: "対応リーグ",
                value: "3"
              }}
            />
          </div>
        </div>

        {/* Today's Games Section */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              今日の試合
            </h2>
            <p className="text-xl text-slate-400">
              リアルタイム更新で最新の試合状況をお届け
            </p>
          </div>
          <TodaysGames />
        </div>

        {/* NPB2 Mode: Add Prospect Watch */}
        {isNPB2Mode && (
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                有望株ウォッチ
              </h2>
              <p className="text-xl text-slate-400">
                注目のファーム選手をAIが分析
              </p>
            </div>
            <Suspense fallback={
              <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-8 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-32 bg-white/10 rounded-lg"></div>
                  ))}
                </div>
              </div>
            }>
              <ProspectWatch farmLeague="ALL" limit={8} />
            </Suspense>
          </div>
        )}

        {/* Status Footer */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-green-400" />
            <span className="text-lg font-semibold text-white">
              {isNPB2Mode ? 'NPB2ファームデータ収集中' : 'NPBスクレイピングデータで動作中'}
            </span>
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="text-slate-300 font-medium">データ更新</div>
              <div className="text-slate-400">
                {new Date().toLocaleDateString('ja-JP', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-slate-300 font-medium">更新頻度</div>
              <div className="text-slate-400">
                {isNPB2Mode ? '5分間隔自動更新' : 'リアルタイム自動更新'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-slate-300 font-medium">システム状態</div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-green-400">稼働中</span>
              </div>
            </div>
          </div>

          {isNPB2Mode && (
            <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <div className="text-orange-400 font-medium">
                🌱 NPB2ファームモード • サーバー: 100.88.12.26:3000 • 品質監視: 稼働中
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}