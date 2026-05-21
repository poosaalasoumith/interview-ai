import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { InterviewClient } from "@/components/interview/interview-client";

export default async function InterviewRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Fetch the user's role to determine if they are the interviewer
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const isInterviewer = profile?.role === "interviewer" || profile?.role === "admin";

  // Fallback to email if full_name is missing
  const username = user.user_metadata?.full_name || user.email?.split('@')[0] || "Guest";

  return (
    <main className="flex h-screen flex-col bg-zinc-950 text-white font-sans overflow-hidden">
      <InterviewClient roomId={roomId} username={username} isInterviewer={isInterviewer} />
    </main>
  );
}
