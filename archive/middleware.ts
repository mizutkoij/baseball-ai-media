/**
 * Next.js Middleware for Performance Monitoring and Optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/performance/performance-monitor';

export function middleware(request: NextRequest) {
  const startTime = Date.now();
  const { pathname, method } = request.nextUrl;

  // Only track API routes and critical pages
  const shouldTrack = pathname.startsWith('/api/') || 
                     pathname === '/' || 
                     pathname.startsWith('/games') ||
                     pathname.startsWith('/players') ||
                     pathname.startsWith('/teams');

  if (!shouldTrack) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Add performance headers
  response.headers.set('X-Request-Start', startTime.toString());
  
  // Add cache headers for static content
  if (pathname.includes('/api/')) {
    // API responses - enable stale-while-revalidate
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  } else {
    // Static pages - longer cache
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  }

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Performance monitoring for completed requests
  // Note: Edge Runtime doesn't support Node.js APIs, so we skip performance monitoring in middleware
  // Performance tracking will be handled in individual API routes instead

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};