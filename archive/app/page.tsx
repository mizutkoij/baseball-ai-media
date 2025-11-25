import Link from "next/link";
import { Calendar, Trophy, TrendingUp, BarChart3, Users, Globe } from "lucide-react";
import TodaysGames from "../components/TodaysGames";
import LeagueSelector from "../components/LeagueSelector";
import { Suspense } from "react";

// Force dynamic rendering to prevent build-time API calls
export const dynamic = 'force-dynamic';

export default function HomePage({ searchParams }: { searchParams: { filter?: string; league?: string } }) {
  const isNPB2Mode = searchParams?.filter === 'NPB2';
  const currentLeague = (searchParams?.league || 'npb') as 'npb' | 'mlb' | 'kbo' | 'international';
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-8">
          <LeagueSelector currentLeague={currentLeague} showDescription={false} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6">
        
        {/* 今日の試合 - 最上部 */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              📅 今日の試合
            </h2>
            <p className="text-xl text-slate-400">
              NPB公式データで最新の試合状況をお届け
            </p>
          </div>
          <Suspense fallback={
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white/10 rounded"></div>
                ))}
              </div>
            </div>
          }>
            <TodaysGames />
          </Suspense>
        </div>


        {/* 試合日程ボタン */}
        <div className="mb-12 text-center">
          <Link
            href="/games"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            <Calendar className="w-6 h-6" />
            試合日程を見る
          </Link>
        </div>

        {/* 順位表 */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">順位表</h2>
            </div>
            <div className="text-center">
              <Link
                href="/standings"
                className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded-lg transition-colors"
              >
                セ・リーグ / パ・リーグ順位を見る
              </Link>
            </div>
          </div>
        </div>

        {/* 打撃ランキング */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h2 className="text-2xl font-bold text-white">打撃ランキング TOP5</h2>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* セントラル・リーグ */}
              <div>
                <h3 className="text-xl font-semibold text-orange-400 mb-4 text-center">セントラル・リーグ</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* 打率 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">打率</h4>
                    <div className="space-y-2">
                      {[
                        { name: "岡本 和真", team: "巨人", stat: ".315" },
                        { name: "佐野 恵太", team: "DeNA", stat: ".308" },
                        { name: "村上 宗隆", team: "ヤクルト", stat: ".305" },
                        { name: "大山 悠輔", team: "阪神", stat: ".298" },
                        { name: "森下 翔太", team: "広島", stat: ".295" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-green-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ホームラン */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">HR</h4>
                    <div className="space-y-2">
                      {[
                        { name: "村上 宗隆", team: "ヤクルト", stat: "32" },
                        { name: "岡本 和真", team: "巨人", stat: "28" },
                        { name: "大山 悠輔", team: "阪神", stat: "24" },
                        { name: "佐野 恵太", team: "DeNA", stat: "18" },
                        { name: "鈴木 誠也", team: "広島", stat: "16" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-orange-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 打点 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">打点</h4>
                    <div className="space-y-2">
                      {[
                        { name: "村上 宗隆", team: "ヤクルト", stat: "88" },
                        { name: "岡本 和真", team: "巨人", stat: "84" },
                        { name: "大山 悠輔", team: "阪神", stat: "76" },
                        { name: "佐野 恵太", team: "DeNA", stat: "72" },
                        { name: "鈴木 誠也", team: "広島", stat: "68" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-blue-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OPS */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">OPS</h4>
                    <div className="space-y-2">
                      {[
                        { name: "村上 宗隆", team: "ヤクルト", stat: "1.024" },
                        { name: "岡本 和真", team: "巨人", stat: ".998" },
                        { name: "大山 悠輔", team: "阪神", stat: ".952" },
                        { name: "佐野 恵太", team: "DeNA", stat: ".928" },
                        { name: "鈴木 誠也", team: "広島", stat: ".915" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-purple-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* パシフィック・リーグ */}
              <div>
                <h3 className="text-xl font-semibold text-blue-400 mb-4 text-center">パシフィック・リーグ</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* 打率 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">打率</h4>
                    <div className="space-y-2">
                      {[
                        { name: "柳田 悠岐", team: "ソフトバンク", stat: ".318" },
                        { name: "山川 穂高", team: "西武", stat: ".302" },
                        { name: "近藤 健介", team: "日本ハム", stat: ".298" },
                        { name: "吉田 正尚", team: "オリックス", stat: ".295" },
                        { name: "浅村 栄斗", team: "楽天", stat: ".292" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-green-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ホームラン */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">HR</h4>
                    <div className="space-y-2">
                      {[
                        { name: "柳田 悠岐", team: "ソフトバンク", stat: "29" },
                        { name: "山川 穂高", team: "西武", stat: "26" },
                        { name: "浅村 栄斗", team: "楽天", stat: "22" },
                        { name: "杉本 裕太郎", team: "オリックス", stat: "20" },
                        { name: "万波 中正", team: "日本ハム", stat: "18" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-orange-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 打点 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">打点</h4>
                    <div className="space-y-2">
                      {[
                        { name: "柳田 悠岐", team: "ソフトバンク", stat: "85" },
                        { name: "山川 穂高", team: "西武", stat: "78" },
                        { name: "浅村 栄斗", team: "楽天", stat: "74" },
                        { name: "近藤 健介", team: "日本ハム", stat: "69" },
                        { name: "杉本 裕太郎", team: "オリックス", stat: "65" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-blue-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OPS */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">OPS</h4>
                    <div className="space-y-2">
                      {[
                        { name: "柳田 悠岐", team: "ソフトバンク", stat: "1.038" },
                        { name: "山川 穂高", team: "西武", stat: ".975" },
                        { name: "浅村 栄斗", team: "楽天", stat: ".948" },
                        { name: "近藤 健介", team: "日本ハム", stat: ".925" },
                        { name: "杉本 裕太郎", team: "オリックス", stat: ".912" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-purple-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <Link
                href="/rankings"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
              >
                全打撃ランキングを見る
              </Link>
            </div>
          </div>
        </div>

        {/* 投手指標 */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-red-500" />
              <h2 className="text-2xl font-bold text-white">投手指標 TOP5</h2>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* セントラル・リーグ */}
              <div>
                <h3 className="text-xl font-semibold text-orange-400 mb-4 text-center">セントラル・リーグ</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* 防御率 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">防御率</h4>
                    <div className="space-y-2">
                      {[
                        { name: "今永 昇太", team: "DeNA", stat: "2.16" },
                        { name: "戸郷 翔征", team: "巨人", stat: "2.32" },
                        { name: "高橋 宏斗", team: "中日", stat: "2.45" },
                        { name: "大瀬良 大地", team: "広島", stat: "2.58" },
                        { name: "青木 宣親", team: "ヤクルト", stat: "2.71" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-red-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 勝利数 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">勝利</h4>
                    <div className="space-y-2">
                      {[
                        { name: "今永 昇太", team: "DeNA", stat: "13" },
                        { name: "戸郷 翔征", team: "巨人", stat: "12" },
                        { name: "高橋 宏斗", team: "中日", stat: "10" },
                        { name: "大瀬良 大地", team: "広島", stat: "9" },
                        { name: "村田 透", team: "阪神", stat: "8" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-yellow-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* セーブ数 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">セーブ</h4>
                    <div className="space-y-2">
                      {[
                        { name: "栗林 良吏", team: "広島", stat: "32" },
                        { name: "湯浅 京己", team: "阪神", stat: "28" },
                        { name: "伊勢 大夢", team: "DeNA", stat: "24" },
                        { name: "大城 滉二", team: "巨人", stat: "21" },
                        { name: "奥川 恭伸", team: "ヤクルト", stat: "18" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-cyan-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 奪三振 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">奪三振</h4>
                    <div className="space-y-2">
                      {[
                        { name: "今永 昇太", team: "DeNA", stat: "142" },
                        { name: "戸郷 翔征", team: "巨人", stat: "135" },
                        { name: "高橋 宏斗", team: "中日", stat: "126" },
                        { name: "大瀬良 大地", team: "広島", stat: "118" },
                        { name: "村田 透", team: "阪神", stat: "108" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-indigo-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* パシフィック・リーグ */}
              <div>
                <h3 className="text-xl font-semibold text-blue-400 mb-4 text-center">パシフィック・リーグ</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* 防御率 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">防御率</h4>
                    <div className="space-y-2">
                      {[
                        { name: "山本 由伸", team: "オリックス", stat: "1.89" },
                        { name: "佐々木朗希", team: "ロッテ", stat: "2.05" },
                        { name: "東浜 巨", team: "ソフトバンク", stat: "2.28" },
                        { name: "宮西 尚生", team: "日本ハム", stat: "2.41" },
                        { name: "岸 孝之", team: "楽天", stat: "2.55" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-red-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 勝利数 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">勝利</h4>
                    <div className="space-y-2">
                      {[
                        { name: "山本 由伸", team: "オリックス", stat: "15" },
                        { name: "佐々木朗希", team: "ロッテ", stat: "12" },
                        { name: "東浜 巨", team: "ソフトバンク", stat: "11" },
                        { name: "岸 孝之", team: "楽天", stat: "10" },
                        { name: "宮西 尚生", team: "日本ハム", stat: "9" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-yellow-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* セーブ数 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">セーブ</h4>
                    <div className="space-y-2">
                      {[
                        { name: "森 唯斗", team: "ソフトバンク", stat: "29" },
                        { name: "松井 裕樹", team: "楽天", stat: "26" },
                        { name: "平野 佳寿", team: "オリックス", stat: "23" },
                        { name: "益田 直也", team: "ロッテ", stat: "20" },
                        { name: "宮西 尚生", team: "日本ハム", stat: "17" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-cyan-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 奪三振 */}
                  <div className="text-center">
                    <h4 className="text-md font-semibold text-white mb-3">奪三振</h4>
                    <div className="space-y-2">
                      {[
                        { name: "佐々木朗希", team: "ロッテ", stat: "168" },
                        { name: "山本 由伸", team: "オリックス", stat: "152" },
                        { name: "東浜 巨", team: "ソフトバンク", stat: "134" },
                        { name: "岸 孝之", team: "楽天", stat: "121" },
                        { name: "宮西 尚生", team: "日本ハム", stat: "115" }
                      ].map((player, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{i + 1}. {player.name.split(' ')[1]}</span>
                          <span className="text-indigo-400 font-bold">{player.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <Link
                href="/rankings?category=pitching"
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors"
              >
                全投手ランキングを見る
              </Link>
            </div>
          </div>
        </div>

        {/* 最新コラム */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-pink-500" />
              <h2 className="text-2xl font-bold text-white">最新コラム</h2>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/column/opsplus-vs-wrcplus" className="group">
                <div className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 mb-2">
                    OPS+とwRC+の違いを解説
                  </h3>
                  <p className="text-slate-400 text-sm">
                    現代野球で重要な指標の違いと使い分けについて詳しく解説します。
                  </p>
                  <div className="text-xs text-slate-500 mt-3">2025年8月19日</div>
                </div>
              </Link>

              <Link href="/column/re24-winning-lines" className="group">
                <div className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 mb-2">
                    RE24で見る勝利への貢献度
                  </h3>
                  <p className="text-slate-400 text-sm">
                    得点期待値の変化量で測る選手の真の価値を分析します。
                  </p>
                  <div className="text-xs text-slate-500 mt-3">2025年8月18日</div>
                </div>
              </Link>

              <Link href="/column/sabermetrics-basics" className="group">
                <div className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 mb-2">
                    セイバーメトリクス入門
                  </h3>
                  <p className="text-slate-400 text-sm">
                    データ野球の基礎知識から応用まで、初心者にも分かりやすく解説。
                  </p>
                  <div className="text-xs text-slate-500 mt-3">2025年8月17日</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* データ収集状況（簡素化） */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-indigo-500" />
              <h2 className="text-2xl font-bold text-white">データ収集システム</h2>
            </div>
            <div className="text-center py-8">
              <div className="text-green-400 text-lg font-medium mb-2">
                ✅ 24時間連続データ収集中
              </div>
              <div className="text-slate-400 text-sm">
                NPB公式サイトとYahoo野球から最新データを自動収集
              </div>
            </div>
          </div>
        </div>

        {/* 他リーグへのボタン */}
        <div className="mb-12">
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-white">他リーグの情報</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Link
                href="/?league=mlb"
                className="group p-6 bg-gradient-to-br from-red-600/20 to-blue-600/20 border border-red-500/30 rounded-xl hover:border-red-500/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🇺🇸</div>
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-red-400 mb-2">
                      MLB (メジャーリーグ)
                    </h3>
                    <p className="text-slate-400 text-sm">
                      アメリカンリーグ・ナショナルリーグの最新情報と統計
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/?league=kbo"
                className="group p-6 bg-gradient-to-br from-blue-600/20 to-red-600/20 border border-blue-500/30 rounded-xl hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🇰🇷</div>
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 mb-2">
                      KBO (韓国プロ野球)
                    </h3>
                    <p className="text-slate-400 text-sm">
                      韓国プロ野球リーグの詳細データと分析情報
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}