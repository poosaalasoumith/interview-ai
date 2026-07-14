"use client";
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import {
  LiveKitRoom,
  PreJoin,
  RoomAudioRenderer,
  VideoTrack,
  useLocalParticipant,
  useTracks,
  useChat,
  useParticipants,
  useDataChannel,
  useRoomContext,
} from "@livekit/components-react";
import { Track, ConnectionQuality } from "livekit-client";
import "@livekit/components-styles";
import {
  Loader2,
  Terminal,
  FileCode2,
  Sparkles,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Tv,
  MessageSquare,
  Users,
  LogOut,
  Send,
  X,
  Radio,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  AlertTriangle,
  ShieldAlert,
  Volume2,
  Timer,
  Hourglass,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { CodingEnvironment } from "./coding-environment";
import { ProblemPanel } from "./problem-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import { 
  endInterviewAndGenerateReport,
  initializeInterviewSession,
  extendInterviewSessionTime,
  terminateInterviewSessionAction,
  autoSubmitInterviewAction,
  toggleLockSessionAction,
} from "@/app/actions/interviews";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LiveKitErrorBoundary } from "./error-boundary";
import { ParticipantTile } from "./participant-tile";
import { cn } from "@/lib/utils";
import { isSessionFinalized } from "@/utils/interview-utils";

interface InterviewClientProps {
  roomId: string;
  username: string;
  isInterviewer?: boolean;
  isReadOnlyReview?: boolean;
  assessmentTemplateId?: string | null;
}

