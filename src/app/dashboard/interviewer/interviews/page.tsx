import { getCandidates, getInterviews, getScheduledInterviews } from "@/app/actions/interviews";
import { InterviewerScheduleClient } from "@/components/dashboard/interviewer-schedule-client";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function InterviewerInterviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Double check authorization
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "interviewer" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const [interviews, candidates, scheduledInterviews] = await Promise.all([
    getInterviews(),
    getCandidates(),
    getScheduledInterviews()
  ]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <InterviewerScheduleClient 
        initialInterviews={interviews} 
        candidates={candidates} 
        initialScheduled={scheduledInterviews}
      />
    </div>
  );
}