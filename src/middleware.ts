import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create a new ratelimiter, that allows 10 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
});

export default async function middleware(request: NextRequest) {
  console.log(`[Middleware] Executing for path: ${request.nextUrl.pathname}`);
  const supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            console.log(`[Middleware] Setting cookie: ${name}`);
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log(`[Middleware] User found: ${!!user}${user ? ` (ID: ${user.id})` : ''}`);

  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isProtectedPath = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/interview');
  const isAuthRoute = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup';

  // Rate limiting for API routes using Upstash Redis
  if (isApiRoute && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || '127.0.0.1';
    const { success, pending, limit, reset, remaining } = await ratelimit.limit(
      `ratelimit_${ip}`
    );
    
    if (!success) {
      console.log(`[Middleware] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'X-RateLimit-Limit': limit.toString(), 'X-RateLimit-Remaining': remaining.toString() } }
      );
    }
  }

  // Redirect unauthenticated users to login
  if (isProtectedPath && !user) {
    console.log(`[Middleware] Unauthorized access to ${request.nextUrl.pathname}. Redirecting to /login`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Enforce Role-Based Access Control (RBAC) on dashboard routes
  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const role = user.user_metadata?.role || 'candidate';
    const path = request.nextUrl.pathname;

    const isAdminRoute = path.startsWith('/dashboard/admin');
    const isInterviewerRoute = path.startsWith('/dashboard/interviewer');
    const isCandidateRoute = path.startsWith('/dashboard/candidate');

    if (isAdminRoute && role !== 'admin') {
      console.log(`[Middleware] Blocked unauthorized access to admin route: ${path}. Redirecting to /dashboard/${role}`);
      return NextResponse.redirect(new URL(`/dashboard/${role}`, request.url));
    }
    if (isInterviewerRoute && role !== 'interviewer') {
      console.log(`[Middleware] Blocked unauthorized access to interviewer route: ${path}. Redirecting to /dashboard/${role}`);
      return NextResponse.redirect(new URL(`/dashboard/${role}`, request.url));
    }
    if (isCandidateRoute && role !== 'candidate') {
      console.log(`[Middleware] Blocked unauthorized access to candidate route: ${path}. Redirecting to /dashboard/${role}`);
      return NextResponse.redirect(new URL(`/dashboard/${role}`, request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && user) {
    console.log(`[Middleware] Authenticated user on auth route ${request.nextUrl.pathname}. Redirecting to /dashboard`);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
