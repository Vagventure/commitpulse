import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from './lib/rate-limit';
import { getClientIp } from './utils/getClientIp';

/**
 * Middleware to enforce rate limiting on specific API routes.
 */
export async function middleware(request: NextRequest) {
  // 1. Prioritize x-real-ip to prevent spoofing
  // 2. Fallback to getClientIp which securely parses x-forwarded-for hops
  // 3. Fallback to localhost
  const ip = request.headers.get('x-real-ip') ?? getClientIp(request) ?? '127.0.0.1';

  const isRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  if (isRefresh) {
    const refreshResult = await rateLimit(`refresh:${ip}`, 5, 60000);

    if (!refreshResult.success) {
      const resp = NextResponse.json(
        { error: 'Too many refresh requests. Please wait before bypassing the cache again.' },
        { status: 429 }
      );
      resp.headers.set('X-RateLimit-Limit', refreshResult.limit.toString());
      resp.headers.set('X-RateLimit-Remaining', '0');
      resp.headers.set('X-RateLimit-Reset', refreshResult.reset.toString());
      resp.headers.set('X-RateLimit-Policy', 'refresh');
      return resp;
    }
  }

  const result = await rateLimit(ip, 60, 60000);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());

  return response;
}

export const config = {
  matcher: [
    '/api/streak/:path*',
    '/api/github/:path*',
    '/api/track-user/:path*',
    '/api/stats/:path*',
    '/api/og/:path*',
    '/api/notify/:path*',
    '/api/compare/:path*',
    '/api/wrapped/:path*',
    '/api/student/:path*',
  ],
};