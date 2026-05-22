import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Retrieve role from the public users table (source of truth)
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || user.user_metadata?.role || "candidate";

  // Redirect to the appropriate dashboard based on role
  if (role === "interviewer") {
    redirect("/dashboard/interviewer");
  } else if (role === "admin") {
    redirect("/dashboard/admin");
  } else {
    redirect("/dashboard/candidate");
  }
}
