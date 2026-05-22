import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { InterviewClient } from "@/components/interview/interview-client";
import { CountdownLatch } from "@/components/interview/countdown-latch";

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

  // If user is candidate, enforce scheduled timing constraints
  if (!isInterviewer) {
    const sessionStatus = interview.session_status;
    const now = new Date();
    const scheduledAt = new Date(interview.scheduled_at);
    
    // Calculate difference
    const diffMs = now.getTime() - scheduledAt.getTime();
    
    // 1. Check if forcefully terminated
    if (sessionStatus === "terminated") {
      return (
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-white p-4">
          <div className="max-w-md w-full p-8 rounded-2xl bg-red-950/20 border border-red-900/30 text-center backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Session Terminated</h2>
            <p className="text-zinc-300">This interview session has been terminated by the proctor/administrator.</p>
          </div>
        </div>
      );
    }

    // 2. Check if already completed or submitted -> enters in readonly review mode
    if (sessionStatus === "submitted" || sessionStatus === "completed" || interview.status === "completed") {
      return (
        <main className="flex h-screen flex-col bg-zinc-950 text-white font-sans overflow-hidden">
          <InterviewClient roomId={roomId} username={username} isInterviewer={isInterviewer} isReadOnlyReview={true} />
        </main>
      );
    }

    // 3. Early join check (now < scheduled_at)
    if (now.getTime() < scheduledAt.getTime()) {
      return (
        <main className="flex h-screen items-center justify-center bg-zinc-950 text-white p-4">
          <CountdownLatch scheduledAt={interview.scheduled_at} title={interview.title} />
        </main>
      );
    }

    // 4. Late join expired check (now > scheduled_at + 15 mins AND never started)
    const fifteenMinutes = 15 * 60 * 1000;
    if (diffMs > fifteenMinutes && !interview.actual_started_at) {
      // Mark as expired in DB
      await supabase
        .from("interviews")
        .update({ session_status: "expired" })
        .eq("id", roomId);

      // Log telemetry infraction
      await supabase
        .from("interview_telemetry")
        .insert([
          {
            interview_id: roomId,
            event_type: "warning_issued",
            details: {
              timestamp: now.toISOString(),
              type: "late_expired",
              message: "Candidate missed the 15-minute join window."
            }
          }
        ]);

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

    // 5. Valid join window (scheduled_at <= now <= scheduled_at + 15 mins OR active reconnection)
    // If not started yet, initialize the session
    if (!interview.actual_started_at) {
      const nowStr = now.toISOString();
      const isLate = now.getTime() > scheduledAt.getTime();
      const newStatus = isLate ? "late_joined" : "active";

      await supabase
        .from("interviews")
        .update({
          actual_started_at: nowStr,
          candidate_joined_at: nowStr,
          session_status: newStatus,
          join_deadline_at: new Date(scheduledAt.getTime() + fifteenMinutes).toISOString()
        })
        .eq("id", roomId);

      await supabase
        .from("interview_telemetry")
        .insert([
          {
            interview_id: roomId,
            event_type: "session_initialized",
            details: {
              timestamp: nowStr,
              status: newStatus,
              joined_at: nowStr
            }
          }
        ]);
    }
  }

  return (
    <main className="flex h-screen flex-col bg-zinc-950 text-white font-sans overflow-hidden">
      <InterviewClient roomId={roomId} username={username} isInterviewer={isInterviewer} />
    </main>
  );
}
