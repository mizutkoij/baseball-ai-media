import type { Metadata } from 'next'
import { Inter, Noto_Sans_JP } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const notoSansJP = Noto_Sans_JP({ 
  subsets: ['latin'],
  variable: '--font-noto-sans-jp'
})

export const metadata: Metadata = {
  title: 'Baseball AI Media - NPB Analytics & Predictions',
  description: '日本プロ野球の高度な分析とAI予測を提供するメディアサイト',
  keywords: 'NPB, 野球, 分析, WAR, セイバーメトリクス, AI, 予測',
  authors: [{ name: 'Baseball AI Media Team' }],
  openGraph: {
    title: 'Baseball AI Media',
    description: 'NPB Analytics & AI Predictions',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Baseball AI Media',
    description: 'NPB Analytics & AI Predictions',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="dark">
      <body className={`${inter.className} ${notoSansJP.variable} min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white antialiased`}>
        <div className="min-h-screen flex flex-col">
          {/* Navigation Header */}
          <header className="sticky top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-md">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-8">
                  <h1 className="text-xl font-bold text-gradient">
                    ⚾ Baseball AI Media
                  </h1>
                  <div className="hidden md:flex space-x-6">
                    <a href="/" className="text-sm hover:text-blue-400 transition-colors">
                      ホーム
                    </a>
                    <a href="/rankings" className="text-sm hover:text-blue-400 transition-colors">
                      ランキング
                    </a>
                    <a href="/matchups" className="text-sm hover:text-blue-400 transition-colors">
                      対戦分析
                    </a>
                    <a href="/columns" className="text-sm hover:text-blue-400 transition-colors">
                      AIコラム
                    </a>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-slate-400">
                    リアルタイム分析
                  </span>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            </nav>
          </header>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-white/10 bg-black/20 backdrop-blur-md mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="font-semibold mb-4">Baseball AI Media</h3>
                  <p className="text-sm text-slate-400">
                    NPBの高度な分析とAI予測を提供するメディアサイト
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-4">分析機能</h3>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li>WAR・wRC+・FIP分析</li>
                    <li>球場補正・中立化指標</li>
                    <li>プラトーン効果分析</li>
                    <li>対戦相性・マッチアップ予測</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-4">データソース</h3>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li>NPB公式データ</li>
                    <li>Yahoo Sports詳細統計</li>
                    <li>1point02.jp球詳データ</li>
                    <li className="text-xs">※合法収集・出典明記</li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-white/10 mt-8 pt-8 text-center">
                <p className="text-xs text-slate-500">
                  © 2024 Baseball AI Media. All rights reserved. | 
                  <a href="/privacy" className="hover:text-white ml-1">プライバシーポリシー</a> | 
                  <a href="/dmca" className="hover:text-white ml-1">DMCA</a>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}