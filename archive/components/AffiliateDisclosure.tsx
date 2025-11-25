/**
 * 景表法対応 - アフィリエイト広告表示コンポーネント
 * ステマ規制（2023年10月施行）に準拠した表示
 */

import { affiliateManager } from '@/lib/affiliates';
import { AlertCircle, ExternalLink } from 'lucide-react';

interface AffiliateDisclosureProps {
  type?: 'full' | 'short' | 'footer';
  className?: string;
}

export default function AffiliateDisclosure({ type = 'short', className = '' }: AffiliateDisclosureProps) {
  if (type === 'full') {
    return (
      <div className={`border border-blue-200 bg-blue-50 p-4 rounded-lg ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <h3 className="font-medium text-blue-900 mb-2">【広告・PR】</h3>
            <p className="text-blue-800 leading-relaxed">
              {affiliateManager.getDisclosureText(false)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'footer') {
    return (
      <div className={`bg-gray-100 border-t border-gray-200 p-4 ${className}`}>
        <div className="max-w-5xl mx-auto">
          <h3 className="font-medium text-gray-900 text-sm mb-2">広告について</h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            {affiliateManager.getDisclosureText(false)}
          </p>
          <div className="mt-3 text-xs text-gray-600">
            <p>本サイトは景品表示法に基づき、広告であることを明示しています。</p>
            <p>参考: <a 
              href="https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
            >
              消費者庁ステマ規制について <ExternalLink className="w-3 h-3" />
            </a></p>
          </div>
        </div>
      </div>
    );
  }

  // type === 'short' (default)
  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      <span className="inline-flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {affiliateManager.getDisclosureText(true)}
      </span>
    </div>
  );
}

// 便利なプリセットコンポーネント

export function AffiliatePageBanner() {
  return (
    <AffiliateDisclosure 
      type="full" 
      className="mb-6" 
    />
  );
}

export function AffiliateFooter() {
  return (
    <AffiliateDisclosure 
      type="footer" 
      className="mt-12" 
    />
  );
}

export function AffiliateBadge({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs ${className}`}>
      <AlertCircle className="w-3 h-3" />
      PR
    </span>
  );
}