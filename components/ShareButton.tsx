"use client";

import { useState } from 'react';
import { Share2, Copy, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { track } from '@/lib/analytics';

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
  enableShortUrl?: boolean;
  onToast?: (message: string, type?: "success" | "error" | "info") => void;
}

// 短縮URL生成（モック実装）
async function generateShortUrl(longUrl: string): Promise<string> {
  try {
    // 実際の短縮URL APIは将来実装予定
    // const response = await fetch('/api/shorten', { 
    //   method: 'POST', 
    //   body: JSON.stringify({ url: longUrl })
    // });
    
    // モック：ドメインを短縮表現に
    const domain = 'npb.ai';
    const path = longUrl.replace(window.location.origin, '');
    const hash = btoa(path).slice(0, 8);
    return `https://${domain}/${hash}`;
  } catch (error) {
    console.warn('Short URL generation failed:', error);
    return longUrl;
  }
}

export function ShareButton({ 
  url, 
  title, 
  text, 
  size = 'sm', 
  className = '', 
  enableShortUrl = true,
  onToast 
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isGeneratingShortUrl, setIsGeneratingShortUrl] = useState(false);

  const share = async () => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const shareTitle = title || text || 'Baseball AI Media';
    
    try {
      // 短縮URL生成 (オプション)
      let shareUrl = fullUrl;
      if (enableShortUrl) {
        setIsGeneratingShortUrl(true);
        shareUrl = await generateShortUrl(fullUrl);
        setIsGeneratingShortUrl(false);
      }
      
      // Try native Web Share API first
      if (navigator.share) {
        const shareData = {
          title: shareTitle,
          text: text || shareTitle,
          url: shareUrl,
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          track('share_native', { url: shareUrl, title: shareTitle, shortened: enableShortUrl });
          onToast?.(`${shareTitle}を共有しました`, "success");
          return;
        }
      }
      
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      track('share_copy', { url: shareUrl, title: shareTitle, shortened: enableShortUrl });
      
      // Toast通知
      onToast?.(
        enableShortUrl ? "短縮URLをコピーしました！" : "URLをコピーしました！", 
        "success"
      );
      
    } catch (err) {
      console.warn('Share failed:', err);
      setIsGeneratingShortUrl(false);
      
      // Ultimate fallback: manual selection
      try {
        const textArea = document.createElement('textarea');
        textArea.value = fullUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        track('share_fallback', { url: fullUrl, title: shareTitle });
        onToast?.("URLをコピーしました", "success");
      } catch (clipboardErr) {
        console.error('All share methods failed:', clipboardErr);
        onToast?.("共有に失敗しました", "error");
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
      title={enableShortUrl ? "短縮URL共有・コピー" : "共有・URLコピー"}
      disabled={isGeneratingShortUrl}
    >
      {isGeneratingShortUrl ? (
        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {enableShortUrl ? <LinkIcon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} /> : <Share2 className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
        </>
      )}
      {copied ? 'コピー済み!' : isGeneratingShortUrl ? '生成中...' : (enableShortUrl ? '短縮共有' : '共有')}
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