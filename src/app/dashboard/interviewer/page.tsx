import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, Clock, FileText, ArrowRight, PlayCircle } from "lucide-react";
import { InterviewerChart } from "@/components/dashboard/interviewer-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function InterviewerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all interviews by this interviewer, joining candidate info and feedback presence
  const { data: interviews } = await supabase
    .from("interviews")
    .select(`
      *,
      candidate:candidate_id(id, name, email, avatar),
      feedback(id)
    `)
    .eq("interviewer_id", user.id)
    .order("scheduled_at", { ascending: true });

  const typedInterviews = interviews || [];
  
  // Calculate Stats
  const todayStr = new Date().toDateString();
  const upcomingToday = typedInterviews.filter(i => 
    (i.status === "scheduled" || i.status === "in_progress") && 
    new Date(i.scheduled_at).toDateString() === todayStr
  );

  const totalInterviews = typedInterviews.length;
  const completedInterviews = typedInterviews.filter(i => i.status === "completed");
  const hoursSpent = completedInterviews.length; // Assume 1 hour per round
  
  // Pending feedback reviews (completed interviews that do not have a feedback row)
  const pendingReviews = typedInterviews.filter(i => 
    i.status === "completed" && (!i.feedback || (Array.isArray(i.feedback) ? i.feedback.length === 0 : !i.feedback))
  );

  // Most immediate upcoming session
  const upcomingSessions = typedInterviews.filter(i => i.status === "scheduled" || i.status === "in_progress");
  const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Interviewer Portal
          </h1>
          <p className="text-muted-foreground mt-1">Manage your upcoming live coding sessions and review candidate evaluations.</p>
        </div>
        {nextSession ? (
          <Link 
            href={`/interview/${nextSession.id}`}
            className={cn(buttonVariants({ variant: "default" }), "w-fit bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer font-semibold")}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Join Active Session
          </Link>
        ) : (
          <Link 
            href="/dashboard/interviewer/interviews"
            className={cn(buttonVariants({ variant: "default" }), "w-fit bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer font-semibold")}
          >
            <CalendarCheck className="w-4 h-4 mr-2" />
            Schedule a Round
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Today</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{upcomingToday.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {upcomingToday.length > 0 ? "Prepare the problem statement" : "All clear for today"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInterviews}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled or completed</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", pendingReviews.length > 0 ? "text-amber-500" : "text-zinc-500")}>
              {pendingReviews.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingReviews.length > 0 ? "Requires interviewer evaluation" : "Up-to-date"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hoursSpent}h</div>
            <p className="text-xs text-muted-foreground mt-1">In live technical rounds</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
          <CardHeader>
            <CardTitle>Schedule Workload</CardTitle>
            <CardDescription>Your weekly scheduled interviews.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <InterviewerChart />
          </CardContent>
        </Card>
        <Card className="col-span-3 bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
          <CardHeader>
            <CardTitle>Action Items</CardTitle>
            <CardDescription>Completed interviews requiring final reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pendingReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                <FileText className="h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">No pending candidates.</p>
              </div>
            ) : (
              pendingReviews.map((review) => (
                <div key={review.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-850 bg-zinc-900/30 hover:bg-zinc-850/50 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 border border-primary/20 shrink-0">
                      <AvatarImage src={review.candidate?.avatar || ""} />
                      <AvatarFallback className="bg-zinc-800 text-zinc-300">
                        {review.candidate?.name?.substring(0, 2).toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-white">
                        {review.candidate?.name || "Guest Candidate"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{review.title}</p>
                    </div>
                  </div>
                  <Link 
                    href={`/interview/${review.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "group-hover:text-primary shrink-0 cursor-pointer")}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))
            )}
            
            {nextSession && (
              <div className="mt-6 pt-6 border-t border-zinc-800/80">
                <h4 className="text-sm font-medium mb-4 text-zinc-300">Immediate Session</h4>
                <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <PlayCircle className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-semibold truncate text-white">{nextSession.title}</h5>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      with <span className="text-zinc-200 font-medium">{nextSession.candidate?.name || "Guest Candidate"}</span> • {new Date(nextSession.scheduled_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Link 
                    href={`/interview/${nextSession.id}`} 
                    className="inline-flex shrink-0 ml-2"
                  >
                    <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground font-semibold cursor-pointer">
                      Join
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
