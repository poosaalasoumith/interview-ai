"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from "react";
import { CodeEditor } from "./code-editor";
import { SUPPORTED_LANGUAGES, LANGUAGE_TEMPLATES } from "@/constants/languages";
import { executeCode, ExecutionResult } from "@/services/piston";
import { logSubmission } from "@/services/submissions";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Play, Maximize2, Minimize2, Copy, Check, Settings2, Loader2, RefreshCw, Sparkles, Terminal, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useDataChannel, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { AIAssistantPanel } from "./ai-assistant-panel";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const AIReviewModal = dynamic(
  () => import("./ai-review-modal").then((mod) => mod.AIReviewModal),
  { ssr: false }
);

interface CodingEnvironmentProps {
  interviewId: string;
  problemStatement?: any;
  isInterviewer?: boolean;
  isLocked?: boolean;
  interviewMode?: string;

  // Custom assessment props
  assessmentTemplateId?: string | null;
  questions?: any[];
  activeQIdx?: number;
  onQuestionSelect?: (index: number) => void;
  attempt?: any;
  onCodeSubmitted?: (questionId: string, status: string) => void;
}

export function CodingEnvironment({ 
  interviewId, 
  problemStatement,
  isInterviewer = false,
  isLocked = false,
  interviewMode = "assessment",
  assessmentTemplateId = null,
  questions = [],
  activeQIdx = 0,
  onQuestionSelect,
  attempt,
  onCodeSubmitted
}: CodingEnvironmentProps) {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(LANGUAGE_TEMPLATES["javascript"]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState<ExecutionResult | null>(null);

  // Custom assessment execution states
  const [executionResults, setExecutionResults] = useState<any[]>([]);
  const [submitSummary, setSubmitSummary] = useState<any>(null);
  const [consoleTab, setConsoleTab] = useState("results");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasRunEvaluation, setHasRunEvaluation] = useState(false);
  const [anyCompileError, setAnyCompileError] = useState(false);
  const { localParticipant } = useLocalParticipant();

  const [fontSize, setFontSize] = useState(14);
  const [minimap, setMinimap] = useState(false);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);
  const [defaultLayout, setDefaultLayout] = useState<number[]>([70, 30]);
  const consolePanelRef = useRef<any>(null);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [assistantWidth, setAssistantWidth] = useState(380);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync window resizes when assistant mode changes (to trigger Monaco layout adjustments)
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("resize"));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isAssistantOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = containerRect.right - e.clientX;
    const constrainedWidth = Math.max(340, Math.min(500, newWidth));
    setAssistantWidth(constrainedWidth);
    
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("resize"));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const isAssessmentMode = interviewMode === "assessment";

  // LiveKit Data Channel for Code Sync
  const room = useRoomContext();
  const { send } = useDataChannel("code-sync", (msg) => {
    const payload = new TextDecoder().decode(msg.payload);
    try {
      const data = JSON.parse(payload);
      if (data.type === "CODE_UPDATE") {
        setCode(data.code);
        if (data.language) {
          setLanguage((prev) => prev !== data.language ? data.language : prev);
        }
      } else if (data.type === "EXECUTION_UPDATE") {
        setOutput(data.output);
      } else if (data.type === "QUESTION_SWITCH") {
        if (data.activeQIdx !== undefined && data.activeQIdx !== activeQIdx && onQuestionSelect) {
          onQuestionSelect(data.activeQIdx);
        }
      } else if (data.type === "QUESTION_STATUS_UPDATE") {
        if (onCodeSubmitted) {
          onCodeSubmitted(data.questionId, data.status);
        }
      } else if (data.type === "EXECUTION_RESULTS_UPDATE") {
        setExecutionResults(data.results);
        setConsoleTab("results");
      } else if (data.type === "SUBMIT_SUMMARY_UPDATE") {
        setSubmitSummary(data.summary);
        setConsoleTab("results");
      }
    } catch (e) {
      console.error("Failed to parse data channel message:", e);
    }
  });

  const safeSend = useCallback((data: Uint8Array, options?: any) => {
    if (room && room.state === "connected" && send) {
      send(data, options).catch((err) => {
        console.warn("[Data Channel] Failed to publish message safely:", err);
      });
    }
  }, [room, send]);

  // Load preferences and draft from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const draft = localStorage.getItem(`draft_${interviewId}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setCode(parsed.code);
        setLanguage(parsed.language);
      } catch (e) {}
    }

    const savedFontSize = localStorage.getItem(`fontSize_${interviewId}`);
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize, 10));
    }

    const savedMinimap = localStorage.getItem(`minimap_${interviewId}`);
    if (savedMinimap) {
      setMinimap(savedMinimap === "true");
    }

    const savedLayout = localStorage.getItem(`layout_${interviewId}`);
    if (savedLayout) {
      try {
        setDefaultLayout(JSON.parse(savedLayout));
      } catch (e) {}
    }

    const savedConsoleCollapsed = localStorage.getItem(`consoleCollapsed_${interviewId}`);
    if (savedConsoleCollapsed) {
      setIsConsoleCollapsed(savedConsoleCollapsed === "true");
    }
  }, [interviewId]);

  // Programmatically apply console collapse state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (consolePanelRef.current) {
        if (isConsoleCollapsed) {
          consolePanelRef.current.collapse();
        } else {
          consolePanelRef.current.expand();
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isConsoleCollapsed]);

  // Handle Code Change
  const handleCodeChange = useCallback(
    (newCode: string | undefined) => {
      if (isInterviewer || isLocked) return;
      const val = newCode || "";
      setCode(val);
      
      // Save draft
      localStorage.setItem(`draft_${interviewId}`, JSON.stringify({ code: val, language }));

      // Broadcast change
      const payload = JSON.stringify({ type: "CODE_UPDATE", code: val, language });
      safeSend(new TextEncoder().encode(payload), { reliable: true });
    },
    [interviewId, language, safeSend, isInterviewer, isLocked]
  );

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isInterviewer || isLocked) return;
    const newLang = e.target.value;
    setLanguage(newLang);
    const newCode = LANGUAGE_TEMPLATES[newLang];
    setCode(newCode);
    
    // Broadcast change
    const payload = JSON.stringify({ type: "CODE_UPDATE", code: newCode, language: newLang });
    safeSend(new TextEncoder().encode(payload), { reliable: true });
  };

  // Custom Assessment: Load saved answer when activeQIdx or attempt changes
  useEffect(() => {
    if (!questions || questions.length === 0 || !assessmentTemplateId) return;

    const loadSavedAnswer = async () => {
      const q = questions[activeQIdx];
      if (!q) return;

      const supabase = createClient();
      let attId = attempt?.id;

      if (!attId) {
        try {
          const { data: interview } = await supabase
            .from("interviews")
            .select("candidate_id")
            .eq("id", interviewId)
            .single();

          if (interview) {
            const { data: att } = await supabase
              .from("assessment_attempts")
              .select("id")
              .eq("interview_id", interviewId)
              .eq("candidate_id", interview.candidate_id)
              .maybeSingle();
            
            if (att) {
              attId = att.id;
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (!attId) {
        const defaultLang = q.expected_language || "javascript";
        setLanguage(defaultLang);
        setCode(q.starter_code?.[defaultLang] || `// Write your code here\n`);
        return;
      }

      try {
        const { data: answer } = await supabase
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

        setOutput(null);
        setExecutionResults([]);
        setSubmitSummary(null);
        setHasRunEvaluation(false);
        setAnyCompileError(false);

        const { data: ansRec } = await supabase
          .from("candidate_answers")
          .select("id, status")
          .eq("attempt_id", attId)
          .eq("question_id", q.id)
          .maybeSingle();

        if (ansRec) {
          const { data: execs } = await supabase
            .from("execution_results")
            .select(`
              *,
              question_testcases!inner(*)
            `)
            .eq("candidate_answer_id", ansRec.id);

          if (execs) {
            setExecutionResults(execs.map(e => ({
              id: e.testcase_id,
              passed: e.passed,
              runtime_status: e.runtime_status,
              stdout: e.stdout,
              stderr: e.stderr,
              input: e.question_testcases.input,
              expected_output: e.question_testcases.expected_output,
              explanation: e.question_testcases.explanation,
              is_hidden: e.question_testcases.is_hidden,
              execution_time_ms: e.execution_time_ms
            })));
          }

          const { data: scoreRec } = await supabase
            .from("assessment_scores")
            .select("*")
            .eq("attempt_id", attId)
            .eq("question_id", q.id)
            .maybeSingle();

          if (scoreRec) {
            setSubmitSummary({
              status: ansRec.status,
              score: scoreRec.score,
              passedCount: execs?.filter(e => e.passed).length || 0,
              totalCount: execs?.length || 0,
              aiEvaluation: scoreRec.ai_evaluation
            });
          }
        }
      } catch (e) {
        console.error("Failed to load saved answer:", e);
      }
    };

    loadSavedAnswer();
  }, [activeQIdx, attempt?.id, questions, interviewId, assessmentTemplateId]);

  // Debounced auto-save draft to Supabase candidate_answers table
  useEffect(() => {
    if (isInterviewer || isLocked || !assessmentTemplateId || !attempt || !questions || questions.length === 0) return;

    const q = questions[activeQIdx];
    if (!q) return;

    const timer = setTimeout(async () => {
      const supabase = createClient();
      try {
        await supabase
          .from("candidate_answers")
          .upsert({
            attempt_id: attempt.id,
            question_id: q.id,
            code: code,
            language: language,
            status: q.status === "not_started" ? "in_progress" : q.status,
            updated_at: new Date().toISOString()
          }, {
            onConflict: "attempt_id,question_id"
          });
      } catch (e) {
        console.error("Failed to auto-save code to Supabase:", e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [code, language, activeQIdx, attempt?.id, questions, isInterviewer, isLocked, assessmentTemplateId]);

  // Broadcast question switches
  useEffect(() => {
    if (assessmentTemplateId && questions && questions.length > 0) {
      const payload = JSON.stringify({ type: "QUESTION_SWITCH", activeQIdx });
      safeSend(new TextEncoder().encode(payload), { reliable: true });
    }
  }, [activeQIdx, questions, safeSend, assessmentTemplateId]);

  const handleRunCodeCustom = async () => {
    if (isExecuting || !code.trim() || !questions || questions.length === 0) return;
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

      const results = data.results || [];
      setExecutionResults(results);
      toast.success("Execution completed!");

      // Broadcast execution results to peer
      const payload = JSON.stringify({ type: "EXECUTION_RESULTS_UPDATE", results });
      safeSend(new TextEncoder().encode(payload), { reliable: true });
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred during execution.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSubmitCodeCustom = async () => {
    if (isSubmitting || !code.trim() || !questions || questions.length === 0 || !attempt) return;
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

      if (onCodeSubmitted) {
        onCodeSubmitted(q.id, data.status);
      }

      if (data.status === "solved") {
        toast.success("Challenge Solved! All test cases passed!");
      } else {
        toast.warning("Answer submitted, but some test cases failed.");
      }

      // Broadcast submit summary and status to peer
      const summaryPayload = JSON.stringify({ type: "SUBMIT_SUMMARY_UPDATE", summary: data });
      safeSend(new TextEncoder().encode(summaryPayload), { reliable: true });

      const statusPayload = JSON.stringify({ type: "QUESTION_STATUS_UPDATE", questionId: q.id, status: data.status });
      safeSend(new TextEncoder().encode(statusPayload), { reliable: true });
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunAllTestCases = async () => {
    if (isExecuting || !code.trim() || !questions || questions.length === 0) return;
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
          runAll: true
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to execute test cases");
      }

      const results = data.results || [];
      setExecutionResults(results);
      setHasRunEvaluation(true);
      const hasErrors = results.some((r: any) => r.runtime_status === "Compilation Error");
      setAnyCompileError(hasErrors);
      
      toast.success("All test cases executed!");

      // Broadcast execution results to peer
      const payload = JSON.stringify({ type: "EXECUTION_RESULTS_UPDATE", results });
      safeSend(new TextEncoder().encode(payload), { reliable: true });
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred during execution.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunCode = async () => {
    if (assessmentTemplateId) {
      await handleRunCodeCustom();
      return;
    }

    if (!code.trim() || isInterviewer || isLocked) return;
    setIsExecuting(true);
    setOutput(null);

    try {
      const result = await executeCode(language, code);
      const executionData = result.run || result.compile;
      if (executionData) {
        setOutput(executionData);
        
        // Log to Supabase
        await logSubmission({
          interview_id: interviewId,
          code,
          language,
          output: executionData.output,
          status: executionData.code === 0 ? "success" : "error",
          execution_time: parseFloat(executionData.time || "0"),
        });

        // Broadcast Execution output
        const payload = JSON.stringify({ type: "EXECUTION_UPDATE", output: executionData });
        safeSend(new TextEncoder().encode(payload), { reliable: true });
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyOutput = () => {
    if (output) {
      navigator.clipboard.writeText(output.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Output copied to clipboard");
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-950 items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-primary animate-spin" />
        </div>
        <p className="text-xs text-zinc-500 font-medium">Loading editor environment...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-zinc-950 border-l border-zinc-800 ${isFullscreen ? "fixed inset-0 z-50 animate-fade-in" : "h-full w-full"}`}>
      {/* Editor Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md shrink-0 select-none">
        <div className="flex items-center gap-3">
          <select 
            value={language}
            onChange={handleLanguageChange}
            disabled={isInterviewer || isLocked}
            className="bg-zinc-850 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-700/60 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          <button 
            onClick={() => {
              if (confirm("Reset editor to original template? This will erase your current code drafts.")) {
                setCode(LANGUAGE_TEMPLATES[language]);
                handleCodeChange(LANGUAGE_TEMPLATES[language]);
              }
            }}
            disabled={isInterviewer || isLocked}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-lg border border-transparent hover:border-zinc-700/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset to Template"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* Font Sizer Widget */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800/80 rounded-lg px-1.5 py-0.5">
            <button
              onClick={() => {
                const newSize = Math.max(10, fontSize - 1);
                setFontSize(newSize);
                localStorage.setItem(`fontSize_${interviewId}`, String(newSize));
              }}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition text-[10px] font-bold cursor-pointer h-5 w-5 flex items-center justify-center"
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="text-[10px] font-mono text-zinc-400 px-2 font-semibold min-w-[28px] text-center">{fontSize}px</span>
            <button
              onClick={() => {
                const newSize = Math.min(24, fontSize + 1);
                setFontSize(newSize);
                localStorage.setItem(`fontSize_${interviewId}`, String(newSize));
              }}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition text-[10px] font-bold cursor-pointer h-5 w-5 flex items-center justify-center"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          {/* Minimap toggle widget */}
          <button
            onClick={() => {
              const nextMinimap = !minimap;
              setMinimap(nextMinimap);
              localStorage.setItem(`minimap_${interviewId}`, String(nextMinimap));
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              minimap 
                ? "bg-zinc-800 text-zinc-100 border-zinc-700/80" 
                : "text-zinc-500 border-transparent hover:bg-zinc-850 hover:text-zinc-300"
            }`}
            title="Toggle Editor Minimap"
          >
            Minimap
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          {(isInterviewer || isLocked) && (
            <span className="px-2.5 py-1 bg-zinc-800/80 border border-zinc-700 text-[10px] font-bold tracking-wider text-indigo-400 uppercase rounded-md">
              {isLocked ? "Submission Frozen" : "Viewing Mode (ReadOnly)"}
            </span>
          )}

          {/* Console Toggle Button */}
          <button 
            onClick={() => {
              const nextCollapsed = !isConsoleCollapsed;
              setIsConsoleCollapsed(nextCollapsed);
              localStorage.setItem(`consoleCollapsed_${interviewId}`, String(nextCollapsed));
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              !isConsoleCollapsed 
                ? "bg-zinc-800 text-zinc-200 border-zinc-700" 
                : "text-zinc-400 hover:text-zinc-250 border-transparent hover:bg-zinc-850"
            }`}
            title={isConsoleCollapsed ? "Show Terminal Console" : "Hide Terminal Console"}
          >
            <Terminal className="w-3.5 h-3.5" />
            Console
          </button>

          {/* AI Tools restricted in assessment mode for candidates */}
          {(!isAssessmentMode || isInterviewer) && (
            <>
              <button 
                onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                  isAssistantOpen 
                    ? "bg-primary/20 text-primary border-primary/30" 
                    : "bg-zinc-850 text-zinc-300 hover:text-white border-zinc-700/50 hover:bg-zinc-800"
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAssistantOpen ? "fill-primary/20" : ""}`} />
                Assistant
              </button>

              <button 
                onClick={() => setIsReviewOpen(true)}
                disabled={!code.trim() || isExecuting}
                className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                AI Review
              </button>
            </>
          )}

          <button 
            onClick={handleRunCode}
            disabled={isExecuting || isInterviewer || isLocked}
            className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-primary/5"
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            Run Code
          </button>

          {assessmentTemplateId && (
            <>
              <button 
                onClick={handleRunAllTestCases}
                disabled={isExecuting || isInterviewer || isLocked}
                className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-primary/5"
              >
                {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-primary" />}
                Run Test Cases
              </button>

              <button 
                onClick={handleSubmitCodeCustom}
                disabled={!hasRunEvaluation || anyCompileError || isSubmitting || isInterviewer || isLocked}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-lg shadow-green-500/5",
                  (!hasRunEvaluation || anyCompileError)
                    ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed opacity-50"
                    : "bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20"
                )}
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit Solution
              </button>
            </>
          )}
          
          <div className="w-px h-5 bg-zinc-800 mx-1" />
          
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-700/30 transition cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Editor"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Editor & Console Split */}
      <div ref={containerRef} className="flex-1 min-h-0 relative flex">
        <div className="flex-grow flex-shrink min-h-0 min-w-[500px] relative">
          <ResizablePanelGroup 
            orientation="vertical"
            onLayoutChange={(layout: any) => {
              localStorage.setItem(`layout_${interviewId}`, JSON.stringify(layout));
            }}
          >
            <ResizablePanel defaultSize={defaultLayout[0]} minSize={30}>
              <CodeEditor 
                language={language}
                value={code}
                onChange={handleCodeChange}
                fontSize={fontSize}
                minimap={minimap}
                readOnly={isInterviewer || isLocked}
                onSelectionChange={setSelectedCode}
              />
            </ResizablePanel>
            
            <ResizableHandle className="h-1 bg-zinc-800 hover:bg-primary/50 transition-colors z-10" />
            
            <ResizablePanel 
              ref={consolePanelRef}
              defaultSize={defaultLayout[1]} 
              minSize={15}
              collapsible={true}
              onPanelCollapse={() => {
                setIsConsoleCollapsed(true);
                localStorage.setItem(`consoleCollapsed_${interviewId}`, "true");
              }}
              onPanelExpand={() => {
                setIsConsoleCollapsed(false);
                localStorage.setItem(`consoleCollapsed_${interviewId}`, "false");
              }}
            >
              <div className="h-full flex flex-col bg-zinc-900/80">
                {assessmentTemplateId ? (
                  <>
                    <div className="h-9 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 shrink-0 select-none">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Evaluation Console</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setIsConsoleCollapsed(true);
                            localStorage.setItem(`consoleCollapsed_${interviewId}`, "true");
                          }}
                          className="p-1 hover:bg-zinc-850 text-zinc-500 hover:text-red-400 rounded transition cursor-pointer"
                          title="Collapse Console"
                        >
                          <Minimize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <Tabs value={consoleTab} onValueChange={setConsoleTab} className="flex-1 flex flex-col min-h-0">
                      <div className="h-8 bg-zinc-900/40 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0 select-none">
                        <TabsList className="bg-zinc-950/60 border border-zinc-850 rounded p-0.5 h-6">
                          <TabsTrigger value="results" className="text-[10px] font-semibold py-0.5 px-2 rounded-sm cursor-pointer">Test Results</TabsTrigger>
                          <TabsTrigger value="feedback" className="text-[10px] font-semibold py-0.5 px-2 rounded-sm cursor-pointer" disabled={!submitSummary?.aiEvaluation}>AI Review</TabsTrigger>
                        </TabsList>
                      </div>

                      <div className="flex-1 min-h-0 overflow-auto p-4 font-mono text-xs">
                        <TabsContent value="results" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0 space-y-4">
                          {isExecuting || isSubmitting ? (
                            <div className="flex items-center gap-2 text-zinc-500">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{isExecuting ? "Executing code..." : "Evaluating code & generating review..."}</span>
                            </div>
                          ) : executionResults.length > 0 ? (
                            <div className="space-y-3">
                              {submitSummary && (
                                <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-850 flex items-center justify-between">
                                  <span className="text-zinc-400 font-bold">Passed Cases:</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn(
                                      submitSummary.passedCount === submitSummary.totalCount
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    )}>
                                      {submitSummary.passedCount} / {submitSummary.totalCount} Passed
                                    </Badge>
                                    {submitSummary.score !== undefined && (
                                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                                        Score: {submitSummary.score}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {executionResults.map((tc, idx) => (
                                  <div key={tc.id || idx} className={cn(
                                    "p-3 rounded-lg border flex flex-col gap-1.5 transition-all select-text",
                                    tc.passed 
                                      ? "bg-emerald-950/10 border-emerald-900/30 text-emerald-400" 
                                      : "bg-red-950/10 border-red-900/30 text-red-400"
                                  )}>
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold flex items-center gap-1.5">
                                        <span className="text-[9px] opacity-60">#{idx + 1}</span>
                                        <span>{tc.is_hidden ? "Hidden Case" : "Visible Case"}</span>
                                      </span>
                                      <Badge className={tc.passed ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/10" : "bg-red-500/20 text-red-400 border-red-500/10"}>
                                        {tc.passed ? "Passed" : "Failed"}
                                      </Badge>
                                    </div>
                                    <div className="text-[10px] space-y-1 text-zinc-300 font-medium">
                                      <div>Input: <span className="text-zinc-400 bg-zinc-950/50 px-1 py-0.5 rounded">{tc.input}</span></div>
                                      <div>Expected: <span className="text-zinc-400 bg-zinc-950/50 px-1 py-0.5 rounded">{tc.expected_output}</span></div>
                                      <div>Actual: <span className={cn("px-1 py-0.5 rounded", tc.passed ? "text-emerald-450 bg-zinc-950/50" : "text-red-400 bg-zinc-950/50")}>{tc.stdout || "[Empty Output]"}</span></div>
                                      {tc.stderr && <div>Error: <span className="text-red-400 bg-zinc-950/50 px-1 py-0.5 rounded">{tc.stderr}</span></div>}
                                      {tc.runtime_status && tc.runtime_status !== "Passed" && tc.runtime_status !== "completed" && <div>Status: <span className="text-red-400 uppercase font-bold">{tc.runtime_status}</span></div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-zinc-650 italic">Submit solution or run code to evaluate against test cases.</div>
                          )}
                        </TabsContent>

                        <TabsContent value="feedback" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0 space-y-4">
                          {submitSummary?.aiEvaluation ? (
                            <div className="space-y-4 select-text">
                              <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-850 space-y-3">
                                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                  <span className="font-bold text-white flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    AI Evaluation Summary
                                  </span>
                                  <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                    Marks: {submitSummary.score}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-zinc-300 space-y-3 leading-relaxed whitespace-pre-wrap font-sans">
                                  {submitSummary.aiEvaluation}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-zinc-650 italic">AI Feedback is generated upon final code submission.</div>
                          )}
                        </TabsContent>
                      </div>
                    </Tabs>
                  </>
                ) : (
                  <>
                    <div className="h-9 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 shrink-0 select-none">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Terminal Console</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {output && (
                          <button 
                            onClick={handleCopyOutput} 
                            className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded transition cursor-pointer"
                            title="Copy Console Output"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setIsConsoleCollapsed(true);
                            localStorage.setItem(`consoleCollapsed_${interviewId}`, "true");
                          }}
                          className="p-1 hover:bg-zinc-850 text-zinc-500 hover:text-red-400 rounded transition cursor-pointer"
                          title="Collapse Console"
                        >
                          <Minimize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                      {isExecuting ? (
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Executing...
                        </div>
                      ) : output ? (
                        <div className="flex flex-col gap-2">
                          {output.stderr && <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>}
                          {output.stdout && <pre className="text-zinc-300 whitespace-pre-wrap">{output.stdout}</pre>}
                          {!output.stderr && !output.stdout && <span className="text-zinc-600 italic">Program exited with no output.</span>}
                          
                          <div className="mt-4 pt-4 border-t border-zinc-800/50 flex gap-4 text-xs text-zinc-500">
                            <span>Exit Code: <span className={output.code === 0 ? "text-green-500" : "text-red-500"}>{output.code}</span></span>
                            <span>Time: {output.time}ms</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-650 italic">Run your code to see output here.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        </div>

        {/* AI Assistant Column */}
        {(!isAssessmentMode || isInterviewer) && (
          <div 
            className={cn(
              "h-full flex flex-row shrink-0 relative overflow-hidden",
              isTransitioning && "transition-[width] duration-200 ease"
            )}
            style={{
              width: isAssistantOpen ? `${assistantWidth}px` : "0px",
            }}
          >
            {/* Resizer Handle */}
            {isAssistantOpen && (
              <div
                onMouseDown={handleMouseDown}
                className={cn(
                  "w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-25 flex-shrink-0 h-full",
                  isDragging ? "bg-primary/60" : "bg-zinc-900"
                )}
              />
            )}
            
            {/* Panel content container */}
            <div className="flex-1 min-w-[340px] h-full">
              <AIAssistantPanel 
                isOpen={isAssistantOpen} 
                onClose={() => setIsAssistantOpen(false)}
                code={code}
                language={language}
                problemStatement={problemStatement}
                selectedCode={selectedCode}
                compilerOutput={output?.output || output?.stderr || "No compiler run executed yet"}
                testCases={executionResults}
                assistantMode={
                  isInterviewer
                    ? "interviewer_live"
                    : interviewMode === "practice"
                    ? "coding_practice"
                    : "candidate_live"
                }
                role={isInterviewer ? "interviewer" : "candidate"}
                sessionType={interviewMode === "assessment" ? "live" : "practice"}
                difficulty={problemStatement?.difficulty || "Medium"}
              />
            </div>
          </div>
        )}
      </div>

      {(!isAssessmentMode || isInterviewer) && (
        <AIReviewModal 
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          code={code}
          language={language}
          problemStatement={problemStatement}
        />
      )}
    </div>
  );
}
