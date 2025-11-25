import type { Metadata } from 'next'
import { Inter, Noto_Sans_JP } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import MobileNav from './components/MobileNav'
import ModernNavigation from '@/components/ModernNavigation'
import QualityBadge from '@/components/QualityBadge'
import { ToastProvider } from '@/components/Toast'
import { currentSeasonYear } from '@/lib/time'
import AnalyticsRouter from '@/components/AnalyticsRouter'
import { AffiliateFooter } from '@/components/AffiliateDisclosure'
import { AuthProvider } from '@/lib/auth'
import { LeaderboardBuilderProvider } from '@/lib/leaderboard-builder'

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
        <Script
          id="website-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Baseball AI Media",
            "url": "https://baseball-ai-media.vercel.app",
            "inLanguage": "ja",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://baseball-ai-media.vercel.app/search?q={search_term_string}",
              "query-input": "required name=search_term_string"
            }
          })}
        </Script>
        <Script
          id="organization-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Baseball AI Media",
            "url": "https://baseball-ai-media.vercel.app",
            "logo": "https://baseball-ai-media.vercel.app/icon.png"
          })}
        </Script>
        <AnalyticsRouter />
        <ToastProvider>
          <AuthProvider>
            <LeaderboardBuilderProvider>
              <div className="min-h-screen flex flex-col bg-slate-900">
          {/* Modern Navigation */}
          <ModernNavigation />

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Affiliate Disclosure */}
          <AffiliateFooter />

          {/* Modern Footer */}
          <footer className="border-t border-white/10 bg-gradient-to-t from-slate-900 to-slate-800">
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                <div className="md:col-span-1">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="text-2xl">⚾</div>
                    <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                      Baseball AI Media
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    NPBの高度な分析とAI予測を提供する次世代野球メディアプラットフォーム
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-4">分析機能</h3>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li className="hover:text-slate-300 transition-colors">WAR・wRC+・FIP分析</li>
                    <li className="hover:text-slate-300 transition-colors">球場補正・中立化指標</li>
                    <li className="hover:text-slate-300 transition-colors">プラトーン効果分析</li>
                    <li className="hover:text-slate-300 transition-colors">対戦相性・マッチアップ予測</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-4">対応リーグ</h3>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li className="hover:text-slate-300 transition-colors">🇯🇵 NPB (セ・パ両リーグ)</li>
                    <li className="hover:text-slate-300 transition-colors">🇺🇸 MLB (メジャーリーグ)</li>
                    <li className="hover:text-slate-300 transition-colors">🇰🇷 KBO (韓国プロ野球)</li>
                    <li className="hover:text-slate-300 transition-colors">🌐 国際比較分析</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-4">データソース</h3>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li className="hover:text-slate-300 transition-colors">NPB公式サイト（公開統計のみ）</li>
                    <li className="hover:text-slate-300 transition-colors">自前算出指標（wOBA, FIP等）</li>
                    <li className="hover:text-slate-300 transition-colors">透明性保証（式・係数を公開）</li>
                    <li className="text-xs text-slate-500">※第三者DB複製なし</li>
                  </ul>
                </div>
              </div>
              
              <div className="border-t border-white/10 pt-8">
                <div className="flex flex-col lg:flex-row justify-between items-center">
                  <div className="text-center lg:text-left mb-4 lg:mb-0">
                    <p className="text-sm text-slate-400">
                      © {currentSeasonYear()} Baseball AI Media. All rights reserved.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap justify-center gap-6 text-sm">
                    <a href="/privacy" className="text-slate-400 hover:text-white transition-colors">
                      プライバシーポリシー
                    </a>
                    <a href="/terms" className="text-slate-400 hover:text-white transition-colors">
                      利用規約
                    </a>
                    <a href="/about" className="text-slate-400 hover:text-white transition-colors">
                      About
                    </a>
                    <a href="/about/methodology" className="text-slate-400 hover:text-white transition-colors">
                      分析手法
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </footer>
              </div>
            </LeaderboardBuilderProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  )
}