import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('proxypress_session');
  const onboarded = request.cookies.get('proxypress_onboarded');
  const { pathname } = request.nextUrl;

  // Paths that are accessible without authentication
  const publicPaths = ['/login', '/favicon.ico', '/logo.png', '/manifest.json'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path)) || 
                       pathname.startsWith('/_next') || 
                       pathname.startsWith('/api') ||
                       pathname.startsWith('/uploads');

  // No session → redirect to login (except public paths)
  if (!session && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Has session but not onboarded → redirect to /onboarding
  if (session && onboarded?.value === '0' && pathname !== '/onboarding' && !isPublicPath && !pathname.startsWith('/uploads')) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Has session, is onboarded, trying to access /login → redirect home
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Has session, is onboarded, trying to access /onboarding → redirect home
  if (session && onboarded?.value === '1' && pathname === '/onboarding') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
