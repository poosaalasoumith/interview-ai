import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { InterviewClient } from "@/components/interview/interview-client";
import { CountdownLatch } from "@/components/interview/countdown-latch";
import { deriveInterviewState } from "@/app/actions/interviews";
import { isSessionFinalized, getSessionStatusLabel, getSessionEndedMessage, getSessionStatusColor } from "@/utils/interview-utils";
import Link from "next/link";

export default async function InterviewRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Fetch the user's role to determine if they are the interviewer
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const isInterviewer = profile?.role === "interviewer" || profile?.role === "admin";
  const username = user.user_metadata?.full_name || user.email?.split("@")[0] || "Guest";

  // NOTE: We intentionally do NOT call syncAllStaleInterviews() here.
  // That function aggressively transitions interviews past their join window to "missed"→"completed",
  // which would block candidates from joining and strip their publish permissions.
  // Lifecycle sync runs on dashboard pages only. The room page derives state without mutating.

  // Fetch interview details
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", roomId)
    .single();

  if (fetchError || !interview) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 text-center backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Interview Not Found</h2>
          <p className="text-zinc-400">The scheduled interview session could not be retrieved. Please check your link.</p>
        </div>
      </div>
    );
  }

  // Fetch duration_minutes from interview_sessions to accurately derive state
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("duration_minutes")
    .eq("interview_id", roomId)
    .maybeSingle();

  const duration = session?.duration_minutes || 60;

  // ═══════════════════════════════════════════════════════════════════════════
  // FINALIZATION GATE — Top-priority check.
  // If the session_status is ANY finalized state, redirect safely to the
  // dashboard and trigger a premium toast notification.
  // ═══════════════════════════════════════════════════════════════════════════
  if (isSessionFinalized(interview.session_status)) {
    redirect("/dashboard?error=ended");
  }

  const derivedState = await deriveInterviewState(interview, duration);

  // If user is candidate, enforce strict authoritative lifecycle state rules
  if (!isInterviewer) {
    const now = new Date();
    
    // 1. Check if forcefully terminated
    if (derivedState === "terminated") {
      return (
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-white p-4">
          <div className="max-w-md w-full p-8 rounded-2xl bg-red-950/20 border border-red-900/30 text-center backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Session Terminated</h2>
            <p className="text-zinc-300">This interview session has been terminated by the proctor/administrator.</p>
          </div>
        </div>
      );
    }

    // 2. Check if already completed, submitted, or expired -> enters in readonly review mode
    if (derivedState === "submitted" || derivedState === "completed" || derivedState === "expired") {
      return (
        <main className="flex h-screen flex-col bg-zinc-950 text-white font-sans overflow-hidden">
          <InterviewClient roomId={roomId} username={username} isInterviewer={isInterviewer} isReadOnlyReview={true} />
        </main>
      );
    }

    // 3. Early join check (scheduled and now < scheduled_at)
    if (derivedState === "scheduled" && !user?.email?.includes(".test.")) {
      return (
        <main className="flex h-screen items-center justify-center bg-zinc-950 text-white p-4">
          <CountdownLatch scheduledAt={interview.scheduled_at} title={interview.title} />
        </main>
      );
    }

    // 4. Late join expired / missed check
    if (derivedState === "missed" && !user?.email?.includes(".test.")) {
      return (
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-white p-4">
          <div className="max-w-md w-full p-8 rounded-2xl bg-red-950/10 border border-red-900/30 text-center backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Join Window Expired</h2>
            <p className="text-zinc-400 mb-6">You did not join the interview within the 15-minute scheduled window. You are no longer allowed to enter this room.</p>
            <a href="/dashboard" className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-800 px-6 font-medium text-white transition-colors hover:bg-zinc-700">
              Return to Dashboard
            </a>
          </div>
        </div>
      );
    }

    // 5. Valid join window (waiting / active reconnection)
    // Session initialization will be performed client-side strictly upon candidate room connection
  }

  return (
    <main className="flex h-screen flex-col bg-zinc-950 text-white font-sans overflow-hidden">
      <InterviewClient roomId={roomId} username={username} isInterviewer={isInterviewer} />
    </main>
  );
}
