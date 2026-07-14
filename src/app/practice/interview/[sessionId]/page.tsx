"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { PracticeWorkspace } from "@/components/interview/practice/practice-workspace";
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, Maximize2, Loader2, AlertCircle, Play, 
  Brain, ShieldCheck, RefreshCw, XCircle, LogOut, Info
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVoiceInterview } from "@/hooks/use-voice-interview";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function PracticeInterviewPage({ params }: PageProps) {
  const router = useRouter();
  const [resolvedSessionId, setResolvedSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Session Configuration & Data
  const [roleName, setRoleName] = useState("");
  const [roundType, setRoundType] = useState("");
  const [technicalMode, setTechnicalMode] = useState<"coding" | "theory">("coding");
  const [difficulty, setDifficulty] = useState("Medium");
  const [personality, setPersonality] = useState("FAANG Style");
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [questionsList, setQuestionsList] = useState<string[]>([]);
  
  // Active Assessment States
  const [secondsRemaining, setSecondsRemaining] = useState(900);
  const [proctorSandboxLogs, setProctorSandboxLogs] = useState<string[]>([]);
  
  // Camera Stream
  const [hasCameraStream, setHasCameraStream] = useState(false);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // Security & Screen States
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const escPressedRef = useRef(false);
  const startInterviewTriggeredRef = useRef(false);

  // Evaluation & Completion states
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStageText, setEvaluationStageText] = useState("");
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationDebugLog, setEvaluationDebugLog] = useState<any | null>(null);
  
  // Local XP & Streaks
  const [totalXP, setTotalXP] = useState(0);
  const [streakDays, setStreakDays] = useState(4);

  // Instantiate our shared voice interview orchestration service hook
  const {
    orchestratorState,
    aiSpeechState,
    logs: orchestratorTelemetryLogs,
    chatLog,
    micVolume,
    interimText: interimSubtitleText,
    candidateText: candidateResponseText,
    currentQuestionIndex,
    diagnostics,
    setCandidateText: setCandidateResponseText,
    startInterview,
    submitCandidateAnswer: orchestratorSubmitCandidateAnswer,
    handleCandidateAnswerSubmit,
    orchestrator
  } = useVoiceInterview(resolvedSessionId, () => {
    handleFinishAndGenerateReport();
  });

  const isDictating = orchestrator?.recognitionManager?.active || false;
  const isUserSpeaking = micVolume > 0;
  const silenceCountdown = (orchestratorState === "LISTENING" || orchestratorState === "SPEECH_DETECTED") ? 2 : null;
  const aiSpeechVisualizerHeight = aiSpeechState === "speaking"
    ? Array.from({ length: 15 }, () => Math.floor(Math.random() * 55) + 10)
    : [];

  const isEvaluatingRef = useRef(false);

  const isConversationalRound = roundType ? (!roundType.toLowerCase().includes("coding") && !roundType.toLowerCase().includes("design")) : false;

  // Resolve Route Parameters
  useEffect(() => {
    params.then(p => {
      setResolvedSessionId(p.sessionId);
    });
  }, [params]);

  // Load XP, streaks, and history
  useEffect(() => {
    if (typeof window !== "undefined") {
      const xpStr = localStorage.getItem("practice_xp") || "0";
      const streakStr = localStorage.getItem("practice_streak") || "4";
      setTotalXP(parseInt(xpStr));
      setStreakDays(parseInt(streakStr));
    }
  }, []);

  // Fetch session data from Supabase or localStorage recovery backup
  useEffect(() => {
    if (!resolvedSessionId) return;

    const loadSession = async () => {
      setIsLoading(true);
      const supabase = createClient();
      
      try {
        const { data, error } = await supabase
          .from("practice_interviews")
          .select("*")
          .eq("id", resolvedSessionId)
          .single();

        if (data) {
          setRoleName(data.role || "Software Engineer");
          setRoundType(data.round || "Coding");
          setDifficulty(data.difficulty || "Medium");
          setPersonality(data.personality || "FAANG Style");
          setGeneratedQuestions(data.questions || []);
          setQuestionsList((data.questions || []).map((q: any) => q.question));
          if (orchestrator) {
            orchestrator.conversationManager.chatLog = data.chat_log || [];
          }
          setProctorSandboxLogs([`ℹ_ [SYSTEM] Session initialized successfully from Cloud. (${new Date().toLocaleTimeString()})`]);
          
          let duration = 900;
          if (data.mode === "Pressure") duration = 300;
          if (data.mode === "Rapid Fire") duration = 180;
          const cachedTime = localStorage.getItem("seconds_remaining_" + resolvedSessionId);
          if (cachedTime) {
            duration = parseInt(cachedTime);
          }
          setSecondsRemaining(duration);
          
          setIsLoading(false);
          return;
        }

        if (error) throw error;
      } catch (err) {
        console.warn("Cloud load failed, checking localStorage fallback:", err);
      }

      const recoveredStr = localStorage.getItem("practice_recovery_" + resolvedSessionId);
      if (recoveredStr) {
        try {
          const recovered = JSON.parse(recoveredStr);
          setRoleName(recovered.role || "Software Engineer");
          setRoundType(recovered.round || "Coding");
          setDifficulty(recovered.difficulty || "Medium");
          setPersonality(recovered.personality || "FAANG Style");
          setGeneratedQuestions(recovered.questions || []);
          setQuestionsList((recovered.questions || []).map((q: any) => q.question));
          if (orchestrator) {
            orchestrator.conversationManager.chatLog = recovered.chatLog || [];
          }
          setProctorSandboxLogs([`ℹ_ [SYSTEM] Session initialized successfully from Local Storage. (${new Date().toLocaleTimeString()})`]);

          let duration = 900;
          if (recovered.mode === "Pressure") duration = 300;
          if (recovered.mode === "Rapid Fire") duration = 180;
          const cachedTime = localStorage.getItem("seconds_remaining_" + resolvedSessionId);
          if (cachedTime) {
            duration = parseInt(cachedTime);
          }
          setSecondsRemaining(duration);
          
          setIsLoading(false);
        } catch (e) {
          console.error("Local recovery parse failed:", e);
          toast.error("Failed to load practice session details.");
          router.push("/dashboard/candidate/practice");
        }
      } else {
        toast.error("Practice session not found.");
        router.push("/dashboard/candidate/practice");
      }
    };

    loadSession();
  }, [resolvedSessionId, router]);

  // Sync active fullscreen status
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreenActive(isCurrentlyFullscreen);
      
      if (!isCurrentlyFullscreen) {
        const isEsc = escPressedRef.current;
        const msg = isEsc
          ? `⚠️ [PROCTOR] Candidate exited fullscreen using ESC key! (${new Date().toLocaleTimeString()})`
          : `⚠️ [PROCTOR] Candidate exited fullscreen mode! (${new Date().toLocaleTimeString()})`;
        setProctorSandboxLogs(prev => [...prev, msg]);
        escPressedRef.current = false;
        
        if (webcamStreamRef.current) {
          webcamStreamRef.current.getTracks().forEach(t => t.stop());
          webcamStreamRef.current = null;
          setHasCameraStream(false);
        }
      } else {
        setProctorSandboxLogs(prev => [...prev, `ℹ_ [PROCTOR] Entered fullscreen mode. (${new Date().toLocaleTimeString()})`]);
        startCameraStream();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        escPressedRef.current = true;
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Setup proctor event listeners
  useEffect(() => {
    if (!isFullscreenActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const isMinimized = (window.outerWidth === 0 && window.outerHeight === 0) || !document.hasFocus();
        const msg = isMinimized
          ? `⚠️ [PROCTOR] Candidate minimized the assessment window! (${new Date().toLocaleTimeString()})`
          : `⚠️ [PROCTOR] Candidate switched tabs! (${new Date().toLocaleTimeString()})`;
        setProctorSandboxLogs(prev => [...prev, msg]);
      }
    };

    const handleBlur = () => {
      const msg = `⚠️ [PROCTOR] Candidate clicked outside the window / lost focus! (${new Date().toLocaleTimeString()})`;
      setProctorSandboxLogs(prev => [...prev, msg]);
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("Copying is restricted in this coding assessment!");
      setProctorSandboxLogs(prev => [...prev, `⚠️ [PROCTOR] Blocked copy attempt! (${new Date().toLocaleTimeString()})`]);
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("Pasting is restricted in this coding assessment!");
      setProctorSandboxLogs(prev => [...prev, `⚠️ [PROCTOR] Blocked paste attempt! (${new Date().toLocaleTimeString()})`]);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
    };
  }, [isFullscreenActive]);

  // Lock browser navigation
  useEffect(() => {
    if (isLoading) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to refresh or close this tab?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isLoading]);

  // Timer Countdown loop
  useEffect(() => {
    if (isLoading || isEvaluating || !isFullscreenActive) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        const nextVal = prev <= 1 ? 0 : prev - 1;
        if (nextVal === 0) {
          clearInterval(timer);
          handleFinishAndGenerateReport();
          toast.warning("Assessment timer expired! Auto-evaluating solution blueprint.");
        }
        if (resolvedSessionId) {
          localStorage.setItem("seconds_remaining_" + resolvedSessionId, nextVal.toString());
        }
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading, isEvaluating, isFullscreenActive, resolvedSessionId]);

  // Start webcam feed for proctoring
  const startCameraStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false
      });
      webcamStreamRef.current = stream;
      setHasCameraStream(true);
    } catch (err) {
      console.warn("Could not start proctor camera feed:", err);
      setHasCameraStream(false);
    }
  };

  const roomVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && webcamStreamRef.current) {
      node.srcObject = webcamStreamRef.current;
    }
  }, []);

  // Save session state helper
  const saveSessionState = async (updates: Partial<any>) => {
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        id: resolvedSessionId,
        user_id: user?.id || null,
        role: roleName,
        round: roundType,
        difficulty,
        personality,
        questions: generatedQuestions,
        chat_log: updates.chatLog || chatLog,
        evaluation: updates.evaluation || null,
        status: updates.status || "active",
        error_reason: updates.errorReason || null,
        updated_at: new Date().toISOString()
      };

      await supabase.from("practice_interviews").upsert(payload);
      localStorage.setItem("practice_recovery_" + resolvedSessionId, JSON.stringify(payload));
    } catch (e) {
      console.warn("Session save sync failed:", e);
    }
  };

  // Submit Answer callback (non-conversational mode fallback)
  const submitCandidateAnswer = async (answer: string) => {
    if (isConversationalRound) {
      orchestratorSubmitCandidateAnswer(answer);
    } else {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (orchestrator) {
        const turn = {
          sender: "user" as const,
          text: answer,
          timestamp,
          turnId: orchestrator.conversationManager.generateId("turn"),
          interviewId: orchestrator.conversationManager.interviewId,
          questionId: questionsList[currentQuestionIndex] || "design",
          followUpId: null,
          transcriptId: "",
          analysisId: "",
          ttsId: "",
          recognitionId: ""
        };
        orchestrator.conversationManager.addTurn(turn);
        orchestrator.conversationManager.saveState();
      }
    }
  };

  // Automated Evaluation & Assessment completion handler
  const handleFinishAndGenerateReport = async () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
      setHasCameraStream(false);
    }

    setIsEvaluating(true);
    isEvaluatingRef.current = true;
    setEvaluationError(null);
    setEvaluationStageText("Analyzing solution complexity & test case alignment...");

    const stageTimer1 = setTimeout(() => {
      setEvaluationStageText("Generating structural code review metrics...");
    }, 2000);

    try {
      const response = await fetch("/api/ai/mock/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: roleName,
          round: roundType,
          difficulty,
          questions: generatedQuestions,
          chatLog,
          fillerWordsCount: 0
        })
      });

      const data = await response.json();
      clearTimeout(stageTimer1);

      if (!response.ok || data.success === false) {
        if (response.status === 400 && data.error === "Unable to evaluate candidate response.") {
          toast.error("We couldn't generate an evaluation report because you didn't provide enough spoken answers during the session.");
          await saveSessionState({
            status: "failed",
            errorReason: "No candidate speech transcripts recorded."
          });
          localStorage.removeItem("practice_recovery_" + resolvedSessionId);
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
          window.location.href = "/dashboard/candidate/practice";
          return;
        }
        throw new Error(data.error || "Evaluation failed");
      }

      const evalData = data.evaluation;
      const newReport = {
        id: "mock-" + Date.now(),
        date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
        role: roleName,
        round: roundType,
        difficulty,
        readinessScore: evalData.readinessScore,
        skills: evalData.skills || [],
        metrics: evalData.metrics,
        strengths: evalData.strengths,
        weaknesses: evalData.weaknesses,
        recommendations: evalData.recommendations,
        improvementPlan: evalData.improvementPlan,
        chatTranscript: chatLog,
        fillerWords: 0,
        questionsReview: evalData.questionsReview
      };

      localStorage.setItem("practice_completed_report_" + resolvedSessionId, JSON.stringify(newReport));

      const historyStr = localStorage.getItem("practice_history");
      let updatedHistory = [newReport];
      if (historyStr) {
        try {
          updatedHistory = [newReport, ...JSON.parse(historyStr)];
        } catch (e) {}
      }
      localStorage.setItem("practice_history", JSON.stringify(updatedHistory));

      const updatedXP = totalXP + 150;
      const updatedStreak = streakDays + 1;
      localStorage.setItem("practice_xp", String(updatedXP));
      localStorage.setItem("practice_streak", String(updatedStreak));

      await saveSessionState({
        status: "completed",
        evaluation: newReport
      });

      localStorage.removeItem("practice_recovery_" + resolvedSessionId);

      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      window.location.href = `/dashboard/candidate/practice?completedSessionId=${resolvedSessionId}`;

    } catch (err: any) {
      console.error(err);
      setEvaluationError(err.message || "Failed to compile AI evaluation report.");
      setIsEvaluating(false);
    }
  };

  // Exit/Quit session
  const handleQuit = async () => {
    setShowExitDialog(false);
    
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    }



    await saveSessionState({
      status: "failed",
      errorReason: "Candidate manually terminated the practice run."
    });

    localStorage.removeItem("practice_recovery_" + resolvedSessionId);

    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    
    window.location.href = "/dashboard/candidate/practice";
  };

  // Manual fallback question navigator (for coding/design rounds)
  const handleNextQuestion = () => {
    const nextIdx = currentQuestionIndex + 1;
    if (nextIdx < questionsList.length) {
      if (orchestrator) {
        orchestrator.conversationManager.currentQuestionIndex = nextIdx;
        orchestrator.notifyChatLogChange();
      }
      setCandidateResponseText("");
    }
  };

  const requestFullscreenAPI = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreenActive(true);
      }
    } catch (err) {
      toast.error("Fullscreen request denied. Please check browser configurations.");
    }
  };

  // =========================================================================
  // AUTOMATIC SPEECH RECOGNITION AND SYNTHESIS LOOPS
  // =========================================================================
  
  // Visualizer height is computed reactively during render

  // Trigger opening introduction & first question (only for conversational rounds)
  useEffect(() => {
    if (isLoading || !isFullscreenActive || questionsList.length === 0 || !isConversationalRound || !resolvedSessionId) return;
    if (startInterviewTriggeredRef.current) return;
    startInterviewTriggeredRef.current = true;

    startInterview(generatedQuestions, {
      role: roleName,
      round: roundType,
      difficulty,
      personality,
      stream: webcamStreamRef.current
    });
  }, [isLoading, isFullscreenActive, questionsList, isConversationalRound, resolvedSessionId]);



  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white font-mono select-none">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-zinc-400">Loading Immersive Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden relative select-none">
      
      {/* 1. Immersive Fullscreen Entry Overlay Latch */}
      {!isFullscreenActive && (
        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-3xl z-[100] flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[130px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[130px] pointer-events-none animate-pulse delay-1000" />
          
          <div className="bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden space-y-6 animate-scale-in border-primary/20">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-indigo-500 to-primary animate-pulse" />
            
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.2)] animate-pulse">
              <Maximize2 className="w-10 h-10 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Enter Fullscreen Workspace</h2>
              <div className="text-zinc-400 text-xs leading-relaxed font-medium space-y-2.5">
                <p>
                  Immersive fullscreen is required to start your proctored assessment playground.
                </p>
                <p className="bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-[10px] font-mono text-zinc-500">
                  ⚠️ Tab switching, minimizing, or exiting fullscreen pauses assessment and logs infraction alerts.
                </p>
              </div>
            </div>

            <Button
              onClick={requestFullscreenAPI}
              className="w-full bg-primary hover:bg-primary/95 text-white font-bold uppercase text-xs tracking-wider h-12 rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 cursor-pointer"
            >
              Enter Immersive Practice Mode
            </Button>
            
            <button
              onClick={() => window.location.href = "/dashboard/candidate/practice"}
              className="text-[10px] font-bold text-zinc-500 hover:text-zinc-400 uppercase tracking-widest block mx-auto underline"
            >
              Cancel & Exit Lobby
            </button>
          </div>
        </div>
      )}

      {/* 2. AI Assessment Evaluation Loading Splash */}
      {isEvaluating && (
        <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-2xl z-[150] flex flex-col items-center justify-center p-6 select-none animate-fade-in text-center">
          <div className="max-w-md space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 bg-primary/5 animate-ping opacity-75" />
              <div className="absolute -inset-4 rounded-full border border-primary/10 bg-primary/5 animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/20 animate-[spin_4s_linear_infinite]">
                <Brain className="w-10 h-10 text-primary" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white tracking-tight">Compiling Evaluation Matrix</h2>
              <p className="text-zinc-400 text-xs font-mono max-w-sm mx-auto animate-pulse">
                {evaluationStageText}
              </p>
            </div>
            
            <div className="w-48 bg-zinc-900 border border-zinc-800 h-1.5 rounded-full overflow-hidden mx-auto mt-4">
              <div className="h-full bg-primary rounded-full animate-[shimmer_2s_infinite] w-full" />
            </div>
          </div>
        </div>
      )}

      {/* 3. Evaluation Failure Diagnostic Screen */}
      {evaluationError && (
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-6 select-none animate-fade-in">
          <div className="max-w-md w-full bg-zinc-900/60 border border-red-500/20 rounded-3xl p-6 shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-red-500/10 animate-bounce">
              <XCircle className="w-7 h-7 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight">AI Evaluation Service Unavailable</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                The mock performance evaluator could not process your practice transcript logs.
              </p>
            </div>

            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-[10px] text-red-400 font-mono leading-relaxed select-text text-left">
              <strong>Error Trace:</strong> {evaluationError}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleFinishAndGenerateReport}
                className="flex-1 bg-primary hover:bg-primary/95 text-white font-bold text-xs uppercase h-10 rounded-xl"
              >
                Retry Evaluation
              </Button>
              <button
                onClick={() => window.location.href = "/dashboard/candidate/practice"}
                className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold text-xs uppercase h-10 rounded-xl border border-zinc-800 transition"
              >
                Exit Assessment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Dedicated Lightweight Header (64px Fixed Height) */}
      <header className="h-16 bg-zinc-900 border-b border-zinc-850 px-6 flex items-center justify-between shrink-0 select-none relative z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-850 px-3 py-1.5 rounded-xl">
            <Brain className="w-4.5 h-4.5 text-primary" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest font-mono">INTERVIEW.AI</span>
          </div>
          <span className="h-5 w-px bg-zinc-800" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-black text-white uppercase tracking-tight">
              {roleName}
            </span>
            <span className="text-[9px] text-zinc-450 font-bold uppercase tracking-wider">
              {roundType} Mock Practice Round
            </span>
          </div>
          <span className={cn(
            "text-[8px] font-black px-2.5 py-0.5 rounded border uppercase tracking-wider ml-2",
            difficulty === "Hard" ? "bg-red-500/10 text-red-400 border-red-500/25" :
            difficulty === "Easy" ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/25" :
            "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"
          )}>
            {difficulty}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 border border-zinc-800 bg-zinc-950/50 px-2.5 py-1 rounded-md text-[9px] font-bold text-emerald-450 uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Connection</span>
          </div>

          <div className="flex items-center gap-1.5 border border-zinc-800 bg-zinc-950/50 px-2.5 py-1 rounded-md text-[9px] font-bold text-zinc-450 uppercase">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isFullscreenActive ? "bg-emerald-500" : "bg-red-500 animate-ping")} />
            <span>Fullscreen</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn(
              "font-mono text-xs font-black border px-3 py-1 rounded-lg select-none",
              secondsRemaining < 60 ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" : "bg-zinc-950 text-emerald-450 border-zinc-800"
            )}>
              {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, "0")}
            </span>
          </div>

          <Button
            onClick={() => setShowExitDialog(true)}
            variant="destructive"
            className="h-8 text-[9px] font-black uppercase tracking-wider px-4 rounded-xl cursor-pointer bg-red-650 hover:bg-red-600 transition"
          >
            Quit Practice
          </Button>
        </div>
      </header>

      {/* 5. Immersive 100% Viewport Workspace Container */}
      <div className="flex-1 min-h-0 bg-zinc-950 relative">
        <PracticeWorkspace
          selectedRound={roundType.includes("Coding") ? "Coding" : roundType.includes("Design") ? "System Design" : "Warm Up"}
          technicalMode={technicalMode}
          currentQuestionText={questionsList[currentQuestionIndex] || ""}
          currentQuestionIndex={currentQuestionIndex}
          currentQuestionObj={generatedQuestions[currentQuestionIndex]}
          chatLog={chatLog}
          candidateResponseText={candidateResponseText}
          setCandidateResponseText={setCandidateResponseText}
          isDictating={isDictating}
          toggleDictation={() => {}}
          silenceCountdown={silenceCountdown}
          aiSpeechState={aiSpeechState}
          handleCandidateAnswerSubmit={handleCandidateAnswerSubmit}
          submitCandidateAnswer={submitCandidateAnswer}
          isUserSpeaking={isUserSpeaking}
          interimSubtitleText={interimSubtitleText}
          micVolume={micVolume}
          diagnostics={diagnostics}
          proctorSandboxLogs={proctorSandboxLogs}
          hasCameraStream={hasCameraStream}
          roomVideoRef={roomVideoRef}
          aiSpeechVisualizerHeight={aiSpeechVisualizerHeight}
          selectedPersonality={personality}
          onNextQuestion={handleNextQuestion}
          onFinishSession={handleFinishAndGenerateReport}
        />
      </div>

      {/* 6. Quit Session Modal Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 select-none">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-850 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">Confirm Quit Assessment?</h4>
                <p className="text-xs text-zinc-450 leading-relaxed font-medium">
                  Quitting will terminate this simulated assessment immediately. Your progress will be saved as "Failed/Aborted" and active score calculation algorithms will be lost.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowExitDialog(false)}
                className="h-9 px-4 rounded-xl text-zinc-400 hover:text-white text-xs font-bold uppercase transition"
              >
                Resume Test
              </button>
              <Button
                onClick={handleQuit}
                variant="destructive"
                className="h-9 px-4 rounded-xl text-xs font-bold uppercase"
              >
                Quit & Forfeit
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
