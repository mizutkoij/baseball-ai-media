"use client";

import { useState } from 'react';
import { Share2, Copy } from 'lucide-react';
import { track } from '@/lib/analytics';

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function ShareButton({ url, title, text, size = 'sm', className = '' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const shareTitle = title || text || 'Baseball AI Media';
    
    try {
      // Try native Web Share API first
      if (navigator.share) {
        const shareData = {
          title: shareTitle,
          text: text || shareTitle,
          url: fullUrl,
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          track('share_native', { url: fullUrl, title: shareTitle });
          return;
        }
      }
      
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('share_copy', { url: fullUrl, title: shareTitle });
    } catch (err) {
      console.warn('Share failed:', err);
      
      // Ultimate fallback: manual selection
      try {
        const textArea = document.createElement('textarea');
        textArea.value = fullUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        track('share_fallback', { url: fullUrl, title: shareTitle });
      } catch (clipboardErr) {
        console.error('All share methods failed:', clipboardErr);
      }
    }
  };

  const buttonClasses = [
    'inline-flex items-center gap-1 transition-colors',
    size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-2',
    'bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md',
    className
  ].join(' ');

  return (
    <button
      onClick={share}
      className={buttonClasses}
      title="共有・URLコピー"
    >
      <Share2 className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {copied ? 'コピー済み!' : '共有'}
    </button>
  );
}

export function QuickShareButton({ url, text }: { url: string; text: string }) {
  const share = async () => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    
    try {
      await navigator.clipboard.writeText(fullUrl);
      track('quick_share', { url: fullUrl, text });
    } catch (err) {
      console.error('Quick share failed:', err);
    }
  };

  return (
    <button
      onClick={share}
      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      title="URLをコピー"
    >
      <Copy className="w-3 h-3" />
    </button>
  );
}

export default ShareButton;