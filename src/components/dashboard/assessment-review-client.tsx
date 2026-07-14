"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { CodeEditor } from "@/components/interview/code-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Brain, 
  Award, 
  Clock, 
  Terminal, 
  FileCode2, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Bookmark,
  Users,
  Compass
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AssessmentReviewClientProps {
  roomId: string;
}

export function AssessmentReviewClient({ roomId }: AssessmentReviewClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);
  const [candidate, setCandidate] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQIdx, setActiveQIdx] = useState(0);

  // Loaded answers details for selected question
  const [answerCode, setAnswerCode] = useState("");
  const [answerLang, setAnswerLang] = useState("javascript");
  const [answerStatus, setAnswerStatus] = useState("not_started");
  const [testcaseResults, setTestcaseResults] = useState<any[]>([]);
  const [aiScore, setAiScore] = useState<any>(null);

  useEffect(() => {
    const fetchReviewData = async () => {
      try {
        // 1. Fetch Attempt & template info
        const { data: att, error: attErr } = await supabase
          .from("assessment_attempts")
          .select(`
            *,
            template:template_id(*)
          `)
          .eq("interview_id", roomId)
          .single();

        if (attErr || !att) throw new Error("Assessment attempt not found");
        setAttempt(att);

        // Fetch candidate details
        const { data: cand, error: candErr } = await supabase
          .from("users")
          .select("*")
          .eq("id", att.candidate_id)
          .single();

        if (!candErr && cand) {
          setCandidate(cand);
        }

        // 2. Fetch Questions
        const { data: quest, error: questErr } = await supabase
          .from("assessment_questions")
          .select(`
            *,
            question_testcases(*)
          `)
          .eq("template_id", att.template_id)
          .order("order_index", { ascending: true });

        if (questErr || !quest) throw new Error("Failed to load questions");
        setQuestions(quest);

        // 3. Load first question's candidate answer details
        await loadQuestionDetails(quest[0]?.id, att.id);

      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviewData();
  }, [roomId]);

  const loadQuestionDetails = async (questionId: string, attemptId: string) => {
    if (!questionId || !attemptId) return;

    try {
      // Fetch Candidate Answer
      const { data: ans } = await supabase
        .from("candidate_answers")
        .select("*")
        .eq("attempt_id", attemptId)
        .eq("question_id", questionId)
        .maybeSingle();

      if (ans) {
        setAnswerCode(ans.code);
        setAnswerLang(ans.language);
        setAnswerStatus(ans.status);

        // Fetch Execution results
        const { data: execs } = await supabase
          .from("execution_results")
          .select(`
            *,
            testcase:testcase_id(*)
          `)
          .eq("candidate_answer_id", ans.id);

        setTestcaseResults(execs || []);
      } else {
        setAnswerCode("");
        setAnswerLang("javascript");
        setAnswerStatus("not_started");
        setTestcaseResults([]);
      }

      // Fetch AI Score
      const { data: score } = await supabase
        .from("assessment_scores")
        .select("*")
        .eq("attempt_id", attemptId)
        .eq("question_id", questionId)
        .maybeSingle();

      setAiScore(score || null);

    } catch (e) {
      console.error(e);
    }
  };

  const handleQuestionSelect = async (idx: number) => {
    setActiveQIdx(idx);
    await loadQuestionDetails(questions[idx].id, attempt.id);
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        <p className="text-zinc-500 text-sm">Assembling assessment analytics report...</p>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4">
        <XCircle className="w-12 h-12 text-zinc-700" />
        <h2 className="text-lg font-bold text-white">No Assessment Data</h2>
        <p className="text-zinc-500 text-xs">The candidate has not started this assessment yet.</p>
        <Link href="/dashboard/interviewer" className="text-xs text-violet-400 hover:underline">
          Return to Portal
        </Link>
      </div>
    );
  }

  const activeQ = questions[activeQIdx];
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 10), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/interviewer" 
            className="p-2 rounded-full border border-zinc-800/80 bg-zinc-900/20 hover:bg-zinc-850 hover:text-white transition text-zinc-400 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Assessment Evaluation Report</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Detailed technical screening metrics for <span className="text-zinc-300 font-bold">{candidate?.name || candidate?.email}</span>
            </p>
          </div>
        </div>

        {attempt.completed_at && (
          <div className="text-xs text-zinc-500 font-mono flex items-center gap-1.5 bg-zinc-900/30 border border-zinc-900 px-3 py-1.5 rounded-lg w-fit">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            <span>Completed on {new Date(attempt.completed_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Main Review Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Left Side: Question List Navigator */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <Card className="bg-zinc-950 border-zinc-900 shadow-xl">
            <CardHeader className="pb-3 border-b border-zinc-900 bg-zinc-900/10">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-400">Questions Navigator</CardTitle>
            </CardHeader>
            <CardContent className="p-3 flex flex-col gap-2">
              {questions.map((q, idx) => {
                const isSelected = idx === activeQIdx;
                const isSolved = q.id === activeQ?.id && answerStatus === "solved";

                return (
                  <button
                    key={q.id}
                    onClick={() => handleQuestionSelect(idx)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border text-xs font-bold transition-all flex items-start gap-2.5 relative cursor-pointer",
                      isSelected
                        ? "bg-violet-600/10 border-violet-500 text-violet-400"
                        : "bg-zinc-900/10 border-zinc-900 text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    )}
                  >
                    <span className={cn(
                      "text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-black",
                      isSelected ? "bg-violet-500/20 text-violet-400" : "bg-zinc-800 text-zinc-500"
                    )}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate tracking-tight font-extrabold">{q.title}</p>
                      <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{q.marks} Marks</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Code Viewer & AI Analysis Panel */}
        <div className="md:col-span-3 flex flex-col gap-6">
          
          {/* Stats Bar */}
          {aiScore && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-zinc-950 border-zinc-900">
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Question Score</span>
                  <span className="text-xl font-black text-white mt-1">{aiScore.score} / {activeQ?.marks || 10}</span>
                </CardContent>
              </Card>

              <Card className="bg-zinc-950 border-zinc-900">
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Readability Quality</span>
                  <span className="text-xl font-black text-violet-400 mt-1">{aiScore.ai_evaluation?.readabilityScore || 0}%</span>
                </CardContent>
              </Card>

              <Card className="bg-zinc-950 border-zinc-900">
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Logic correctness</span>
                  <Badge className={cn(
                    "mt-2 text-[9px] font-extrabold uppercase",
                    aiScore.ai_evaluation?.isLogicalCorrect 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}>
                    {aiScore.ai_evaluation?.isLogicalCorrect ? "Passed" : "Failed"}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Interactive tabs */}
          <Card className="bg-zinc-950 border-zinc-900 flex-1 flex flex-col shadow-xl">
            <Tabs defaultValue="code" className="flex-1 flex flex-col h-full">
              <CardHeader className="pb-0 border-b border-zinc-900 bg-zinc-900/10 shrink-0">
                <div className="flex justify-between items-center pb-3 flex-wrap gap-3">
                  <TabsList className="bg-transparent border-0 gap-3 p-0 h-auto">
                    <TabsTrigger value="code" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white font-bold text-xs text-zinc-500 px-3.5 py-1.5 rounded transition border-0">
                      <FileCode2 className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
                      Candidate Code
                    </TabsTrigger>
                    <TabsTrigger value="testcases" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white font-bold text-xs text-zinc-500 px-3.5 py-1.5 rounded transition border-0">
                      <Terminal className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
                      Execution Logs ({testcaseResults.length})
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white font-bold text-xs text-zinc-500 px-3.5 py-1.5 rounded transition border-0">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-violet-400 animate-pulse" />
                      AI Analysis Report
                    </TabsTrigger>
                  </TabsList>
                  
                  {activeQ && (
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-zinc-400 border-zinc-800 bg-zinc-900/20 font-mono px-2 py-0.5">
                      Language: {answerLang}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-0 overflow-hidden flex flex-col bg-zinc-950/20">
                
                {/* Code Tab */}
                <TabsContent value="code" className="mt-0 flex-1 h-[400px]">
                  {answerCode ? (
                    <CodeEditor
                      value={answerCode}
                      language={answerLang}
                      onChange={() => {}}
                      readOnly={true}
                      fontSize={13}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-650 text-xs">
                      <FileCode2 className="w-6 h-6 mb-2" />
                      <span>The candidate has not submitted code for this challenge yet.</span>
                    </div>
                  )}
                </TabsContent>

                {/* Test Cases Tab */}
                <TabsContent value="testcases" className="mt-0 flex-1 p-6 overflow-y-auto custom-scrollbar">
                  {testcaseResults.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-650 text-xs min-h-[300px]">
                      <Terminal className="w-6 h-6 mb-2" />
                      <span>No test case execution runs recorded.</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {testcaseResults.map((res, idx) => (
                        <div key={res.id} className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-200">Test Case {idx + 1}</span>
                              <Badge className={cn(
                                "text-[9px] px-1.5 py-0.2 font-semibold",
                                res.testcase?.is_hidden 
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                                  : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              )}>
                                {res.testcase?.is_hidden ? "Hidden" : "Visible"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-zinc-550">{res.execution_time_ms} ms</span>
                              <Badge className={cn(
                                "text-[9px] font-extrabold uppercase",
                                res.passed 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {res.runtime_status}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid gap-2 text-xs font-mono">
                            <div className="grid gap-1">
                              <span className="text-zinc-500 text-[10px] font-bold">Input Parameter</span>
                              <pre className="bg-stone-950 p-2.5 rounded text-zinc-300 font-mono text-[10px] border border-zinc-900 overflow-x-auto">{res.testcase?.input}</pre>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-zinc-500 text-[10px] font-bold">Expected Output</span>
                              <pre className="bg-stone-950 p-2.5 rounded text-zinc-300 font-mono text-[10px] border border-zinc-900 overflow-x-auto">{res.testcase?.expected_output}</pre>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-zinc-500 text-[10px] font-bold">Candidate stdout</span>
                              <pre className={cn(
                                "p-2.5 rounded font-mono text-[10px] border overflow-x-auto whitespace-pre-wrap",
                                res.passed 
                                  ? "bg-stone-950 text-emerald-400 border-zinc-900" 
                                  : "bg-red-950/5 text-red-400 border-red-950/20"
                              )}>
                                {res.stdout || res.stderr || "No output recorded"}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* AI Review Tab */}
                <TabsContent value="ai" className="mt-0 flex-1 p-6 overflow-y-auto custom-scrollbar">
                  {aiScore?.ai_evaluation ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl space-y-1.5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Big-O Complexity analysis</span>
                          <p className="text-zinc-300 font-mono text-xs">Time Complexity: <span className="text-violet-400 font-bold">{aiScore.ai_evaluation.timeComplexity}</span></p>
                          <p className="text-zinc-300 font-mono text-xs mt-1">Space Complexity: <span className="text-violet-400 font-bold">{aiScore.ai_evaluation.spaceComplexity}</span></p>
                        </div>
                        <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl space-y-1.5 flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Optimality Check</span>
                          <Badge className={cn(
                            "w-fit text-[9px] font-extrabold uppercase px-2.5 py-0.5 mt-1",
                            aiScore.ai_evaluation.isOptimal 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          )}>
                            {aiScore.ai_evaluation.isOptimal ? "Optimal implementation" : "Sub-optimal implementation"}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Logic & Correctness analysis</h4>
                        <p className="text-zinc-300 text-xs leading-relaxed leading-6 bg-zinc-900/10 p-4 rounded-xl border border-zinc-900">{aiScore.ai_evaluation.logicalCorrectness}</p>
                      </div>

                      <div className="space-y-2 border-t border-zinc-900 pt-5">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-violet-400" />
                          Detailed Code Review & Recommendations
                        </h4>
                        <p className="text-zinc-350 text-xs leading-relaxed leading-6 font-sans">{aiScore.ai_evaluation.feedback}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-650 text-xs min-h-[300px]">
                      <Sparkles className="w-6 h-6 mb-2" />
                      <span>AI report is not available for this question.</span>
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
