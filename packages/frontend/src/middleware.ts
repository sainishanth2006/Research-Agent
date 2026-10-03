import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Add any custom middleware logic here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to auth pages without token
        const path = req.nextUrl.pathname;
        if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/api/auth') || path.startsWith('/api/backend')) {
          return true;
        }
        // Require token for all other paths
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication endpoints)
     * - api/backend (backend proxy)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login, register pages
     */
    '/((?!api/auth|api/backend|_next/static|_next/image|favicon.ico|login|register).*)',
  ],
};