import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Code, Star, Clock, Play, Sparkles } from "lucide-react";
import { CandidateChart } from "@/components/dashboard/candidate-chart";
import { CandidateScheduleClient } from "@/components/dashboard/candidate-schedule-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SafeLink } from "@/components/ui/safe-link";
import { Routes } from "@/lib/routes";
import { redirect } from "next/navigation";
import { syncAllStaleInterviews } from "@/app/actions/interviews";
import { isSessionFinalized } from "@/utils/interview-utils";

export default async function CandidateDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Synchronize dynamic lifecycle states in the DB prior to rendering
  try {
    await syncAllStaleInterviews();
  } catch (e) {
    console.error("[Candidate Dashboard] Lifecycle status sync exception:", e);
  }

  // Fetch real interviews for the logged-in candidate
  const { data: interviews } = await supabase
    .from("interviews")
    .select(`
      *,
      interviewer:interviewer_id(id, name, email, avatar)
    `)
    .eq("candidate_id", user.id)
    .order("scheduled_at", { ascending: true });

  const typedInterviews = interviews || [];
  const upcomingInterviews = typedInterviews.filter(i => 
    i.session_status === "scheduled" || 
    i.session_status === "waiting"
  );
  // Only truly active sessions — never finalized ones
  const liveInterviews = typedInterviews.filter(i => 
    (i.session_status === "active" || i.session_status === "late_joined") &&
    !isSessionFinalized(i.session_status)
  );
  const completedInterviews = typedInterviews.filter(i => isSessionFinalized(i.session_status));

  // Fetch candidate feedback scores
  const { data: feedbackData } = await supabase
    .from("feedback")
    .select("overall_score, technical_score, communication_score")
    .eq("candidate_id", user.id);

  const totalFeedbackCount = feedbackData?.length || 0;
  const avgScore = totalFeedbackCount > 0
    ? Math.round((feedbackData || []).reduce((acc, f) => acc + (f.overall_score || 0), 0) / totalFeedbackCount)
    : 0;

  // Next upcoming interview message helper
  let nextInterviewMsg = "No upcoming sessions";
  if (upcomingInterviews.length > 0) {
    const nextDate = new Date(upcomingInterviews[0].scheduled_at);
    const diffTime = nextDate.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      nextInterviewMsg = "Session is scheduled for today!";
    } else if (diffDays === 1) {
      nextInterviewMsg = "Next one is tomorrow!";
    } else {
      nextInterviewMsg = `Next one in ${diffDays} days`;
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'Candidate'}!
          </h1>
          <p className="text-muted-foreground mt-1">Here's an overview of your upcoming technical rounds and overall performance.</p>
        </div>
        <SafeLink 
          href={Routes.candidatePractice}
          className={cn(buttonVariants({ variant: "default" }), "w-fit bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer")}
        >
          <Code className="w-4 h-4 mr-2" />
          Practice Coding
        </SafeLink>
      </div>

      {liveInterviews.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-violet-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-violet-500/10 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="space-y-1.5 z-10">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="text-[10px] font-bold tracking-widest text-white uppercase bg-white/10 px-2 py-0.5 rounded">
                Live Session In Progress
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white">{liveInterviews[0].title}</h3>
            <p className="text-xs text-white/70">
              with <span className="font-medium text-white">{liveInterviews[0].interviewer?.name || "Guest Interviewer"}</span> • Session is active and waiting for your participation.
            </p>
          </div>
          <SafeLink
            href={Routes.interview(liveInterviews[0].id)}
            className={cn(buttonVariants({ variant: "secondary" }), "font-black text-xs h-9 px-5 bg-white text-violet-750 hover:bg-zinc-100 cursor-pointer shadow-lg shrink-0 z-10")}
          >
            <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
            Enter Active Interview Room
          </SafeLink>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Interviews</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{upcomingInterviews.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{nextInterviewMsg}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Rounds</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedInterviews.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedInterviews.length > 0 ? `Good job! Keep it up.` : "Schedule a round to start."}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", avgScore > 0 ? "text-emerald-500" : "text-zinc-500")}>
              {avgScore > 0 ? `${avgScore}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {avgScore > 80 ? "Top tier score" : avgScore > 0 ? "Consistently passing" : "No feedback reports yet"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Review Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedInterviews.length > totalFeedbackCount ? "Pending" : "Updated"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedInterviews.length > totalFeedbackCount ? "AI generation in progress" : "All reports generated"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
          <CardHeader>
            <CardTitle>Upcoming Schedule</CardTitle>
            <CardDescription>Your scheduled technical interviews.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CandidateScheduleClient upcomingInterviews={upcomingInterviews} />
          </CardContent>
        </Card>
        <Card className="col-span-3 bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
          <CardHeader>
            <CardTitle>Skill Breakdown</CardTitle>
            <CardDescription>Your performance cross-section from completed rounds.</CardDescription>
          </CardHeader>
          <CardContent>
            {completedInterviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                <Sparkles className="h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">Complete an interview to see insights.</p>
              </div>
            ) : (
              <CandidateChart />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
