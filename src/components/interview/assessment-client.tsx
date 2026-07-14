"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { CodeEditor } from "./code-editor";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Terminal, 
  FileCode2, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Loader2,
  Clock,
  ArrowRight,
  Maximize2,
  Minimize2,
  FolderKanban,
  CheckCircle2,
  Send,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./markdown-renderer";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";

interface AssessmentClientProps {
  roomId: string;
  templateId: string;
  isInterviewer?: boolean;
}

export function AssessmentClient({ roomId, templateId, isInterviewer = false }: AssessmentClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQIdx, setActiveQIdx] = useState(0);

  // Editor states
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consoleTab, setConsoleTab] = useState("results");
  const [executionResults, setExecutionResults] = useState<any[]>([]);
  const [submitSummary, setSubmitSummary] = useState<any>(null);

  // Attempt timing
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // 1. Initialize assessment session
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch template
        const { data: temp, error: tempErr } = await supabase
          .from("assessment_templates")
          .select("*")
          .eq("id", templateId)
          .single();

        if (tempErr || !temp) throw new Error("Assessment template not found");
        setTemplate(temp);

        // Fetch questions
        const { data: quest, error: questErr } = await supabase
          .from("assessment_questions")
          .select(`
            *,
            question_testcases(*)
          `)
          .eq("template_id", templateId)
          .order("order_index", { ascending: true });

        if (questErr || !quest) throw new Error("Failed to load assessment questions");
        setQuestions(quest);

        // Fetch interview details to get the assigned candidate
        const { data: interview, error: intErr } = await supabase
          .from("interviews")
          .select("*")
          .eq("id", roomId)
          .single();

        if (intErr || !interview) throw new Error("Interview not found");
        const candidateId = interview.candidate_id;

        // Fetch or create attempt for the assigned candidate
        let { data: att, error: attErr } = await supabase
          .from("assessment_attempts")
          .select("*")
          .eq("interview_id", roomId)
          .eq("candidate_id", candidateId)
          .maybeSingle();

        if (attErr) throw attErr;

        if (!att) {
          if (isInterviewer) {
            // Proctor joins before candidate has started - do not create attempt
            setAttempt(null);
            if (quest.length > 0) {
              const defaultLang = quest[0].expected_language || "javascript";
              setLanguage(defaultLang);
              setCode(quest[0].starter_code?.[defaultLang] || `// Write your code here\n`);
            }
            setLoading(false);
            return;
          } else {
            // Candidate joins - create attempt
            const { data: newAtt, error: newAttErr } = await supabase
              .from("assessment_attempts")
              .insert({
                interview_id: roomId,
                candidate_id: candidateId,
                template_id: templateId,
                status: "in_progress"
              })
              .select()
              .single();

            if (newAttErr) throw newAttErr;
            att = newAtt;
          }
        }

        if (att.status === "completed" && !isInterviewer) {
          toast.success("You have already completed this assessment!");
          router.push("/dashboard/candidate");
          return;
        }

        setAttempt(att);

        // Calculate time left (e.g. 60 mins duration)
        const durationMs = 60 * 60 * 1000; // default 60 minutes
        const elapsedMs = Date.now() - new Date(att.started_at).getTime();
        const remaining = Math.max(0, durationMs - elapsedMs);
        setTimeLeft(Math.floor(remaining / 1000));

        // Load candidate's saved answer or starter code for first question
        await loadSavedAnswer(quest[0], att.id);

      } catch (err: any) {
        console.error("Session initialization failed:", err);
        if (err && typeof err === 'object') {
          console.error("Error details:", {
            message: err.message || err.messageText,
            code: err.code,
            details: err.details,
            hint: err.hint,
            stack: err.stack,
            ...err
          });
        }
        toast.error(err.message || "Initialization failed.");
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [roomId, templateId, isInterviewer]);

  // Timer Countdown loop
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!isInterviewer) {
        handleAutoSubmitAssessment();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isInterviewer]);

  // 2. Load candidate's draft answer for the active question
  const loadSavedAnswer = async (q: any, attId: string) => {
    if (!q || !attId) return;

    try {
      const { data: answer, error } = await supabase
        .from("candidate_answers")
        .select("*")
        .eq("attempt_id", attId)
        .eq("question_id", q.id)
        .maybeSingle();

      const defaultLang = q.expected_language || "javascript";
      
      if (answer) {
        setLanguage(answer.language);
        setCode(answer.code);
      } else {
        setLanguage(defaultLang);
        setCode(q.starter_code?.[defaultLang] || `// Write your code here\n`);
      }
      setExecutionResults([]);
      setSubmitSummary(null);
    } catch (e) {
      console.error(e);
    }
  };

  // 3. Auto-save draft on code changes
  const saveDraft = async (currentCode: string, currentLang: string) => {
    if (!attempt || !questions[activeQIdx]) return;
    const q = questions[activeQIdx];

    try {
      await supabase
        .from("candidate_answers")
        .upsert({
          attempt_id: attempt.id,
          question_id: q.id,
          code: currentCode,
          language: currentLang,
          status: "in_progress",
          updated_at: new Date().toISOString()
        }, {
          onConflict: "attempt_id,question_id"
        });

      // Update question status in local state
      setQuestions(prev => {
        const updated = [...prev];
        if (updated[activeQIdx].status !== "solved") {
          updated[activeQIdx].status = "in_progress";
        }
        return updated;
      });
    } catch (e) {
      console.error("Draft save failed:", e);
    }
  };

  const handleCodeChange = (newCode: string | undefined) => {
    const val = newCode || "";
    setCode(val);
    saveDraft(val, language);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    const starter = questions[activeQIdx]?.starter_code?.[newLang] || `// Write your code here\n`;
    setCode(starter);
    saveDraft(starter, newLang);
  };

  // Switch to another question
  const handleQuestionSelect = async (idx: number) => {
    if (idx === activeQIdx) return;
    setActiveQIdx(idx);
    if (attempt) {
      await loadSavedAnswer(questions[idx], attempt.id);
    } else {
      const q = questions[idx];
      const defaultLang = q.expected_language || "javascript";
      setLanguage(defaultLang);
      setCode(q.starter_code?.[defaultLang] || `// Write your code here\n`);
    }
  };

  // 4. Run Code against visible test cases
  const handleRunCode = async () => {
    if (isExecuting || !code.trim()) return;
    setIsExecuting(true);
    setConsoleTab("results");
    setExecutionResults([]);
    setSubmitSummary(null);

    const q = questions[activeQIdx];

    try {
      const response = await fetch("/api/assessments/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          code,
          language,
          runAll: false
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to execute code");
      }

      setExecutionResults(data.results || []);
      toast.success("Execution completed!");
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred during execution.");
    } finally {
      setIsExecuting(false);
    }
  };

  // 5. Submit Code for final evaluation (visible + hidden)
  const handleSubmitCode = async () => {
    if (isSubmitting || !code.trim()) return;
    setIsSubmitting(true);
    setConsoleTab("results");
    setExecutionResults([]);
    setSubmitSummary(null);

    const q = questions[activeQIdx];

    try {
      const response = await fetch("/api/assessments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          questionId: q.id,
          code,
          language
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Submission failed");
      }

      setSubmitSummary(data);
      
      // Update local question solved status
      setQuestions(prev => {
        const updated = [...prev];
        updated[activeQIdx].status = data.status; // 'solved' or 'submitted'
        return updated;
      });

      if (data.status === "solved") {
        toast.success("Challenge Solved! All test cases passed!");
      } else {
        toast.warning("Answer submitted, but some test cases failed.");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Complete Assessment Attempt
  const handleFinishAssessment = async () => {
    if (!confirm("Are you sure you want to finish the assessment? You won't be able to edit your solutions after this.")) return;
    
    try {
      const { error } = await supabase
        .from("assessment_attempts")
        .update({
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", attempt.id);

      if (error) throw error;

      // Update interview session status
      await supabase
        .from("interviews")
        .update({
          status: "completed",
          session_status: "submitted",
          actual_ended_at: new Date().toISOString()
        })
        .eq("id", roomId);

      toast.success("Assessment submitted successfully! Thank you.");
      router.push("/dashboard/candidate");
    } catch (e: any) {
      toast.error("Failed to complete attempt: " + e.message);
    }
  };

  const handleAutoSubmitAssessment = async () => {
    toast.error("Time is up! Your assessment will be automatically submitted.");
    try {
      await supabase
        .from("assessment_attempts")
        .update({
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", attempt?.id);

      await supabase
        .from("interviews")
        .update({
          status: "completed",
          session_status: "submitted",
          actual_ended_at: new Date().toISOString()
        })
        .eq("id", roomId);

      router.push("/dashboard/candidate?status=completed");
    } catch (e) {
      router.push("/dashboard/candidate");
    }
  };

  // Helper formatting for timer
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-zinc-950 items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
        <p className="text-zinc-500 text-sm font-medium">Setting up your secure coding environment...</p>
      </div>
    );
  }

  const activeQ = questions[activeQIdx];

  return (
    <div className={cn(
      "flex flex-col bg-zinc-950 text-zinc-200 border-l border-zinc-900 select-none",
      isFullscreen ? "fixed inset-0 z-50 animate-fade-in" : "h-screen w-screen overflow-hidden"
    )}>
      {/* Top Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <FolderKanban className="w-5 h-5 text-violet-500" />
          <h1 className="text-sm font-extrabold text-white tracking-wide">{template?.title || "Technical Assessment"}</h1>
          {isInterviewer ? (
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 animate-pulse">
              Proctor Mode
            </Badge>
          ) : (
            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700/50 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
              Progressive coding
            </Badge>
          )}
        </div>

        {/* Timer & Finish controls */}
        <div className="flex items-center gap-4">
          {attempt === null && isInterviewer ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 text-xs font-bold font-mono tracking-wider animate-pulse">
              <AlertCircle className="w-4 h-4" />
              <span>Candidate Offline</span>
            </div>
          ) : (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold tracking-wider transition-colors",
              timeLeft !== null && timeLeft < 300 
                ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse" 
                : "bg-zinc-900/50 border-zinc-800/80 text-zinc-300"
            )}>
              <Clock className="w-4 h-4 text-violet-400" />
              <span>{timeLeft !== null ? formatTime(timeLeft) : "00:00"}</span>
            </div>
          )}

          {!isInterviewer && (
            <Button
              onClick={handleFinishAssessment}
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs h-9 cursor-pointer flex items-center gap-1 px-4 shadow-lg shadow-violet-600/20 transition-all active:scale-95"
            >
              Finish Assessment
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          
          {/* Sidebar Question Navigator */}
          <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-zinc-950 border-r border-zinc-900 flex flex-col p-4 space-y-4 shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase select-none">Assessment challenges</span>
            
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
              {questions.map((q, idx) => {
                const isSelected = idx === activeQIdx;
                const isSolved = q.status === "solved";
                const isSubmitted = q.status === "submitted";
                const isStarted = q.status === "in_progress";

                return (
                  <button
                    key={q.id}
                    onClick={() => handleQuestionSelect(idx)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all duration-300 flex items-start gap-2.5 relative group cursor-pointer",
                      isSelected
                        ? "bg-violet-600/10 border-violet-500 text-violet-400 shadow-[0_0_20px_rgba(109,40,217,0.05)]"
                        : "bg-zinc-900/20 border-zinc-900/60 text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
                    )}
                  >
                    <span className={cn(
                      "text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      isSelected ? "bg-violet-500/20 text-violet-400" : "bg-zinc-800 text-zinc-500"
                    )}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold tracking-tight">{q.title}</p>
                      <p className="text-[9px] text-zinc-500 font-medium mt-0.5 flex items-center gap-1.5 font-mono">
                        <span>{q.marks} Marks</span>
                        <span className="opacity-40">•</span>
                        <span className={cn(
                          isSolved && "text-emerald-400 font-bold",
                          isSubmitted && "text-blue-400 font-bold",
                          isStarted && "text-amber-500 font-bold",
                          !isSolved && !isSubmitted && !isStarted && "text-zinc-650"
                        )}>
                          {isSolved ? "Solved" : isSubmitted ? "Submitted" : isStarted ? "In Progress" : "Not Started"}
                        </span>
                      </p>
                    </div>

                    {isSolved && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-zinc-900 w-1" />

          {/* Left panel: Problem Details */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <div className="h-full flex flex-col bg-zinc-950">
              <header className="h-10 shrink-0 border-b border-zinc-900 bg-zinc-900/10 px-6 flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Problem Statement</span>
                {activeQ && (
                  <Badge variant="outline" className={cn(
                    "text-[9px] uppercase font-black px-2 py-0.5",
                    activeQ.difficulty === "Easy" ? "text-green-400 bg-green-500/5 border-green-500/10" :
                    activeQ.difficulty === "Medium" ? "text-yellow-400 bg-yellow-500/5 border-yellow-500/10" :
                    "text-red-400 bg-red-500/5 border-red-500/10"
                  )}>
                    {activeQ.difficulty}
                  </Badge>
                )}
              </header>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 select-text text-left">
                {activeQ ? (
                  <>
                    <div className="space-y-3">
                      <h2 className="text-xl font-bold text-white">{activeQ.title}</h2>
                      <MarkdownRenderer content={activeQ.description} />
                    </div>

                    {activeQ.constraints && activeQ.constraints.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-zinc-900">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Constraints</h4>
                        <ul className="list-disc list-inside text-xs font-mono text-zinc-400 bg-zinc-900/30 p-3 rounded-lg border border-zinc-900 space-y-1">
                          {activeQ.constraints.map((c: string, idx: number) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeQ.examples && activeQ.examples.length > 0 && (
                      <div className="space-y-4 pt-3 border-t border-zinc-900">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Examples</h4>
                        {activeQ.examples.map((ex: any, idx: number) => (
                          <div key={idx} className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-xl space-y-2 font-mono text-xs select-text">
                            <span className="text-[10px] font-black text-violet-400 uppercase select-none">Example {idx + 1}</span>
                            <div className="flex gap-2">
                              <span className="text-zinc-500 font-bold">Input:</span>
                              <span className="text-zinc-200">{ex.input}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-zinc-500 font-bold">Output:</span>
                              <span className="text-emerald-400">{ex.output}</span>
                            </div>
                            {ex.explanation && (
                              <div className="text-zinc-500 mt-1 pt-1.5 border-t border-zinc-900/50">
                                <span className="font-bold mr-1">Explanation:</span>
                                <span>{ex.explanation}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-650" />
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-zinc-900 w-1" />

          {/* Right panel: Editor & Console */}
          <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
            <ResizablePanelGroup orientation="vertical">
              
              {/* Monaco Editor Panel */}
              <ResizablePanel defaultSize={60} minSize={40} className="flex flex-col bg-zinc-950 relative">
                <header className="h-10 shrink-0 border-b border-zinc-900 bg-zinc-900/10 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <select
                      value={language}
                      onChange={handleLanguageChange}
                      className="bg-zinc-900 hover:bg-zinc-850 text-xs font-semibold text-zinc-300 border border-zinc-850 rounded px-2.5 py-1 outline-none transition cursor-pointer"
                    >
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.id} value={lang.id}>{lang.name}</option>
                      ))}
                    </select>

                    <div className="flex items-center bg-zinc-900 border border-zinc-850 rounded px-1.5 py-0.5">
                      <button
                        onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                        className="text-[10px] font-bold text-zinc-500 hover:text-white px-1.5 cursor-pointer"
                      >
                        A-
                      </button>
                      <span className="text-[10px] font-mono text-zinc-400 font-semibold min-w-[20px] text-center">{fontSize}</span>
                      <button
                        onClick={() => setFontSize(Math.min(20, fontSize + 1))}
                        className="text-[10px] font-bold text-zinc-500 hover:text-white px-1.5 cursor-pointer"
                      >
                        A+
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900/60 border border-zinc-850/60 rounded hover:bg-zinc-800 transition cursor-pointer"
                    >
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </header>

                <div className="flex-1 overflow-hidden bg-zinc-950">
                  {activeQ && (
                    <CodeEditor
                      value={code}
                      language={language}
                      onChange={handleCodeChange}
                      fontSize={fontSize}
                      minimap={false}
                      readOnly={isInterviewer}
                    />
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle className="bg-zinc-900 h-1" />

              {/* Interactive Console Panel */}
              <ResizablePanel defaultSize={40} minSize={20} className="flex flex-col bg-zinc-950">
                <Tabs value={consoleTab} onValueChange={setConsoleTab} className="h-full flex flex-col">
                  <header className="h-10 shrink-0 border-b border-zinc-900 bg-zinc-900/20 px-4 flex items-center justify-between">
                    <TabsList className="bg-transparent border-0 gap-2 p-0 h-auto">
                      <TabsTrigger 
                        value="results" 
                        className="data-[state=active]:bg-zinc-900/80 data-[state=active]:text-white font-bold text-xs text-zinc-500 px-3 py-1 rounded border-0 transition"
                      >
                        <Terminal className="w-3.5 h-3.5 mr-1 text-violet-400" />
                        Test Console
                      </TabsTrigger>
                      <TabsTrigger 
                        value="aiFeedback" 
                        className="data-[state=active]:bg-zinc-900/80 data-[state=active]:text-white font-bold text-xs text-zinc-500 px-3 py-1 rounded border-0 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1 text-violet-400 animate-pulse" />
                        AI Feedback Summary
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2">
                      {isInterviewer ? (
                        <Badge className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-wider px-3 py-1">
                          Read Only View
                        </Badge>
                      ) : (
                        <>
                          <Button
                            onClick={handleRunCode}
                            disabled={isExecuting || isSubmitting}
                            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-350 font-bold text-xs h-8 px-3.5 cursor-pointer flex items-center gap-1"
                          >
                            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-zinc-400" />}
                            Run Code
                          </Button>

                          <Button
                            onClick={handleSubmitCode}
                            disabled={isExecuting || isSubmitting}
                            className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs h-8 px-4 cursor-pointer flex items-center gap-1 shadow-md shadow-violet-600/10"
                          >
                            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Submit Solution
                          </Button>
                        </>
                      )}
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-zinc-950/40">
                    <TabsContent value="results" className="mt-0 h-full">
                      {executionResults.length === 0 && !submitSummary && (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-650 text-xs">
                          <Terminal className="w-6 h-6 mb-2" />
                          <span>Console is empty. Run or Submit your solution to execute test cases.</span>
                        </div>
                      )}

                      {/* Display execution results */}
                      {executionResults.length > 0 && (
                        <div className="space-y-4 text-left">
                          <div className="flex gap-2">
                            <span className="text-xs font-bold text-zinc-400">Execution Summary:</span>
                            <Badge className={cn(
                              executionResults.every(r => r.passed) 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            )}>
                              {executionResults.filter(r => r.passed).length} / {executionResults.length} Cases Passed
                            </Badge>
                          </div>

                          <div className="grid gap-3">
                            {executionResults.map((res, idx) => (
                              <div key={res.id} className="bg-zinc-900/50 border border-zinc-900 rounded-xl p-3.5 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-zinc-300">Case {idx + 1}</span>
                                  <Badge variant="outline" className={cn(
                                    "text-[9px] font-bold px-2 py-0.5",
                                    res.passed 
                                      ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" 
                                      : "text-red-400 border-red-500/20 bg-red-500/5"
                                  )}>
                                    {res.runtime_status}
                                  </Badge>
                                </div>

                                {res.stderr ? (
                                  <pre className="bg-red-950/10 border border-red-900/20 text-red-400 p-2.5 rounded font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">{res.stderr}</pre>
                                ) : (
                                  <div className="grid gap-1 text-[11px] font-mono">
                                    <div className="flex gap-2">
                                      <span className="text-zinc-500">Input:</span>
                                      <span className="text-zinc-300">{res.input}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="text-zinc-500">Expected:</span>
                                      <span className="text-zinc-400">{res.expected_output}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="text-zinc-500">Output:</span>
                                      <span className={cn(res.passed ? "text-emerald-400" : "text-red-400")}>{res.stdout}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display submission results (both visible and hidden cases) */}
                      {submitSummary && (
                        <div className="space-y-4 text-left">
                          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                            <div>
                              <p className="text-xs font-bold text-zinc-400">Code Submission Status</p>
                              <p className="text-[10px] text-zinc-650 mt-0.5">Includes hidden test cases and AI logic check</p>
                            </div>
                            <Badge className={cn(
                              "text-xs uppercase font-extrabold px-3 py-1",
                              submitSummary.status === "solved" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse"
                            )}>
                              {submitSummary.status === "solved" ? "Solved & Completed" : "Submitted"}
                            </Badge>
                          </div>

                          <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex items-center justify-between">
                            <div className="text-xs space-y-1">
                              <p className="text-zinc-400 font-bold">Total Score: <span className="text-white text-sm font-black">{submitSummary.score} Marks</span></p>
                              <p className="text-[10px] text-zinc-500">Pass Rate: {submitSummary.passedCount} / {submitSummary.totalCount} Test Cases</p>
                            </div>
                            {submitSummary.aiEvaluation && (
                              <div className="text-right text-xs">
                                <p className="text-zinc-400 font-bold">Readability Score</p>
                                <p className="text-violet-400 text-sm font-black mt-0.5">{submitSummary.aiEvaluation.readabilityScore}/100</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="aiFeedback" className="mt-0 h-full text-left">
                      {submitSummary?.aiEvaluation ? (
                        <div className="space-y-4 text-xs leading-relaxed animate-fade-in">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-900/30 border border-zinc-900 p-3 rounded-lg">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase">Complexity Analysis</span>
                              <p className="text-zinc-300 font-mono mt-1">Time: {submitSummary.aiEvaluation.timeComplexity}</p>
                              <p className="text-zinc-300 font-mono mt-0.5">Space: {submitSummary.aiEvaluation.spaceComplexity}</p>
                            </div>
                            <div className="bg-zinc-900/30 border border-zinc-900 p-3 rounded-lg flex flex-col justify-center">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase">Optimal Approach</span>
                              <Badge className={cn(
                                "w-fit mt-1 text-[9px] px-2 py-0.5 font-bold",
                                submitSummary.aiEvaluation.isOptimal 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              )}>
                                {submitSummary.aiEvaluation.isOptimal ? "Optimal solution" : "Sub-optimal solution"}
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Technical Logic evaluation</span>
                            <p className="text-zinc-350">{submitSummary.aiEvaluation.logicalCorrectness}</p>
                          </div>

                          <div className="space-y-1.5 border-t border-zinc-900 pt-3">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-violet-400" />
                              AI Recommendations & Review
                            </span>
                            <p className="text-zinc-350 leading-relaxed font-sans">{submitSummary.aiEvaluation.feedback}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-650 text-xs">
                          <AlertCircle className="w-6 h-6 mb-2" />
                          <span>Submit your code to trigger the AI Semantic Review and recommendations.</span>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