export function InterviewClient({ 
  roomId, 
  username, 
  isInterviewer = false, 
  isReadOnlyReview = false,
  assessmentTemplateId: initialAssessmentTemplateId = null
}: InterviewClientProps) {
  const [token, setToken] = useState<string>("");
  const [preJoinComplete, setPreJoinComplete] = useState(isReadOnlyReview || false);
  const [error, setError] = useState<string | null>(null);
  const [problemStatement, setProblemStatement] = useState<any>(null);
  const [isEnding, startEndingTransition] = useTransition();
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState(0);

  // Custom Assessment states
  const [assessmentTemplateId, setAssessmentTemplateId] = useState<string | null>(initialAssessmentTemplateId);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQIdx, setActiveQIdx] = useState<number>(0);
  const [attempt, setAttempt] = useState<any>(null);
  const [isTestCandidate, setIsTestCandidate] = useState(false);

  const handleQuestionSelect = (idx: number) => {
    setActiveQIdx(idx);
    setProblemStatement(questions[idx]);
  };

  const handleCodeSubmitted = (questionId: string, status: string) => {
    setQuestions((prev: any[]) => {
      const updated = prev.map((q: any) => q.id === questionId ? { ...q, status } : q);
      return updated;
    });
    setProblemStatement((prev: any) => prev && prev.id === questionId ? { ...prev, status } : prev);
  };

  const fetchAssessmentData = async (templateId: string, candidateId: string) => {
    const supabase = createClient();
    try {
      // Fetch questions
      const { data: quest, error: questErr } = await supabase
        .from("assessment_questions")
        .select(`
          *,
          question_testcases(*)
        `)
        .eq("template_id", templateId)
        .order("order_index", { ascending: true });

      if (questErr) throw questErr;

      let initialQuestions = quest || [];

      // Fetch or create attempt for candidate
      let { data: att, error: attErr } = await supabase
        .from("assessment_attempts")
        .select("*")
        .eq("interview_id", roomId)
        .eq("candidate_id", candidateId)
        .maybeSingle();

      if (attErr) throw attErr;

      if (!att && !isInterviewer) {
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

      setAttempt(att);

      // Fetch statuses of candidate answers for questions, if attempt exists
      if (att && initialQuestions.length > 0) {
        const { data: answers } = await supabase
          .from("candidate_answers")
          .select("question_id, status")
          .eq("attempt_id", att.id);
          
        if (answers) {
          const statusMap = new Map(answers.map(a => [a.question_id, a.status]));
          initialQuestions = initialQuestions.map(q => ({
            ...q,
            status: statusMap.get(q.id) || "not_started"
          }));
        }
      }

      setQuestions(initialQuestions);
      if (initialQuestions.length > 0) {
        setProblemStatement(initialQuestions[0]);
      }
    } catch (err: any) {
      console.error("Failed to load assessment data:", err);
    }
  };
  const router = useRouter();

  // Fetch Token & Problem Details
  useEffect(() => {
    const fetchToken = async (retryCount = 0) => {
      try {
        const res = await fetch(`/api/livekit?room=${roomId}&username=${username}`);
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error || `Failed to fetch token (HTTP ${res.status})`;
          // Retry on 500 errors (transient server issues) up to 2 times
          if (res.status >= 500 && retryCount < 2) {
            console.warn(`[LiveKit Token] Retrying token fetch (attempt ${retryCount + 2})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return fetchToken(retryCount + 1);
          }
          throw new Error(errMsg);
        }
        console.log("[LiveKit Token] Token received successfully");
        setToken(data.token);
      } catch (err: any) {
        console.error("[LiveKit Token] Token fetch failed:", err.message);
        setError(err.message);
      }
    };

    const fetchProblem = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("interviews")
        .select("problem_statement")
        .eq("id", roomId)
        .single();
        
      if (data?.problem_statement) {
        setProblemStatement(data.problem_statement);
      }
    };

    fetchToken();
    fetchProblem();
  }, [roomId, username]);

  const handleEndInterview = async () => {
    if (isProcessingFeedback || isEnding) return;
    if (!confirm("Are you sure you want to end this interview and generate the AI feedback report? This will complete the session for both participants.")) return;

    setIsProcessingFeedback(true);
    setEvaluationStep(0);

    // Dynamic simulated steps interval (2.5 seconds per step, up to 5 steps, 6th step is done)
    const stepInterval = setInterval(() => {
      setEvaluationStep((prev) => {
        if (prev < 5) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 2500);

    startEndingTransition(async () => {
      try {
        const res = await endInterviewAndGenerateReport(roomId);
        clearInterval(stepInterval);
        if (res.error) {
          toast.error(res.error);
          setIsProcessingFeedback(false);
        } else {
          toast.success("Interview completed! AI Report successfully generated and saved.");
          router.push(isInterviewer ? "/dashboard/interviewer" : "/dashboard/candidate");
        }
      } catch (err: any) {
        clearInterval(stepInterval);
        toast.error(err.message || "An unexpected error occurred.");
        setIsProcessingFeedback(false);
      }
    });
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 bg-zinc-950 p-6">
        <div className="max-w-lg w-full text-center space-y-4">
          <div className="text-red-500 font-semibold bg-red-500/10 p-4 rounded-lg border border-red-500/20 text-sm">
            {error}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button 
              onClick={() => {
                setError(null);
                setToken("");
                // Re-trigger token fetch
                const fetchToken = async () => {
                  try {
                    const res = await fetch(`/api/livekit?room=${roomId}&username=${username}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to fetch token");
                    setToken(data.token);
                  } catch (err: any) {
                    setError(err.message);
                  }
                };
                fetchToken();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition cursor-pointer font-semibold text-sm"
            >
              Retry Connection
            </button>
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-md hover:bg-zinc-700 transition cursor-pointer text-sm"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (token === "") {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-zinc-950 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-primary animate-spin" />
        </div>
        <p className="text-zinc-500 text-xs font-semibold animate-pulse tracking-wide">Initializing secure room connection...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-zinc-950 text-white select-none font-sans" data-lk-theme="default">
      {!preJoinComplete ? (
        <div className="flex h-full items-center justify-center bg-zinc-950 p-4">
          <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900 border border-zinc-800/80 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen mix-blend-screen animate-pulse" />
            
            <h1 className="text-xl font-bold text-center mb-2 z-10 relative">Enter Coding Room</h1>
            <p className="text-center text-zinc-400 mb-6 z-10 relative text-xs tracking-wide">
              Configure your mic and video prior to joining the session.
            </p>
            
            <div className="z-10 relative">
              <PreJoin
                onSubmit={() => setPreJoinComplete(true)}
                onError={(err) => {
                  console.error("[LiveKit PreJoin Error]", err);
                  setError(err.message || "Permission denied or media device error");
                }}
                defaults={{
                  username: username,
                  audioEnabled: true,
                  videoEnabled: true,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <LiveKitRoom
          video={!isReadOnlyReview}
          audio={!isReadOnlyReview}
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          className="h-full w-full flex flex-col overflow-hidden"
          connectOptions={{
            autoSubscribe: true,
          }}
          onDisconnected={() => {
            router.push("/dashboard");
          }}
          onError={(err) => {
            console.error("[LiveKit Room Error]", err);
            const msg = err.message || "Failed to establish a room connection";
            // Provide clearer guidance for "invalid token" errors
            if (msg.toLowerCase().includes("invalid token")) {
              setError("LiveKit connection failed: Invalid token. This usually means the LiveKit API credentials have expired or been rotated. Please contact your administrator to verify the LiveKit Cloud project settings.");
            } else {
              setError(msg);
            }
          }}
        >
          <LiveKitErrorBoundary>
            <InterviewRoomContent 
              roomId={roomId}
              username={username}
              isInterviewer={isInterviewer}
              isReadOnlyReview={isReadOnlyReview}
              problemStatement={problemStatement}
              setProblemStatement={setProblemStatement}
              handleEndInterview={handleEndInterview}
              isEnding={isEnding}
              isProcessingFeedback={isProcessingFeedback}
              assessmentTemplateId={assessmentTemplateId}
              setAssessmentTemplateId={setAssessmentTemplateId}
              questions={questions}
              setQuestions={setQuestions}
              activeQIdx={activeQIdx}
              setActiveQIdx={setActiveQIdx}
              attempt={attempt}
              setAttempt={setAttempt}
              handleQuestionSelect={handleQuestionSelect}
              handleCodeSubmitted={handleCodeSubmitted}
              fetchAssessmentData={fetchAssessmentData}
              isTestCandidate={isTestCandidate}
              setIsTestCandidate={setIsTestCandidate}
            />
          </LiveKitErrorBoundary>
        </LiveKitRoom>
      )}
      
      {(isEnding || isProcessingFeedback) && (() => {
        const evaluationSteps = [
          "Establishing secure connection to evaluation engine...",
          "Retrieving candidate's collaborative code submissions...",
          "Analyzing computational time and space complexity...",
          "Evaluating code style, patterns, and language conventions...",
          "Generating structural review and AI feedback summary...",
          "Hardening report and syncing changes to database..."
        ];
        const progressPercent = Math.min(((evaluationStep + 1) / evaluationSteps.length) * 100, 100);
        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-lg z-50 flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800/80 p-8 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
              {/* Elegant glowing background element */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen animate-pulse" />
              
              {/* Spinning icon & sparkles */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full border-4 border-zinc-800 border-t-primary animate-spin" />
                <Sparkles className="w-8 h-8 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>

              {/* Title */}
              <h2 className="text-lg font-bold text-white tracking-wide mb-1 uppercase">AI Evaluation Engines Active</h2>
              <p className="text-zinc-400 text-xs mb-8 leading-relaxed max-w-xs">
                Synthesizing collaborative submissions and calculating technical, structural, and communication metrics.
              </p>

              {/* Progress steps container */}
              <div className="w-full space-y-4 mb-8 text-left">
                {/* Stepped progress indicators */}
                <div className="w-full bg-zinc-800/50 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-primary to-purple-650 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Steps timeline view */}
                <div className="space-y-2.5">
                  {evaluationSteps.map((stepMsg, idx) => {
                    const isActive = idx === evaluationStep;
                    const isDone = idx < evaluationStep;
                    
                    return (
                      <div 
                        key={idx} 
                        className={cn(
                          "flex items-center gap-3 text-[11px] transition-all duration-300",
                          isActive ? "text-primary font-semibold translate-x-1" : isDone ? "text-zinc-500" : "text-zinc-700"
                        )}
                      >
                        <div 
                          className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-300 text-[8px]",
                            isActive ? "border-primary bg-primary/10 text-primary animate-pulse" : 
                            isDone ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold" : "border-zinc-800 text-transparent"
                          )}
                        >
                          {isDone ? "✓" : isActive ? "●" : ""}
                        </div>
                        <span className="truncate flex-1">{stepMsg}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 font-medium animate-pulse">
                Generating report... {Math.round(progressPercent)}% completed
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* Inner Layout Component wrapping active LiveKit hooks */
interface InnerProps {
  roomId: string;
  username: string;
  isInterviewer: boolean;
  isReadOnlyReview?: boolean;
  problemStatement: any;
  setProblemStatement: (p: any) => void;
  handleEndInterview: () => void;
  isEnding: boolean;
  isProcessingFeedback: boolean;

  // Custom assessment props
  assessmentTemplateId: string | null;
  setAssessmentTemplateId: (id: string | null) => void;
  questions: any[];
  setQuestions: React.Dispatch<React.SetStateAction<any[]>>;
  activeQIdx: number;
  setActiveQIdx: (idx: number) => void;
  attempt: any;
  setAttempt: (att: any) => void;
  handleQuestionSelect: (idx: number) => void;
  handleCodeSubmitted: (questionId: string, status: string) => void;
  fetchAssessmentData: (templateId: string, candidateId: string) => Promise<void>;
  
  // Test Candidate
  isTestCandidate: boolean;
  setIsTestCandidate: (val: boolean) => void;
}

function InterviewRoomContent({
  roomId,
  username,
  isInterviewer,
  isReadOnlyReview = false,
  problemStatement,
  setProblemStatement,
  handleEndInterview,
  isEnding,
  isProcessingFeedback,

  assessmentTemplateId,
  setAssessmentTemplateId,
  questions,
  setQuestions,
  activeQIdx,
  setActiveQIdx,
  attempt,
  setAttempt,
  handleQuestionSelect,
  handleCodeSubmitted,
  fetchAssessmentData,
  isTestCandidate,
  setIsTestCandidate
}: InnerProps) {
  const router = useRouter();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();

  const isParticipantCandidate = useCallback((p: any) => {
    let remoteRole = "candidate";
    try {
      if (p.metadata) {
        const meta = JSON.parse(p.metadata);
        if (meta.role) remoteRole = meta.role.toLowerCase();
      }
    } catch (e) {
      const raw = p.metadata?.trim().toLowerCase();
      if (raw === "admin" || raw === "interviewer") remoteRole = raw;
    }
    const nameLower = (p.name || "").toLowerCase();
    const identityLower = p.identity.toLowerCase();
    if (identityLower.includes("admin") || nameLower.includes("admin")) remoteRole = "admin";
    else if (identityLower.includes("interviewer") || nameLower.includes("interviewer")) remoteRole = "interviewer";

    return remoteRole === "candidate";
  }, []);

  // Local Participant Metadata Reactivity
  const [localMetadata, setLocalMetadata] = useState(localParticipant.metadata);
  useEffect(() => {
    const handleMetadataChanged = (metadata: string | undefined) => {
      setLocalMetadata(metadata);
    };
    (localParticipant as any).on("metadataChanged", handleMetadataChanged);
    return () => {
      (localParticipant as any).off("metadataChanged", handleMetadataChanged);
    };
  }, [localParticipant]);

  // Dynamic role resolution from LiveKit local participant metadata
  let localRole = isInterviewer ? "interviewer" : "candidate";
  try {
    if (localMetadata) {
      const meta = JSON.parse(localMetadata);
      if (meta.role) localRole = meta.role.toLowerCase();
    }
  } catch (e) {}

  const isLocalModerator = localRole === "interviewer" || localRole === "admin";

  // Warning Popup State
  const [activeWarning, setActiveWarning] = useState<{
    count: number;
    reason: string;
    moderatorName: string;
    timestamp: string;
  } | null>(null);

  // Custom panel layout references
  const chatPanelRef = useRef<any>(null);

  // States
  const [windowWidth, setWindowWidth] = useState(1200);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageInput, setMessageInput] = useState("");
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Proctoring & RBAC States
  const [interviewType, setInterviewType] = useState<string>("Technical");
  const [interviewMode, setInterviewMode] = useState<"assessment" | "live coding" | "hr">("assessment");
  const [warningsCount, setWarningsCount] = useState(0);
  const [isLocked, setIsLocked] = useState(isReadOnlyReview || false);
  const [lockReason, setLockReason] = useState<string>("Your assessment session has been locked.");
  const [candidateRemarks, setCandidateRemarks] = useState("");

  // Proctoring stabilization states
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Collapsible left sidebar for candidates
  const [candidateFocusStates, setCandidateFocusStates] = useState<Record<string, { isFocused: boolean; isFullscreen: boolean; isMinimized?: boolean; isScreenSharing?: boolean; timestamp: number }>>({});

  // Lifecycle & Clock countdown states
  const [sessionStatus, setSessionStatus] = useState<string>("scheduled");
  const [actualStartedAt, setActualStartedAt] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [timeExtendedMinutes, setTimeExtendedMinutes] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [candidateJoinedAt, setCandidateJoinedAt] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  
  // Redesign and missing states
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isProctorGridView, setIsProctorGridView] = useState(true); // Default to grid for proctors
  
  // Delayed Safe Handshake Ref & Force Subscription trigger
  const lastInfractionTimeRef = useRef<number>(0);
  const escPressedRef = useRef<boolean>(false);
  const handshakesRef = useRef<Record<string, {
    status: "waiting" | "ready" | "fallback";
    timestamp: number;
    retryCount: number;
  }>>({});
  const [subscriptionTrigger, setSubscriptionTrigger] = useState(0);
  const forceUpdateSubscriptions = useCallback(() => setSubscriptionTrigger(prev => prev + 1), []);
  
  // Proctoring Monitor States
  const [focusedCandidateIdentity, setFocusedCandidateIdentity] = useState<string | null>(null);
  const [isPinnedMode, setIsPinnedMode] = useState<boolean>(false);
  const [isFullscreenMonitor, setIsFullscreenMonitor] = useState<boolean>(false);

  // Accurate participant presence engine (excludes stale reconnects and disconnected ghosts)
  const getActiveUniqueParticipantsCount = useCallback(() => {
    const activeIdentities = new Set<string>();
    
    if (localParticipant?.identity) {
      activeIdentities.add(localParticipant.identity);
    }
    
    participants.forEach((p) => {
      if (p.identity) {
        activeIdentities.add(p.identity);
      }
    });
    
    return activeIdentities.size;
  }, [localParticipant, participants]);

  // Format seconds to HH:MM:SS for production-grade telemetry timer display
  const formatHHMMSS = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0")
    ].join(":");
  }, []);
  
  // Track mute / media states
  const [isMicEnabled, setIsMicEnabled] = useState(localParticipant.isMicrophoneEnabled);
  const [isCamEnabled, setIsCamEnabled] = useState(localParticipant.isCameraEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState(localParticipant.isScreenShareEnabled);

  // Load chat features
  const { send: sendChatMessage, chatMessages } = useChat();

  // Load layout from localStorage
  const [defaultHLayout, setDefaultHLayout] = useState<number[]>([20, 60, 20]);
  const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLayout = localStorage.getItem(`hLayout_${roomId}`);
    const savedChatOpen = localStorage.getItem(`chatOpen_${roomId}`);
    
    if (savedLayout) {
      try { setDefaultHLayout(JSON.parse(savedLayout)); } catch (e) {}
    }
    if (savedChatOpen) {
      setIsChatOpen(savedChatOpen === "true");
    }
    setIsLayoutLoaded(true);

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, [roomId]);

  // Synchronize mic, cam, screen sharing controls with actual states
  useEffect(() => {
    const handleUpdate = () => {
      setIsMicEnabled(localParticipant.isMicrophoneEnabled);
      setIsCamEnabled(localParticipant.isCameraEnabled);
      setIsScreenSharing(localParticipant.isScreenShareEnabled);
    };

    localParticipant.on("trackMuted", handleUpdate);
    localParticipant.on("trackUnmuted", handleUpdate);
    localParticipant.on("localTrackPublished", handleUpdate);
    localParticipant.on("localTrackUnpublished", handleUpdate);

    return () => {
      localParticipant.off("trackMuted", handleUpdate);
      localParticipant.off("trackUnmuted", handleUpdate);
      localParticipant.off("localTrackPublished", handleUpdate);
      localParticipant.off("localTrackUnpublished", handleUpdate);
    };
  }, [localParticipant]);

  // Strict global keyboard event blocker when session is locked
  useEffect(() => {
    if (!isLocked || isLocalModerator) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isChatInput = activeEl && 
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") && 
        activeEl.id === "chat-input";
        
      if (isChatInput) {
        return; // Allow typing in the chat
      }

      // Block all other keyboard shortcuts and inputs in coding workspace
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isLocked, isLocalModerator]);

  // 1. Delayed Safe Handshake Polling and Role Validation Wait State
  useEffect(() => {
    const checkHandshakes = () => {
      let changed = false;
      const now = Date.now();
      
      participants.forEach((p) => {
        const id = p.identity;
        const entry = handshakesRef.current[id];
        
        if (!entry) {
          // New participant: initialize in 'waiting' state
          handshakesRef.current[id] = {
            status: "waiting",
            timestamp: now,
            retryCount: 0
          };
          changed = true;
        } else if (entry.status === "waiting") {
          // Check if metadata is ready and valid
          let isMetadataReady = false;
          try {
            if (p.metadata) {
              const meta = JSON.parse(p.metadata);
              if (meta && typeof meta === "object" && meta.role) {
                isMetadataReady = true;
              }
            }
          } catch (e) {
            const raw = p.metadata?.trim().toLowerCase();
            if (raw === "admin" || raw === "interviewer" || raw === "candidate") {
              isMetadataReady = true;
            }
          }
          
          const nameLower = (p.name || "").toLowerCase();
          const identityLower = p.identity.toLowerCase();
          const isExplicitMod = identityLower.includes("admin") || nameLower.includes("admin") ||
                               identityLower.includes("interviewer") || nameLower.includes("interviewer");
          
          if (isMetadataReady || isExplicitMod) {
            entry.status = "ready";
            changed = true;
            console.log(`[Handshake] Safe metadata sync established for ${p.name || p.identity}`);
          } else if (now - entry.timestamp > 5000) {
            // Fallback timeout recovery (5 seconds)
            entry.status = "fallback";
            changed = true;
            console.warn(`[Handshake] Timeout for ${p.name || p.identity}. Applying fallback candidate role rules.`);
          } else {
            entry.retryCount += 1;
          }
        }
      });
      
      // Cleanup handshakes for participants who left
      Object.keys(handshakesRef.current).forEach((id) => {
        if (!participants.some((p) => p.identity === id)) {
          delete handshakesRef.current[id];
          changed = true;
        }
      });
      
      if (changed) {
        forceUpdateSubscriptions();
      }
    };
    
    checkHandshakes();
    const interval = setInterval(checkHandshakes, 500);
    return () => clearInterval(interval);
  }, [participants, forceUpdateSubscriptions]);

  // 2. Strict Role-Segmented LiveKit Subscription Engine
  useEffect(() => {
    const updateSubscriptions = () => {
      participants.forEach((p) => {
        const handshake = handshakesRef.current[p.identity];
        
        // Handshake Wait State: Do NOT subscribe to tracks in 'waiting' state
        if (!handshake || handshake.status === "waiting") {
          p.trackPublications.forEach((pub) => {
            if ("setSubscribed" in pub && pub.isSubscribed) {
              try { pub.setSubscribed(false); } catch (e) {}
            }
          });
          return;
        }

        // Resolve Remote Role
        let remoteRole = "candidate";
        try {
          if (p.metadata) {
            const meta = JSON.parse(p.metadata);
            if (meta.role) remoteRole = meta.role.toLowerCase();
          }
        } catch (e) {
          const raw = p.metadata?.trim().toLowerCase();
          if (raw === "admin" || raw === "interviewer") remoteRole = raw;
        }

        const nameLower = (p.name || "").toLowerCase();
        const identityLower = p.identity.toLowerCase();
        if (identityLower.includes("admin") || nameLower.includes("admin")) remoteRole = "admin";
        else if (identityLower.includes("interviewer") || nameLower.includes("interviewer")) remoteRole = "interviewer";

        const isRemoteModerator = remoteRole === "admin" || remoteRole === "interviewer";

        p.trackPublications.forEach((pub) => {
          if (!("setSubscribed" in pub)) return;
          
          if (isLocalModerator) {
            // Moderator: subscribe to ALL candidate audio/video + screenshares
            if (!pub.isSubscribed) {
              try { pub.setSubscribed(true); } catch (e) {}
            }
          } else {
            // Candidate:
            // - subscribe ONLY to interviewer/admin audio
            // - never subscribe to other candidate streams
            if (isRemoteModerator) {
              if (pub.kind === Track.Kind.Audio) {
                if (!pub.isSubscribed) {
                  try { pub.setSubscribed(true); } catch (e) {}
                }
              } else {
                // Do not subscribe to moderator video in candidate isolation mode
                if (pub.isSubscribed) {
                  try { pub.setSubscribed(false); } catch (e) {}
                }
              }
            } else {
              // Remote candidate stream: block subscription
              if (pub.isSubscribed) {
                try { pub.setSubscribed(false); } catch (e) {}
              }
            }
          }
        });
      });
    };

    updateSubscriptions();

    participants.forEach((p) => {
      p.on("trackPublished", updateSubscriptions);
      p.on("trackUnpublished", updateSubscriptions);
      p.on("trackSubscribed", updateSubscriptions);
      p.on("trackUnsubscribed", updateSubscriptions);
    });

    return () => {
      participants.forEach((p) => {
        p.off("trackPublished", updateSubscriptions);
        p.off("trackUnpublished", updateSubscriptions);
        p.off("trackSubscribed", updateSubscriptions);
        p.off("trackUnsubscribed", updateSubscriptions);
      });
    };
  }, [participants, isLocalModerator, subscriptionTrigger]);

  // 3. Audio Recovery Logic & Automatic Reconnection Sync
  useEffect(() => {
    if (!room) return;

    const handleRecoveryTrigger = (reason: string) => {
      console.log(`[Audio Recovery] Triggering subscription refresh due to: ${reason}`);
      forceUpdateSubscriptions();
      
      if ((room as any).canPlaybackAudio ?? (room as any).canPlayAudio) {
        room.startAudio().catch((err) => {
          console.warn("[Audio Recovery] Failed to start audio playback automatically:", err);
        });
      }
    };

    const handleSubscriptionFailed = (trackSid: string, participant: any) => {
      console.error(`[Audio Recovery] Subscription failed for track ${trackSid} of participant ${participant.identity}`);
      handleRecoveryTrigger(`Subscription failed for track ${trackSid}`);
    };

    const handleReconnected = () => {
      handleRecoveryTrigger("Room reconnected");
    };

    const handleParticipantConnected = (p: any) => {
      handleRecoveryTrigger(`Participant ${p.name || p.identity} connected`);
    };

    const handleTrackMuted = (pub: any, p: any) => {
      if (pub.kind === Track.Kind.Audio) {
        forceUpdateSubscriptions();
      }
    };

    const handleTrackUnmuted = (pub: any, p: any) => {
      if (pub.kind === Track.Kind.Audio) {
        forceUpdateSubscriptions();
      }
    };

    room.on("trackSubscriptionFailed", handleSubscriptionFailed);
    room.on("reconnected", handleReconnected);
    room.on("participantConnected", handleParticipantConnected);
    room.on("trackMuted", handleTrackMuted);
    room.on("trackUnmuted", handleTrackUnmuted);

    return () => {
      room.off("trackSubscriptionFailed", handleSubscriptionFailed);
      room.off("reconnected", handleReconnected);
      room.off("participantConnected", handleParticipantConnected);
      room.off("trackMuted", handleTrackMuted);
      room.off("trackUnmuted", handleTrackUnmuted);
    };
  }, [room, forceUpdateSubscriptions]);

  // Active speaker auto-focus for moderator proctoring
  useEffect(() => {
    if (!isLocalModerator || isPinnedMode) return;

    const handleSpeakingChange = (p: any, speaking: boolean) => {
      if (speaking) {
        let remoteRole = "candidate";
        try {
          if (p.metadata) {
            const meta = JSON.parse(p.metadata);
            if (meta.role) remoteRole = meta.role.toLowerCase();
          }
        } catch (e) {
          const raw = p.metadata?.trim().toLowerCase();
          if (raw === "admin" || raw === "interviewer") remoteRole = raw;
        }
        const nameLower = (p.name || "").toLowerCase();
        const identityLower = p.identity.toLowerCase();
        if (identityLower.includes("admin") || nameLower.includes("admin")) remoteRole = "admin";
        else if (identityLower.includes("interviewer") || nameLower.includes("interviewer")) remoteRole = "interviewer";

        if (remoteRole === "candidate") {
          setFocusedCandidateIdentity(p.identity);
        }
      }
    };

    participants.forEach((p) => {
      p.on("isSpeakingChanged", (speaking) => handleSpeakingChange(p, speaking));
    });

    return () => {
      participants.forEach((p) => {
        p.off("isSpeakingChanged", (speaking) => handleSpeakingChange(p, speaking));
      });
    };
  }, [participants, isLocalModerator, isPinnedMode]);

  // Initial candidate auto-focus for moderator proctoring
  useEffect(() => {
    if (!isLocalModerator || focusedCandidateIdentity) return;

    const firstCandidate = participants.find((p) => {
      let remoteRole = "candidate";
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          if (meta.role) remoteRole = meta.role.toLowerCase();
        }
      } catch (e) {
        const raw = p.metadata?.trim().toLowerCase();
        if (raw === "admin" || raw === "interviewer") remoteRole = raw;
      }
      const nameLower = (p.name || "").toLowerCase();
      const identityLower = p.identity.toLowerCase();
      if (identityLower.includes("admin") || nameLower.includes("admin")) remoteRole = "admin";
      else if (identityLower.includes("interviewer") || nameLower.includes("interviewer")) remoteRole = "interviewer";

      return remoteRole === "candidate";
    });

    if (firstCandidate) {
      setFocusedCandidateIdentity(firstCandidate.identity);
    }
  }, [participants, isLocalModerator, focusedCandidateIdentity]);

  // Fetch dynamic participant audio and video streams
  const cameraTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true }
  ]);

  const screenShareTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false }
  ]);
  const hasScreenShare = screenShareTracks.length > 0;
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("code");

  // Force navigate workspace tabs if screenshare starts
  useEffect(() => {
    if (hasScreenShare) {
      setActiveWorkspaceTab("screenshare");
      toast.info("A participant started screen sharing. Switched to view screen.");
    } else if (activeWorkspaceTab === "screenshare") {
      setActiveWorkspaceTab("code");
    }
  }, [hasScreenShare]);

  // Telemetry Sync Helper
  const logTelemetry = async (eventType: string, details: any = {}) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("interview_telemetry")
        .insert([
          {
            interview_id: roomId,
            event_type: eventType,
            details: {
              user: username,
              role: isInterviewer ? "interviewer" : "candidate",
              timestamp: new Date().toISOString(),
              ...details
            }
          }
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setTelemetryLogs((prev) => {
          if (prev.some((p) => p.id === data.id)) return prev;
          return [...prev, data];
        });
      }
      return data;
    } catch (err: any) {
      console.error("Telemetry logging failed:", err.message);
    }
  };

  // Broadcast focus status over WebRTC channels to update moderator dashboard cards
  const broadcastFocusStatus = (isFocused: boolean, isFullscreen: boolean, isMinimized: boolean = false) => {
    if (isInterviewer || isReadOnlyReview) return;
    const payload = JSON.stringify({
      type: "CANDIDATE_FOCUS_UPDATE",
      isFocused,
      isFullscreen,
      isMinimized,
      isScreenSharing: localParticipant?.isScreenShareEnabled || isScreenSharing,
      identity: localParticipant.identity
    });
    try {
      sendPresence(new TextEncoder().encode(payload), { reliable: true });
      sendControl(new TextEncoder().encode(payload), { reliable: true });
    } catch (e) {
      console.warn("Failed to broadcast focus status over WebRTC:", e);
    }
  };

  // Standardized automated infraction triggers
  const triggerInfraction = async (
    type: "TAB_SWITCH" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "SCREEN_SHARE_STOPPED" | "DEVTOOLS_SUSPECTED" | "MINIMIZED" | "WINDOW_MINIMIZED" | "ESC_EXIT" | "FULLSCREEN_ENTER",
    message: string
  ) => {
    if (isInterviewer || isReadOnlyReview || isLocked) return;

    // Guard against multiple rapid infractions (e.g. within 1.5 seconds)
    const now = Date.now();
    if (now - lastInfractionTimeRef.current < 1500) {
      return;
    }
    lastInfractionTimeRef.current = now;

    // Calculate next warning count
    const nextCount = warningsCount + 1;
    setWarningsCount(nextCount);

    const timestamp = new Date().toISOString();
    
    // Log telemetry in Supabase
    await logTelemetry(type, {
      count: nextCount,
      reason: message,
      candidate: username || "candidate",
      user: username || "candidate",
      timestamp
    });

    // Also log warning_issued event so getCandidateWarningsCount aggregates correctly
    await logTelemetry("warning_issued", {
      count: nextCount,
      reason: message,
      candidate: localParticipant.identity,
      recipient: localParticipant.identity,
      moderatorName: "System Proctor",
      timestamp
    });

    // Broadcast warning/infraction to interviewer
    const payload = JSON.stringify({
      type: "WARNING_ISSUED",
      infractionType: type,
      count: nextCount,
      reason: message,
      candidateIdentity: localParticipant.identity,
      candidateName: username || "Candidate",
      moderatorName: "System Proctor",
      timestamp
    });
    
    try {
      sendControl(new TextEncoder().encode(payload), { reliable: true });
      sendPresence(new TextEncoder().encode(payload), { reliable: true });
    } catch (err) {
      console.warn("Failed to broadcast infraction over WebRTC:", err);
    }

    // Instantly display details on popup modal for the candidate to acknowledge
    setActiveWarning({
      count: nextCount,
      reason: message,
      moderatorName: "System Proctor",
      timestamp
    });
    playWarningSound();

    toast.warning(`WARNING (${nextCount}/3): ${message}`);

    // If warnings exceed 3, lock session and auto-submit
    if (nextCount >= 3) {
      setIsLocked(true);
      autoSubmitAssessment(`Exceeded maximum infraction threshold (3 warnings): ${message}`);
    }
  };

  // Play premium synthesized siren alert using Web Audio API (cross-browser compatible)
  const playWarningSound = () => {
    if (typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc1.type = "sawtooth";
      osc2.type = "square";

      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc2.frequency.setValueAtTime(440, audioCtx.currentTime); // A4

      // Pitch oscillation
      osc1.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
      osc1.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.6);
      osc1.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.9);
      osc1.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 1.2);

      osc2.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.3);
      osc2.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 0.6);
      osc2.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.9);
      osc2.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 1.2);

      gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
      
      osc1.stop(audioCtx.currentTime + 1.5);
      osc2.stop(audioCtx.currentTime + 1.5);
    } catch (err) {
      console.error("Web Audio API warning sound failed to play:", err);
    }
  };

  // Auto-submit candidate assessment when infractions count reaches limit
  const autoSubmitAssessment = async (reason: string) => {
    try {
      setIsLocked(true);
      
      const draftKey = `draft_${roomId}`;
      let code = "// Auto-submitted code due to policy violation";
      let language = "javascript";
      if (typeof window !== "undefined") {
        const draft = localStorage.getItem(draftKey);
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            code = parsed.code || code;
            language = parsed.language || language;
          } catch (e) {}
        }
      }

      // Log submission to Supabase telemetry
      await logTelemetry("submission", { remarks: `Enforced Auto-submission: ${reason}` });
      
      const res = await autoSubmitInterviewAction(roomId, code, language);
      if (res.error) {
        console.error("Enforced auto-submit DB failure:", res.error);
      }
      
      // Broadcast finalization event to interviewer/admin
      const payload = JSON.stringify({ type: "SUBMISSION_FINALIZED" });
      sendControl(new TextEncoder().encode(payload), { reliable: true });
      
      toast.error("Assessment auto-submitted due to proctoring policy violations.");

      // Disconnect room
      room.disconnect();
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Auto-submission failed:", err);
    }
  };

  // Auto-submit candidate assessment when exam duration expires
  const handleAutoSubmitOnExpiry = async () => {
    try {
      setIsLocked(true);
      toast.error("Assessment duration has expired. Saving final draft and finalizing submission...");
      
      const draftKey = `draft_${roomId}`;
      let code = "// Auto-submitted code on session expiration";
      let language = "javascript";
      if (typeof window !== "undefined") {
        const draft = localStorage.getItem(draftKey);
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            code = parsed.code || code;
            language = parsed.language || language;
          } catch (e) {}
        }
      }

      const res = await autoSubmitInterviewAction(roomId, code, language);
      if (res.error) {
        toast.error("Failed to save final submission automatically: " + res.error);
      } else {
        toast.success("Final code saved successfully!");
      }

      // Broadcast finalization event to interviewer/admin
      const payload = JSON.stringify({ type: "SUBMISSION_FINALIZED" });
      sendControl(new TextEncoder().encode(payload), { reliable: true });

      // Disconnect room
      room.disconnect();
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Auto-submit on expiry error:", err);
    }
  };

  // Helper to retrieve warning counts per candidate from telemetry logs
  const getCandidateWarningsCount = (candidateNameOrIdentity: string) => {
    const candidateWarnings = telemetryLogs.filter(
      (log) => 
        (log.event_type === "warning_issued" ||
         log.event_type === "TAB_SWITCH" ||
         log.event_type === "WINDOW_BLUR" ||
         log.event_type === "MINIMIZED" ||
         log.event_type === "WINDOW_MINIMIZED" ||
         log.event_type === "FULLSCREEN_EXIT" ||
         log.event_type === "ESC_EXIT") && 
        (log.details?.candidate === candidateNameOrIdentity || 
         log.details?.recipient === candidateNameOrIdentity ||
         log.details?.user === candidateNameOrIdentity)
    );
    return candidateWarnings.length;
  };

  // Realtime Control Data Channel (for warnings and locks)
  const { send: rawSendControl } = useDataChannel("control-sync", (msg) => {
    const payload = new TextDecoder().decode(msg.payload);
    try {
      const data = JSON.parse(payload);
      if (data.type === "MODE_UPDATE") {
        setInterviewMode(data.mode);
        toast.info(`Interviewer switched room mode to: ${data.mode.toUpperCase()}`);
      } else if (data.type === "WARNING_ISSUED") {
        // Enforce candidate identity filtering ONLY for candidates
        if (!isLocalModerator && data.candidateIdentity && data.candidateIdentity !== localParticipant.identity) {
          return;
        }

        // Prevent duplicate warning event handling (bounds checking) for candidates
        if (!isLocalModerator && data.count <= warningsCount) return;

        if (!isLocalModerator) {
          setWarningsCount(data.count);
          // Instantly display details on popup modal if not moderator
          setActiveWarning({
            count: data.count,
            reason: data.reason,
            moderatorName: data.moderatorName || "System Moderator",
            timestamp: data.timestamp || new Date().toISOString()
          });
          playWarningSound();
        } else {
          // If we are the moderator, append this infraction directly to the in-memory telemetry logs!
          const newInfractionLog = {
            id: `webrtc-${Date.now()}-${Math.random()}`,
            interview_id: roomId,
            event_type: data.infractionType || "warning_issued",
            created_at: data.timestamp || new Date().toISOString(),
            details: {
              candidate: data.candidateIdentity,
              user: data.candidateName || data.candidateIdentity,
              role: "candidate",
              reason: data.reason,
              timestamp: data.timestamp || new Date().toISOString(),
              severity: "high"
            }
          };
          setTelemetryLogs(prev => {
            // Avoid duplicates
            if (prev.some(log => log.details?.timestamp === newInfractionLog.details.timestamp && log.event_type === newInfractionLog.event_type)) {
              return prev;
            }
            return [...prev, newInfractionLog];
          });
        }

        toast.warning(`WARNING ISSUED (${data.count}/3): ${data.reason}`);
        if (data.count >= 3) {
          setIsLocked(true);
          if (!isLocalModerator) {
            autoSubmitAssessment(data.reason);
          }
        }
      } else if (data.type === "LOCK_SESSION") {
        // Enforce candidate identity filtering
        if (data.candidateIdentity && data.candidateIdentity !== localParticipant.identity) {
          return;
        }
        setIsLocked(true);
        setLockReason(data.reason || "Locked by moderator");
        toast.error("Your assessment session has been locked.");
      } else if (data.type === "UNLOCK_SESSION") {
        // Enforce candidate identity filtering
        if (data.candidateIdentity && data.candidateIdentity !== localParticipant.identity) {
          return;
        }
        setIsLocked(false);
        setLockReason("");
        toast.success("Your assessment session has been unlocked. You may resume your work.");
      } else if (data.type === "SUBMISSION_FINALIZED") {
        setIsLocked(true);
        toast.success("Candidate finalized and submitted their assessment.");
      } else if (data.type === "TIME_EXTENDED") {
        toast.success(`Interviewer extended interview duration by ${data.addedMinutes} minutes!`);
        setTimeExtendedMinutes(data.totalExtended || 0);
      } else if (data.type === "FORCE_TERMINATE") {
        // Enforce candidate identity filtering if specified
        if (data.candidateIdentity && data.candidateIdentity !== localParticipant.identity) {
          return;
        }
        setIsLocked(true);
        toast.error("This session has been forcefully terminated by the proctor.");
        if (!isLocalModerator) {
          room.disconnect();
          router.push("/dashboard");
        }
      } else if (data.type === "CANDIDATE_FOCUS_UPDATE") {
        setCandidateFocusStates(prev => ({
          ...prev,
          [data.identity]: {
            isFocused: data.isFocused,
            isFullscreen: data.isFullscreen,
            isMinimized: data.isMinimized || false,
            isScreenSharing: data.isScreenSharing || false,
            timestamp: Date.now()
          }
        }));
      }
    } catch (e) {}
  });

  const sendControl = async (data: Uint8Array, options?: any) => {
    if (room && room.state === "connected" && localParticipant) {
      try {
        await rawSendControl(data, options);
      } catch (err) {
        console.warn("[WebRTC Control] Failed to send control message:", err);
      }
    } else {
      console.log("[WebRTC Control] Skipped rawSendControl: room not connected.");
    }
  };

  // Warning Issue Helper
  const issueWarning = async (reason: string, targetCandidate?: { identity: string; name: string }) => {
    const candidateNameOrId = targetCandidate ? targetCandidate.identity : (focusedCandidateIdentity || "candidate");
    
    // Find candidate warnings specifically from telemetry logs
    const candidateWarningsCount = getCandidateWarningsCount(candidateNameOrId);
    const nextCount = candidateWarningsCount + 1;
    
    if (!targetCandidate || targetCandidate.identity === focusedCandidateIdentity) {
      setWarningsCount(nextCount);
    }
    
    const moderatorName = localParticipant.name || username || "Interviewer";
    const timestamp = new Date().toISOString();

    // Log warning in Supabase with candidate identity
    await logTelemetry("warning_issued", { 
      count: nextCount, 
      reason, 
      moderatorName, 
      timestamp,
      candidate: candidateNameOrId,
      recipient: candidateNameOrId
    });
    
    // Broadcast warning with candidateIdentity filter
    const controlPayload = JSON.stringify({
      type: "WARNING_ISSUED",
      count: nextCount,
      reason,
      moderatorName,
      timestamp,
      candidateIdentity: candidateNameOrId
    });
    sendControl(new TextEncoder().encode(controlPayload), { reliable: true });

    toast.warning(`Warning ${nextCount}/3 issued to candidate.`);

    if (nextCount >= 3) {
      const lockPayload = JSON.stringify({ 
        type: "LOCK_SESSION",
        candidateIdentity: candidateNameOrId
      });
      sendControl(new TextEncoder().encode(lockPayload), { reliable: true });
    }
  };

  // Load telemetry, warnings, and scheduled interviews details on load
  useEffect(() => {
    const loadInterviewDetails = async () => {
      const supabase = createClient();
      
      const { data: interviewData } = await supabase
        .from("interviews")
        .select("*, candidate:candidate_id(name, email)")
        .eq("id", roomId)
        .single();
        
      if (interviewData) {
        setSessionStatus(interviewData.session_status || "scheduled");
        setActualStartedAt(interviewData.actual_started_at);
        setCandidateJoinedAt(interviewData.candidate_joined_at);
        setTimeExtendedMinutes(interviewData.time_extended_minutes || 0);
        setScheduledAt(interviewData.scheduled_at);

        if (interviewData.candidate?.email?.includes(".test.")) {
          setIsTestCandidate(true);
        }

        if (interviewData.assessment_template_id) {
          setAssessmentTemplateId(interviewData.assessment_template_id);
          fetchAssessmentData(interviewData.assessment_template_id, interviewData.candidate_id);
        }

        if (interviewData.session_status === "terminated" || 
            interviewData.session_status === "submitted" || 
            interviewData.session_status === "completed" ||
            interviewData.session_status === "expired" ||
            interviewData.session_status === "missed" ||
            interviewData.session_status === "cancelled" ||
            interviewData.session_status === "canceled" ||
            interviewData.is_locked) {
          setIsLocked(true);
          if (interviewData.is_locked) {
            setLockReason(interviewData.lock_reason || "Locked by moderator");
          }
        }

        // Fetch duration_minutes from interview_sessions
        const { data: sessionData } = await supabase
          .from("interview_sessions")
          .select("duration_minutes")
          .eq("interview_id", roomId)
          .maybeSingle();

        if (sessionData?.duration_minutes) {
          setDurationMinutes(sessionData.duration_minutes);
        }

        // Find scheduled interview type
        const { data: scheduleData } = await supabase
          .from("scheduled_interviews")
          .select("interview_type")
          .eq("interviewer_id", interviewData.interviewer_id)
          .eq("scheduled_at", interviewData.scheduled_at)
          .maybeSingle();

        if (scheduleData?.interview_type) {
          setInterviewType(scheduleData.interview_type);
          const typeLower = scheduleData.interview_type.toLowerCase();
          if (typeLower.includes("hr") || typeLower.includes("behavior") || typeLower.includes("personal")) {
            setInterviewMode("hr");
          } else if (typeLower.includes("technical") || typeLower.includes("coding")) {
            setInterviewMode("live coding");
          } else {
            setInterviewMode("assessment");
          }
        }
      }

      // Load previous telemetry logs
      const { data: telemetry } = await supabase
        .from("interview_telemetry")
        .select("*")
        .eq("interview_id", roomId)
        .order("created_at", { ascending: true });

      if (telemetry) {
        setTelemetryLogs(telemetry);
        const warnings = telemetry.filter((t) => 
          t.event_type === "warning_issued" || 
          t.event_type === "TAB_SWITCH" || 
          t.event_type === "WINDOW_BLUR" || 
          t.event_type === "MINIMIZED" ||
          t.event_type === "WINDOW_MINIMIZED" ||
          t.event_type === "FULLSCREEN_EXIT" ||
          t.event_type === "ESC_EXIT"
        );
        setWarningsCount(warnings.length);
        
        if (warnings.length >= 3 || telemetry.some((t) => t.event_type === "submission")) {
          setIsLocked(true);
        }
      }
    };

    loadInterviewDetails();
  }, [roomId]);

  // Candidate-Authoritative session initialization strictly upon LiveKit connection
  useEffect(() => {
    if (isLocalModerator || actualStartedAt || isReadOnlyReview || room.state !== "connected") return;
    // FINALIZATION GUARD: Do NOT attempt to initialize if session is already finalized
    if (isSessionFinalized(sessionStatus)) return;

    const triggerStart = async () => {
      try {
        console.log("[Lobby Sync] Candidate connection established. Initializing authoritative session...");
        const res = await initializeInterviewSession(roomId);
        if (res.error) {
          console.warn("[Lobby Sync] Session initialization check:", res.error);
          // If the error is due to finalization, disconnect and redirect
          if (res.error.includes("permanently finalized")) {
            toast.error("This session has been permanently finalized.");
            room.disconnect();
            router.push("/dashboard");
          }
        } else if (res.interview) {
          console.log("[Lobby Sync] Authoritative session successfully started by candidate!");
          setSessionStatus(res.interview.session_status || "active");
          setActualStartedAt(res.interview.actual_started_at);
          setCandidateJoinedAt(res.interview.candidate_joined_at);
        }
      } catch (e) {
        console.error("[Lobby Sync] Failed to trigger start:", e);
      }
    };

    triggerStart();
  }, [room.state, isLocalModerator, actualStartedAt, isReadOnlyReview, roomId, sessionStatus]);

  // Enforce read-only review track state on connect
  useEffect(() => {
    if (isReadOnlyReview) {
      const enforceMuted = async () => {
        try {
          await localParticipant.setMicrophoneEnabled(false);
          await localParticipant.setCameraEnabled(false);
          await localParticipant.setScreenShareEnabled(false);
          setIsMicEnabled(false);
          setIsCamEnabled(false);
          setIsScreenSharing(false);
        } catch (e) {
          console.error("Failed to enforce muted tracks in readonly review mode:", e);
        }
      };
      enforceMuted();
    }
  }, [isReadOnlyReview, localParticipant]);

  // Supabase Realtime Channel for active interview updates
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel(`interview-session-sync:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "interviews",
          filter: `id=eq.${roomId}`
        },
        (payload: any) => {
          const updated = payload.new;
          if (!updated) return;
          
          setSessionStatus(updated.session_status || "scheduled");
          setActualStartedAt(updated.actual_started_at);
          setCandidateJoinedAt(updated.candidate_joined_at);
          
          if (updated.time_extended_minutes !== undefined) {
            const diff = updated.time_extended_minutes - timeExtendedMinutes;
            if (diff > 0) {
              toast.success(`Time extended by ${diff} minutes!`);
            }
            setTimeExtendedMinutes(updated.time_extended_minutes || 0);
          }
          
          if (updated.is_locked !== undefined) {
            setIsLocked(updated.is_locked);
            if (updated.is_locked) {
              setLockReason(updated.lock_reason || "Locked by moderator");
            } else {
              setLockReason("");
            }
          }

          if (updated.session_status === "terminated") {
            setIsLocked(true);
            toast.error("The interview session was forcefully terminated by the proctor.", {
              duration: 10000
            });
            room.disconnect();
            router.push("/dashboard");
          } else if (
            updated.session_status === "submitted" || 
            updated.session_status === "completed" || 
            updated.session_status === "expired" ||
            updated.session_status === "missed" ||
            updated.session_status === "cancelled" ||
            updated.session_status === "canceled"
          ) {
            setIsLocked(true);
            const statusUpper = updated.session_status.toUpperCase();
            toast.success(`The assessment is finalized: ${statusUpper}`, {
              duration: 5000
            });
            room.disconnect();
            router.push("/dashboard");
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "interview_telemetry",
          filter: `interview_id=eq.${roomId}`
        },
        (payload: any) => {
          const newLog = payload.new;
          if (!newLog) return;
          
          setTelemetryLogs((prev) => {
            if (prev.some((p) => p.id === newLog.id)) return prev;
            const updatedLogs = [...prev, newLog];
            
            // Sync local warningsCount for candidate
            const warnings = updatedLogs.filter((t) => 
              t.event_type === "warning_issued" || 
              t.event_type === "TAB_SWITCH" || 
              t.event_type === "WINDOW_BLUR" || 
              t.event_type === "MINIMIZED" ||
              t.event_type === "WINDOW_MINIMIZED" ||
              t.event_type === "FULLSCREEN_EXIT" ||
              t.event_type === "ESC_EXIT"
            );
            
            if (!isInterviewer && warnings.length > warningsCount) {
              setWarningsCount(warnings.length);
            }
            
            return updatedLogs;
          });
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, timeExtendedMinutes, room, router]);

  // Timer countdown ticking
  useEffect(() => {
    if (!actualStartedAt || isLocked) {
      return;
    }
    // FINALIZATION GUARD: Don't run the timer if the session is already finalized
    if (isSessionFinalized(sessionStatus)) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const start = new Date(actualStartedAt).getTime();
      const totalAllocatedMinutes = durationMinutes + timeExtendedMinutes;
      const elapsedSeconds = Math.floor((now - start) / 1000);
      const remaining = totalAllocatedMinutes * 60 - elapsedSeconds;

      if (remaining <= 0) {
        setRemainingSeconds(0);
        clearInterval(interval);
        
        // Auto-submit code when timer hits zero!
        if (!isInterviewer && !isLocked) {
          handleAutoSubmitOnExpiry();
        }
      } else {
        setRemainingSeconds(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [actualStartedAt, durationMinutes, timeExtendedMinutes, isLocked, isInterviewer]);

  // Periodically persist remaining seconds in DB (every 15 seconds) for admin auditing and recovery
  useEffect(() => {
    if (!actualStartedAt || isLocked || isInterviewer || remainingSeconds === null) {
      return;
    }

    const syncInterval = setInterval(async () => {
      const supabase = createClient();
      await supabase
        .from("interviews")
        .update({ remaining_seconds: remainingSeconds })
        .eq("id", roomId);
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [actualStartedAt, isLocked, isInterviewer, remainingSeconds, roomId]);

  // Presence channel for typing notifications
  const { send: rawSendPresence } = useDataChannel("presence", (msg) => {
    const payload = new TextDecoder().decode(msg.payload);
    try {
      const data = JSON.parse(payload);
      if (data.type === "TYPING") {
        setPeerIsTyping(data.isTyping);
      } else if (data.type === "INFRACTION" && isInterviewer) {
        toast.error(`INFRACTION: ${data.message}`);
      } else if (data.type === "CANDIDATE_FOCUS_UPDATE") {
        setCandidateFocusStates(prev => ({
          ...prev,
          [data.identity]: {
            isFocused: data.isFocused,
            isFullscreen: data.isFullscreen,
            isMinimized: data.isMinimized || false,
            isScreenSharing: data.isScreenSharing || false,
            timestamp: Date.now()
          }
        }));
      }
    } catch (e) {}
  });

  const sendPresence = async (data: Uint8Array, options?: any) => {
    if (room && room.state === "connected" && localParticipant) {
      try {
        await rawSendPresence(data, options);
      } catch (err) {
        console.warn("[WebRTC Presence] Failed to send presence message:", err);
      }
    } else {
      console.log("[WebRTC Presence] Skipped rawSendPresence: room not connected.");
    }
  };

  // Proctoring focus and tab switch tracking
  useEffect(() => {
    if (isInterviewer || isReadOnlyReview || isLocked || !actualStartedAt) return;

    const handleVisibilityChange = () => {
      const isMinimized = document.hidden && ((window.outerWidth === 0 && window.outerHeight === 0) || !document.hasFocus());
      if (document.hidden) {
        const type = isMinimized ? "WINDOW_MINIMIZED" : "TAB_SWITCH";
        const msg = isMinimized
          ? "Candidate minimized the assessment browser window!"
          : "Candidate switched tabs or minimized the browser!";
        triggerInfraction(type, msg);
        broadcastFocusStatus(false, !!document.fullscreenElement, isMinimized);
      } else {
        broadcastFocusStatus(document.hasFocus(), !!document.fullscreenElement, false);
      }
    };

    const handleBlur = () => {
      const isMinimized = (window.outerWidth === 0 && window.outerHeight === 0);
      const type = isMinimized ? "WINDOW_MINIMIZED" : "WINDOW_BLUR";
      const msg = isMinimized
        ? "Candidate minimized the assessment browser window!"
        : "Candidate clicked outside the assessment window / lost focus!";
      triggerInfraction(type, msg);
      broadcastFocusStatus(false, !!document.fullscreenElement, isMinimized);
    };

    const handleFocus = () => {
      broadcastFocusStatus(true, !!document.fullscreenElement, false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // Initial broadcast
    broadcastFocusStatus(document.hasFocus(), !!document.fullscreenElement, false);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isInterviewer, isReadOnlyReview, isLocked, actualStartedAt, warningsCount]);

  // Proctoring fullscreen change and pointer lock tracking
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreenActive(isCurrentlyFullscreen);
      
      if (!isInterviewer && !isLocked && actualStartedAt) {
        if (!isCurrentlyFullscreen) {
          const type = escPressedRef.current ? "ESC_EXIT" : "FULLSCREEN_EXIT";
          const msg = escPressedRef.current 
            ? "Candidate exited fullscreen using the ESC key!" 
            : "Candidate exited fullscreen focus mode!";
          triggerInfraction(type, msg);
          escPressedRef.current = false;
        } else {
          // Log FULLSCREEN_ENTER when successfully returning to fullscreen
          logTelemetry("FULLSCREEN_ENTER", { user: username, timestamp: new Date().toISOString() });
          
          // Broadcast FULLSCREEN_ENTER to moderator so the log is updated
          const enterPayload = JSON.stringify({
            type: "WARNING_ISSUED",
            infractionType: "FULLSCREEN_ENTER",
            count: warningsCount,
            reason: "Candidate entered fullscreen mode.",
            candidateIdentity: localParticipant.identity,
            candidateName: username || "Candidate",
            moderatorName: "System Proctor",
            timestamp: new Date().toISOString()
          });
          try {
            sendControl(new TextEncoder().encode(enterPayload), { reliable: true });
            sendPresence(new TextEncoder().encode(enterPayload), { reliable: true });
          } catch (e) {}
        }
        broadcastFocusStatus(document.hasFocus(), isCurrentlyFullscreen);
      }
    };

    const handlePointerLockChange = () => {
      console.log("[Proctor PointerLock]", !!document.pointerLockElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    
    // Initial sync
    setIsFullscreenActive(!!document.fullscreenElement);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [isInterviewer, isLocked, actualStartedAt, warningsCount]);

  // Clipboard copy/paste block
  useEffect(() => {
    if (isInterviewer || isReadOnlyReview || isLocked) return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logTelemetry("copy_paste", { action: "copy" });
      toast.error("Copying is disabled during active assessments.");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logTelemetry("copy_paste", { action: "paste" });
      toast.error("Pasting is disabled during active assessments.");
    };

    window.addEventListener("copy", handleCopy);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("paste", handlePaste);
    };
  }, [isInterviewer, isReadOnlyReview, isLocked]);

  // Inactivity / Idle Proctor (45 seconds)
  useEffect(() => {
    if (isInterviewer || isReadOnlyReview || isLocked) return;

    let idleTimer: NodeJS.Timeout;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        logTelemetry("idle", { duration_seconds: 45 });
        const alertPayload = JSON.stringify({
          type: "INFRACTION",
          event: "idle",
          message: "Candidate has been idle for over 45 seconds",
          timestamp: new Date().toISOString()
        });
        sendPresence(new TextEncoder().encode(alertPayload), { reliable: true });
      }, 45000);
    };

    resetIdleTimer();
    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keypress", resetIdleTimer);
    
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keypress", resetIdleTimer);
    };
  }, [isInterviewer, isReadOnlyReview, isLocked]);

  // Mute / Media infractions
  useEffect(() => {
    if (isInterviewer || isReadOnlyReview || isLocked) return;

    const handleTrackMuted = (publication: any) => {
      if (publication.source === Track.Source.Camera) {
        logTelemetry("camera_toggle", { enabled: false });
        const alertPayload = JSON.stringify({
          type: "INFRACTION",
          event: "camera_off",
          message: "Candidate disabled camera!",
          timestamp: new Date().toISOString()
        });
        sendPresence(new TextEncoder().encode(alertPayload), { reliable: true });
      } else if (publication.source === Track.Source.Microphone) {
        logTelemetry("microphone_toggle", { enabled: false });
        const alertPayload = JSON.stringify({
          type: "INFRACTION",
          event: "mic_off",
          message: "Candidate muted microphone!",
          timestamp: new Date().toISOString()
        });
        sendPresence(new TextEncoder().encode(alertPayload), { reliable: true });
      }
    };

    const handleTrackUnmuted = (publication: any) => {
      if (publication.source === Track.Source.Camera) {
        logTelemetry("camera_toggle", { enabled: true });
      } else if (publication.source === Track.Source.Microphone) {
        logTelemetry("microphone_toggle", { enabled: true });
      }
    };

    const handleLocalTrackPublished = (publication: any) => {
      if (publication.source === Track.Source.ScreenShare) {
        setIsScreenSharing(true);
        logTelemetry("SCREEN_SHARE_STARTED", { user: username });
        
        // Auto-maximize / enter fullscreen immersive exam mode
        if (!isInterviewer) {
          try {
             if (document.documentElement.requestFullscreen) {
               document.documentElement.requestFullscreen().then(() => {
                 setIsFullscreenActive(true);
               }).catch((e) => {
                 console.warn("Auto-fullscreen publish failed:", e);
               });
             }
          } catch (err) {
            console.warn("Auto-fullscreen publish error:", err);
          }
        }
      }
    };

    const handleLocalTrackUnpublished = (publication: any) => {
      if (publication.source === Track.Source.ScreenShare) {
        setIsScreenSharing(false);
        logTelemetry("SCREEN_SHARE_STOPPED", { user: username });
        if (!isInterviewer && !isLocked && actualStartedAt) {
          triggerInfraction("SCREEN_SHARE_STOPPED", "Candidate stopped their screen share stream!");
        }
      }
    };

    localParticipant.on("trackMuted", handleTrackMuted);
    localParticipant.on("trackUnmuted", handleTrackUnmuted);
    localParticipant.on("localTrackPublished", handleLocalTrackPublished);
    localParticipant.on("localTrackUnpublished", handleLocalTrackUnpublished);

    return () => {
      localParticipant.off("trackMuted", handleTrackMuted);
      localParticipant.off("trackUnmuted", handleTrackUnmuted);
      localParticipant.off("localTrackPublished", handleLocalTrackPublished);
      localParticipant.off("localTrackUnpublished", handleLocalTrackUnpublished);
    };
  }, [localParticipant, isInterviewer, isReadOnlyReview, isLocked, actualStartedAt]);

  // Devtools keyboard shortcuts and window resize detection
  useEffect(() => {
    if (isInterviewer || isReadOnlyReview || isLocked || !actualStartedAt) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape fullscreen exit detection
      if (e.key === "Escape" || e.key === "Esc") {
        if (document.fullscreenElement) {
          escPressedRef.current = true;
        }
      }

      // Devtools shortcuts: F12, Ctrl+Shift+I/J/C, Cmd+Opt+I
      const isDevToolsKeys = 
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.metaKey && e.altKey && (e.key === "I" || e.key === "i"));

      if (isDevToolsKeys) {
        e.preventDefault();
        e.stopPropagation();
        triggerInfraction("DEVTOOLS_SUSPECTED", "Candidate suspected of opening Devtools via keyboard shortcut!");
      }
    };

    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const threshold = 160;
        const widthDelta = window.outerWidth - window.innerWidth;
        const heightDelta = window.outerHeight - window.innerHeight;
        
        // Large discrepancy when fullscreen is suspected of opening Devtools
        if ((widthDelta > threshold || heightDelta > threshold) && document.fullscreenElement) {
          triggerInfraction("DEVTOOLS_SUSPECTED", "Candidate suspected of opening Devtools (window resize discrepancy)!");
        }
      }, 500);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [isInterviewer, isReadOnlyReview, isLocked, actualStartedAt, warningsCount]);

  // Prevent accidental exits with beforeunload
  useEffect(() => {
    if (isInterviewer || isReadOnlyReview || isLocked || !actualStartedAt) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Assessment is currently in progress. If you refresh or exit, an infraction will be logged and your exam may be submitted!";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isInterviewer, isReadOnlyReview, isLocked, actualStartedAt]);

  // Handle Unread Message Badge Increments
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    
    // Increment only if chat window is collapsed and message is remote
    if (!isChatOpen && lastMsg.from?.identity !== localParticipant.identity) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [chatMessages, isChatOpen, localParticipant.identity]);

  // Clean unread notifications on chat opening
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      // Expand right resizable panel
      const timer = setTimeout(() => {
        if (chatPanelRef.current) {
          chatPanelRef.current.expand();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Collapse right resizable panel
      if (chatPanelRef.current) {
        chatPanelRef.current.collapse();
      }
    }
  }, [isChatOpen]);

  // Scroll to bottom helper for message history
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, peerIsTyping]);

  // Input controller with typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    // Broadcast typing starts
    const payload = JSON.stringify({ type: "TYPING", isTyping: true });
    sendPresence(new TextEncoder().encode(payload), { reliable: true });

    if (typingTimeout) clearTimeout(typingTimeout);
    
    const timeout = setTimeout(() => {
      const stopPayload = JSON.stringify({ type: "TYPING", isTyping: false });
      sendPresence(new TextEncoder().encode(stopPayload), { reliable: true });
    }, 2000);
    setTypingTimeout(timeout);
  };

  // Submit messages
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim()) return;

    try {
      await sendChatMessage(messageInput);
      setMessageInput("");
      
      // Instantly clear typing indicator
      const stopPayload = JSON.stringify({ type: "TYPING", isTyping: false });
      sendPresence(new TextEncoder().encode(stopPayload), { reliable: true });
      if (typingTimeout) clearTimeout(typingTimeout);
    } catch (e: any) {
      toast.error("Failed to send message: " + e.message);
    }
  };

  // Toggles for control bars
  const toggleMic = useCallback(async () => {
    if (isReadOnlyReview || (isLocked && !isInterviewer)) {
      toast.error("Microphone controls are locked for this session.");
      return;
    }
    const nextState = !localParticipant.isMicrophoneEnabled;
    await localParticipant.setMicrophoneEnabled(nextState);
    setIsMicEnabled(nextState);
    toast.success(nextState ? "Microphone Unmuted" : "Microphone Muted");
  }, [localParticipant, isReadOnlyReview, isLocked, isInterviewer]);

  const toggleCam = useCallback(async () => {
    if (isReadOnlyReview || (isLocked && !isInterviewer)) {
      toast.error("Camera controls are locked for this session.");
      return;
    }
    const nextState = !localParticipant.isCameraEnabled;
    await localParticipant.setCameraEnabled(nextState);
    setIsCamEnabled(nextState);
    toast.success(nextState ? "Camera Enabled" : "Camera Disabled");
  }, [localParticipant, isReadOnlyReview, isLocked, isInterviewer]);

  const toggleScreenShare = useCallback(async () => {
    if (isReadOnlyReview || (isLocked && !isInterviewer)) {
      toast.error("Screen sharing controls are locked for this session.");
      return;
    }
    const nextState = !localParticipant.isScreenShareEnabled;

    if (nextState) {
      // 1. Immediately request fullscreen utilizing the active user gesture click context
      if (!isInterviewer) {
        try {
          if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            setIsFullscreenActive(true);
            setIsSidebarCollapsed(true); // Maximize workspace focus
          }
        } catch (err) {
          console.warn("Fullscreen request blocked or failed before screenshare prompt:", err);
        }
      }

      // 2. Launch display media screenshare prompt
      try {
        await localParticipant.setScreenShareEnabled(true);
        setIsScreenSharing(true);
        toast.success("Screen Share Started");
      } catch (err: any) {
        console.warn("Candidate screen sharing failed or canceled:", err);
        toast.error("Screen sharing is required to proceed. Please grant permissions.");
        setIsScreenSharing(false);
        // Exiting fullscreen since screen sharing failed or was canceled
        if (document.fullscreenElement) {
          try {
            await document.exitFullscreen();
            setIsFullscreenActive(false);
          } catch (ex) {}
        }
      }
    } else {
      // Candidate is stopping screensharing
      try {
        await localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        toast.success("Screen Share Stopped");
      } catch (err: any) {
        console.error("Failed to stop screen share stream:", err);
      }
    }
  }, [localParticipant, isReadOnlyReview, isLocked, isInterviewer]);

  const toggleChat = useCallback(() => {
    const nextState = !isChatOpen;
    setIsChatOpen(nextState);
    localStorage.setItem(`chatOpen_${roomId}`, String(nextState));
  }, [isChatOpen, roomId]);

  // Extend active session duration
  const handleExtendSession = async (minutes: number) => {
    try {
      const res = await extendInterviewSessionTime(roomId, minutes);
      if (res.error) {
        toast.error("Failed to extend session time: " + res.error);
      } else {
        toast.success(`Session time extended by ${minutes} minutes successfully!`);
        
        // Broadcast time extension control event to candidate so they see it immediately
        const payload = JSON.stringify({ 
          type: "TIME_EXTENDED", 
          addedMinutes: minutes,
          totalExtended: res.interview?.time_extended_minutes || 0
        });
        sendControl(new TextEncoder().encode(payload), { reliable: true });
      }
    } catch (err: any) {
      toast.error("Error extending session: " + err.message);
    }
  };

  // Force terminate candidate session
  const handleTerminateSession = async () => {
    if (!confirm("Are you sure you want to forcefully terminate this interview session? The candidate will be disconnected and locked out immediately.")) {
      return;
    }
    
    try {
      const res = await terminateInterviewSessionAction(roomId);
      if (res.error) {
        toast.error("Failed to terminate session: " + res.error);
      } else {
        toast.success("Session forcefully terminated!");
        
        // Broadcast termination control event to candidate
        const payload = JSON.stringify({ type: "FORCE_TERMINATE" });
        sendControl(new TextEncoder().encode(payload), { reliable: true });
        
        // Disconnect room
        room.disconnect();
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast.error("Error terminating session: " + err.message);
    }
  };

  const handleSubmitAssessment = async () => {
    try {
      setIsLocked(true);
      
      const draftKey = `draft_${roomId}`;
      let code = "// Submitted code";
      let language = "javascript";
      if (typeof window !== "undefined") {
        const draft = localStorage.getItem(draftKey);
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            code = parsed.code || code;
            language = parsed.language || language;
          } catch (e) {}
        }
      }

      // Log submission to telemetry
      await logTelemetry("submission", { remarks: candidateRemarks || "Manual candidate submission" });
      
      if (assessmentTemplateId && attempt) {
        const supabase = createClient();
        await supabase
          .from("assessment_attempts")
          .update({
            status: "completed",
            completed_at: new Date().toISOString()
          })
          .eq("id", attempt.id);
      }

      const res = await autoSubmitInterviewAction(roomId, code, language);
      if (res.error) {
        toast.error("Failed to finalize submission: " + res.error);
        setIsLocked(false);
        return;
      }
      
      // Broadcast submission finalization
      const payload = JSON.stringify({ type: "SUBMISSION_FINALIZED" });
      sendControl(new TextEncoder().encode(payload), { reliable: true });
      
      setIsSubmitModalOpen(false);
      toast.success("Your assessment has been successfully submitted and finalized!");

      // Disconnect room
      room.disconnect();
      router.push("/dashboard");
    } catch (err: any) {
      toast.error("Failed to submit assessment: " + err.message);
      setIsLocked(false);
    }
  };

  // Bind accessible keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      // Skip triggers if user is actively entering text anywhere on screen
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true" ||
          activeEl.classList.contains("input") ||
          activeEl.closest(".monaco-editor"))
      ) {
        return;
      }

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMic();
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        toggleCam();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        toggleChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMic, toggleCam, toggleChat]);

  // Avoid layout issues before hydration restores splits
  if (!isLayoutLoaded) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-950 items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-zinc-500 font-semibold tracking-wide">Constructing high-fidelity room components...</p>
      </div>
    );
  }

  // Calculate layout orientation
  const isTablet = windowWidth < 768;
  const isCompactLaptop = windowWidth >= 768 && windowWidth < 1024;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 relative">
      {/* Header bar */}
      <header className={cn(
        "shrink-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-lg z-30 select-none transition-all duration-300",
        !isLocalModerator && isFullscreenActive ? "h-11 px-4" : "h-14 px-6"
      )}>
        <div className="flex items-center gap-3">
          {/* Lobby State Machine Badge */}
          {(() => {
            const activeCandidates = participants.filter(isParticipantCandidate);
            const isCandidatePresent = activeCandidates.length > 0 || !isLocalModerator;

            if (sessionStatus === "completed" || sessionStatus === "submitted") {
              return (
                <span className="px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase border rounded-lg flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Assessment Finalized
                </span>
              );
            }
            if (sessionStatus === "terminated") {
              return (
                <span className="px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase border rounded-lg flex items-center gap-1.5 bg-red-500/10 text-red-400 border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Terminated
                </span>
              );
            }
            if (sessionStatus === "expired") {
              return (
                <span className="px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase border rounded-lg flex items-center gap-1.5 bg-red-500/10 text-red-400 border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Expired
                </span>
              );
            }

            if (actualStartedAt || isCandidatePresent) {
              return (
                <span className="px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase border rounded-lg flex items-center gap-1.5 bg-emerald-500/10 text-emerald-450 border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.05)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-450 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                  </span>
                  Interview Active
                </span>
              );
            }

            // Only show Waiting state for moderators - candidates never see this
            if (isLocalModerator) {
              return (
                <span className="px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase border rounded-lg flex items-center gap-1.5 bg-amber-500/10 text-amber-450 border-amber-500/20 animate-pulse">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-450 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                  </span>
                  Waiting for Candidate
                </span>
              );
            }

            // Candidate sees a connecting/ready state instead
            return (
              <span className="px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase border rounded-lg flex items-center gap-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-450 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
                Session Ready
              </span>
            );
          })()}

          <div className="h-4 w-px bg-zinc-800" />
          <h2 className="text-xs font-semibold text-zinc-300">
            Session ID: <span className="font-mono text-primary font-bold">{roomId}</span>
          </h2>

          {/* Animated Authoritative Live Timer */}
          {actualStartedAt && remainingSeconds !== null ? (
            <span className={cn(
              "ml-3 px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wider font-mono flex items-center gap-1.5 border backdrop-blur-md transition-all duration-300",
              remainingSeconds <= 300 
                ? "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.15)]" 
                : "bg-zinc-850 text-emerald-400 border-zinc-700/50"
            )}>
              <Timer className="w-3.5 h-3.5" />
              {formatHHMMSS(remainingSeconds)}
            </span>
          ) : (
            isLocalModerator && (
              <span className="ml-3 px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wider font-mono bg-zinc-850 text-zinc-450 border border-zinc-700/30 flex items-center gap-1.5">
                <Hourglass className="w-3.5 h-3.5 animate-pulse text-amber-500/60" />
                Timer: Awaiting Join
              </span>
            )
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Active Participant Count Badge */}
          {(() => {
            const activeCandidates = participants.filter(isParticipantCandidate);
            const isCandidatePresent = activeCandidates.length > 0 || !isLocalModerator;
            return (
              <div className={cn(
                "hidden sm:flex items-center gap-1.5 px-3 py-1 border rounded-lg transition-all duration-300 bg-zinc-850",
                isCandidatePresent 
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
                  : "border-zinc-800 text-zinc-450"
              )}>
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {getActiveUniqueParticipantsCount()} Present
                </span>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full inline-block",
                  isCandidatePresent ? "bg-emerald-450 shadow-[0_0_8px_#34d399]" : "bg-zinc-600"
                )} />
              </div>
            );
          })()}
          
          {isLocalModerator ? (
            <Button 
              onClick={handleEndInterview}
              disabled={isEnding || isProcessingFeedback}
              variant="destructive"
              className="bg-red-650 hover:bg-red-600 border border-red-700/30 text-white font-bold tracking-wide shadow-lg shadow-red-955/20 text-[10px] uppercase px-4 h-9 cursor-pointer transition-all duration-300"
            >
              {isEnding || isProcessingFeedback ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                "End Interview"
              )}
            </Button>
          ) : (
            !isLocked && (
              <Button
                onClick={() => setIsSubmitModalOpen(true)}
                disabled={isLocked}
                className="bg-emerald-650 hover:bg-emerald-600 border border-emerald-700/30 text-white font-bold tracking-wide shadow-lg shadow-emerald-955/20 text-[10px] uppercase px-4 h-9 cursor-pointer transition-all duration-300"
              >
                Submit Assessment
              </Button>
            )
          )}
        </div>
      </header>

      {/* Main split work area - Structurally Redesigned with CSS Grid & Flexbox */}
      <div className="flex-1 min-h-0 relative select-none">
        {isLocalModerator ? (
          /* ========================================================================= */
          /* 1. ENTERPRISE MODERATOR LAYOUT                                            */
          /* ========================================================================= */
          <div className={cn(
            "w-full h-full bg-zinc-950 overflow-hidden",
            isTablet 
              ? "flex flex-col" 
              : "grid grid-cols-[280px_1fr_340px] h-[calc(100vh-56px)]"
          )}>
            {/* LEFT SIDEBAR: Participant Video Column & Hardware/Status Indicators */}
            <aside className={cn(
              "shrink-0 bg-zinc-950 border-zinc-800 flex flex-col min-h-0 select-none",
              isTablet 
                ? "w-full h-[130px] flex-row items-center border-b p-3 gap-3 overflow-x-auto overflow-y-hidden" 
                : "w-[280px] h-full border-r p-4 gap-4 overflow-y-auto scrollbar-none"
            )}>
              <div className={cn(
                "flex gap-3 min-h-0",
                isTablet ? "flex-row items-center" : "flex-col w-full"
              )}>
                {cameraTracks.map((trackRef) => {
                  const p = trackRef.participant;
                  const isSelf = p.identity === localParticipant.identity;

                  // Decode role
                  let remoteRole = "candidate";
                  try {
                    if (p.metadata) {
                      const meta = JSON.parse(p.metadata);
                      if (meta.role) remoteRole = meta.role.toLowerCase();
                    }
                  } catch (e) {
                    const raw = p.metadata?.trim().toLowerCase();
                    if (raw === "admin" || raw === "interviewer") remoteRole = raw;
                  }
                  const nameLower = (p.name || "").toLowerCase();
                  const identityLower = p.identity.toLowerCase();
                  if (identityLower.includes("admin") || nameLower.includes("admin")) remoteRole = "admin";
                  else if (identityLower.includes("interviewer") || nameLower.includes("interviewer")) remoteRole = "interviewer";

                  const isCandidate = remoteRole === "candidate";
                  const isFocused = focusedCandidateIdentity === p.identity;

                  return (
                    <div 
                      key={`${p.identity}-${trackRef.source}`}
                      onClick={() => {
                        if (isCandidate && !isSelf) {
                          setFocusedCandidateIdentity(p.identity);
                          setActiveWorkspaceTab("monitor");
                          toast.info(`Focused proctoring stream on candidate: ${p.name || p.identity}`);
                        }
                      }}
                      className={cn(
                        "shrink-0 transition-all duration-300",
                        isTablet ? "w-[160px]" : "w-full",
                        isCandidate && !isSelf && "cursor-pointer hover:scale-[1.02]",
                        isFocused && "ring-2 ring-indigo-500 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      )}
                    >
                      <ParticipantTile 
                        trackRef={trackRef} 
                        isLocal={isSelf} 
                        warningsCount={isCandidate ? warningsCount : undefined}
                      />
                    </div>
                  );
                })}
                <RoomAudioRenderer />
              </div>

              {/* Hardware Link Quality & System Diagnostics (Desktop only) */}
              {!isTablet && (
                <div className="mt-auto pt-4 border-t border-zinc-900/60 flex flex-col gap-2 select-none">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    <span>Host Link</span>
                    <span className="text-indigo-400 font-extrabold">Active</span>
                  </div>
                  <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-3 space-y-1.5 font-mono text-[9px] text-zinc-400">
                    <div className="flex items-center justify-between">
                      <span>Server RTT:</span>
                      <span className="text-zinc-300 font-semibold">14ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Live Bitrate:</span>
                      <span className="text-zinc-300 font-semibold">1200 kbps</span>
                    </div>
                  </div>
                </div>
              )}
            </aside>

            {/* CENTER WORKSPACE: Collaborative Monaco Editor & Central Problem Context */}
            <main className="flex-1 min-w-0 bg-zinc-950 flex flex-col h-full overflow-hidden">
              <Tabs value={activeWorkspaceTab} onValueChange={setActiveWorkspaceTab} className="h-full flex flex-col min-h-0 relative">
                <div className="h-12 shrink-0 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between select-none">
                  <TabsList className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-0.5">
                    <TabsTrigger value="problem" className="data-[state=active]:bg-zinc-800/80 data-[state=active]:text-white font-semibold text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-md cursor-pointer transition">
                      <FileCode2 className="w-3.5 h-3.5" />
                      Problem Context
                    </TabsTrigger>
                    <TabsTrigger value="code" className="data-[state=active]:bg-zinc-800/80 data-[state=active]:text-white font-semibold text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-md cursor-pointer transition">
                      <Terminal className="w-3.5 h-3.5" />
                      Coding Workspace
                    </TabsTrigger>
                    <TabsTrigger value="monitor" className="data-[state=active]:bg-indigo-650/80 data-[state=active]:text-white font-semibold text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-md cursor-pointer transition">
                      <Radio className="w-3.5 h-3.5" />
                      Proctor Monitor
                    </TabsTrigger>
                    {hasScreenShare && (
                      <TabsTrigger value="screenshare" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-md cursor-pointer transition animate-pulse">
                        <Tv className="w-3.5 h-3.5 text-primary" />
                        Screen Share View
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>
                
                <div className="flex-1 min-h-0 relative">
                  <TabsContent value="problem" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0">
                    <ProblemPanel 
                      interviewId={roomId}
                      problem={problemStatement} 
                      onProblemUpdate={setProblemStatement}
                      isInterviewer={isLocalModerator}
                      assessmentTemplateId={assessmentTemplateId}
                      questions={questions}
                      activeQIdx={activeQIdx}
                      onQuestionSelect={handleQuestionSelect}
                      attempt={attempt}
                    />
                  </TabsContent>
                  <TabsContent value="code" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0">
                    <CodingEnvironment 
                      interviewId={roomId} 
                      problemStatement={problemStatement} 
                      isInterviewer={isLocalModerator}
                      isLocked={isLocked}
                      interviewMode={interviewMode}
                      assessmentTemplateId={assessmentTemplateId}
                      questions={questions}
                      activeQIdx={activeQIdx}
                      onQuestionSelect={handleQuestionSelect}
                      attempt={attempt}
                      onCodeSubmitted={handleCodeSubmitted}
                    />
                  </TabsContent>
                  
                  {/* Proctor Monitor Tab Content */}
                  <TabsContent value="monitor" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0 flex flex-col bg-zinc-950 overflow-hidden select-none">
                    {(() => {
                      const activeCandidates = participants.filter(isParticipantCandidate);
                      
                      if (activeCandidates.length === 0) {
                        return (
                          <div className="flex-grow flex flex-col items-center justify-center p-8 bg-zinc-950 text-center select-none">
                            <div className="relative mb-6">
                              <div className="w-20 h-20 rounded-full bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-950/30">
                                <Users className="w-9 h-9 animate-pulse" />
                              </div>
                              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-white tracking-wide">Scanning for Candidate Connections...</h3>
                            <p className="text-xs text-zinc-400 max-w-sm mt-2 leading-relaxed">
                              Proctoring systems are fully active. Awaiting candidate connection to establish secure WebRTC audio, video, and screen share proctor pipelines.
                            </p>
                          </div>
                        );
                      }

                      if (isProctorGridView) {
                        return (
                          <div className="flex-grow flex flex-col min-h-0 bg-zinc-950">
                            {/* Grid View Title Bar */}
                            <div className="bg-zinc-900 border-b border-zinc-800 p-4 shrink-0 flex flex-wrap items-center justify-between gap-4 select-none">
                              <div>
                                <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
                                  <LayoutGrid className="w-4 h-4 text-indigo-400 animate-pulse" />
                                  Multi-Candidate Monitor Deck
                                </h3>
                                <p className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider mt-0.5">
                                  Live assessment telemetry and connection feeds
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 bg-zinc-950 p-1 border border-zinc-855 rounded-xl">
                                <Button
                                  onClick={() => setIsProctorGridView(true)}
                                  className={cn(
                                    "h-7 text-[9px] font-bold uppercase px-3 rounded-lg cursor-pointer transition",
                                    isProctorGridView
                                      ? "bg-indigo-650 text-white shadow-md shadow-indigo-950/20"
                                      : "bg-transparent text-zinc-400 hover:text-zinc-300"
                                  )}
                                >
                                  Grid View ({activeCandidates.length})
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (focusedCandidateIdentity && activeCandidates.some(c => c.identity === focusedCandidateIdentity)) {
                                      setIsProctorGridView(false);
                                    } else {
                                      setFocusedCandidateIdentity(activeCandidates[0].identity);
                                      setIsProctorGridView(false);
                                    }
                                  }}
                                  className={cn(
                                    "h-7 text-[9px] font-bold uppercase px-3 rounded-lg cursor-pointer transition",
                                    !isProctorGridView
                                      ? "bg-indigo-650 text-white shadow-md shadow-indigo-950/20"
                                      : "bg-transparent text-zinc-400 hover:text-zinc-300"
                                  )}
                                >
                                  Focus View
                                </Button>
                              </div>
                            </div>

                            {/* Responsive Candidate Card Grid */}
                            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 scrollbar-none">
                              {activeCandidates.map((p) => {
                                const candCameraTrack = cameraTracks.find(t => t.participant.identity === p.identity);
                                const candScreenShareTrack = screenShareTracks.find(t => t.participant.identity === p.identity);
                                const tabOuts = telemetryLogs.filter(log => (log.event_type === "tab_switch" || log.event_type === "TAB_SWITCH" || log.event_type === "WINDOW_BLUR" || log.event_type === "MINIMIZED" || log.event_type === "WINDOW_MINIMIZED") && (log.details?.candidate === p.identity || log.details?.user === p.name || log.details?.user === p.identity)).length;
                                const fullExits = telemetryLogs.filter(log => (log.event_type === "fullscreen_exit" || log.event_type === "FULLSCREEN_EXIT" || log.event_type === "ESC_EXIT") && (log.details?.candidate === p.identity || log.details?.user === p.name || log.details?.user === p.identity)).length;
                                const idles = telemetryLogs.filter(log => log.event_type === "idle" && (log.details?.candidate === p.identity || log.details?.user === p.name || log.details?.user === p.identity)).length;
                                const warnings = getCandidateWarningsCount(p.identity);
                                const isSpeaking = p.isSpeaking;
                                const connection = p.connectionQuality;

                                const borderClass = warnings >= 3
                                  ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse"
                                  : warnings > 0
                                    ? "border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                                    : isSpeaking
                                      ? "border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                      : "border-zinc-800 hover:border-zinc-700";

                                return (
                                  <div
                                    key={p.identity}
                                    className={cn(
                                      "bg-zinc-900/40 backdrop-blur-md border rounded-2xl p-4 flex flex-col gap-3.5 transition-all duration-300 relative group overflow-hidden",
                                      borderClass
                                    )}
                                  >
                                    {warnings >= 3 && (
                                      <div className="absolute inset-0 bg-red-950/5 pointer-events-none" />
                                    )}

                                    {/* Card Header */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className={cn(
                                          "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border",
                                          isSpeaking
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                            : "bg-zinc-950 border-zinc-800 text-zinc-400"
                                        )}>
                                          {(p.name || p.identity).split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-xs font-bold text-white block truncate max-w-[120px]">
                                            {p.name || p.identity}
                                          </span>
                                          <span className="text-[8px] text-zinc-550 font-mono block truncate max-w-[120px]">{p.identity}</span>
                                          
                                          {/* Live Focus & Fullscreen Badges */}
                                          {(() => {
                                            const focusState = candidateFocusStates[p.identity];
                                            const isCurrentlyFocused = focusState ? focusState.isFocused : true;
                                            const isCurrentlyFullscreen = focusState ? focusState.isFullscreen : true;
                                            const isCurrentlyScreenSharing = focusState ? !!focusState.isScreenSharing : false;
                                            const isCurrentlyMinimized = focusState ? !!focusState.isMinimized : false;
                                            return (
                                              <div className="flex items-center gap-1 mt-1 text-[7px] font-extrabold uppercase tracking-wide">
                                                <span className={cn(
                                                  "w-1.5 h-1.5 rounded-full inline-block shrink-0",
                                                  isCurrentlyMinimized 
                                                    ? "bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.6)] animate-ping" 
                                                    : isCurrentlyFocused 
                                                      ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" 
                                                      : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-ping"
                                                )} />
                                                <span className={
                                                  isCurrentlyMinimized 
                                                    ? "text-red-500 font-extrabold" 
                                                    : isCurrentlyFocused 
                                                      ? "text-emerald-400" 
                                                      : "text-red-400 font-bold"
                                                }>
                                                  {isCurrentlyMinimized ? "Minimized" : isCurrentlyFocused ? "Focused" : "Lost Focus"}
                                                </span>
                                                <span className="text-zinc-700 mx-0.5">|</span>
                                                <span className={isCurrentlyFullscreen ? "text-indigo-400" : "text-amber-400 animate-pulse font-bold"}>
                                                  {isCurrentlyFullscreen ? "Fullscreen" : "Exited FS"}
                                                </span>
                                                <span className="text-zinc-700 mx-0.5">|</span>
                                                <span className={isCurrentlyScreenSharing ? "text-emerald-450 font-extrabold animate-pulse" : "text-zinc-550"}>
                                                  {isCurrentlyScreenSharing ? "Screen Sharing" : "No Share"}
                                                </span>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>

                                      <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border",
                                        connection === ConnectionQuality.Excellent ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                                        connection === ConnectionQuality.Good ? "text-blue-400 border-blue-500/30 bg-blue-500/10" :
                                        "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                      )}>
                                        {connection === ConnectionQuality.Excellent ? "Excellent" :
                                         connection === ConnectionQuality.Good ? "Good" : "Weak"}
                                      </span>
                                    </div>

                                    {/* Video Feeds Side-by-Side */}
                                    <div className="grid grid-cols-2 gap-2 h-24 shrink-0">
                                      {/* Webcam Preview */}
                                      <div className="relative bg-black border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center">
                                        {candCameraTrack ? (
                                          <div className="w-full h-full object-cover">
                                            <ParticipantTile
                                              trackRef={candCameraTrack}
                                              isLocal={false}
                                              warningsCount={warnings}
                                            />
                                          </div>
                                        ) : (
                                          <span className="text-[9px] text-zinc-650 font-mono">Camera Off</span>
                                        )}
                                        <div className="absolute bottom-1.5 left-1.5 bg-black/75 px-1 py-0.5 rounded text-[6px] font-bold text-zinc-400 tracking-wider">
                                          WEBCAM
                                        </div>
                                      </div>

                                      {/* Screen Preview */}
                                      <div className="relative bg-black border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center">
                                        {candScreenShareTrack ? (
                                          <VideoTrack
                                            trackRef={candScreenShareTrack as any}
                                            className="w-full h-full object-contain"
                                          />
                                        ) : (
                                          <div className="flex flex-col items-center justify-center p-2 text-center text-zinc-700 w-full h-full bg-zinc-950/40">
                                            <Tv className="w-3.5 h-3.5 mb-0.5 text-zinc-750" />
                                            <span className="text-[6px] font-bold text-zinc-600">INACTIVE</span>
                                          </div>
                                        )}
                                        <div className="absolute bottom-1.5 left-1.5 bg-black/75 px-1 py-0.5 rounded text-[6px] font-bold text-zinc-400 tracking-wider">
                                          DESKTOP
                                        </div>
                                      </div>
                                    </div>

                                    {/* Telemetry Counter Metrics Grid */}
                                    <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-mono">
                                      <div className="bg-zinc-950/40 border border-zinc-850 rounded-lg py-1 flex flex-col justify-center">
                                        <span className="text-zinc-550 text-[7px] font-bold uppercase tracking-wider">Tab Out</span>
                                        <span className={cn("font-bold mt-0.5", tabOuts > 0 ? "text-amber-450" : "text-zinc-400")}>{tabOuts}</span>
                                      </div>
                                      <div className="bg-zinc-950/40 border border-zinc-855 rounded-lg py-1 flex flex-col justify-center">
                                        <span className="text-zinc-550 text-[7px] font-bold uppercase tracking-wider">Full Exit</span>
                                        <span className={cn("font-bold mt-0.5", fullExits > 0 ? "text-red-400" : "text-zinc-400")}>{fullExits}</span>
                                      </div>
                                      <div className="bg-zinc-950/40 border border-zinc-855 rounded-lg py-1 flex flex-col justify-center">
                                        <span className="text-zinc-550 text-[7px] font-bold uppercase tracking-wider">Idle</span>
                                        <span className={cn("font-bold mt-0.5", idles > 0 ? "text-amber-455 animate-pulse" : "text-zinc-400")}>{idles}</span>
                                      </div>
                                      <div className={cn(
                                        "border rounded-lg py-1 flex flex-col justify-center",
                                        warnings >= 3 ? "bg-red-500/10 border-red-500/20 text-red-400 font-bold" :
                                        warnings > 0 ? "bg-amber-500/10 border-amber-500/20 text-amber-400 font-bold" :
                                        "bg-zinc-950/40 border-zinc-850 text-zinc-400"
                                      )}>
                                        <span className="text-[7px] font-bold uppercase tracking-wider">Warnings</span>
                                        <span className="font-bold mt-0.5">{warnings}/3</span>
                                      </div>
                                    </div>

                                    {/* Exam Lifecycle Status & Ticking Timer */}
                                    <div className="grid grid-cols-2 gap-1 text-center text-[9px] font-mono mt-1">
                                      <div className="bg-zinc-950/40 border border-zinc-850 rounded-lg py-1 px-1.5 flex flex-col justify-center text-left">
                                        <span className="text-zinc-550 text-[7px] font-bold uppercase tracking-wider">Join Delay</span>
                                        <span className={cn(
                                          "font-bold mt-0.5 truncate",
                                          candidateJoinedAt && scheduledAt && 
                                          new Date(candidateJoinedAt).getTime() - new Date(scheduledAt).getTime() > 0 
                                            ? "text-red-400" 
                                            : "text-emerald-400"
                                        )}>
                                          {candidateJoinedAt && scheduledAt ? (
                                            (() => {
                                              const diff = new Date(candidateJoinedAt).getTime() - new Date(scheduledAt).getTime();
                                              if (diff <= 0) return "On Time";
                                              const m = Math.floor(diff / 60000);
                                              const s = Math.floor((diff % 60000) / 1000);
                                              return `+${m}m ${s}s Late`;
                                            })()
                                          ) : "Awaiting..."}
                                        </span>
                                      </div>
                                      
                                      <div className="bg-zinc-950/40 border border-zinc-850 rounded-lg py-1 px-1.5 flex flex-col justify-center text-left">
                                        <span className="text-zinc-550 text-[7px] font-bold uppercase tracking-wider">Live Timer</span>
                                        <span className={cn(
                                          "font-bold mt-0.5 flex items-center gap-1",
                                          remainingSeconds !== null && remainingSeconds <= 300 
                                            ? "text-red-400 animate-pulse font-extrabold" 
                                            : "text-emerald-400"
                                        )}>
                                          <Clock className="w-2.5 h-2.5" />
                                          {remainingSeconds !== null ? (
                                            `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`
                                          ) : "00:00"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Action Row */}
                                    <div className="flex gap-1.5 mt-2">
                                      <Button
                                        onClick={() => {
                                          setFocusedCandidateIdentity(p.identity);
                                          setIsProctorGridView(false);
                                          toast.info(`Switched focus to: ${p.name || p.identity}`);
                                        }}
                                        className="flex-grow h-7 text-[8px] font-bold uppercase bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer transition duration-300"
                                      >
                                        Focus
                                      </Button>
                                      
                                      <Button
                                        onClick={() => handleExtendSession(5)}
                                        className="h-7 px-2 text-[8px] font-bold uppercase bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg cursor-pointer transition duration-300"
                                        title="Extend session by 5 minutes"
                                      >
                                        +5m
                                      </Button>

                                      <Button
                                        onClick={() => {
                                          const reason = prompt(`Enter warning reason for candidate ${p.name || p.identity}:`, "Exited active browser page context");
                                          if (reason) issueWarning(reason, { identity: p.identity, name: p.name || p.identity });
                                        }}
                                        variant="outline"
                                        className="h-7 px-2 text-[8px] font-bold uppercase bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-lg cursor-pointer transition duration-300"
                                      >
                                        Warn
                                      </Button>
                                      
                                      <Button
                                        onClick={handleTerminateSession}
                                        variant="outline"
                                        className="h-7 w-7 p-0 flex items-center justify-center bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 rounded-lg cursor-pointer transition duration-300"
                                        title="Force Terminate Session"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // Focus View Mode
                      const focusedParticipant = participants.find(p => p.identity === focusedCandidateIdentity) || activeCandidates[0];
                      const focusedCameraTrack = cameraTracks.find(t => t.participant.identity === focusedParticipant.identity);
                      const focusedScreenShareTrack = screenShareTracks.find(t => t.participant.identity === focusedParticipant.identity);

                      const candidateName = focusedParticipant.name || focusedParticipant.identity;
                      const candidateLogs = telemetryLogs.filter(
                        log => log.details?.candidate === focusedParticipant.identity || log.details?.user === focusedParticipant.name || log.details?.user === focusedParticipant.identity
                      );
                      const focusedWarningsCount = getCandidateWarningsCount(focusedParticipant.identity);
                      
                      return (
                        <div className="h-full flex flex-col min-h-0 bg-zinc-950 relative">
                          {/* Fullscreen Proctor Inspection Portal */}
                          {isFullscreenMonitor && (
                            <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-xl z-50 flex flex-col p-6 space-y-4">
                              <div className="flex items-center justify-between border-b border-zinc-900 pb-3 select-none">
                                <div className="flex items-center gap-2.5">
                                  <ShieldAlert className="w-5 h-5 text-indigo-400 animate-pulse" />
                                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                    IMMERSIVE CANDIDATE PROCTOR INTERFACE — <span className="text-indigo-400">{candidateName}</span>
                                  </h2>
                                </div>
                                <Button
                                  onClick={() => setIsFullscreenMonitor(false)}
                                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white uppercase text-[10px] font-bold px-3 py-1 rounded-lg"
                                >
                                  Exit Fullscreen
                                </Button>
                              </div>
                              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black flex flex-col">
                                  {focusedCameraTrack ? (
                                    <ParticipantTile
                                      trackRef={focusedCameraTrack}
                                      isLocal={false}
                                      warningsCount={focusedWarningsCount}
                                    />
                                  ) : (
                                    <div className="flex-grow flex items-center justify-center text-zinc-550 font-mono text-xs">Camera Feed Inactive</div>
                                  )}
                                  <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur px-3 py-1 rounded-lg border border-zinc-800 text-[9px] font-extrabold text-zinc-300 tracking-wider">
                                    WEBCAM PREVIEW
                                  </div>
                                </div>
                                <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black flex flex-col">
                                  {focusedScreenShareTrack ? (
                                    <VideoTrack
                                      trackRef={focusedScreenShareTrack as any}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <div className="flex-grow flex flex-col items-center justify-center text-zinc-550 text-center p-6 bg-zinc-950/30">
                                      <Tv className="w-10 h-10 mb-2 text-zinc-850" />
                                      <span className="text-xs font-bold text-zinc-600">SCREEN SHARE INACTIVE</span>
                                    </div>
                                  )}
                                  <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur px-3 py-1 rounded-lg border border-zinc-800 text-[9px] font-extrabold text-zinc-300 tracking-wider">
                                    DESKTOP PRESENTATION
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Focus View Header bar */}
                          <div className="bg-zinc-900 border-b border-zinc-800 p-4 shrink-0 flex flex-wrap items-center justify-between gap-4 select-none">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border backdrop-blur-xl transition-all duration-300",
                                focusedParticipant.isSpeaking
                                  ? "border-emerald-500/80 text-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-pulse"
                                  : "border-zinc-700/50 text-zinc-400 bg-zinc-950"
                              )}>
                                {candidateName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white truncate max-w-[150px] block">
                                    {candidateName}
                                  </span>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border shadow-sm",
                                    focusedParticipant.connectionQuality === ConnectionQuality.Excellent ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                                    focusedParticipant.connectionQuality === ConnectionQuality.Good ? "text-blue-400 border-blue-500/30 bg-blue-500/10" :
                                    "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                  )}>
                                    {focusedParticipant.connectionQuality === ConnectionQuality.Excellent ? "Excellent" :
                                     focusedParticipant.connectionQuality === ConnectionQuality.Good ? "Good" : "Weak"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-550 font-mono mt-0.5 truncate max-w-[150px]">{focusedParticipant.identity}</p>
                              </div>
                            </div>

                            {/* Mic decibel meter */}
                            <div className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-850 px-4 py-2 rounded-xl">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Audio Monitor:</span>
                              <div className="flex items-center gap-1.5 h-6">
                                {focusedParticipant.isMicrophoneEnabled ? (
                                  <>
                                    <div className="flex items-end gap-0.5 h-3.5 w-10">
                                      <span className={cn("w-1 rounded-full bg-emerald-400 transition-all duration-150", focusedParticipant.isSpeaking ? "h-3 animate-pulse" : "h-1")} />
                                      <span className={cn("w-1 rounded-full bg-emerald-400 transition-all duration-150 delay-75", focusedParticipant.isSpeaking ? "h-4.5 animate-pulse" : "h-1")} />
                                      <span className={cn("w-1 rounded-full bg-emerald-400 transition-all duration-150 delay-150", focusedParticipant.isSpeaking ? "h-2.5 animate-pulse" : "h-1")} />
                                      <span className={cn("w-1 rounded-full bg-emerald-400 transition-all duration-150 delay-300", focusedParticipant.isSpeaking ? "h-4 animate-pulse" : "h-1")} />
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-400 animate-pulse">LIVE</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-end gap-0.5 h-1 w-10">
                                      <span className="w-1 h-1 rounded-full bg-red-500/50" />
                                      <span className="w-1 h-1 rounded-full bg-red-500/50" />
                                      <span className="w-1 h-1 rounded-full bg-red-500/50" />
                                      <span className="w-1 h-1 rounded-full bg-red-500/50" />
                                    </div>
                                    <span className="text-[10px] font-bold text-red-500 uppercase">MUTED</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Infraction metrics */}
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <div className="flex flex-col items-center px-2 py-1 bg-zinc-950/40 border border-zinc-850 rounded-lg">
                                <span className="text-[8px] text-zinc-550 font-bold uppercase tracking-wider">Tab Out</span>
                                <span className="text-xs font-bold text-zinc-300 mt-0.5">
                                  {candidateLogs.filter(log => log.event_type === "tab_switch" || log.event_type === "TAB_SWITCH" || log.event_type === "WINDOW_BLUR" || log.event_type === "MINIMIZED" || log.event_type === "WINDOW_MINIMIZED").length}
                                </span>
                              </div>
                              <div className="flex flex-col items-center px-2 py-1 bg-zinc-950/40 border border-zinc-850 rounded-lg">
                                <span className="text-[8px] text-zinc-550 font-bold uppercase tracking-wider">Full Exit</span>
                                <span className="text-xs font-bold text-zinc-300 mt-0.5">
                                  {candidateLogs.filter(log => log.event_type === "fullscreen_exit" || log.event_type === "FULLSCREEN_EXIT" || log.event_type === "ESC_EXIT").length}
                                </span>
                              </div>
                              <div className="flex flex-col items-center px-2 py-1 bg-zinc-950/40 border border-zinc-850 rounded-lg">
                                <span className="text-[8px] text-zinc-550 font-bold uppercase tracking-wider">Idle Flags</span>
                                <span className="text-xs font-bold text-zinc-300 mt-0.5">
                                  {candidateLogs.filter(log => log.event_type === "idle").length}
                                </span>
                              </div>
                              <div className="flex flex-col items-center px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <span className="text-[8px] text-amber-500 font-bold uppercase tracking-wider">Warnings</span>
                                <span className="text-xs font-bold text-amber-400 mt-0.5">
                                  {focusedWarningsCount} / 3
                                </span>
                              </div>
                            </div>

                            {/* Action panel */}
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => setIsPinnedMode(!isPinnedMode)}
                                variant="outline"
                                className={cn(
                                  "h-8 text-[9px] font-bold uppercase tracking-wider rounded-lg px-2.5 transition cursor-pointer",
                                  isPinnedMode
                                    ? "bg-indigo-650 hover:bg-indigo-600 text-white border-indigo-500"
                                    : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-zinc-350"
                                )}
                                title={isPinnedMode ? "Unpin Focus" : "Pin Focus on Candidate"}
                              >
                                {isPinnedMode ? "📌 Pinned" : "📍 Pin Focus"}
                              </Button>
                              <Button
                                onClick={() => setIsFullscreenMonitor(!isFullscreenMonitor)}
                                variant="outline"
                                className="h-8 text-[9px] font-bold uppercase tracking-wider bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-zinc-355 rounded-lg px-2.5 transition cursor-pointer"
                                title="Enter Fullscreen Proctor Mode"
                              >
                                <Maximize2 className="w-3.5 h-3.5 inline mr-1" /> Fullscreen
                              </Button>
                              
                              <Button
                                onClick={() => handleExtendSession(5)}
                                variant="outline"
                                className="h-8 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 rounded-lg px-2.5 transition cursor-pointer"
                                title="Extend candidate session by 5 minutes"
                              >
                                <Timer className="w-3.5 h-3.5 inline mr-1" /> +5 Min
                              </Button>
                              
                              <Button
                                onClick={() => {
                                  const reason = prompt(`Enter warning reason for candidate ${candidateName}:`, "Exited active browser page context");
                                  if (reason) issueWarning(reason, { identity: focusedParticipant.identity, name: focusedParticipant.name || focusedParticipant.identity });
                                }}
                                variant="outline"
                                className="h-8 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25 rounded-lg px-2.5 transition cursor-pointer animate-pulse"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> Warn
                              </Button>
                              
                              <Button
                                onClick={handleTerminateSession}
                                variant="outline"
                                className="h-8 text-[9px] font-bold uppercase tracking-wider bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 rounded-lg px-2.5 transition cursor-pointer"
                                title="Force Terminate Session"
                              >
                                <X className="w-3.5 h-3.5 inline mr-1" /> Terminate
                              </Button>
                              
                              <Button
                                onClick={() => setIsProctorGridView(true)}
                                className="h-8 text-[9px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-300 rounded-lg px-2.5 transition cursor-pointer"
                              >
                                <LayoutGrid className="w-3.5 h-3.5 inline mr-1" /> Grid View
                              </Button>
                            </div>
                          </div>

                          {/* Dual streams panel */}
                          <div className="flex-grow min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                            {/* Webcam feed */}
                            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-xl flex flex-col min-h-0">
                              <div className="absolute top-3 left-3 z-10 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-300 tracking-wider">
                                CAMERA STREAM
                              </div>
                              <div className="flex-grow flex items-center justify-center bg-black min-h-0">
                                {focusedCameraTrack ? (
                                  <div className="w-full h-full object-cover">
                                    <ParticipantTile
                                      trackRef={focusedCameraTrack}
                                      isLocal={false}
                                      warningsCount={focusedWarningsCount}
                                    />
                                  </div>
                                ) : (
                                  <div className="text-zinc-650 font-mono text-xs">No active camera stream</div>
                                )}
                              </div>
                            </div>

                            {/* Screen share feed */}
                            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-xl flex flex-col min-h-0">
                              <div className="absolute top-3 left-3 z-10 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-300 tracking-wider">
                                DESKTOP PRESENTATION
                              </div>
                              <div className="flex-grow flex items-center justify-center bg-black min-h-0">
                                {focusedScreenShareTrack ? (
                                  <VideoTrack
                                    trackRef={focusedScreenShareTrack as any}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3 shadow-lg">
                                      <Tv className="w-6 h-6" />
                                    </div>
                                    <span className="text-zinc-400 text-xs font-bold tracking-wide">Screen Share Inactive</span>
                                    <p className="text-[10px] text-zinc-650 max-w-xs leading-relaxed mt-1">
                                      The candidate has not initiated screen sharing. Monaco editors and tab focus telemetries are active.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Switcher Bar */}
                          <div className="shrink-0 bg-zinc-900 border-t border-zinc-800 p-3 select-none flex flex-col gap-2">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-1">Candidate Quick Switcher</span>
                            <div className="flex gap-3 overflow-x-auto scrollbar-none py-1">
                              {activeCandidates.map((cand) => {
                                const activeWarns = getCandidateWarningsCount(cand.identity);
                                const isFocused = cand.identity === focusedParticipant.identity;
                                const isSpeaking = cand.isSpeaking;

                                return (
                                  <button
                                    key={cand.identity}
                                    onClick={() => {
                                      setFocusedCandidateIdentity(cand.identity);
                                      toast.info(`Switched focus to: ${cand.name || cand.identity}`);
                                    }}
                                    className={cn(
                                      "shrink-0 flex items-center gap-3 px-3 py-1.5 rounded-xl border transition-all duration-300 text-left cursor-pointer",
                                      isFocused
                                        ? "bg-indigo-650 border-indigo-500 text-white shadow-lg shadow-indigo-950/20"
                                        : isSpeaking
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                                          : "bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold border",
                                      isFocused ? "bg-indigo-750 border-indigo-400 text-white" : "bg-zinc-900 border-zinc-800"
                                    )}>
                                      {(cand.name || cand.identity).split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-[10px] font-bold block truncate max-w-[80px] leading-tight">
                                        {cand.name || cand.identity}
                                      </span>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        {activeWarns > 0 && (
                                          <span className={cn(
                                            "text-[8px] font-extrabold px-1 rounded",
                                            isFocused ? "bg-indigo-750 text-amber-300" : "bg-amber-500/20 text-amber-400"
                                          )}>
                                            ⚠️ {activeWarns}
                                          </span>
                                        )}
                                        {isSpeaking && (
                                          <span className={cn(
                                            "text-[8px] font-extrabold px-1 rounded animate-pulse",
                                            isFocused ? "bg-indigo-750 text-emerald-300" : "bg-emerald-500/20 text-emerald-400"
                                          )}>
                                            SPEAKING
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </TabsContent>

                  {hasScreenShare && (
                    <TabsContent value="screenshare" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0 bg-zinc-950 flex flex-col">
                      <div className="h-8 shrink-0 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
                          <Tv className="w-3.5 h-3.5 text-primary" /> Viewing active presentation
                        </span>
                      </div>
                      <div className="flex-1 min-h-0 bg-zinc-950 p-4 flex items-center justify-center">
                        <div className="relative w-full h-full max-h-full max-w-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
                          <VideoTrack 
                            trackRef={screenShareTracks[0] as any} 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    </TabsContent>
                  )}
                </div>
              </Tabs>
            </main>

            {/* RIGHT SIDEBAR: Proctor Control Command Center & Sticky Room Chat */}
            <aside className={cn(
              "shrink-0 bg-zinc-900 flex flex-col min-h-0",
              isTablet 
                ? "w-full border-t border-zinc-800 p-4 h-[300px]" 
                : "w-[340px] h-full border-l border-zinc-800/80"
            )}>
              {/* Live Proctoring Control Deck */}
              <div className="flex-1 min-h-0 border-b border-zinc-800/60 p-4 flex flex-col gap-3.5 overflow-y-auto scrollbar-none select-none">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Proctoring Command
                  </h3>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    warningsCount > 0 
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                      : "bg-zinc-850 text-zinc-400 border-zinc-800"
                  )}>
                    Warnings: {warningsCount}/3
                  </span>
                </div>

                {/* Mode Selectors */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Room Mode</label>
                  <select
                    value={interviewMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as any;
                      setInterviewMode(nextMode);
                      const payload = JSON.stringify({ type: "MODE_UPDATE", mode: nextMode });
                      sendControl(new TextEncoder().encode(payload), { reliable: true });
                      logTelemetry("mode_change", { to: nextMode });
                      toast.success(`Switched room mode to ${nextMode.toUpperCase()}`);
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs font-semibold text-zinc-300 focus:border-indigo-500 outline-none cursor-pointer hover:border-zinc-700 transition"
                  >
                    <option value="assessment">Assessment (Strict Proctoring)</option>
                    <option value="live coding">Live Coding (Collaborative)</option>
                    <option value="hr">HR / Behavioral (Discussion)</option>
                  </select>
                </div>

                {/* Quick Proctor Actions */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <Button
                    onClick={() => {
                      const reason = prompt("Enter reason for warning:", "Exited fullscreen assessment workspace");
                      if (reason) issueWarning(reason);
                    }}
                    disabled={isLocked}
                    variant="outline"
                    className="h-8.5 text-[10px] font-bold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 cursor-pointer rounded-xl transition duration-300"
                  >
                    Issue Warning
                  </Button>
                  <Button
                    onClick={async () => {
                      if (isLocked) {
                        if (confirm("Are you sure you want to unlock this candidate's assessment environment?")) {
                          setIsLocked(false);
                          setLockReason("");
                          
                          // 1. Call server action for database persistence
                          const res = await toggleLockSessionAction(roomId, false);
                          if (res.error) {
                            toast.error(`Failed to unlock session: ${res.error}`);
                            return;
                          }
                          
                          // 2. Broadcast LiveKit message for instant sync
                          const unlockPayload = JSON.stringify({ type: "UNLOCK_SESSION" });
                          sendControl(new TextEncoder().encode(unlockPayload), { reliable: true });
                          toast.success("Candidate environment unlocked!");
                        }
                      } else {
                        const reason = prompt("Enter lock reason (optional):", "Suspected proctoring violation");
                        if (reason === null) return; // Moderator cancelled
                        
                        setIsLocked(true);
                        setLockReason(reason || "Locked by moderator");
                        
                        // 1. Call server action for database persistence
                        const res = await toggleLockSessionAction(roomId, true, reason);
                        if (res.error) {
                          toast.error(`Failed to lock session: ${res.error}`);
                          return;
                        }
                        
                        // 2. Broadcast LiveKit message for instant sync
                        const lockPayload = JSON.stringify({ 
                          type: "LOCK_SESSION", 
                          reason: reason || "Locked by moderator" 
                        });
                        sendControl(new TextEncoder().encode(lockPayload), { reliable: true });
                        toast.success("Candidate environment locked!");
                      }
                    }}
                    variant="outline"
                    className={cn(
                      "h-8.5 text-[10px] font-bold uppercase cursor-pointer rounded-xl transition duration-300 flex items-center justify-center gap-1 w-full",
                      isLocked
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 animate-pulse"
                        : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                    )}
                  >
                    {isLocked ? (
                      <>
                        <Unlock className="w-3 h-3" />
                        Unlock Session
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Lock Session
                      </>
                    )}
                  </Button>
                </div>

                {/* Live Infractions Event Log */}
                <div className="flex-1 min-h-0 flex flex-col gap-1.5 select-text">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Live Infractions Log</span>
                  <div className="flex-1 overflow-y-auto border border-zinc-800 bg-zinc-950/60 rounded-xl p-3 font-mono text-[9px] text-zinc-400 space-y-2 scrollbar-thin">
                    {telemetryLogs.length === 0 ? (
                      <span className="text-zinc-600 italic block text-center py-4 select-none">No infractions recorded</span>
                    ) : (
                      telemetryLogs.map((log, idx) => {
                        const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const isViolation = log.event_type === "warning_issued" ||
                          log.event_type === "TAB_SWITCH" ||
                          log.event_type === "WINDOW_BLUR" ||
                          log.event_type === "MINIMIZED" ||
                          log.event_type === "WINDOW_MINIMIZED" ||
                          log.event_type === "FULLSCREEN_EXIT" ||
                          log.event_type === "ESC_EXIT" ||
                          log.event_type === "SCREEN_SHARE_STOPPED" ||
                          log.event_type === "DEVTOOLS_SUSPECTED";
                        
                        const severity = log.details?.severity || (isViolation ? "high" : "info");
                        
                        return (
                          <div key={log.id || idx} className="border-b border-zinc-900/60 pb-1.5 last:border-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-zinc-550">[{time}]</span>
                              <div className="flex items-center gap-1">
                                {isViolation && (
                                  <span className={cn(
                                    "px-1 py-0.2 rounded text-[6px] font-bold uppercase border",
                                    severity === "high" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  )}>
                                    {severity}
                                  </span>
                                )}
                                <span className={cn(
                                  "px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider border",
                                  log.event_type === "warning_issued" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                  log.event_type === "FULLSCREEN_ENTER" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                  log.event_type === "submission" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                                  isViolation
                                    ? "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse font-extrabold"
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                )}>
                                  {log.event_type}
                                </span>
                              </div>
                            </div>
                            <p className="text-[8px] text-zinc-400 pt-1 leading-relaxed">
                              <span className="font-semibold text-zinc-300">
                                {log.details?.user || log.details?.candidate || username || "Candidate"}:
                              </span>{" "}
                              {log.details?.reason || log.details?.action || JSON.stringify(log.details || {})}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Panel - Integrated at bottom, Collapsible */}
              <div className={cn(
                "shrink-0 transition-all duration-300 flex flex-col bg-zinc-900/90",
                isChatOpen ? "h-[320px] border-t border-zinc-800" : "h-12"
              )}>
                {/* Collapsed Chat Header Trigger */}
                <div 
                  onClick={toggleChat}
                  className="h-12 px-4 shrink-0 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900 cursor-pointer hover:bg-zinc-850 select-none transition"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-zinc-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Room Chat</span>
                    {unreadCount > 0 && (
                      <span className="bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground rounded-full animate-pulse">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <X className={cn("w-4 h-4 text-zinc-500 transition-transform duration-300", isChatOpen ? "" : "rotate-180")} />
                </div>

                {/* Chat body containing scroll stream and input footer */}
                {isChatOpen && (
                  <div className="flex-1 flex flex-col min-h-0 bg-zinc-900">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-thin select-text">
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 select-none">
                          <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed">
                            Enter messages below. Communication is active across all participants.
                          </p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => {
                          const isSelf = msg.from?.identity === localParticipant.identity;
                          const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          let roleName = "Candidate";
                          let roleBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          let resolvedRole = "candidate";

                          if (isSelf) {
                            resolvedRole = localRole;
                          } else {
                            // Try parsing metadata of the sender
                            const participantMetadata = msg.from?.metadata;
                            if (participantMetadata) {
                              try {
                                const meta = JSON.parse(participantMetadata);
                                if (meta.role) resolvedRole = meta.role.toLowerCase();
                              } catch (e) {
                                const rawMeta = participantMetadata.trim().toLowerCase();
                                if (rawMeta === "admin" || rawMeta === "interviewer" || rawMeta === "candidate") {
                                  resolvedRole = rawMeta;
                                }
                              }
                            }
                            
                            // If role is still candidate/guest, check string matches in identity/name
                            if (resolvedRole === "candidate") {
                              const identityLower = (msg.from?.identity || "").toLowerCase();
                              const nameLower = (msg.from?.name || "").toLowerCase();
                              if (identityLower.includes("admin") || nameLower.includes("admin")) {
                                resolvedRole = "admin";
                              } else if (identityLower.includes("interviewer") || nameLower.includes("interviewer")) {
                                resolvedRole = "interviewer";
                              }
                            }
                          }

                          if (resolvedRole === "admin") {
                            roleName = "Admin";
                            roleBadgeColor = "bg-red-500/10 text-red-400 border-red-500/20";
                          } else if (resolvedRole === "interviewer") {
                            roleName = "Interviewer";
                            roleBadgeColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                          } else {
                            roleName = "Candidate";
                            roleBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          }

                          return (
                            <div 
                              key={msg.id}
                              className={cn(
                                "flex flex-col max-w-[85%] animate-fade-in-up",
                                isSelf ? "ml-auto items-end" : "mr-auto items-start"
                              )}
                            >
                              <span className="text-[9px] text-zinc-500 font-semibold mb-1 px-1 flex items-center gap-1 flex-wrap">
                                <span>{isSelf ? "You" : msg.from?.name || msg.from?.identity}</span>
                                <span className={cn(
                                  "px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider border",
                                  roleBadgeColor
                                )}>
                                  {roleName}
                                </span>
                                <span className="text-zinc-600">•</span>
                                <span>{formattedTime}</span>
                              </span>
                              <div className={cn(
                                "px-3 py-2 rounded-xl text-xs leading-relaxed break-words whitespace-pre-wrap shadow-md border",
                                isSelf 
                                  ? "bg-primary border-primary/20 text-primary-foreground rounded-br-none" 
                                  : "bg-zinc-800 border-zinc-700/50 text-zinc-100 rounded-bl-none"
                              )}>
                                {msg.message}
                              </div>
                            </div>
                          );
                        })
                      )}
                      {peerIsTyping && (
                        <div className="flex flex-col items-start max-w-[85%] select-none">
                          <span className="text-[9px] text-zinc-500 font-semibold mb-1 px-1">Typing...</span>
                          <div className="px-3 py-2 rounded-xl text-xs bg-zinc-800/50 border border-zinc-800 text-zinc-400 rounded-bl-none flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-0" />
                            <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-150" />
                            <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-300" />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* sticky input footer */}
                    <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 bg-zinc-900 shrink-0">
                      <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 focus-within:border-primary transition duration-300">
                        <input 
                          id="chat-input"
                          type="text"
                          value={messageInput}
                          onChange={handleInputChange}
                          placeholder="Type a message..."
                          className="flex-1 bg-transparent text-xs text-white outline-none placeholder-zinc-500 h-7"
                        />
                        <button 
                          type="submit"
                          disabled={!messageInput.trim()}
                          className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title="Send Message"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : (
          /* ========================================================================= */
          /* 2. SECURE CANDIDATE LAYOUT                                                */
          /* ========================================================================= */
          <div className={cn(
            "w-full h-full bg-zinc-950 overflow-hidden relative",
            isTablet 
              ? "flex flex-col" 
              : isChatOpen 
                ? (isSidebarCollapsed ? "grid grid-cols-[64px_1fr_320px] h-[calc(100vh-56px)]" : "grid grid-cols-[220px_1fr_320px] h-[calc(100vh-56px)]")
                : (isSidebarCollapsed ? "grid grid-cols-[64px_1fr] h-[calc(100vh-56px)]" : "grid grid-cols-[220px_1fr] h-[calc(100vh-56px)]")
          )}>
            {/* LEFT SIDEBAR: Candidate Own Local Video Stream Only */}
            <aside className={cn(
              "shrink-0 bg-zinc-950 border-zinc-800 flex flex-col min-h-0 select-none relative transition-all duration-300",
              isTablet 
                ? "w-full h-[120px] flex-row items-center border-b p-3 gap-3 overflow-x-auto overflow-y-hidden" 
                : isSidebarCollapsed 
                  ? "w-[64px] h-full border-r p-2 gap-2 overflow-hidden items-center" 
                  : "w-[220px] h-full border-r p-4 gap-4 overflow-y-auto scrollbar-none"
            )}>
              {/* Collapse/Expand Toggle Button (Desktop only) */}
              {!isTablet && (
                <button
                  onClick={() => setIsSidebarCollapsed(prev => !prev)}
                  className="absolute top-3 right-[-10px] z-40 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full p-0.5 border border-zinc-700 shadow-md cursor-pointer transition-all duration-200"
                  title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                  {isSidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>
              )}

              <div className={cn(
                "flex gap-3 min-h-0",
                isTablet ? "flex-row items-center" : "flex-col w-full"
              )}>
                {cameraTracks
                  .filter((trackRef) => {
                    const p = trackRef.participant;
                    const isSelf = p.identity === localParticipant.identity;
                    if (isSelf) return true;

                    // Decode role of remote participant
                    let remoteRole = "candidate";
                    try {
                      if (p.metadata) {
                        const meta = JSON.parse(p.metadata);
                        if (meta.role) remoteRole = meta.role.toLowerCase();
                      }
                    } catch (e) {
                      const raw = p.metadata?.trim().toLowerCase();
                      if (raw === "admin" || raw === "interviewer") remoteRole = raw;
                    }
                    const nameLower = (p.name || "").toLowerCase();
                    const identityLower = p.identity.toLowerCase();
                    if (identityLower.includes("admin") || nameLower.includes("admin")) remoteRole = "admin";
                    else if (identityLower.includes("interviewer") || nameLower.includes("interviewer")) remoteRole = "interviewer";

                    const isRemoteModerator = remoteRole === "admin" || remoteRole === "interviewer";

                    // Candidates can only see moderators in HR mode, and never see other candidates
                    if (isRemoteModerator && interviewMode === "hr") return true;
                    
                    return false;
                  })
                  .map((trackRef) => (
                    <div 
                      key={`${trackRef.participant.identity}-${trackRef.source}`}
                      className={cn(
                        "shrink-0 transition-all duration-300",
                        isTablet ? "w-[150px]" : "w-full"
                      )}
                    >
                      <ParticipantTile 
                        trackRef={trackRef} 
                        isLocal={trackRef.participant.identity === localParticipant.identity} 
                        warningsCount={warningsCount}
                      />
                    </div>
                  ))}
                <RoomAudioRenderer />
              </div>

              {/* Secure Link Telemetry for Candidate */}
              {!isTablet && !isSidebarCollapsed && (
                <div className="mt-auto pt-4 border-t border-zinc-900/60 flex flex-col gap-2 select-none animate-fade-in">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    <span>Link Health</span>
                    <span className="text-emerald-400 font-extrabold">Excellent</span>
                  </div>
                </div>
              )}
            </aside>

            {/* CENTER WORKSPACE: Collaborative Coding Workspace & problem specs */}
            <main className="flex-1 min-w-0 bg-zinc-950 flex flex-col h-full overflow-hidden relative">
              {/* Fullscreen Blurred Dark Glassmorphism Lockout Screen over the workspace */}
              {isLocked && !isLocalModerator && (
                <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-xl z-30 flex flex-col items-center justify-center space-y-6 p-6 select-none animate-fade-in">
                  <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-pulse shadow-[0_0_50px_rgba(245,158,11,0.25)]">
                    <Lock className="w-10 h-10 text-amber-500" />
                  </div>
                  
                  <div className="text-center max-w-md space-y-3">
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">SESSION LOCKED</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      Your assessment has been temporarily paused by the moderator.<br />
                      Please wait for further instructions.
                    </p>
                    
                    {lockReason && (
                      <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-left max-w-xs mx-auto">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Moderator Notice:</span>
                        <p className="text-xs text-zinc-300 italic font-medium">"{lockReason}"</p>
                      </div>
                    )}
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-left font-mono text-xs text-zinc-500 space-y-1.5 mt-2">
                      <div className="flex justify-between border-b border-zinc-850 pb-1.5 mb-1.5">
                        <span>Session ID:</span>
                        <span className="text-zinc-300 select-all">{roomId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Warnings Issued:</span>
                        <span className="text-amber-400 font-bold">{warningsCount} / 3</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase animate-pulse">
                    Microphone & Camera Remain Active
                  </div>
                </div>
              )}

              <Tabs value={activeWorkspaceTab} onValueChange={setActiveWorkspaceTab} className="h-full flex flex-col min-h-0">
                <div className="h-12 shrink-0 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between select-none">
                  <TabsList className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-0.5">
                    <TabsTrigger value="problem" className="data-[state=active]:bg-zinc-800/80 data-[state=active]:text-white font-semibold text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-md cursor-pointer transition">
                      <FileCode2 className="w-3.5 h-3.5" />
                      Problem Context
                    </TabsTrigger>
                    <TabsTrigger value="code" className="data-[state=active]:bg-zinc-800/80 data-[state=active]:text-white font-semibold text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-md cursor-pointer transition">
                      <Terminal className="w-3.5 h-3.5" />
                      Coding Workspace
                    </TabsTrigger>
                    {hasScreenShare && (
                      <TabsTrigger value="screenshare" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-md cursor-pointer transition animate-pulse">
                        <Tv className="w-3.5 h-3.5 text-primary" />
                        Screen Share View
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>
                
                <div className="flex-1 min-h-0 relative">
                  <TabsContent value="problem" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0">
                    <ProblemPanel 
                      interviewId={roomId}
                      problem={problemStatement} 
                      onProblemUpdate={setProblemStatement}
                      isInterviewer={isLocalModerator}
                      assessmentTemplateId={assessmentTemplateId}
                      questions={questions}
                      activeQIdx={activeQIdx}
                      onQuestionSelect={handleQuestionSelect}
                      attempt={attempt}
                    />
                  </TabsContent>
                  <TabsContent value="code" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0">
                    <CodingEnvironment 
                      interviewId={roomId} 
                      problemStatement={problemStatement} 
                      isInterviewer={isLocalModerator}
                      isLocked={isLocked}
                      interviewMode={interviewMode}
                      assessmentTemplateId={assessmentTemplateId}
                      questions={questions}
                      activeQIdx={activeQIdx}
                      onQuestionSelect={handleQuestionSelect}
                      attempt={attempt}
                      onCodeSubmitted={handleCodeSubmitted}
                    />
                  </TabsContent>
                  {hasScreenShare && (
                    <TabsContent value="screenshare" className="h-full w-full m-0 data-[state=inactive]:hidden min-h-0 bg-zinc-950 flex flex-col">
                      <div className="h-8 shrink-0 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
                          <Tv className="w-3.5 h-3.5 text-primary" /> Viewing active presentation
                        </span>
                      </div>
                      <div className="flex-1 min-h-0 bg-zinc-950 p-4 flex items-center justify-center">
                        <div className="relative w-full h-full max-h-full max-w-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
                          <VideoTrack 
                            trackRef={screenShareTracks[0] as any} 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    </TabsContent>
                  )}
                </div>
              </Tabs>
            </main>

            {/* RIGHT SIDEBAR: Candidate Chat Panel ONLY (Hiding all infraction timeline triggers) */}
            {isChatOpen && (
              <aside className={cn(
                "shrink-0 bg-zinc-900 flex flex-col min-h-0",
                isTablet 
                  ? "w-full border-t border-zinc-800 p-4 h-[300px]" 
                  : "w-[320px] h-full border-l border-zinc-800/80"
              )}>
                <div className="h-full flex flex-col bg-zinc-900 min-h-0">
                  {/* Chat header */}
                  <div className="h-12 px-4 shrink-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 select-none">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-zinc-300" />
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Room Chat</span>
                    </div>
                    <button 
                      onClick={toggleChat}
                      className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded transition cursor-pointer"
                      title="Collapse Chat"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Message stream */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-thin select-text">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 select-none">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">No Messages Yet</p>
                        <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed">
                          Enter messages below. Communication is active across all participants.
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isSelf = msg.from?.identity === localParticipant.identity;
                        const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        let roleName = "Candidate";
                        let roleBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        let resolvedRole = "candidate";

                        if (isSelf) {
                          resolvedRole = localRole;
                        } else {
                          // Try parsing metadata of the sender
                          const participantMetadata = msg.from?.metadata;
                          if (participantMetadata) {
                            try {
                              const meta = JSON.parse(participantMetadata);
                              if (meta.role) resolvedRole = meta.role.toLowerCase();
                            } catch (e) {
                              const rawMeta = participantMetadata.trim().toLowerCase();
                              if (rawMeta === "admin" || rawMeta === "interviewer" || rawMeta === "candidate") {
                                resolvedRole = rawMeta;
                              }
                            }
                          }
                          
                          // If role is still candidate/guest, check string matches in identity/name
                          if (resolvedRole === "candidate") {
                            const identityLower = (msg.from?.identity || "").toLowerCase();
                            const nameLower = (msg.from?.name || "").toLowerCase();
                            if (identityLower.includes("admin") || nameLower.includes("admin")) {
                              resolvedRole = "admin";
                            } else if (identityLower.includes("interviewer") || nameLower.includes("interviewer")) {
                              resolvedRole = "interviewer";
                            }
                          }
                        }

                        if (resolvedRole === "admin") {
                          roleName = "Admin";
                          roleBadgeColor = "bg-red-500/10 text-red-400 border-red-500/20";
                        } else if (resolvedRole === "interviewer") {
                          roleName = "Interviewer";
                          roleBadgeColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                        } else {
                          roleName = "Candidate";
                          roleBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        }

                        return (
                          <div 
                            key={msg.id}
                            className={cn(
                              "flex flex-col max-w-[85%] animate-fade-in-up",
                              isSelf ? "ml-auto items-end" : "mr-auto items-start"
                            )}
                          >
                            <span className="text-[9px] text-zinc-500 font-semibold mb-1 px-1 flex items-center gap-1.5 flex-wrap">
                              <span>{isSelf ? "You" : msg.from?.name || msg.from?.identity}</span>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                                roleBadgeColor
                              )}>
                                {roleName}
                              </span>
                              <span className="text-zinc-600">•</span>
                              <span>{formattedTime}</span>
                            </span>
                            <div className={cn(
                              "px-3 py-2 rounded-xl text-xs font-medium leading-relaxed break-words whitespace-pre-wrap shadow-md border",
                              isSelf 
                                ? "bg-primary border-primary/20 text-primary-foreground rounded-br-none" 
                                : "bg-zinc-800 border-zinc-700/50 text-zinc-100 rounded-bl-none"
                            )}>
                              {msg.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                    
                    {peerIsTyping && (
                      <div className="flex flex-col items-start max-w-[85%] select-none">
                        <span className="text-[9px] text-zinc-500 font-semibold mb-1 px-1">Typing...</span>
                        <div className="px-3 py-2 rounded-xl text-xs bg-zinc-800/50 border border-zinc-800 text-zinc-400 rounded-bl-none flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-0" />
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-150" />
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-300" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* sticky message input */}
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 bg-zinc-900 shrink-0">
                    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 focus-within:border-primary transition duration-300">
                      <input 
                        type="text"
                        value={messageInput}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent text-xs text-white outline-none placeholder-zinc-500 h-7"
                      />
                      <button 
                        type="submit"
                        disabled={!messageInput.trim()}
                        className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Send Message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {/* Centered Floating Control Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none pointer-events-none">
        <div className="h-14 flex items-center px-4 gap-3 bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-xl shadow-2xl rounded-2xl pointer-events-auto">
          {/* Audio toggle */}
          <button
            onClick={toggleMic}
            className={cn(
              "h-10 w-10 flex items-center justify-center rounded-xl border transition-all duration-300 hover:scale-105 cursor-pointer",
              isMicEnabled 
                ? "bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border-zinc-800 hover:border-zinc-700" 
                : "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20 hover:border-red-500/30"
            )}
            title={isMicEnabled ? "Mute Microphone (M)" : "Unmute Microphone (M)"}
          >
            {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Video toggle */}
          <button
            onClick={toggleCam}
            className={cn(
              "h-10 w-10 flex items-center justify-center rounded-xl border transition-all duration-300 hover:scale-105 cursor-pointer",
              isCamEnabled 
                ? "bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border-zinc-800 hover:border-zinc-700" 
                : "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20 hover:border-red-500/30"
            )}
            title={isCamEnabled ? "Disable Camera (V)" : "Enable Camera (V)"}
          >
            {isCamEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          {/* Screen Share toggle */}
          <button
            onClick={toggleScreenShare}
            className={cn(
              "h-10 w-10 flex items-center justify-center rounded-xl border transition-all duration-300 hover:scale-105 cursor-pointer",
              isScreenSharing 
                ? "bg-primary/20 text-primary border-primary/30" 
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800 hover:border-zinc-700"
            )}
            title={isScreenSharing ? "Stop Screen Share" : "Start Screen Share"}
          >
            <Tv className={cn("w-4 h-4", isScreenSharing && "animate-pulse")} />
          </button>

          <div className="w-px h-6 bg-zinc-800/80 mx-0.5" />

          {/* Chat Panel Toggle */}
          <button
            onClick={toggleChat}
            className={cn(
              "h-10 w-10 flex items-center justify-center rounded-xl border transition-all duration-300 hover:scale-105 relative cursor-pointer",
              isChatOpen 
                ? "bg-zinc-800 text-zinc-200 border-zinc-700" 
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800 hover:border-zinc-700"
            )}
            title="Toggle Room Chat (C)"
          >
            <MessageSquare className="w-4 h-4" />
            
            {/* Unread message badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground shadow-lg border border-zinc-950 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Tablet Chat Button overlay */}
          {isTablet && (
            <button
              onClick={() => {
                toast.info("Mobile/Tablet chat is open at the bottom. Use sidebar controls.");
              }}
              className="h-10 w-10 flex items-center justify-center rounded-xl border bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          {/* Leaves the interview room */}
          <button
            onClick={() => {
              if (confirm("Are you sure you want to disconnect from this interview room? Your changes will be saved.")) {
                router.push("/dashboard");
              }
            }}
            className="h-10 px-4 flex items-center justify-center gap-1.5 rounded-xl bg-red-650 hover:bg-red-600 text-white font-semibold text-xs border border-red-700/20 transition-all duration-300 hover:scale-105 cursor-pointer shadow-lg shadow-red-955/15"
            title="Disconnect Room"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Moderator Early Entry Waiting Screen */}
      {isLocalModerator && !actualStartedAt && (
        <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 select-none animate-fade-in text-center">
          <div className="max-w-md space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              {/* Pulsing Radar Rings */}
              <div className="absolute inset-0 rounded-full bg-indigo-500/5 border border-indigo-500/20 animate-ping opacity-75" />
              <div className="absolute -inset-4 rounded-full bg-indigo-500/5 border border-indigo-500/10 animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <Users className="w-8 h-8 text-indigo-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Waiting for Candidate Entry...</h2>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                The interview environment and countdown timer will activate automatically the moment the candidate connects to the room.
              </p>
            </div>
            
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 text-left font-mono text-[10px] text-zinc-500 space-y-2">
              <div className="flex justify-between">
                <span>Room Code:</span>
                <span className="text-zinc-300 font-bold">{roomId}</span>
              </div>
              <div className="flex justify-between">
                <span>Lobby Status:</span>
                <span className="text-amber-400 font-bold animate-pulse">Awaiting Candidate Connection</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Enforced Lockout Overlay (Glassmorphism) */}
      {!isInterviewer && !isReadOnlyReview && !isLocked && !isFullscreenActive && actualStartedAt && !isTestCandidate && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 select-none animate-fade-in text-center">
          {/* Glowing background meshes */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000" />
          
          <div className="bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden space-y-6 animate-scale-in border-red-500/20 shadow-red-950/15">
            {/* Red pulsing glow line at the top */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse" />
            
            {/* Spinning/pulsing custom warning proctor badge */}
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-2xl bg-red-500/5 border border-red-500/20 animate-ping opacity-75" />
              <div className="absolute -inset-2 rounded-3xl bg-red-500/5 border border-red-500/10 animate-pulse" />
              <div className="relative w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.25)]">
                <Maximize2 className="w-10 h-10 text-red-500 animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Fullscreen Focus Enforced</h2>
              <div className="text-zinc-400 text-sm leading-relaxed font-medium space-y-2">
                <p className="text-red-400 font-semibold uppercase text-[10px] tracking-wider animate-pulse">Security Guideline Violation</p>
                <p>
                  Fullscreen mode is required during this assessment.
                </p>
                <p className="text-zinc-300 font-bold text-base mt-1">
                  Please return to fullscreen immediately.
                </p>
              </div>
            </div>
            
            {warningsCount > 0 ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between font-mono text-xs text-red-400 shadow-inner">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Active Warnings
                </span>
                <span className="font-extrabold text-[13px] bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">
                  {warningsCount} / 3
                </span>
              </div>
            ) : (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex items-center justify-between font-mono text-xs text-emerald-400">
                <span className="flex items-center gap-1.5 uppercase font-bold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Warnings Issued
                </span>
                <span className="font-extrabold text-[13px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  0 / 3
                </span>
              </div>
            )}

            <Button
              onClick={async () => {
                try {
                  if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                    setIsFullscreenActive(true);
                  }
                } catch (err) {
                  toast.error("Failed to enter fullscreen. Please grant browser permissions.");
                }
              }}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs tracking-widest h-12 rounded-xl shadow-lg shadow-red-950/30 border border-red-500/20 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 group relative overflow-hidden active:scale-98 animate-pulse hover:animate-none"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-red-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2">
                <Maximize2 className="w-4 h-4 group-hover:scale-110 transition" />
                Return to Fullscreen Mode
              </span>
            </Button>
            
            <p className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider leading-none">
              Exiting fullscreen logs an automated proctoring infraction
            </p>
          </div>
        </div>
      )}

      {/* Fullscreen Blurred Dark Glassmorphism Lockout Screen (Permanent End of Session) */}
      {(sessionStatus === "terminated" || 
        sessionStatus === "submitted" || 
        sessionStatus === "completed" || 
        sessionStatus === "expired" ||
        sessionStatus === "missed" ||
        sessionStatus === "cancelled" ||
        sessionStatus === "canceled") && !isLocalModerator && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-xl z-50 flex flex-col items-center justify-center space-y-6 p-6 animate-fade-in select-none">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.25)]">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <div className="text-center max-w-md space-y-3">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Assessment Session Locked</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              This assessment session has been locked due to exceeding the maximum of 3 proctoring warnings (infractions) or because the session was finalized and submitted.
            </p>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-left font-mono text-xs text-zinc-500 space-y-1.5">
              <div className="flex justify-between border-b border-zinc-850 pb-1.5 mb-1.5">
                <span>Session ID:</span>
                <span className="text-zinc-300">{roomId}</span>
              </div>
              <div className="flex justify-between">
                <span>Warnings Issued:</span>
                <span className="text-red-400 font-bold">{warningsCount} / 3</span>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-200 font-semibold uppercase text-xs tracking-wider rounded-xl transition duration-300 cursor-pointer h-10"
          >
            Exit Assessment
          </Button>
        </div>
      )}

      {/* Interactive Candidate Submit Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <FileCode2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Submit Assessment</h3>
                <p className="text-xs text-zinc-400">Are you ready to finalize and submit your work?</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Candidate Remarks / Notes</label>
              <textarea
                value={candidateRemarks}
                onChange={(e) => setCandidateRemarks(e.target.value)}
                placeholder="Add optional notes about your solution, design patterns, or complexities..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition duration-300 h-24 resize-none placeholder-zinc-600"
              />
            </div>

            <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 font-mono text-[10px] text-zinc-500 space-y-1">
              <p className="text-zinc-400 font-semibold mb-1">Submission Pre-Check:</p>
              <div className="flex justify-between">
                <span>• Code integrity:</span>
                <span className="text-emerald-400">READY</span>
              </div>
              <div className="flex justify-between">
                <span>• Proctor warnings:</span>
                <span className={warningsCount > 0 ? "text-amber-400" : "text-emerald-400"}>
                  {warningsCount} / 3
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => setIsSubmitModalOpen(false)}
                variant="outline"
                className="flex-1 bg-transparent border-zinc-800 hover:bg-zinc-850 hover:text-zinc-200 text-zinc-400 font-bold uppercase text-[10px] tracking-wide h-10 cursor-pointer rounded-xl transition"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAssessment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-[10px] tracking-wide h-10 cursor-pointer rounded-xl shadow-lg shadow-emerald-950/20 border border-emerald-500/20 transition-all duration-300"
              >
                Submit & Lock
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Realtime Synchronized Candidate Warning Popup System */}
      {activeWarning && !isLocalModerator && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-zinc-900 border-2 border-amber-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden space-y-6 animate-scale-in">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            
            {/* Warning Header with pulsing alert */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center animate-bounce shadow-[0_0_30px_rgba(245,158,11,0.25)]">
                <span className="text-3xl font-extrabold text-amber-500">⚠️</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Proctoring Warning Issued</h2>
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold text-xs uppercase px-3 py-1 rounded-full animate-pulse tracking-widest">
                Infraction {activeWarning.count} / 3
              </span>
            </div>

            {/* Warning Infraction Details */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-3 text-left">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Infraction Reason</label>
                <p className="text-sm font-semibold text-zinc-200 mt-0.5 leading-relaxed">
                  {activeWarning.reason}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-900/60 pt-3 text-[10px] font-mono text-zinc-500">
                <div>
                  <span className="block text-zinc-550 uppercase tracking-wider">Moderator</span>
                  <span className="text-zinc-300 font-bold">{activeWarning.moderatorName}</span>
                </div>
                <div>
                  <span className="block text-zinc-550 uppercase tracking-wider">Timestamp</span>
                  <span className="text-zinc-300 font-bold">
                    {new Date(activeWarning.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[10px] text-amber-400/80 leading-relaxed font-sans text-center">
              Please strictly adhere to assessment guidelines. A 3rd infraction will result in immediate session termination and auto-submission of your exam.
            </div>

            {/* Acknowledge Button */}
            <Button
              onClick={() => {
                setActiveWarning(null);
                toast.info("Warning acknowledged. Assessment resumed.");
              }}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase text-[10px] tracking-widest h-11 cursor-pointer rounded-xl border border-amber-500/20 transition-all duration-300 shadow-lg shadow-amber-950/20"
            >
              Acknowledge & Resume
            </Button>
          </div>
        </div>
      )}

      {/* Fullscreen Candidate Proctor Monitor Overlay */}
      {isFullscreenMonitor && focusedCandidateIdentity && participants.find(p => p.identity === focusedCandidateIdentity) && (() => {
        const focusedParticipant = participants.find(p => p.identity === focusedCandidateIdentity)!;
        const focusedCameraTrack = cameraTracks.find(t => t.participant.identity === focusedCandidateIdentity);
        const focusedScreenShareTrack = screenShareTracks.find(t => t.participant.identity === focusedCandidateIdentity);
        return (
          <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col overflow-hidden animate-fade-in select-none">
            {/* Header */}
            <div className="h-14 shrink-0 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </span>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  FULLSCREEN PROCTOR WATCH: <span className="text-indigo-400 font-mono">{focusedParticipant.name || focusedParticipant.identity}</span>
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <span className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-mono font-bold text-amber-400 animate-pulse">
                  Warnings: {warningsCount}/3
                </span>
                <Button
                  onClick={() => setIsFullscreenMonitor(false)}
                  variant="outline"
                  className="h-9 px-3 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750 rounded-xl transition flex items-center gap-1.5 text-xs font-bold uppercase cursor-pointer"
                >
                  <X className="w-4 h-4" /> Exit Fullscreen
                </Button>
              </div>
            </div>

            {/* Grid area */}
            <div className="flex-1 min-h-0 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-black">
              {/* Camera */}
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900/50 shadow-2xl flex flex-col min-h-0">
                <div className="absolute top-4 left-4 z-10 bg-zinc-950/80 backdrop-blur-md px-3 py-1 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 tracking-wider">
                  CANDIDATE WEBCAM FEED
                </div>
                <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
                  {focusedCameraTrack ? (
                    <div className="w-full h-full object-cover">
                      <ParticipantTile
                        trackRef={focusedCameraTrack}
                        isLocal={focusedCameraTrack.participant.identity === localParticipant.identity}
                        warningsCount={warningsCount}
                      />
                    </div>
                  ) : (
                    <span className="text-zinc-650 font-mono text-sm">No webcam active</span>
                  )}
                </div>
              </div>

              {/* Screen */}
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900/50 shadow-2xl flex flex-col min-h-0">
                <div className="absolute top-4 left-4 z-10 bg-zinc-950/80 backdrop-blur-md px-3 py-1 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 tracking-wider">
                  CANDIDATE DESKTOP SCREEN FEED
                </div>
                <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
                  {focusedScreenShareTrack ? (
                    <VideoTrack
                      trackRef={focusedScreenShareTrack as any}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 h-full">
                      <Tv className="w-10 h-10 text-zinc-700 animate-pulse" />
                      <span className="text-zinc-500 text-sm font-bold tracking-wide uppercase">Screen presentation is inactive</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Live Candidate Proctor Preview */}
      {isLocalModerator && activeWorkspaceTab !== "monitor" && focusedCandidateIdentity && participants.find(p => p.identity === focusedCandidateIdentity) && (() => {
        const focusedParticipant = participants.find(p => p.identity === focusedCandidateIdentity)!;
        const focusedCameraTrack = cameraTracks.find(t => t.participant.identity === focusedCandidateIdentity);
        return (
          <div 
            onClick={() => setActiveWorkspaceTab("monitor")}
            className="fixed bottom-24 right-6 z-35 w-[180px] bg-zinc-950/80 border border-zinc-800 hover:border-indigo-500/50 backdrop-blur-md shadow-2xl rounded-2xl p-2.5 cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] group hover:shadow-[0_0_20px_rgba(99,102,241,0.25)] flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400 tracking-wider uppercase">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-indigo-400 animate-pulse" /> Proctor Preview
              </span>
              <span className="text-[8px] text-zinc-550 group-hover:text-indigo-400 transition">Expand ↗</span>
            </div>
            <div className="rounded-lg overflow-hidden aspect-video bg-zinc-900 border border-zinc-850 relative">
              {focusedCameraTrack ? (
                <VideoTrack
                  trackRef={focusedCameraTrack as any}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-mono text-[9px] text-zinc-600">Muted</div>
              )}
              {focusedParticipant.isSpeaking && (
                <span className="absolute inset-0 rounded-lg border-2 border-emerald-500 animate-pulse pointer-events-none" />
              )}
            </div>
            <span className="text-[10px] font-bold text-zinc-200 truncate leading-none">
              {focusedParticipant.name || focusedParticipant.identity}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
