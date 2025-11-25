import { Suspense } from 'react';
import { FileText, Calendar, TrendingUp, Zap, Brain, Target } from 'lucide-react';
import Link from 'next/link';

// Force dynamic rendering for latest content
export const dynamic = 'force-dynamic';

async function fetchColumnData() {
  // Mock data for now - would be replaced with actual API/database call
  const mockColumns = [
    {
      id: 'brief-20241204',
      title: '【12/4 Brief】阪神・巨人戦前分析：戸郷vsオースティンの注目対決',
      excerpt: 'セ・リーグ首位争いの天王山。戸郷の対左打者成績と阪神打線の東京ドーム適応度を中心に、勝敗を左右するキーファクターを分析。',
      date: '2024-12-04',
      type: 'brief',
      category: '試合前分析',
      read_time: 3,
      featured: true,
      url: '/column/brief/2024-12-04'
    },
    {
      id: 'brief-20241203',
      title: '【12/3 Brief】パ・リーグ順位変動：ホークス連勝の影響分析',
      excerpt: 'ソフトバンクの5連勝がプレーオフ争いに与える影響を数値分析。残り試合での各チームの勝率予測と順位シミュレーション。',
      date: '2024-12-03',
      type: 'brief',
      category: '順位分析',
      read_time: 4,
      featured: false,
      url: '/column/brief/2024-12-03'
    },
    {
      id: 'analysis-pitching-evolution',
      title: '2024年NPB投手成績の進化：FIP-による客観評価',
      excerpt: 'Park Factor補正を適用したFIP-指標で見る今季投手陣の真の実力。従来指標では見えない各リーグの投手力格差を定量分析。',
      date: '2024-12-02',
      type: 'analysis',
      category: '投手分析',
      read_time: 8,
      featured: true,
      url: '/column/analysis/pitching-evolution-2024'
    },
    {
      id: 'weekly-wrap-48',
      title: '第48週ウィークリーラップ：クライマックス前の最終調整',
      excerpt: '各チームのコンディション指標と直近10試合の傾向分析。プレーオフに向けた戦力状況とローテーション調整の現状をレポート。',
      date: '2024-12-01',
      type: 'weekly',
      category: '週間総括',
      read_time: 6,
      featured: false,
      url: '/column/weekly/week-48-2024'
    },
    {
      id: 'brief-20241130',
      title: '【11/30 Brief】新人王争い最終局面：各候補者の成績比較',
      excerpt: '新人王レースの最有力候補3名をwRC+とERA-で客観比較。残り試合での成績推移がもたらす順位変動を予測分析。',
      date: '2024-11-30',
      type: 'brief',
      category: '個人成績',
      read_time: 5,
      featured: false,
      url: '/column/brief/2024-11-30'
    },
    {
      id: 'deep-dive-park-factors',
      title: '球場係数2024年版：12球場の特性と補正効果を徹底解析',
      excerpt: 'NPB12球場の2024年Park Factor算出結果と各指標への影響度分析。中立化指標導入による選手評価の変化を詳細レポート。',
      date: '2024-11-28',
      type: 'deep-dive',
      category: '球場分析',
      read_time: 12,
      featured: true,
      url: '/column/deep-dive/park-factors-2024'
    }
  ];

  return {
    columns: mockColumns,
    categories: [
      { name: '試合前分析', count: 45, color: 'blue' },
      { name: '順位分析', count: 28, color: 'green' },
      { name: '投手分析', count: 22, color: 'purple' },
      { name: '週間総括', count: 48, color: 'orange' },
      { name: '個人成績', count: 34, color: 'red' },
      { name: '球場分析', count: 12, color: 'indigo' }
    ],
    stats: {
      total_columns: 189,
      this_month: 24,
      avg_read_time: 5.2
    }
  };
}

