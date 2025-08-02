/**
 * 絶対URL生成ユーティリティ
 * OG画像やcanonical URLで使用
 */

export function absUrl(path: string): string {
  const base = 
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    'http://localhost:3000';
    
  return path.startsWith('http') ? path : `${base}${path}`;
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    'http://localhost:3000';
}