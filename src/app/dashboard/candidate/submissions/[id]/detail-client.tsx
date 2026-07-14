"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Brain,
  Award,
  Clock,
  Printer,
  Download,
  Terminal,
  CheckCircle2,
  XCircle,
  Code2,
  Calendar,
  Sparkles,
  MessageSquare,
  BadgeAlert,
  ChevronRight,
  TrendingUp,
  Globe
} from "lucide-react";
import { SafeLink } from "@/components/ui/safe-link";
import { Routes } from "@/lib/routes";
import { AssessmentReviewClient } from "@/components/dashboard/assessment-review-client";

interface SubmissionDetailClientProps {
  id: string;
  type: string;
  detailData: any;
}

export function SubmissionDetailClient({ id, type, detailData }: SubmissionDetailClientProps) {
  const router = useRouter();

  if (!detailData && type !== "Coding Assessment") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between no-print">
          <SafeLink
            href={Routes.candidateSubmissions}
            className="text-xs text-primary hover:underline flex items-center gap-1 font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Submission History
          </SafeLink>
        </div>
        <Card className="bg-zinc-900/40 border-zinc-800/80 p-8 text-center rounded-2xl">
          <p className="text-zinc-400">Submission record not found or could not be retrieved.</p>
        </Card>
      </div>
    );
  }

  if (type === "Coding Assessment") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between no-print">
          <SafeLink
            href={Routes.candidateSubmissions}
            className="text-xs text-primary hover:underline flex items-center gap-1 font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Submission History
          </SafeLink>
        </div>
        <AssessmentReviewClient roomId={id} />
      </div>
    );
  }

  // Trigger Print View (Native PDF Save)
  const handlePrint = () => {
    window.print();
  };

  // Download raw markdown/JSON
  const handleDownload = (format: "md" | "json") => {
    let content = "";
    let filename = `Report-${type.replace(/\s+/g, "-")}-${id}`;

    if (format === "json") {
      content = JSON.stringify(detailData, null, 2);
      filename += ".json";
    } else {
      content = `# InterviewAI Executive Performance Report\n\n` +
                `**Assessment ID:** ${id}\n` +
                `**Category Type:** ${type}\n` +
                `**Created/Scheduled Date:** ${new Date(detailData.created_at || detailData.scheduled_at || Date.now()).toLocaleDateString()}\n\n`;

      if (type === "Compiler Sandbox") {
        content += `## Compiler Sandbox Execution Logs\n\n` +
                   `- **Language:** ${detailData.language}\n` +
                   `- **Runtime Execution Status:** ${detailData.status}\n` +
                   `- **Execution Time:** ${detailData.execution_time ? `${(detailData.execution_time * 1000).toFixed(0)}ms` : "N/A"}\n\n` +
                   `### Submitted Code:\n\`\`\`${detailData.language}\n${detailData.code}\n\`\`\`\n\n` +
                   `### Compiler Outputs:\n\`\`\`\n${detailData.output}\n\`\`\`\n`;
      } else if (type === "Practice" || type === "Mock Interview") {
        content += `## AI Session Metrics\n\n` +
                   `- **Role target:** ${detailData.role}\n` +
                   `- **Round Category:** ${detailData.round}\n` +
                   `- **Calibration Difficulty:** ${detailData.difficulty}\n` +
                   `- **Personality Bias:** ${detailData.personality}\n` +
                   `- **AI Readiness Score:** ${detailData.evaluation?.readinessScore || "N/A"}%\n\n` +
                   `## Strengths:\n` +
                   `${detailData.evaluation?.strengths?.map((s: string) => `- ${s}`).join("\n") || "No key strengths registered."}\n\n` +
                   `## Key Focus Areas:\n` +
                   `${detailData.evaluation?.weaknesses?.map((w: string) => `- ${w}`).join("\n") || "No key focus areas registered."}\n\n` +
                   `## Recommendations:\n` +
                   `${detailData.evaluation?.recommendations || "No recommendations registered."}\n\n` +
                   `## Study Improvement Plan:\n` +
                   `${detailData.evaluation?.improvementPlan || "No improvement plan generated."}\n`;
      } else if (type === "Real Interview") {
        content += `## Interview Performance Feedback\n\n` +
                   `- **Interviewer Name:** ${detailData.interviewer?.name || "Guest"}\n` +
                   `- **Technical Score:** ${detailData.technical_score}%\n` +
                   `- **Communication Score:** ${detailData.communication_score}%\n` +
                   `- **Overall Average:** ${detailData.overall_score}%\n\n` +
                   `### AI Feedback Analysis:\n\n${detailData.ai_feedback || "No AI feedback summary details recorded."}\n\n` +
                   `### Interviewer Comments:\n\n"${detailData.interviewer_comments || "No comments written."}"\n`;
      }
      filename += ".md";
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const score = type === "Real Interview" 
    ? detailData.overall_score 
    : (type === "Practice" || type === "Mock Interview" ? detailData.evaluation?.readinessScore : null);

  const passed = score !== null ? score >= 70 : (detailData.status === "Success" || detailData.overallResult === "Passed");

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto print:mx-0 print:max-w-full print:text-black">
      
      {/* Dynamic print-only header */}
      <div className="hidden print:block border-b-2 border-zinc-900 pb-5 mb-8">
        <h1 className="text-3xl font-black text-black">InterviewAI Executive Summary Report</h1>
        <p className="text-sm text-zinc-500 mt-1">Generated chronologically on {new Date().toLocaleDateString()}</p>
      </div>

      {/* Detail Header / Action buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900/50 pb-5 no-print">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/candidate/submissions"
            className="p-2 rounded-full border border-zinc-800/80 bg-zinc-900/20 hover:bg-zinc-850 hover:text-white transition text-zinc-400 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/20 capitalize">
                {type}
              </Badge>
              {detailData.language && (
                <Badge variant="outline" className="font-mono lowercase text-xxs">
                  {detailData.language}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
              {type === "Compiler Sandbox" ? detailData.interviews?.title || "Compiler Sandbox Run" : (type === "Real Interview" ? detailData.interview?.title : detailData.role)}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Run ID: <span className="font-mono">{id}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="border-zinc-800 hover:bg-zinc-800 text-xs h-9 cursor-pointer gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("md")}
            className="border-zinc-800 hover:bg-zinc-800 text-xs h-9 cursor-pointer gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("json")}
            className="border-zinc-800 hover:bg-zinc-800 text-xs h-9 cursor-pointer font-mono"
            title="Download JSON Payload"
          >
            {"{ JSON }"}
          </Button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Left Column - Score Cards & Metadata */}
        <div className="space-y-6 md:col-span-1 print:col-span-1">
          
          {/* Main Score Card */}
          {score !== null && (
            <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 hover:bg-zinc-900/50 transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-400">Average Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-black ${passed ? "text-emerald-400" : "text-amber-500"}`}>{score}%</span>
                  <Badge variant="outline" className={`text-xxs uppercase ${passed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                    {passed ? "Passed" : "Below Cutoff"}
                  </Badge>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${passed ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${score}%` }} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sub scores for Real Interview */}
          {type === "Real Interview" && (
            <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Score Breakdown</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-zinc-950/40 p-2.5 rounded border border-zinc-850">
                  <span className="text-zinc-400">Technical Skill</span>
                  <span className="font-bold text-primary">{detailData.technical_score}%</span>
                </div>
                <div className="flex justify-between items-center bg-zinc-950/40 p-2.5 rounded border border-zinc-850">
                  <span className="text-zinc-400">Communication</span>
                  <span className="font-bold text-amber-400">{detailData.communication_score}%</span>
                </div>
              </div>
            </Card>
          )}

          {/* Session Metadata Card */}
          <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4.5 space-y-3.5">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Details</h3>
            <div className="space-y-3 text-xs">
              
              <div className="flex justify-between py-1.5 border-b border-zinc-850/50">
                <span className="text-zinc-500">Date</span>
                <span className="text-zinc-200 font-medium">
                  {new Date(detailData.created_at || detailData.scheduled_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              {type === "Compiler Sandbox" ? (
                <>
                  <div className="flex justify-between py-1.5 border-b border-zinc-850/50">
                    <span className="text-zinc-500">Status</span>
                    <span className={`font-bold ${passed ? "text-emerald-400" : "text-red-400"}`}>
                      {detailData.status || "Completed"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-850/50">
                    <span className="text-zinc-500">Execution Runtime</span>
                    <span className="text-zinc-200 font-mono">
                      {detailData.execution_time ? `${(detailData.execution_time * 1000).toFixed(0)}ms` : "N/A"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between py-1.5 border-b border-zinc-850/50">
                    <span className="text-zinc-500">Role Target</span>
                    <span className="text-zinc-200 font-medium">{detailData.role || "Software Engineer"}</span>
                  </div>
                  {detailData.difficulty && (
                    <div className="flex justify-between py-1.5 border-b border-zinc-850/50">
                      <span className="text-zinc-500">Difficulty</span>
                      <span className="text-zinc-200 font-medium">{detailData.difficulty}</span>
                    </div>
                  )}
                  {detailData.personality && (
                    <div className="flex justify-between py-1.5 border-b border-zinc-850/50">
                      <span className="text-zinc-500">Tone Bias</span>
                      <span className="text-zinc-200 font-medium">{detailData.personality}</span>
                    </div>
                  )}
                  {type === "Real Interview" && detailData.interviewer && (
                    <div className="pt-2">
                      <span className="text-zinc-500 block mb-1">Assigned Interviewer</span>
                      <p className="font-bold text-white text-xs">{detailData.interviewer?.name || "Guest"}</p>
                      <p className="text-zinc-500 text-[10px] font-mono">{detailData.interviewer?.email}</p>
                    </div>
                  )}
                </>
              )}

            </div>
          </Card>
        </div>

        {/* Right Column - Report Details & Outputs */}
        <div className="space-y-6 md:col-span-2 print:col-span-2">
          
          {/* Practice & Mock AI Report */}
          {(type === "Practice" || type === "Mock Interview") && (
            <>
              {/* Executive Summary */}
              <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    AI Evaluation Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-zinc-300 text-sm leading-relaxed">
                  <p>{detailData.evaluation?.summary || "No executive summary parsed for this practice session."}</p>
                  
                  {detailData.evaluation?.recommendations && (
                    <div className="p-3 bg-zinc-950/50 border border-zinc-850 rounded-lg mt-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        AI Recommendations
                      </h4>
                      <p className="text-xs text-zinc-400 leading-normal">{detailData.evaluation.recommendations}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Strengths & Focus Areas */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                    <Award className="w-4 h-4 text-emerald-400" />
                    Highlighted Strengths
                  </h3>
                  {detailData.evaluation?.strengths?.length > 0 ? (
                    <ul className="space-y-2">
                      {detailData.evaluation.strengths.map((str: string, idx: number) => (
                        <li key={idx} className="text-xs text-zinc-300 bg-emerald-500/5 border border-emerald-500/10 p-2 rounded">
                          {str}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-550 italic">No key strengths highlighted.</p>
                  )}
                </Card>

                <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80 p-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                    <BadgeAlert className="w-4 h-4 text-amber-500" />
                    Areas to Focus On
                  </h3>
                  {detailData.evaluation?.weaknesses?.length > 0 ? (
                    <ul className="space-y-2">
                      {detailData.evaluation.weaknesses.map((weak: string, idx: number) => (
                        <li key={idx} className="text-xs text-zinc-300 bg-amber-500/5 border border-amber-500/10 p-2 rounded">
                          {weak}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-550 italic">No weaknesses pointed out.</p>
                  )}
                </Card>
              </div>

              {/* Improvement Plan */}
              {detailData.evaluation?.improvementPlan && (
                <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Targeted Study & Improvement Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-zinc-350 leading-relaxed">
                    {detailData.evaluation.improvementPlan}
                  </CardContent>
                </Card>
              )}

              {/* Q&A Transcript */}
              {detailData.chat_log && detailData.chat_log.length > 0 && (
                <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-white">Interactive Session Dialogue</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {detailData.chat_log.map((chat: any, idx: number) => (
                      <div
                        key={idx}
                        className={`flex gap-3 text-xs leading-normal p-3 rounded-lg border ${
                          chat.sender === "ai"
                            ? "bg-zinc-900/30 border-zinc-850"
                            : "bg-primary/5 border-primary/10 ml-8 flex-row-reverse"
                        }`}
                      >
                        <div className="shrink-0 font-bold uppercase tracking-wider text-[10px] text-zinc-500 mt-0.5">
                          {chat.sender === "ai" ? "AI Interviewer" : "Candidate"}
                        </div>
                        <div className={`flex-1 text-zinc-300 whitespace-pre-wrap ${chat.sender !== "ai" && "text-right"}`}>
                          {chat.text}
                          {chat.timestamp && (
                            <span className="block text-[9px] text-zinc-500 mt-1 font-mono">{chat.timestamp}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Real Scheduled Interview Report */}
          {type === "Real Interview" && (
            <>
              {/* Executive Summary */}
              <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    AI Evaluation Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-zinc-300 text-sm leading-relaxed">
                  {detailData.ai_feedback?.split("\n\n").map((para: string, idx: number) => (
                    <p key={idx}>{para}</p>
                  )) || <p>{detailData.ai_feedback}</p>}

                  {detailData.interviewer_comments && (
                    <div className="mt-6 p-4 rounded-lg bg-zinc-800/20 border border-zinc-850 space-y-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Interviewer's Final Assessment Comments
                      </h4>
                      <p className="text-zinc-400 text-xs leading-relaxed italic">
                        "{detailData.interviewer_comments}"
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Compiler Sandbox Source Code & Execution Results */}
          {type === "Compiler Sandbox" && (
            <>
              {/* Submitted Code */}
              <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                    <Code2 className="w-4.5 h-4.5 text-primary" />
                    Submitted Source Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-xs text-zinc-350 bg-zinc-950 p-4 rounded-lg border border-zinc-900 overflow-x-auto max-h-[350px] custom-scrollbar">
                    <pre className="whitespace-pre">{detailData.code}</pre>
                  </div>
                </CardContent>
              </Card>

              {/* Compilation Output */}
              <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4.5 h-4.5 text-primary" />
                    Console Output Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-xs text-zinc-300 bg-black/90 p-4 rounded-lg border border-zinc-900 overflow-x-auto max-h-[200px] custom-scrollbar whitespace-pre-wrap">
                    {detailData.output || "No compiler run outputs captured."}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

        </div>
      </div>

    </div>
  );
}
