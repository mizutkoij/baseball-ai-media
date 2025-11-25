import type { Metadata } from 'next'
import { Inter, Noto_Sans_JP } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import MobileNav from './components/MobileNav'
import QualityBadge from '@/components/QualityBadge'
import { ToastProvider } from '@/components/Toast'
import { currentSeasonYear } from '@/lib/time'
// import AnalyticsRouter from '@/components/AnalyticsRouter'

const inter = Inter({ subsets: ['latin'] })
const notoSansJP = Noto_Sans_JP({ 
  subsets: ['latin'],
  variable: '--font-noto-sans-jp'
})

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

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
    <html lang="ja">
      <head>
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { send_page_view: true });
              `}
            </Script>
          </>
        )}
        {PLAUSIBLE_DOMAIN && (
          <Script
            src="https://plausible.io/js/script.js"
            data-domain={PLAUSIBLE_DOMAIN}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`${inter.className} ${notoSansJP.variable} min-h-screen bg-white text-slate-900 antialiased`}>
        <JsonLd
          type="WebSite"
          data={{
            "@context":"https://schema.org",
            "@type":"WebSite",
            "name":"Baseball AI Media",
            "url":"https://baseball-ai-media.vercel.app",
            "inLanguage":"ja",
            "potentialAction":{
              "@type":"SearchAction",
              "target":"https://baseball-ai-media.vercel.app/search?q={search_term_string}",
              "query-input":"required name=search_term_string"
            }
          }}
        />
        <JsonLd
          type="Organization"
          data={{
            "@context":"https://schema.org",
            "@type":"Organization",
            "name":"Baseball AI Media",
            "url":"https://baseball-ai-media.vercel.app",
            "logo":"https://baseball-ai-media.vercel.app/icon.png"
          }}
        />
        {/* <AnalyticsRouter /> */}
        <ToastProvider>
          <div className="min-h-screen flex flex-col">
          {/* Navigation Header */}
          <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-14 sm:h-16">
                <div className="flex items-center space-x-4 sm:space-x-8">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                    ⚾ Baseball AI Media
                  </h1>
                  <div className="hidden lg:flex space-x-4 xl:space-x-6">
                    <a href="/" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      ホーム
                    </a>
                    <a href="/players" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      選手データベース
                    </a>
                    <a href="/players/2025" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      2025年選手一覧
                    </a>
                    <a href="/teams" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      チーム
                    </a>
                    <a href="/games" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      試合情報
                    </a>
                    <a href="/standings" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      順位表
                    </a>
                    <a href="/rankings" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      ランキング
                    </a>
                    <a href="/records" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      記録
                    </a>
                    <a href="/matchups" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      対戦分析
                    </a>
                    <a href="/analytics" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      📊 高度分析
                    </a>
                    <a href="/column" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      コラム
                    </a>
                    <a href="/about" className="text-xs xl:text-sm text-slate-600 hover:text-blue-600 transition-colors">
                      About
                    </a>
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  {/* Quality Badge - P1 Monitoring */}
                  <div className="hidden sm:block">
                    <QualityBadge />
                  </div>
                  <div className="hidden md:flex items-center space-x-2 sm:space-x-4">
                    <span className="text-xs text-slate-600">
                      リアルタイム分析
                    </span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <MobileNav />
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
                  <h3 className="font-semibold mb-4">独自データ</h3>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li>NPB公式サイト（公開統計のみ）</li>
                    <li>自前算出指標（wOBA, FIP等）</li>
                    <li>透明性保証（式・係数を公開）</li>
                    <li className="text-xs">※第三者DB複製なし</li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-white/10 mt-8 pt-8 text-center">
                <p className="text-xs text-slate-500">
                  © {currentSeasonYear()} Baseball AI Media. All rights reserved.
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
                  <a href="/privacy" className="hover:text-white transition-colors">プライバシーポリシー</a>
                  <span className="text-slate-600">|</span>
                  <a href="/terms" className="hover:text-white transition-colors">利用規約</a>
                  <span className="text-slate-600">|</span>
                  <a href="/about" className="hover:text-white transition-colors">About</a>
                  <span className="text-slate-600">|</span>
                  <a href="/about/methodology" className="hover:text-white transition-colors">分析手法</a>
                </div>
              </div>
            </div>
          </footer>
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}