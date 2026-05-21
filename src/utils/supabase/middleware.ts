import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  
  const currentPath = request.nextUrl.pathname
  const isAuthRoute = currentPath.startsWith('/login') || currentPath.startsWith('/signup')
  
  const redirect = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  // Protect all routes except auth routes, public assets, and home page
  if (!user && !isAuthRoute && currentPath !== '/' && !currentPath.startsWith('/api') && !currentPath.startsWith('/auth')) {
    return redirect('/login')
  }

  // Redirect authenticated users away from auth pages to their dashboard
  if (user && isAuthRoute) {
    return redirect('/dashboard')
  }

  // Dashboard role routing logic
  if (user && currentPath === '/dashboard') {
    // We get role from user metadata
    const role = user.user_metadata?.role || 'candidate'
    return redirect(`/${role}`)
  }

  return supabaseResponse
}