function ColumnCard({ column }: { column: any }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'brief': return <Zap className="w-4 h-4" />;
      case 'analysis': return <TrendingUp className="w-4 h-4" />;
      case 'weekly': return <Calendar className="w-4 h-4" />;
      case 'deep-dive': return <Brain className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'brief': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'analysis': return 'text-green-600 bg-green-50 border-green-200';
      case 'weekly': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'deep-dive': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      '試合前分析': 'bg-blue-100 text-blue-800',
      '順位分析': 'bg-green-100 text-green-800',
      '投手分析': 'bg-purple-100 text-purple-800',
      '週間総括': 'bg-orange-100 text-orange-800',
      '個人成績': 'bg-red-100 text-red-800',
      '球場分析': 'bg-indigo-100 text-indigo-800'
    };
    return colors[category] || 'bg-slate-100 text-slate-800';
  };

  return (
    <Link href={column.url} className="block group">
      <article className={`
        bg-white border border-slate-200 rounded-lg p-6 transition-all duration-200
        group-hover:border-blue-300 group-hover:shadow-md
        ${column.featured ? 'border-blue-200 bg-blue-50/30' : ''}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(column.type)}`}>
              {getTypeIcon(column.type)}
              {column.type.toUpperCase()}
            </span>
            {column.featured && (
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                注目
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">
            {new Date(column.date).toLocaleDateString('ja-JP', { 
              month: 'short', 
              day: 'numeric' 
            })}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
          {column.title}
        </h3>

        {/* Excerpt */}
        <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3">
          {column.excerpt}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(column.category)}`}>
            {column.category}
          </span>
          <span className="text-xs text-slate-500">
            読了時間 {column.read_time}分
          </span>
        </div>
      </article>
    </Link>
  );
}

function CategoryFilter({ categories }: { categories: any[] }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-blue-600" />
        カテゴリー別記事数
      </h3>
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.name} className="flex items-center justify-between">
            <span className="text-sm text-slate-700">{cat.name}</span>
            <span className="bg-slate-100 text-slate-800 text-xs font-medium px-2 py-1 rounded-full">
              {cat.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsOverview({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
        <div className="text-3xl font-bold text-blue-600 mb-2">{stats.total_columns}</div>
        <div className="text-sm text-slate-600">総記事数</div>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
        <div className="text-3xl font-bold text-green-600 mb-2">{stats.this_month}</div>
        <div className="text-sm text-slate-600">今月の記事数</div>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
        <div className="text-3xl font-bold text-purple-600 mb-2">{stats.avg_read_time}分</div>
        <div className="text-sm text-slate-600">平均読了時間</div>
      </div>
    </div>
  );
}

export default async function ColumnsPage() {
  const data = await fetchColumnData();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              NPB AIコラム
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              データサイエンスとAI分析による深いインサイト。試合前後の分析から週間総括、
              長期トレンド分析まで、NPBを多角的に解説します。
            </p>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <span>試合前後の即時分析</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span>統計的トレンド解析</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span>AI駆動インサイト</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Stats Overview */}
        <StatsOverview stats={data.stats} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Featured Articles */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">注目記事</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {data.columns.filter(col => col.featured).map((column) => (
                  <ColumnCard key={column.id} column={column} />
                ))}
              </div>
            </div>

            {/* All Articles */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">最新記事</h2>
              <div className="space-y-6">
                {data.columns.map((column) => (
                  <ColumnCard key={column.id} column={column} />
                ))}
              </div>
            </div>

            {/* Load More */}
            <div className="text-center mt-8">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                さらに記事を読み込む
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <CategoryFilter categories={data.categories} />
            
            {/* About AI Columns */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-600" />
                AIコラムについて
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                当サイトのコラムは、NPB公式データとセイバーメトリクス理論に基づく客観的分析です。
                Park Factor補正・プラトーン効果・状況別成績など、多角的データを統合して洞察を提供します。
              </p>
              <Link
                href="/about/methodology" 
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                分析手法の詳細 →
              </Link>
            </div>

            {/* Related Links */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">関連ツール</h3>
              <div className="space-y-3">
                <Link
                  href="/teams/compare"
                  className="block text-sm text-slate-600 hover:text-blue-600 transition-colors"
                >
                  → チーム比較分析
                </Link>
                <Link
                  href="/players/compare"
                  className="block text-sm text-slate-600 hover:text-blue-600 transition-colors"
                >
                  → 選手比較分析  
                </Link>
                <Link
                  href="/matchups"
                  className="block text-sm text-slate-600 hover:text-blue-600 transition-colors"
                >
                  → 対戦分析
                </Link>
                <Link
                  href="/rankings"
                  className="block text-sm text-slate-600 hover:text-blue-600 transition-colors"
                >
                  → 選手ランキング
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}