'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  console.log("[Auth Action] Starting login process...");
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    console.log("[Auth Action] Login failed: Missing credentials");
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("[Auth Action] Supabase login error:", error.message);
    return { error: error.message }
  }

  console.log("[Auth Action] Login successful for user:", data.user?.id);
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signup(formData: FormData) {
  console.log("[Auth Action] Starting signup process...");
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const role = formData.get('role') as string || 'candidate'

  console.log(`[Auth Action] Received signup request. Name: "${name}", Email: "${email}", Role: "${role}"`);

  if (!email || !password || !name) {
    console.log("[Auth Action] Signup failed: Missing fields");
    return { error: 'All fields are required' }
  }

  const supabase = await createClient()

  console.log("[Auth Action] Registering user in Supabase Auth with metadata:", {
    full_name: name,
    role: role,
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: role,
      },
    },
  })

  if (error) {
    console.error("[Auth Action] Supabase signup error:", error.message);
    return { error: error.message }
  }

  console.log("[Auth Action] Supabase signUp returned user successfully. ID:", data.user?.id);
  console.log("[Auth Action] Persisted raw user metadata in auth.users:", JSON.stringify(data.user?.user_metadata, null, 2));

  // Optional: you can redirect to a verification page or directly to dashboard if auto-confirm is enabled
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signInWithGoogle() {
  console.log("[Auth Action] Starting Google OAuth...");
  const supabase = await createClient()
  
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    console.error("[Auth Action] Google Auth Error:", error)
    return redirect('/login?error=Google auth failed')
  }

  if (data.url) {
    console.log("[Auth Action] Google Auth redirect URL generated:", data.url);
    redirect(data.url)
  }
}

export async function signOut() {
  console.log("[Auth Action] Starting signOut...");
  const supabase = await createClient()
  await supabase.auth.signOut()
  console.log("[Auth Action] SignOut complete. Redirecting to /login...");
  redirect('/login')
}

export async function updateProfile(payload: { name: string; avatar?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized." };
  }

  // 1. Update Auth user metadata
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      full_name: payload.name,
      avatar_url: payload.avatar || user.user_metadata?.avatar_url
    }
  });

  if (authError) {
    console.error("[Auth Action] Error updating auth metadata:", authError.message);
    return { error: authError.message };
  }

  // 2. Update Public users table
  const { error: dbError } = await supabase
    .from("users")
    .update({
      name: payload.name,
      avatar: payload.avatar || null
    })
    .eq("id", user.id);

  if (dbError) {
    console.error("[Auth Action] Error updating public user table:", dbError.message);
    return { error: dbError.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
