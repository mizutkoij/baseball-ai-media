import { Metadata } from 'next';
import VotingInterface from './VotingInterface';

export const metadata: Metadata = {
  title: '推し選手投票 | Baseball AI Media',
  description: 'お気に入りのNPB選手に投票しよう！1日1回、あなたの推し選手をサポート。リアルタイム投票ランキングで盛り上がりをチェック。',
  keywords: ['NPB', '投票', '推し選手', 'プロ野球', 'ランキング', 'ファン投票'],
  openGraph: {
    title: '推し選手投票 - お気に入りのNPB選手をサポート',
    description: '1日1回、あなたの推し選手に投票しよう！リアルタイムランキングで全国のファンと盛り上がろう。',
    type: 'website',
    images: [
      {
        url: '/og-vote.jpg',
        width: 1200,
        height: 630,
        alt: '推し選手投票 - Baseball AI Media'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: '推し選手投票 | Baseball AI Media',
    description: '1日1回、あなたの推し選手に投票しよう！',
    images: ['/og-vote.jpg']
  }
};

// NPB選手データ（サンプル - 実際はDBから取得）
const FEATURED_PLAYERS = [
  // セ・リーグ
  { player_id: 'munetaka_murakami', name: '村上宗隆', team: 'S', position: '内野手', teamName: 'ヤクルト' },
  { player_id: 'tetsuto_yamada', name: '山田哲人', team: 'S', position: '内野手', teamName: 'ヤクルト' },
  { player_id: 'seiya_suzuki', name: '鈴木誠也', team: 'C', position: '外野手', teamName: '広島' },
  { player_id: 'kensuke_kondo', name: '近藤健介', team: 'C', position: '外野手', teamName: '広島' },
  { player_id: 'masataka_yoshida', name: '吉田正尚', team: 'B', position: '外野手', teamName: 'オリックス' },
  { player_id: 'yutaro_sugimoto', name: '杉本裕太郎', team: 'B', position: '外野手', teamName: 'オリックス' },
  { player_id: 'kazuma_okamoto', name: '岡本和真', team: 'G', position: '内野手', teamName: '巨人' },
  { player_id: 'hayato_sakamoto', name: '坂本勇人', team: 'G', position: '内野手', teamName: '巨人' },
  { player_id: 'kenta_maeda', name: '前田健太', team: 'T', position: '投手', teamName: '阪神' },
  { player_id: 'teruaki_sato', name: '佐藤輝明', team: 'T', position: '内野手', teamName: '阪神' },
  { player_id: 'dayan_viciedo', name: 'ビシエド', team: 'D', position: '内野手', teamName: '中日' },
  { player_id: 'yota_kyoda', name: '京田陽太', team: 'D', position: '内野手', teamName: '中日' },

  // パ・リーグ  
  { player_id: 'yuki_yanagita', name: '柳田悠岐', team: 'H', position: '外野手', teamName: 'ソフトバンク' },
  { player_id: 'akira_nakamura', name: '中村晃', team: 'H', position: '外野手', teamName: 'ソフトバンク' },
  { player_id: 'hotaka_yamakawa', name: '山川穂高', team: 'L', position: '内野手', teamName: '西武' },
  { player_id: 'sosuke_genda', name: '源田壮亮', team: 'L', position: '内野手', teamName: '西武' },
  { player_id: 'shohei_ohtani', name: '大谷翔平', team: 'F', position: '投手/DH', teamName: '日本ハム' },
  { player_id: 'kotaro_kiyomiya', name: '清宮幸太郎', team: 'F', position: '内野手', teamName: '日本ハム' },
  { player_id: 'takahiro_laird', name: 'レアード', team: 'M', position: '内野手', teamName: 'ロッテ' },
  { player_id: 'shogo_nakamura', name: '中村奨吾', team: 'M', position: '捕手', teamName: 'ロッテ' },
  { player_id: 'yuma_mune', name: '宗佑磨', team: 'E', position: '外野手', teamName: '楽天' },
  { player_id: 'hideto_asamura', name: '浅村栄斗', team: 'E', position: '内野手', teamName: '楽天' }
];

const TEAM_COLORS = {
  'G': 'bg-orange-500',
  'T': 'bg-yellow-500', 
  'C': 'bg-red-500',
  'S': 'bg-green-500',
  'D': 'bg-blue-500',
  'B': 'bg-blue-600',
  'H': 'bg-yellow-600',
  'L': 'bg-blue-400',
  'M': 'bg-black',
  'F': 'bg-blue-800',
  'E': 'bg-red-700'
};

export default function FavoriteVotePage() {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            ⚾ 推し選手投票
          </h1>
          <p className="text-lg text-gray-300 mb-2">
            {today} - あなたの推し選手に投票しよう！
          </p>
          <p className="text-sm text-gray-400">
            1日1回投票可能 • リアルタイムでランキング更新
          </p>
        </div>

        {/* 投票インターフェース */}
        <VotingInterface 
          players={FEATURED_PLAYERS}
          teamColors={TEAM_COLORS}
        />

        {/* 投票ルール */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">📋 投票ルール</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>• <strong>1日1回投票</strong>：同じIPアドレスから1日1回まで投票可能</li>
              <li>• <strong>リアルタイム反映</strong>：投票結果は即座にランキングに反映</li>
              <li>• <strong>プライバシー保護</strong>：IPアドレスはハッシュ化して保存</li>
              <li>• <strong>公平性</strong>：不正な投票を防ぐため各種対策を実施</li>
              <li>• <strong>期間</strong>：毎日0時にリセット、翌日から新しい投票</li>
            </ul>
          </div>
        </div>

        {/* シェアボタン */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm mb-4">投票後はSNSでシェアしよう！</p>
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => {
                const text = `私の推し選手に投票しました！⚾ みんなも参加しよう！ #推し選手投票 #NPB`;
                const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
                window.open(url, '_blank');
              }}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors text-sm"
            >
              🐦 Twitterでシェア
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}