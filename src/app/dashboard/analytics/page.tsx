import { AIAnalytics } from "@/components/dashboard/ai-analytics";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Routes } from "@/lib/routes";

export default async function AnalyticsPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const c = await cookieStore;
          return c.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(Routes.login);
  }

  // Fetch feedback/analytics data
  const { data: feedbackData } = await supabase
    .from("feedback")
    .select("technical_score, communication_score, overall_score, created_at")
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: true });

  const { data: analyticsData } = await supabase
    .from("analytics")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">AI Analytics Dashboard</h1>
        <p className="text-zinc-400">Track your interview performance and skill progression.</p>
      </div>

      <AIAnalytics feedback={feedbackData || []} stats={analyticsData} />
    </div>
  );
}
