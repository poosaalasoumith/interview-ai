import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Retrieve the user profile from the database public.users table (source of truth)
          const { data: profile } = await supabase
            .from('users')
            .select('role, name')
            .eq('id', user.id)
            .single()

          const dbRole = profile?.role || 'candidate'

          // Synchronize the user_metadata role with the public users table role if missing/mismatched
          if (user.user_metadata?.role !== dbRole) {
            console.log(`[Auth Callback] Syncing auth metadata role to matching database role: "${user.user_metadata?.role || 'none'}" -> "${dbRole}"`);
            await supabase.auth.updateUser({
              data: {
                role: dbRole,
                full_name: user.user_metadata?.full_name || profile?.name || user.email?.split('@')[0],
              }
            });
          }
        }
      } catch (syncError) {
        console.error("[Auth Callback] Failed to synchronize role metadata:", syncError);
      }

      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
