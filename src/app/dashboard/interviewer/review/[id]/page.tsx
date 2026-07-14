import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Brain, Award, Star, MessageSquareCode, BadgeAlert, AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { AssessmentReviewClient } from "@/components/dashboard/assessment-review-client";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the interview details to see if it's assessment-based
  const { data: interview } = await supabase
    .from("interviews")
    .select("assessment_template_id")
    .eq("id", id)
    .single();

  if (interview?.assessment_template_id) {
    return (
      <div className="container py-8 max-w-6xl mx-auto px-4 md:px-0">
        <AssessmentReviewClient roomId={id} />
      </div>
    );
  }

  // Fetch the feedback and related interview details
  const { data: feedback, error } = await supabase
    .from("feedback")
    .select(`
      *,
      interview:interview_id(title, scheduled_at),
      candidate:candidate_id(name, email, avatar),
      interviewer:interviewer_id(name)
    `)
    .eq("interview_id", id)
    .single();

  if (error || !feedback) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-zinc-600 animate-pulse" />
        <h2 className="text-xl font-bold text-zinc-200">Evaluation Report Pending</h2>
        <p className="text-muted-foreground text-sm max-w-sm text-center">
          The evaluation report is either generating or does not exist for this session yet.
        </p>
        <Link href="/dashboard/interviewer" className={cn(buttonVariants({ variant: "outline" }), "border-zinc-800")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  // Parse AI evaluation JSON
  let report: any = {};
  try {
    report = JSON.parse(feedback.ai_feedback || "{}");
  } catch (e) {
    report = {
      summary: feedback.ai_feedback || "No summary provided.",
      strengths: [],
      weaknesses: []
    };
  }

  const strengths = report.strengths || [];
  const weaknesses = report.weaknesses || [];
  const recommendation = report.recommendation || "Hire";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/interviewer" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full border border-zinc-800/80 bg-zinc-900/20")}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Evaluation Report
          </h1>
          <p className="text-muted-foreground mt-1">AI-assisted comprehensive review for {feedback.candidate?.name || feedback.candidate?.email}.</p>
        </div>
      </div>

      {/* Hero Score Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Technical Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{feedback.technical_score}%</div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: `${feedback.technical_score}%` }} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Communication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-500">{feedback.communication_score}%</div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${feedback.communication_score}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-500">{feedback.overall_score}%</div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${feedback.overall_score}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/60 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Recommendation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mt-1 text-white">{recommendation}</div>
            <Badge variant="outline" className="mt-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xxs font-semibold uppercase tracking-wider">
              AI Decision
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left main summary */}
        <Card className="md:col-span-2 bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white font-bold">
              <Brain className="w-5 h-5 text-primary" />
              AI Performance Summary
            </CardTitle>
            <CardDescription className="text-zinc-500">Synthesized algorithmic logic, code structure, and runtime execution summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300 leading-relaxed text-sm">
            {report.summary?.split('\n\n').map((para: string, idx: number) => (
              <p key={idx}>{para}</p>
            )) || <p>{feedback.ai_feedback}</p>}
          </CardContent>
        </Card>

        {/* Right side panel with strengths, weaknesses and metadata */}
        <div className="space-y-6">
          <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                Technical Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              {strengths.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No key strengths highlighted.</p>
              ) : (
                <ul className="space-y-2">
                  {strengths.map((str: string, idx: number) => (
                    <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2 bg-emerald-500/5 p-2.5 rounded border border-emerald-500/10">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <BadgeAlert className="w-4 h-4 text-amber-500 shrink-0" />
                Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weaknesses.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No key weaknesses highlighted.</p>
              ) : (
                <ul className="space-y-2">
                  {weaknesses.map((weak: string, idx: number) => (
                    <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2 bg-amber-500/5 p-2.5 rounded border border-amber-500/10">
                      <span className="text-amber-500 font-bold shrink-0">!</span>
                      <span>{weak}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold text-zinc-405 uppercase tracking-wider">Candidate & Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 border border-zinc-800 shrink-0">
                  <AvatarImage src={feedback.candidate?.avatar || ""} />
                  <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xxs font-bold">
                    {feedback.candidate?.name?.substring(0, 2).toUpperCase() || "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{feedback.candidate?.name || "Guest Candidate"}</p>
                  <p className="text-zinc-500 truncate max-w-[200px]">{feedback.candidate?.email}</p>
                </div>
              </div>
              <div className="pt-2.5 border-t border-zinc-850 space-y-1.5 text-zinc-400">
                <p>Round: <span className="text-zinc-200 font-medium">{feedback.interview?.title}</span></p>
                <p>Evaluator: <span className="text-zinc-200 font-medium">{feedback.interviewer?.name || "Self-assigned"}</span></p>
                <p>Completed: <span className="text-zinc-200 font-medium">{new Date(feedback.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper utility for cn classnames
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}