"use client";

import { useState } from 'react';
import { track } from '@/lib/analytics';

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  className?: string;
}

export default function ShareButton({ url, title, text, className = "" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title,
      text: text || title,
      url,
    };

    // Try native Web Share API first
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        track('share_native', { url, title });
        return;
      } catch (err) {
        // User cancelled or error - fall back to copy
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('share_copy', { url, title });
    } catch (err) {
      console.error('Failed to copy:', err);
      // Ultimate fallback: manual selection
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('share_fallback', { url, title });
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors ${className}`}
      title="この比較を共有"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
      </svg>
      {copied ? 'コピー済み!' : '共有'}
    </button>
  );
}