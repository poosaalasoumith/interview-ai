import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function InterviewerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the public user data to ensure sync
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const formattedUser = {
    id: user.id,
    email: user.email,
    name: profile?.name || user.user_metadata?.full_name || "",
    avatar: profile?.avatar || user.user_metadata?.avatar_url || "",
    role: profile?.role || "interviewer"
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
          Interviewer Profile
        </h1>
        <p className="text-muted-foreground mt-1">
          Customize your workspace identity, display name, and profile presence for candidate assessments.
        </p>
      </div>

      <ProfileForm user={formattedUser} />
    </div>
  );
}