"use client";

import { Share2, Copy } from 'lucide-react';
import { track } from '@/lib/analytics';

interface ShareButtonProps {
  url: string;
  text: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function ShareButton({ url, text, size = 'sm', className = '' }: ShareButtonProps) {
  const share = async () => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    
    try {
      if (navigator.share) {
        await navigator.share({ 
          title: text, 
          url: fullUrl, 
          text: `${text} - Baseball AI Media` 
        });
        track('share_native', { url: fullUrl, text });
      } else {
        await navigator.clipboard.writeText(fullUrl);
        // Simple feedback - could be replaced with toast
        const button = document.activeElement as HTMLButtonElement;
        if (button) {
          const originalText = button.textContent;
          button.textContent = 'コピー済み!';
          setTimeout(() => {
            button.textContent = originalText;
          }, 2000);
        }
        track('share_copy', { url: fullUrl, text });
      }
    } catch (err) {
      console.warn('Share failed:', err);
      
      // Fallback: try clipboard
      try {
        await navigator.clipboard.writeText(fullUrl);
        track('share_copy_fallback', { url: fullUrl, text });
      } catch (clipboardErr) {
        console.error('Clipboard also failed:', clipboardErr);
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
      共有
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