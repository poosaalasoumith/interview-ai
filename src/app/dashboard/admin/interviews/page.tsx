import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ShieldAlert, Clock, Star, Play, CheckCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { syncAllStaleInterviews } from "@/app/actions/interviews";

export default async function AdminInterviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Ensure user is actually admin
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-red-500 animate-pulse" />
        <h2 className="text-xl font-bold text-zinc-200">Access Restricted</h2>
        <p className="text-muted-foreground text-sm max-w-sm text-center">
          Only platform system administrators have clearance to view all scheduled sessions.
        </p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "border-zinc-800")}>
          Return to Workspace
        </Link>
      </div>
    );
  }

  // Synchronize dynamic lifecycle states in the DB prior to rendering
  try {
    await syncAllStaleInterviews();
  } catch (e) {
    console.error("[Admin Interviews Page] Lifecycle status sync exception:", e);
  }

  // 2. Fetch all interviews globally across candidate and interviewer bounds
  const { data: interviews, error } = await supabase
    .from("interviews")
    .select(`
      *,
      candidate:candidate_id(id, name, email, avatar),
      interviewer:interviewer_id(id, name, email, avatar),
      feedback:feedback(id, overall_score)
    `)
    .order("scheduled_at", { ascending: false });

  if (error) {
    console.error("[Admin Interviews] Error fetching:", error.message);
  }

  const allInterviews = interviews || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
          System Sessions Monitor
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitor all scheduled, active, and completed technical assessments across the InterviewAI instance.
        </p>
      </div>

      <div className="grid gap-4">
        {allInterviews.length === 0 ? (
          <Card className="bg-zinc-900/20 border-zinc-800/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Calendar className="h-10 w-10 text-zinc-650" />
              <div>
                <p className="text-base font-semibold text-zinc-350">No scheduled sessions recorded</p>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  Once interviewers schedule sessions, they will be tracked globally here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {allInterviews.map((interview) => {
              const date = new Date(interview.scheduled_at);
              const formattedDate = date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
              });
              const formattedTime = date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit"
              });

              const feedbackObj = Array.isArray(interview.feedback)
                ? interview.feedback[0]
                : (interview.feedback as any) || null;

              return (
                <Card 
                  key={interview.id} 
                  className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-all duration-300 hover:border-zinc-700/85 relative group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <CardTitle className="text-base font-bold text-white group-hover:text-primary transition-colors">
                          {interview.title}
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-500 mt-1 flex flex-col gap-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            {formattedDate} at {formattedTime}
                          </span>
                          {interview.expiration_reason && (
                            <span className="text-[10px] text-zinc-450 italic mt-1 font-mono bg-zinc-950/30 border border-zinc-850/60 px-2 py-0.5 rounded w-fit">
                              Audit: {interview.expiration_reason} {interview.status_message ? `— ${interview.status_message}` : ""}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase tracking-wider shrink-0",
                        interview.session_status === "completed" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        interview.session_status === "submitted" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                        interview.session_status === "expired" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                        interview.session_status === "terminated" && "bg-red-500/10 text-red-400 border-red-500/20",
                        (interview.session_status === "cancelled" || interview.session_status === "canceled") && "bg-zinc-800 text-zinc-450 border-zinc-700/50",
                        interview.session_status === "missed" && "bg-red-950/20 text-red-400 border-red-900/30",
                        interview.session_status === "active" && "bg-primary/10 text-primary border-primary/20 animate-pulse",
                        interview.session_status === "waiting" && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse",
                        interview.session_status === "scheduled" && "bg-zinc-850 text-zinc-500 border-zinc-800/50"
                      )}>
                        {interview.session_status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Candidate & Interviewer Split */}
                    <div className="grid grid-cols-2 gap-4 py-2 border-y border-zinc-850/50">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Candidate</p>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-zinc-800 shrink-0">
                            <AvatarImage src={interview.candidate?.avatar || ""} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                              {interview.candidate?.name?.substring(0, 2).toUpperCase() || "CN"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs text-white truncate font-medium">{interview.candidate?.name || "Guest"}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Interviewer</p>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-zinc-800 shrink-0">
                            <AvatarImage src={interview.interviewer?.avatar || ""} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                              {interview.interviewer?.name?.substring(0, 2).toUpperCase() || "INT"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs text-white truncate font-medium">{interview.interviewer?.name || "Guest"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Panel */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      {(interview.session_status === "completed" || 
                        interview.session_status === "submitted" || 
                        interview.session_status === "expired" || 
                        interview.session_status === "terminated" || 
                        interview.session_status === "cancelled" || 
                        interview.session_status === "missed") ? (
                        <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span>AI score: {feedbackObj?.overall_score ? `${feedbackObj.overall_score}%` : "Not evaluated"}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500">
                          Room ID: <span className="font-mono text-zinc-400">{interview.id.substring(0, 8)}...</span>
                        </div>
                      )}

                      {(interview.session_status === "scheduled" || 
                        interview.session_status === "waiting" || 
                        interview.session_status === "active" || 
                        interview.session_status === "late_joined") && (
                        <Link 
                          href={`/interview/${interview.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs h-8 cursor-pointer border-zinc-800")}
                        >
                          <Play className="h-3 w-3 mr-1" /> Join room
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}