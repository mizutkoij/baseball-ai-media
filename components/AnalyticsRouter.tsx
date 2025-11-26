"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function AnalyticsRouter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!GA_ID || typeof window === "undefined" || typeof window.gtag !== "function") return;
    
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    window.gtag("event", "page_view", { page_path: url });
    
    // デバッグログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 GA4 Page View:', url);
    }
  }, [pathname, searchParams]);

  return null;
}