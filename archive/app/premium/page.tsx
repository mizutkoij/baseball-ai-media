'use client';

import PremiumFeatures from '@/components/PremiumFeatures';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            ホームに戻る
          </Link>
        </div>

        <PremiumFeatures showUpgrade={true} size="full" />
      </div>
    </div>
  );
}