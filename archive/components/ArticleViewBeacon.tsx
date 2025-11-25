"use client";
import { useEffect } from "react";
import { trackArticleView } from "@/lib/analytics";

declare global {
  interface Window {
    __articleViewSent?: Record<string, boolean>;
  }
}

interface ArticleViewBeaconProps {
  slug: string;
}

export default function ArticleViewBeacon({ slug }: ArticleViewBeaconProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // 一度きりガード
    window.__articleViewSent ??= {};
    if (window.__articleViewSent[slug]) return;
    
    window.__articleViewSent[slug] = true;
    trackArticleView(slug);
    
    // デバッグログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('📖 Article View Tracked:', slug);
    }
  }, [slug]);
  
  return null;
}