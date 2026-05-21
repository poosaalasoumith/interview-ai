import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Award, Star, Clock, Play, ArrowRight, Sparkles, BookOpen, AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function CandidateInterviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all interviews with nested interviewer and feedback data
  const { data: interviews, error } = await supabase
    .from("interviews")
    .select(`
      *,
      interviewer:interviewer_id(id, name, email, avatar),
      feedback:feedback(id, overall_score, technical_score, communication_score, ai_feedback)
    `)
    .eq("candidate_id", user.id)
    .order("scheduled_at", { ascending: false });

  if (error) {
    console.error("[Candidate Interviews] Error fetching:", error.message);
  }

  const typedInterviews = interviews || [];
  
  // Filter interviews by status
  const upcoming = typedInterviews.filter(
    (i) => i.status === "scheduled" || i.status === "in_progress"
  );
  
  const completed = typedInterviews.filter(
    (i) => i.status === "completed"
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
          My Interview Rounds
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitor your upcoming scheduled coding assessments and view comprehensive post-interview feedback.
        </p>
      </div>

      {/* 1. Upcoming Interviews Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Scheduled Assessments ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <Card className="bg-zinc-900/20 border-zinc-800/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <Calendar className="h-8 w-8 text-zinc-600" />
              <div>
                <p className="text-sm font-medium text-zinc-300">No upcoming interviews scheduled</p>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  Once an interviewer schedules a technical round with you, it will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((interview) => {
              const date = new Date(interview.scheduled_at);
              const formattedDate = date.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric"
              });
              const formattedTime = date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit"
              });

              // Problem Details
              const problem = interview.problem_statement || {};

              return (
                <Card 
                  key={interview.id} 
                  className={cn(
                    "bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-all duration-350 relative overflow-hidden group hover:border-zinc-700/85",
                    interview.status === "in_progress" && "border-primary/50 bg-primary/5"
                  )}
                >
                  {interview.status === "in_progress" && (
                    <div className="absolute top-0 right-0 bg-primary px-3 py-1 text-xxs font-black text-primary-foreground uppercase tracking-widest rounded-bl">
                      Live Now
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <CardTitle className="text-base font-bold text-white group-hover:text-primary transition-colors">
                          {interview.title}
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formattedDate} • {formattedTime}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-xxs font-bold uppercase shrink-0",
                        interview.status === "in_progress" 
                          ? "bg-primary/10 text-primary border-primary/20" 
                          : "bg-zinc-800/55 text-zinc-400 border-zinc-700/50"
                      )}>
                        {interview.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Problem Preview */}
                    <div className="p-3 rounded bg-zinc-950/40 border border-zinc-850/60 text-xs">
                      <p className="text-zinc-500 font-medium uppercase tracking-wider text-[10px]">Active Question Focus</p>
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="font-semibold text-zinc-300">{problem.title || "TBD during interview"}</span>
                        {problem.difficulty && (
                          <Badge variant="secondary" className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-black",
                            problem.difficulty === "Easy" && "bg-emerald-500/10 text-emerald-400",
                            problem.difficulty === "Medium" && "bg-amber-500/10 text-amber-400",
                            problem.difficulty === "Hard" && "bg-red-500/10 text-red-400"
                          )}>
                            {problem.difficulty}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Interviewer Metadata */}
                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-zinc-850/60">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-zinc-800 shrink-0">
                          <AvatarImage src={interview.interviewer?.avatar || ""} />
                          <AvatarFallback className="bg-zinc-800 text-zinc-350 text-[10px] font-bold">
                            {interview.interviewer?.name?.substring(0, 2).toUpperCase() || "INT"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-400 truncate">
                            Interviewer: <span className="font-medium text-zinc-200">{interview.interviewer?.name || "Guest"}</span>
                          </p>
                        </div>
                      </div>

                      <Link 
                        href={`/interview/${interview.id}`}
                        className={cn(
                          buttonVariants({ 
                            variant: interview.status === "in_progress" ? "default" : "outline", 
                            size: "sm" 
                          }), 
                          "text-xs px-3 py-1 h-8 cursor-pointer shrink-0 border-zinc-800"
                        )}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {interview.status === "in_progress" ? "Join Session" : "Join Lobby"}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Completed Interviews Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-500" />
          Completed & Evaluated Rounds ({completed.length})
        </h2>
        {completed.length === 0 ? (
          <Card className="bg-zinc-900/20 border-zinc-800/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <Award className="h-8 w-8 text-zinc-600 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-zinc-300">No completed rounds found</p>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  Once you successfully complete a technical round and the evaluator ends the session, your feedback scores will load here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {completed.map((interview) => {
              const date = new Date(interview.scheduled_at);
              const formattedDate = date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
              });

              // Pull RLS-resolved nested feedback
              const feedbackObj = Array.isArray(interview.feedback) 
                ? interview.feedback[0] 
                : (interview.feedback as any) || null;

              return (
                <Card 
                  key={interview.id} 
                  className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-all duration-350 hover:border-zinc-700/85 relative overflow-hidden group"
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <CardTitle className="text-base font-bold text-white group-hover:text-primary transition-colors">
                          {interview.title}
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-500 mt-1">
                          Completed on {formattedDate} • with {interview.interviewer?.name || "Guest Interviewer"}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xxs font-black uppercase tracking-wider shrink-0">
                        Evaluated
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {feedbackObj ? (
                      <div className="grid grid-cols-3 gap-2 py-1 text-center">
                        <div className="bg-zinc-950/40 rounded p-2 border border-zinc-850/50">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Technical</p>
                          <p className="text-base font-black text-primary mt-1">{feedbackObj.technical_score}%</p>
                        </div>
                        <div className="bg-zinc-950/40 rounded p-2 border border-zinc-850/50">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Comms</p>
                          <p className="text-base font-black text-amber-500 mt-1">{feedbackObj.communication_score}%</p>
                        </div>
                        <div className="bg-zinc-950/40 rounded p-2 border border-zinc-850/50 border-l-2 border-l-emerald-500">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Overall</p>
                          <p className="text-base font-black text-emerald-500 mt-1">{feedbackObj.overall_score}%</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-950/30 rounded border border-zinc-850/50 text-xs text-zinc-500 italic flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                        AI assessment generated, syncing final report metadata...
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2.5 border-t border-zinc-850/60">
                      <Link
                        href={`/dashboard/candidate/review/${interview.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "text-xs px-3.5 py-1.5 h-9 cursor-pointer w-full justify-between bg-zinc-950/45 border-zinc-800 text-zinc-300 hover:text-white"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                          View Performance Report
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-primary transition-transform duration-300 group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}