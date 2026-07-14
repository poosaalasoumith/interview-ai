"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeEditor } from "@/components/interview/code-editor";
import { executeCode, ExecutionResult } from "@/services/piston";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";
import { AIReviewModal } from "@/components/interview/ai-review-modal";
import { WORKSPACE_CONFIGS } from "@/components/interview/practice/workspace-config";
import { PracticeWorkspace } from "@/components/interview/practice/practice-workspace";
import { 
  Play, 
  Terminal, 
  FileCode2, 
  Sparkles, 
  BookOpen, 
  Code2, 
  ChevronRight, 
  Lightbulb, 
  AlertCircle, 
  Copy, 
  Check, 
  Loader2,
  Tv,
  Users,
  Mic,
  Video,
  Radio,
  Flame,
  Award,
  TrendingUp,
  Brain,
  History,
  Shield,
  Volume2,
  VideoOff,
  MicOff,
  User,
  Zap,
  ArrowRight,
  RefreshCw,
  Trash2,
  Calendar,
  MessageSquare,
  ShieldCheck,
  ChevronLeft,
  Search,
  Maximize2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useVoiceInterview } from "@/hooks/use-voice-interview";

// Originally Curated Coding Playground Problems
interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

interface CuratedProblem {
  id: string;
  title: string;
  difficulty: string;
  category: string;
  description: string;
  examples: ProblemExample[];
  constraints: string[];
  starterCode: Record<string, string>;
}

const PROBLEMS: CuratedProblem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have *exactly* one solution, and you may not use the *same* element twice.

You can return the answer in any order.`,
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "Because nums[1] + nums[2] == 6, we return [1, 2]."
      }
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists."
    ],
    starterCode: {
      javascript: `// JavaScript Starter Template\nfunction twoSum(nums, target) {\n  // Write your code here\n  \n}`,
      typescript: `// TypeScript Starter Template\nfunction twoSum(nums: number[], target: number): number[] {\n  // Write your code here\n  return [];\n}`,
      python: `# Python Starter Template\nclass Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        # Write your code here\n        pass`,
      java: `// Java Starter Template\nimport java.util.*;\n\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[0];\n    }\n}`,
      cpp: `// C++ Starter Template\n#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your code here\n        return {};\n    }\n};`,
      c: `// C Starter Template\n#include <stdio.h>\n#include <stdlib.h>\n\nint* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    // Write your code here\n    *returnSize = 0;\n    return NULL;\n}`,
      go: `// Go Starter Template\npackage main\n\nfunc twoSum(nums []int, target int) []int {\n    // Write your code here\n    return []int{}\n}`
    }
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Stacks",
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      {
        input: "s = \"()\"",
        output: "true",
      },
      {
        input: "s = \"()[]{}\"",
        output: "true",
      },
      {
        input: "s = \"(]\"",
        output: "false",
      }
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'."
    ],
    starterCode: {
      javascript: `// JavaScript Starter Template\nfunction isValid(s) {\n  // Write your code here\n  \n}`,
      typescript: `// TypeScript Starter Template\nfunction isValid(s: string): boolean {\n  // Write your code here\n  return false;\n}`,
      python: `# Python Starter Template\nclass Solution:\n    def isValid(self, s: str) -> bool:\n        # Write your code here\n        pass`,
      java: `// Java Starter Template\nclass Solution {\n    public boolean isValid(String s) {\n        // Write your code here\n        return false;\n    }\n}`,
      cpp: `// C++ Starter Template\n#include <string>\nusing namespace std;\n\nclass Solution {\npublic:\n    bool isValid(string s) {\n        // Write your code here\n        return false;\n    }\n};`,
      c: `// C Starter Template\n#include <stdbool.h>\n\nbool isValid(char* s) {\n    // Write your code here\n    return false;\n}`,
      go: `// Go Starter Template\npackage main\n\nfunc isValid(s string) bool {\n    // Write your code here\n    return false;\n}`
    }
  }
];

// SaaS Mock Interview Config Constants
interface RoleDef {
  id: string;
  name: string;
  category: string;
  badges: string[];
  skills: string[];
}

const ROLES: RoleDef[] = [
  { id: "frontend", name: "Frontend Engineer", category: "Software Development", badges: ["React", "TypeScript", "Performance"], skills: ["React", "Web APIs", "TypeScript", "UI Architecture"] },
  { id: "backend", name: "Backend Engineer", category: "Software Development", badges: ["NodeJS", "Databases", "APIs"], skills: ["RESTful APIs", "SQL/NoSQL", "Event Loops", "Caching"] },
  { id: "data", name: "Data Analyst", category: "Data Science", badges: ["SQL", "Pandas", "Tableau"], skills: ["Python Data Structures", "Statistical Auditing", "Aggregation"] },
  { id: "hr", name: "HR Executive", category: "Operations", badges: ["Talent Sourcing", " STAR Method"], skills: ["Behavioral Evaluation", "Sourcing Pipelines", "Conflict Resolution"] },
  { id: "devops", name: "DevOps Engineer", category: "Software Development", badges: ["Docker", "AWS", "CI/CD Pipeline"], skills: ["Docker Containers", "AWS Core Infrastructure", "GitHub Actions"] },
  { id: "product", name: "Product Manager", category: "Management", badges: ["Product Lifecycle", "Wireframing"], skills: ["Market Analysis", "Prioritization", "User Story Mapping"] }
];

const PRESETS = [
  { title: "Frontend Mock", round: "Technical", difficulty: "Medium", mode: "Timed", personality: "Professional", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-sm animate-fade-in" },
  { title: "Backend Mock", round: "Coding", difficulty: "Hard", mode: "Pressure", personality: "Aggressive", bg: "bg-red-500/10 text-red-400 border-red-500/20 shadow-sm animate-fade-in" },
  { title: "DSA Sprint", round: "Coding", difficulty: "Expert", mode: "Timed", personality: "FAANG Style", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-sm animate-fade-in" },
  { title: "HR Rapid Fire", round: "HR Round", difficulty: "Easy", mode: "Rapid Fire", personality: "HR Conversational", bg: "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-sm animate-fade-in" },
  { title: "System Design Deep Dive", round: "System Design", difficulty: "Expert", mode: "Relaxed", personality: "Professional", bg: "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-sm animate-fade-in" },
  { title: "Behavioral Simulation", round: "Behavioral", difficulty: "Medium", mode: "Relaxed", personality: "Friendly", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm animate-fade-in" }
];

const PRACTICE_QUESTIONS: Record<string, Record<string, string[]>> = {
  "Frontend Engineer": {
    "Technical": [
      "Explain the difference between pure components and higher-order components in React.",
      "How does the virtual DOM reconcile node updates, and what are key optimization techniques?",
      "Can you describe how you would optimize a web application experiencing long load times due to heavy bundle size?"
    ],
    "Coding": [
      "Implement a function `reverseString(s)` that reverses a string in-place.",
      "Implement a basic `debounce` function that delays function invocation until a specific timing gap has elapsed.",
      "Write a function to merge two sorted arrays into a single sorted array in linear time complexity."
    ],
    "Behavioral": [
      "Tell me about a time you had a technical disagreement with a team member. How did you resolve it?",
      "Can you describe a situation where you had to ship a frontend feature under extremely tight deadlines?",
      "Tell me about your favorite frontend project and the engineering trade-offs you had to make."
    ]
  },
  "Backend Engineer": {
    "Technical": [
      "What are the major pros and cons of using a SQL database vs NoSQL database for scaling telemetry logging?",
      "Explain horizontal vs vertical scaling and how you implement load balancing on AWS or GCP.",
      "Explain how JWT authentication works, how you securely store tokens, and how you handle token revocation."
    ],
    "Coding": [
      "Write a function `twoSum` to find indices of two numbers that add up to a target number.",
      "Write a function to validate if a string of parentheses is balanced.",
      "Implement a cache with Least Recently Used (LRU) eviction policy."
    ],
    "Behavioral": [
      "Tell me about a time when a production API failed in production. How did you diagnose and mitigate it?",
      "Describe a scenario where you had to coordinate with frontend developers to launch a core database schema update.",
      "How do you ensure code coverage and reliability when building high-concurrency microservices?"
    ]
  }
};

const FALLBACK_QUESTIONS: Record<string, string[]> = {
  "Warm Up": [
    "Welcome! Tell me about yourself and your professional journey.",
    "What motivated you to apply for this mock interview session today?",
    "What are your biggest engineering strengths and where do you look to improve?"
  ],
  "Behavioral": [
    "Tell me about a time you made a mistake at work. How did you take responsibility and resolve it?",
    "Describe a time when you had to work with someone whose work style was extremely different from yours.",
    "Tell me about a project that failed. What did you learn and how did you apply it since?"
  ],
  "HR Round": [
    "What are your salary expectations, and where do you see yourself in five years?",
    "Why should we hire you over other candidates preparing for similar roles?",
    "How do you maintain a healthy work-life balance while working in a high-growth environment?"
  ],
  "System Design": [
    "Design a real-time collaborative code editor like Google Docs or Figma.",
    "Design a globally scalable notification dispatch service that can handle billions of push alerts daily.",
    "Design a rate-limiter middleware that blocks user spam while keeping latency low."
  ],
  "Technical": [
    "What are the best practices for caching api payloads, and how do you prevent stale query states?",
    "Explain how clean architecture and SOLID principles influence your daily coding practices.",
    "What is your approach to analyzing CPU/Memory bottlenecks under heavy stress testing?"
  ],
  "Coding": [
    "Given a string, find the length of the longest substring without repeating characters.",
    "Write an algorithm to reverse a singly linked list in-place.",
    "Implement a binary search algorithm and explain its runtime efficiency."
  ]
};



export default function PracticePlayground() {
  const [activePlaygroundTab, setActivePlaygroundTab] = useState<"sandbox" | "studio">("studio");

  // =========================================================================
  // 1. ORIGINAL CODING SANDBOX PLAYGROUND STATE
  // =========================================================================
  const [selectedProblem, setSelectedProblem] = useState(PROBLEMS[0]);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Synchronize sandbox code templates
  useEffect(() => {
    const templates = selectedProblem.starterCode as any;
    setCode(templates[language] || templates["javascript"] || "");
    setOutput(null);
  }, [selectedProblem, language]);

  const handleRunCode = async () => {
    if (!code.trim()) return;
    setIsExecuting(true);
    setOutput(null);
    try {
      const result = await executeCode(language, code);
      const executionData = result.run || result.compile;
      if (executionData) {
        setOutput(executionData);
        toast.success("Execution completed successfully.");
      } else {
        throw new Error("No compilation or run outputs received.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to execute code.");
    } finally {
      setIsExecuting(false);
    }
  };

  // =========================================================================
  // 2. NEW AI MOCK INTERVIEW PRACTICE MODE STATE
  // =========================================================================
  const [practiceHistory, setPracticeHistory] = useState<any[]>([]);
  const [totalXP, setTotalXP] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  
  // Wizard Setup Stages: 0 = Lobby, 1 = Onboarding wizard, 2 = Live Studio, 3 = Feedback Report
  const [wizardStep, setWizardStep] = useState(0); 
  const [subStep, setSubStep] = useState(1); // 1 = Role, 2 = Rounds/Settings, 3 = Calibration check, 4 = Waiting countdown

  // Onboarding Selection
  const [roleSearch, setRoleSearch] = useState("");
  const [roleCategory, setRoleCategory] = useState("Software Development");
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [selectedRound, setSelectedRound] = useState("Technical");
  const [selectedDifficulty, setSelectedDifficulty] = useState("Medium");
  const [selectedMode, setSelectedMode] = useState("Timed");
  const [selectedPersonality, setSelectedPersonality] = useState("Professional");
  const [technicalMode, setTechnicalMode] = useState<"theory" | "coding">("theory");

  // Media Calibration Check
  const [hasCameraStream, setHasCameraStream] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const [diagMic, setDiagMic] = useState<"pending" | "checking" | "success" | "failed">("pending");
  const [diagCam, setDiagCam] = useState<"pending" | "checking" | "success" | "failed">("pending");
  const [diagVad, setDiagVad] = useState<"pending" | "checking" | "success" | "failed">("pending");

  // React Callback Refs for automatic video stream binding
  const calibVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && webcamStreamRef.current) {
      node.srcObject = webcamStreamRef.current;
    }
  }, [hasCameraStream]);

  const roomVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && webcamStreamRef.current) {
      node.srcObject = webcamStreamRef.current;
    }
  }, [hasCameraStream, wizardStep]);

  const [calibrationError, setCalibrationError] = useState<string | null>(null);

  // Enterprise voice synchronization triggers
  const [micInputDetected, setMicInputDetected] = useState(false);

  // Live Assessment Session (Room)
  const [secondsRemaining, setSecondsRemaining] = useState(900); // 15 mins default
  const [proctorSandboxLogs, setProctorSandboxLogs] = useState<string[]>([]);
  const [isFullscreenActive, setIsFullscreenActive] = useState(true);
  const escPressedRef = useRef(false);
  const [difficultyHistory, setDifficultyHistory] = useState<string[]>(["Medium"]);
  const [fillerWordsCount, setFillerWordsCount] = useState(0);

  const isRoomActiveRef = useRef(false);
  const isAutonomousRef = useRef(true);
  const startInterviewTriggeredRef = useRef(false);

  // Recording snapshots
  const [completedReport, setCompletedReport] = useState<any | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [currentQuestionAttemptCount, setCurrentQuestionAttemptCount] = useState(0);

  const [practiceSessionId, setPracticeSessionId] = useState<string | null>(null);
  const [sessionSaveStatus, setSessionSaveStatus] = useState<"synced" | "in_memory" | "failed">("synced");
  const [evaluationDebugLog, setEvaluationDebugLog] = useState<any | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const currentQuestionsList = generatedQuestions.map((q) => q.question);

  // Instantiate our shared voice interview orchestration service hook
  const {
    orchestratorState,
    aiSpeechState,
    logs: orchestratorTelemetryLogs,
    chatLog,
    micVolume: roomMicVolume,
    interimText: interimSubtitleText,
    candidateText: candidateResponseText,
    currentQuestionIndex,
    diagnostics,
    setCandidateText: setCandidateResponseText,
    startInterview,
    submitCandidateAnswer,
    handleCandidateAnswerSubmit,
    orchestrator
  } = useVoiceInterview(practiceSessionId || "", () => {
    handleFinishAndGenerateReport();
  });

  const isDictating = orchestrator?.recognitionManager?.active || false;
  const isUserSpeaking = roomMicVolume > 0;
  const silenceCountdown = (orchestratorState === "LISTENING" || orchestratorState === "SPEECH_DETECTED") ? 2 : null;
  const aiSpeechVisualizerHeight = aiSpeechState === "speaking"
    ? Array.from({ length: 12 }, () => Math.floor(10 + Math.random() * 45))
    : new Array(12).fill(10);

  const isDevMode = typeof window !== "undefined" && (process.env.NODE_ENV === "development" || window.location.hostname === "localhost");

  const isCodingOrDesign = selectedRound === "Coding" || 
    (selectedRound === "Technical" && technicalMode === "coding") || 
    selectedRound === "System Design";

  // Fullscreen and Sandboxed Proctoring for Practice Room (Tab Switch, Blur, Copy/Paste)
  useEffect(() => {
    if (wizardStep !== 2) return;
    if (!isCodingOrDesign) return;

    // Fullscreen change handler
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
      } else {
        setProctorSandboxLogs(prev => [...prev, `ℹ_ [PROCTOR] Candidate entered fullscreen mode. (${new Date().toLocaleTimeString()})`]);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        escPressedRef.current = true;
      }
    };

    // Tab Switch / Blur detection
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

    // Copy / Paste restriction
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

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);

    // Initial sync
    setIsFullscreenActive(!!document.fullscreenElement);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
    };
  }, [wizardStep, isCodingOrDesign]);

  // Helper to upsert practice session (Supabase first, in-memory fallback, localStorage for recovery backup only)
  const savePracticeSession = async (id: string, updates: Partial<any>) => {
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const dbRoundName = selectedRound === "Technical"
        ? (technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)")
        : selectedRound;

      const payload = {
        id,
        user_id: user?.id || null,
        role: selectedRole.name,
        round: dbRoundName,
        difficulty: selectedDifficulty,
        personality: selectedPersonality,
        questions: updates.questions || generatedQuestions,
        chat_log: updates.chatLog || chatLog,
        evaluation: updates.evaluation || completedReport,
        status: updates.status || "active",
        error_reason: updates.errorReason || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("practice_interviews").upsert(payload);
      if (error) throw error;

      setSessionSaveStatus("synced");
      // Clean up localStorage recovery backup once synced/concluded
      if (updates.status === "completed" || updates.status === "failed") {
        localStorage.removeItem("practice_recovery_" + id);
      }
      return true;
    } catch (dbError) {
      const dbRoundName = selectedRound === "Technical"
        ? (technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)")
        : selectedRound;

      console.warn("Supabase save failed/unavailable, keeping session in-memory:", dbError);
      setSessionSaveStatus("in_memory");
      // Store copy in localStorage ONLY as a recovery backup in case of accidental browser refresh
      localStorage.setItem("practice_recovery_" + id, JSON.stringify({
        id,
        role: selectedRole.name,
        round: dbRoundName,
        difficulty: selectedDifficulty,
        personality: selectedPersonality,
        questions: updates.questions || generatedQuestions,
        chatLog: updates.chatLog || chatLog,
        evaluation: updates.evaluation || completedReport,
        status: updates.status || "active",
        errorReason: updates.errorReason || null
      }));
      return false;
    }
  };

  // Manual retry sync function
  const handleRetryCloudSync = async () => {
    if (!practiceSessionId) return;
    toast.loading("Retrying cloud synchronization...", { id: "cloud-sync" });
    const success = await savePracticeSession(practiceSessionId, {
      questions: generatedQuestions,
      chatLog,
      evaluation: completedReport,
      status: evaluationError ? "failed" : "completed",
      errorReason: evaluationError
    });
    if (success) {
      toast.success("Successfully synchronized practice run to the Cloud!", { id: "cloud-sync" });
    } else {
      toast.error("Cloud sync failed. The session is still safe in memory.", { id: "cloud-sync" });
    }
  };

  // Recover session or load completed report in case of redirect
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const completedSessionId = urlParams.get("completedSessionId");
      
      if (completedSessionId) {
        const reportStr = localStorage.getItem("practice_completed_report_" + completedSessionId);
        if (reportStr) {
          try {
            const report = JSON.parse(reportStr);
            setCompletedReport(report);
            setWizardStep(3); // Go directly to report step
            
            // Clean up
            localStorage.removeItem("practice_completed_report_" + completedSessionId);
            toast.success("AI Mock evaluation report compiled successfully!");
            
            // Clean up URL parameters cleanly
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
            return;
          } catch (e) {
            console.error("Report parse failed:", e);
          }
        }
      }

      const keys = Object.keys(localStorage);
      const recoveryKey = keys.find(k => k.startsWith("practice_recovery_"));
      if (recoveryKey) {
        try {
          const recovered = JSON.parse(localStorage.getItem(recoveryKey)!);
          console.log("Accidental refresh recovery loaded:", recovered);
          setPracticeSessionId(recovered.id);
          setGeneratedQuestions(recovered.questions);
          if (orchestrator) {
            orchestrator.conversationManager.chatLog = recovered.chatLog || [];
          }
          setCompletedReport(recovered.evaluation);
          setEvaluationError(recovered.errorReason);
          setSessionSaveStatus("in_memory");
          toast.info("Active practice session recovered from browser memory.");
        } catch (e) {}
      }
    }
  }, []);

  const generateMockQuestions = async (role: string, round: string, diff: string, pers: string) => {
    setIsGeneratingQuestions(true);
    try {
      const response = await fetch("/api/ai/mock/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, round, difficulty: diff, personality: pers })
      });
      let data: any = null;
      if (response.ok) {
        data = await response.json();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${response.status}`);
      }
      if (data && data.questions && data.questions.length === 3) {
        setGeneratedQuestions(data.questions);
        console.log("Dynamically generated questions:", data.questions);
      } else {
        throw new Error("Invalid response format: questions array is missing or length is not 3");
      }
    } catch (e: any) {
      console.warn("Failed to generate dynamic questions, falling back to static questions:", e.message || e);
      
      // Let the user know we fell back gracefully to static questions
      if (e.message && (e.message.includes("quota") || e.message.includes("limit") || e.message.includes("status 500"))) {
        toast.warning("AI rate limit reached. Using pre-configured mock questions for your practice session.");
      }

      // Normalize round name to match static question registry keys
      let normalizedRound = round;
      if (round.toLowerCase().includes("coding")) {
        normalizedRound = "Coding";
      } else if (round.toLowerCase().includes("theory") || round.toLowerCase().includes("technical")) {
        normalizedRound = "Technical";
      }

      // Flexibly match selected role with static PRACTICE_QUESTIONS keys
      let roleKey = role;
      if (!PRACTICE_QUESTIONS[roleKey]) {
        const keys = Object.keys(PRACTICE_QUESTIONS);
        const match = keys.find(
          k => k.toLowerCase().includes(role.toLowerCase()) || 
               role.toLowerCase().includes(k.toLowerCase()) ||
               k.replace(/engineer|developer/gi, "").trim().toLowerCase() === role.replace(/engineer|developer/gi, "").trim().toLowerCase()
        );
        if (match) roleKey = match;
      }

      const staticQs = (PRACTICE_QUESTIONS[roleKey] && PRACTICE_QUESTIONS[roleKey][normalizedRound]) 
        || FALLBACK_QUESTIONS[normalizedRound] 
        || FALLBACK_QUESTIONS["Warm Up"];
        
      const fallbackStructure = staticQs.slice(0, 3).map((q) => ({
        question: q,
        idealAnswer: "Ideal response covering the technical requirements of this topic.",
        keywords: ["technical", "implementation", "architecture"],
        concepts: ["design", "correctness"],
        rubric: {
          beginner: "Weak response with minimal technical terms.",
          intermediate: "Answers the question but lacks deep specifics.",
          expert: "Accurate, comprehensive answer with clear concepts."
        }
      }));
      setGeneratedQuestions(fallbackStructure);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStageText, setEvaluationStageText] = useState("");

  const timerIntervalRef = useRef<any>(null);

  // Initialize and load persistent sandboxed data from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const historyStr = localStorage.getItem("practice_history");
      const xpStr = localStorage.getItem("practice_xp") || "0";
      const streakStr = localStorage.getItem("practice_streak") || "4";
      if (historyStr) {
        try { setPracticeHistory(JSON.parse(historyStr)); } catch (e) {}
      }
      setTotalXP(parseInt(xpStr));
      setStreakDays(parseInt(streakStr));
    }
  }, []);

  // Parse URL search parameters for practice session replay context restoration
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const roleParam = urlParams.get("role");
      const roundParam = urlParams.get("round");
      const diffParam = urlParams.get("difficulty");
      const langParam = urlParams.get("language");
      
      if (roleParam && roundParam) {
        // Pre-configure settings
        const matchedRole = ROLES.find(r => r.name.toLowerCase() === roleParam.toLowerCase() || r.id === roleParam.toLowerCase());
        if (matchedRole) {
          setSelectedRole(matchedRole);
        }
        
        // Clean round names (e.g. "Technical (Coding)" -> "Technical")
        let roundClean = roundParam;
        if (roundParam.includes("Technical")) {
          roundClean = "Technical";
          if (roundParam.toLowerCase().includes("coding")) {
            setTechnicalMode("coding");
          } else {
            setTechnicalMode("theory");
          }
        }
        
        setSelectedRound(roundClean);
        if (diffParam) setSelectedDifficulty(diffParam);
        if (langParam) setLanguage(langParam.toLowerCase());
        
        // Auto-open onboarding wizard and advance to calibration step
        setWizardStep(1);
        setSubStep(3);
        
        // Generate mock questions for replay
        generateMockQuestions(
          matchedRole ? matchedRole.name : roleParam,
          roundParam,
          diffParam || "Medium",
          selectedPersonality
        );
        
        toast.success("Restored practice settings for replay.");
        
        // Clear search params cleanly without page refresh
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
      }
    }
  }, []);

  // Real-time query permission status change and hardware plug/unplug listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Listen to hardware media device plug/unplug changes
    const handleDeviceChange = () => {
      console.log("Hardware device change event captured. Restructuring active media streams...");
      if (subStep === 3 || wizardStep === 2) {
        startHardwareCalibration();
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }

    // 2. Listen to browser permission state toggles
    let camStatus: PermissionStatus | null = null;
    let micStatus: PermissionStatus | null = null;

    const handlePermissionChange = () => {
      console.log("Browser permission level changed. Re-calibrating hardware...");
      if (subStep === 3 || wizardStep === 2) {
        startHardwareCalibration();
      }
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "camera" as any }).then(status => {
        camStatus = status;
        status.addEventListener("change", handlePermissionChange);
      }).catch(e => console.warn("Camera permissions query unsupported in this browser context."));

      navigator.permissions.query({ name: "microphone" as any }).then(status => {
        micStatus = status;
        status.addEventListener("change", handlePermissionChange);
      }).catch(e => console.warn("Microphone permissions query unsupported in this browser context."));
    }

    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
      if (camStatus) camStatus.removeEventListener("change", handlePermissionChange);
      if (micStatus) micStatus.removeEventListener("change", handlePermissionChange);
    };
  }, [subStep, wizardStep]);

  // Speech loop handlers replaced by the useVoiceInterview orchestrator

  // Launch media permissions check with fallback constraint queues and hardware diagnostics
  const startHardwareCalibration = async () => {
    // Trigger dynamic question generation in the background
    const resolvedRound = selectedRound === "Technical"
      ? (technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)")
      : selectedRound;
    generateMockQuestions(selectedRole.name, resolvedRound, selectedDifficulty, selectedPersonality);
    
    setWizardStep(1);
    setSubStep(3);
    setDiagMic("checking");
    setDiagCam("checking");
    setDiagVad("checking");
    setCalibrationError(null);
    setMicInputDetected(false);

    // Clean up previous stream and trackers if any to prevent hardware locks
    if (webcamStreamRef.current) {
      try {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (err) {}
      webcamStreamRef.current = null;
    }

    try {
      // 1. Browser compatibility safeguard
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("navigator.mediaDevices.getUserMedia is not supported by your browser or secure local context.");
      }

      // Enumerate available hardware units to verify inputs exist
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      const audioDevices = devices.filter(d => d.kind === "audioinput");

      if (videoDevices.length === 0 && audioDevices.length === 0) {
        throw new Error("No active webcam or microphone hardware detected on this platform.");
      }

      // 2. Sequential media capture: Attempt ideal settings, then fall back to broad settings
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (hdErr) {
        console.warn("High-definition userMedia constraints rejected, fallback to generic camera constraints...", hdErr);
        // Resilient fallback constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      }

      // Store successfully captured stream ref
      webcamStreamRef.current = stream;
      
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      // Check mic status
      if (audioTracks.length > 0 && audioTracks[0].enabled) {
        setDiagMic("success");
      } else {
        setDiagMic("failed");
      }

      // Check webcam status
      if (videoTracks.length > 0 && videoTracks[0].enabled) {
        setDiagCam("success");
        setHasCameraStream(true);
      } else {
        setDiagCam("failed");
        setHasCameraStream(false);
      }

      // Check Speech-to-Text VAD availability
      const hasSpeechRec = typeof window !== "undefined" && (
        "webkitSpeechRecognition" in window || 
        "SpeechRecognition" in window || 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition
      );
      if (hasSpeechRec && audioTracks.length > 0) {
        setDiagVad("success");
      } else {
        setDiagVad("failed");
      }

      // Log verified device names into Proctor Sandbox Companion logs
      const videoLabel = videoTracks[0]?.label || "Default Integrated Camera";
      const audioLabel = audioTracks[0]?.label || "Default Audio Capture Channel";
      setProctorSandboxLogs(prev => [
        ...prev,
        `📹 Real-time camera online: ${videoLabel}`,
        `🎙️ Audio feed calibrated: ${audioLabel}`
      ]);

      // Web Audio API mic pitch/gain visualizer
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 128;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const readVolume = () => {
        if (!webcamStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const volume = Math.min(100, Math.floor(avg * 2.5));
        setMicVolume(volume);

        // Detect mic speech inputs above threshold
        if (volume > 4) {
          setMicInputDetected(true);
        }

        requestAnimationFrame(readVolume);
      };
      readVolume();

    } catch (e: any) {
      console.error("Hardware calibration failed:", e);
      let friendlyError = e.message || "Permissions denied or hardware unmounted.";
      if (e.name === "NotReadableError" || friendlyError.toLowerCase().includes("in use") || friendlyError.toLowerCase().includes("readable")) {
        friendlyError = "Webcam or Microphone is already in use by another application (e.g. Zoom, Teams, Skype, or another browser tab). Please close all other applications and retry.";
      }
      setCalibrationError(friendlyError);
      toast.error(`Media device capture failed: ${friendlyError}`);
      setHasCameraStream(false);
      setDiagMic("failed");
      setDiagCam("failed");
      setDiagVad("failed");

      setProctorSandboxLogs(prev => [
        ...prev,
        `⚠️ Media Pipeline Crash: ${friendlyError}`
      ]);
    }
  };

  const handleLaunchPreset = (preset: any) => {
    const roleObj = ROLES.find(r => r.name.toLowerCase().includes(preset.title.split(" ")[0].toLowerCase())) || ROLES[0];
    setSelectedRole(roleObj);
    setSelectedRound(preset.round);
    setSelectedDifficulty(preset.difficulty);
    setSelectedMode(preset.mode);
    setSelectedPersonality(preset.personality);
    
    // Routes directly to Calibration Stage
    startHardwareCalibration();
  };

  // Triggers Timed / Countdown systems
  function startInterviewRoomSession(questions: string[]) {
    setWizardStep(2);
    startInterviewTriggeredRef.current = false;
    
    // Generate a fresh session ID
    const sessionId = "practice-" + Math.floor(Math.random() * 10000000);
    setPracticeSessionId(sessionId);
    setEvaluationError(null);
    setEvaluationDebugLog(null);
    
    // Save initial session state
    savePracticeSession(sessionId, {
      questions: generatedQuestions,
      chatLog: [],
      status: "active"
    });

    setDifficultyHistory([selectedDifficulty]);
    setFillerWordsCount(0);

    // Set countdown limits
    let duration = 900; // 15 mins for Timed
    if (selectedMode === "Pressure") duration = 300; // 5 mins pressure round
    if (selectedMode === "Rapid Fire") duration = 180; // 3 mins rapid verbal fire
    setSecondsRemaining(duration);

    if (selectedMode !== "Relaxed") {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            finishSession();
            toast.warning("Practice session timer expired! Auto-generating assessment report.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }

  // Trigger voice interview orchestration on startup
  useEffect(() => {
    if (!practiceSessionId || generatedQuestions.length === 0 || wizardStep !== 2) return;
    if (startInterviewTriggeredRef.current) return;
    startInterviewTriggeredRef.current = true;

    const resolvedRound = selectedRound === "Technical"
      ? (technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)")
      : selectedRound;

    startInterview(generatedQuestions, {
      role: selectedRole.name,
      round: resolvedRound,
      difficulty: selectedDifficulty,
      personality: selectedPersonality,
      stream: webcamStreamRef.current
    });
  }, [practiceSessionId, generatedQuestions, wizardStep]);

  const goToNextQuestion = () => {
    orchestrator?.transitionTo("NEXT_QUESTION");
  };

  const finishSession = () => {
    orchestrator?.transitionTo("REPORT_GENERATION");
  };

  const toggleDictation = () => {
    if (orchestrator?.recognitionManager?.active) {
      orchestrator.recognitionManager.stop();
      toast.success("Voice recording paused. Click again to resume.");
    } else {
      orchestrator?.recognitionManager?.start();
      toast.success("Recording voice — speak clearly.");
    }
  };

  // Generate SaaS Report Dashboard & curates 7-Day goals
  async function handleFinishAndGenerateReport(finalChatTranscript?: any[]) {
    isRoomActiveRef.current = false;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    orchestrator?.destroy();

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    }

    setIsEvaluating(true);
    setEvaluationError(null);
    setEvaluationDebugLog(null);
    setEvaluationStageText("Analyzing overall semantic alignment & relevance...");

    const stageTimer1 = setTimeout(() => {
      setEvaluationStageText("Evaluating technical accuracy & factual correctness...");
    }, 1500);

    const stageTimer2 = setTimeout(() => {
      setEvaluationStageText("Synthesizing comprehensive readiness report...");
    }, 3000);

    try {
      const resolvedRoundName = selectedRound === "Technical"
        ? (technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)")
        : selectedRound;

      const activeTranscript = finalChatTranscript || chatLog;
      const response = await fetch("/api/ai/mock/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole.name,
          round: resolvedRoundName,
          difficulty: selectedDifficulty,
          questions: generatedQuestions,
          chatLog: activeTranscript,
          fillerWordsCount
        })
      });

      const data = await response.json();

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsEvaluating(false);

      // Phase 5: If evaluation explicitly failed (transcript invalid, LLM parse error, etc.)
      if (!response.ok || data.success === false) {
        const errorMsg = data.error || "Evaluation Failed";
        const errorReason = data.reason || "An unknown error occurred during evaluation.";
        setEvaluationError(errorMsg + ": " + errorReason);
        if (data.debugLog) setEvaluationDebugLog(data.debugLog);

        // Save failed status to DB
        if (practiceSessionId) {
          savePracticeSession(practiceSessionId, {
            chatLog: activeTranscript,
            status: "failed",
            errorReason: errorMsg + ": " + errorReason
          });
        }

        setWizardStep(3);
        toast.error(errorMsg);
        return;
      }

      // Success path: extract evaluation from response
      const evalData = data.evaluation;
      if (data.debugLog) setEvaluationDebugLog(data.debugLog);

      const targetRoleName = selectedRole.name;
      const newReport = {
        id: "mock-" + Date.now(),
        date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
        role: targetRoleName,
        round: resolvedRoundName,
        difficulty: selectedDifficulty,
        readinessScore: evalData.readinessScore,
        skills: selectedRole.skills,
        metrics: evalData.metrics,
        strengths: evalData.strengths,
        weaknesses: evalData.weaknesses,
        recommendations: evalData.recommendations,
        improvementPlan: evalData.improvementPlan,
        chatTranscript: activeTranscript,
        fillerWords: fillerWordsCount,
        questionsReview: evalData.questionsReview
      };

      setCompletedReport(newReport);
      setWizardStep(3); // Route to Reports view

      // Add streaks and XP points
      const updatedXP = totalXP + 150;
      const updatedStreak = streakDays + 1;
      setTotalXP(updatedXP);
      setStreakDays(updatedStreak);
      localStorage.setItem("practice_xp", String(updatedXP));
      localStorage.setItem("practice_streak", String(updatedStreak));

      // Append mock assessment to Practice History sandbox in localStorage
      const updatedHistory = [newReport, ...practiceHistory];
      setPracticeHistory(updatedHistory);
      localStorage.setItem("practice_history", JSON.stringify(updatedHistory));

      // Save completed status to DB
      if (practiceSessionId) {
        savePracticeSession(practiceSessionId, {
          chatLog: activeTranscript,
          evaluation: newReport,
          status: "completed"
        });
      }

      toast.success("AI Feedback Report synthesized! Streaks and XP updated.");
    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      console.error(err);
      const errorMsg = "Evaluation Failed: " + (err.message || "Network or server error.");
      setEvaluationError(errorMsg);
      setIsEvaluating(false);
      setWizardStep(3);

      // Save failed status to DB
      if (practiceSessionId) {
        savePracticeSession(practiceSessionId, {
          chatLog: finalChatTranscript || chatLog,
          status: "failed",
          errorReason: errorMsg
        });
      }

      toast.error("Failed to generate AI performance report.");
    }
  }

  function handleStartPracticeWizard() {
    setWizardStep(1);
    setSubStep(1);
  }

  function handleReturnToLobby() {
    isRoomActiveRef.current = false;
    orchestrator?.destroy();

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setWizardStep(0);
    setCompletedReport(null);
  }

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to purge all sandboxed mock interview reports and reset gamified streak states?")) {
      localStorage.removeItem("practice_history");
      localStorage.removeItem("practice_xp");
      localStorage.removeItem("practice_streak");
      setPracticeHistory([]);
      setTotalXP(0);
      setStreakDays(0);
      toast.success("Practice database records reset completed.");
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] w-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Dynamic Sub-header Navigation */}
      {wizardStep === 0 && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 p-2.5 rounded-xl">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActivePlaygroundTab("studio")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase transition",
                activePlaygroundTab === "studio"
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Mock Interview Studio
            </button>
            <button
              onClick={() => setActivePlaygroundTab("sandbox")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase transition",
                activePlaygroundTab === "sandbox"
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              AI Coding Sandbox
            </button>
          </div>
          
          {activePlaygroundTab === "studio" && (
            <div className="flex items-center gap-4 text-xs font-mono font-bold text-zinc-400 mr-2.5">
              <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                <Flame className="w-3.5 h-3.5 fill-current text-amber-500" />
                Streak: {streakDays} Days
              </span>
              <span className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                <Zap className="w-3.5 h-3.5 fill-current text-indigo-500" />
                {totalXP} XP Points
              </span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB A: ORIGINAL CODING PLAYGROUND                                         */}
      {/* ========================================================================= */}
      {activePlaygroundTab === "sandbox" && wizardStep === 0 && (
        <div className="flex-1 flex flex-col space-y-6 min-h-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 select-none">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent flex items-center gap-2">
                <Code2 className="w-8 h-8 text-primary" />
                AI Coding Playground
              </h1>
              <p className="text-muted-foreground mt-1">
                Accelerate your learning. Solve curated algorithmic rounds and trigger instant Gemini reviews.
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden shadow-2xl">
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize={35} minSize={25} className="bg-zinc-900/20 backdrop-blur-sm border-r border-zinc-850">
                <Tabs defaultValue="problems" className="h-full flex flex-col">
                  <div className="h-12 shrink-0 bg-zinc-900/60 border-b border-zinc-850 px-4 flex items-center">
                    <TabsList className="bg-zinc-950/60 w-full grid grid-cols-2">
                      <TabsTrigger value="problems" className="data-[state=active]:bg-zinc-800 flex items-center gap-1.5 text-xs">
                        <BookOpen className="w-3.5 h-3.5" />
                        Problem Catalog
                      </TabsTrigger>
                      <TabsTrigger value="desc" className="data-[state=active]:bg-zinc-800 flex items-center gap-1.5 text-xs">
                        <FileCode2 className="w-3.5 h-3.5" />
                        Focus View
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 min-h-0 relative overflow-y-auto custom-scrollbar p-2">
                    <TabsContent value="problems" className="h-full m-0 p-4 space-y-3 data-[state=inactive]:hidden">
                      <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">Practice Questions</p>
                      {PROBLEMS.map((prob) => (
                        <div 
                          key={prob.id}
                          onClick={() => setSelectedProblem(prob)}
                          className={cn(
                            "p-4 rounded-lg border cursor-pointer transition-all duration-200 flex justify-between items-center group",
                            selectedProblem.id === prob.id 
                              ? "bg-primary/5 border-primary/45" 
                              : "bg-zinc-900/40 border-zinc-850 hover:border-zinc-800 hover:bg-zinc-900/70"
                          )}
                        >
                          <div className="space-y-1.5 min-w-0">
                            <span className={cn(
                              "font-bold text-sm truncate block",
                              selectedProblem.id === prob.id ? "text-primary" : "text-zinc-200 group-hover:text-white"
                            )}>
                              {prob.title}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-black uppercase px-1.5 py-0.5",
                                prob.difficulty === "Easy" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                prob.difficulty === "Medium" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                prob.difficulty === "Hard" && "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {prob.difficulty}
                              </Badge>
                              <span className="text-[10px] text-zinc-500">{prob.category}</span>
                            </div>
                          </div>
                          <ChevronRight className={cn(
                            "w-4 h-4 transition-transform duration-300",
                            selectedProblem.id === prob.id ? "text-primary translate-x-0.5" : "text-zinc-600 group-hover:text-zinc-400"
                          )} />
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="desc" className="h-full m-0 p-4 space-y-6 data-[state=inactive]:hidden select-text">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            "text-[10px] font-black uppercase px-2 py-0.5",
                            selectedProblem.difficulty === "Easy" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            selectedProblem.difficulty === "Medium" && "bg-amber-500/10 text-amber-400 border-emerald-500/20",
                            selectedProblem.difficulty === "Hard" && "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {selectedProblem.difficulty}
                          </Badge>
                          <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{selectedProblem.category}</span>
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{selectedProblem.title}</h2>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                        {selectedProblem.description}
                      </p>
                      {/* Examples */}
                      <div className="space-y-4 pt-4 border-t border-zinc-850">
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Examples
                        </h4>
                        {selectedProblem.examples.map((example, idx) => (
                          <div key={idx} className="p-3 bg-zinc-950/40 rounded border border-zinc-850 space-y-1.5 font-mono text-xs">
                            <p className="font-sans font-bold text-zinc-400">Example {idx + 1}:</p>
                            <p><span className="text-zinc-500 font-semibold">Input:</span> {example.input}</p>
                            <p><span className="text-zinc-500 font-semibold">Output:</span> {example.output}</p>
                            {example.explanation && (
                              <p className="italic text-zinc-450 mt-1 pl-2 border-l border-zinc-850"><span className="text-zinc-500 font-semibold not-italic">Explanation:</span> {example.explanation}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </ResizablePanel>

              <ResizableHandle className="w-1 bg-zinc-850 hover:bg-primary/50 transition-colors z-10" />

              <ResizablePanel defaultSize={65} minSize={35} className="flex flex-col">
                {/* Editor Controls */}
                <div className="h-12 shrink-0 bg-zinc-900/60 border-b border-zinc-850 px-4 flex items-center justify-between select-none">
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-zinc-800 text-xs text-zinc-200 border border-zinc-750 rounded-md px-2 py-1 outline-none cursor-pointer focus:border-primary transition"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>{lang.name}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsReviewOpen(true)}
                      disabled={!code.trim() || isExecuting}
                      className="flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 h-8.5 rounded-md text-xs font-semibold cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Code Review
                    </button>
                    <button 
                      onClick={handleRunCode}
                      disabled={isExecuting}
                      className="flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 h-8.5 rounded-md text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                    >
                      {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      Run Sandbox
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 relative">
                  <ResizablePanelGroup orientation="vertical">
                    <ResizablePanel defaultSize={70} minSize={30}>
                      <CodeEditor 
                        language={language}
                        value={code}
                        onChange={(val) => setCode(val || "")}
                      />
                    </ResizablePanel>
                    <ResizableHandle className="h-1 bg-zinc-850 hover:bg-primary/50 transition-colors" />
                    <ResizablePanel defaultSize={30} minSize={15} className="flex flex-col bg-zinc-900/60 font-mono text-xs select-text">
                      <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-zinc-850 bg-zinc-900 select-none">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                          <Terminal className="w-3.5 h-3.5" /> Interactive Terminal Output
                        </span>
                      </div>
                      <div className="flex-1 overflow-auto p-4 bg-zinc-950/20 leading-relaxed text-zinc-300">
                        {isExecuting ? (
                          <div className="flex items-center gap-2 text-zinc-550 animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Executing compiler...
                          </div>
                        ) : output ? (
                          <div className="flex flex-col gap-2">
                            {output.stderr && <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>}
                            {output.stdout && <pre className="text-zinc-200 whitespace-pre-wrap">{output.stdout}</pre>}
                            {!output.stderr && !output.stdout && <span className="text-zinc-650 italic">Compilation succeeded. Sandbox exited with 0.</span>}
                            <div className="mt-4 pt-4 border-t border-zinc-850 flex gap-4 text-[10px] text-zinc-500 font-semibold select-none">
                              <span>Status: <span className={output.code === 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{output.code === 0 ? "Success" : "Run Error"}</span></span>
                              <span>Duration: {output.time}ms</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600 italic">Playground terminal active. Write code and click Run Sandbox.</span>
                        )}
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          <AIReviewModal 
            isOpen={isReviewOpen}
            onClose={() => setIsReviewOpen(false)}
            code={code}
            language={language}
            problemStatement={selectedProblem}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB B: NEW AI MOCK INTERVIEW STUDIO LOBBY                                 */}
      {/* ========================================================================= */}
      {activePlaygroundTab === "studio" && wizardStep === 0 && (
        <div className="flex-1 flex flex-col space-y-8 min-h-0 select-none scrollbar-thin overflow-y-auto pr-1">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent flex items-center gap-2">
                <Brain className="w-8 h-8 text-primary" />
                AI Mock Interview Studio
              </h1>
              <p className="text-zinc-450 mt-1 text-sm font-medium">
                SaaS-grade dynamic interview coaches. Elevate response readiness, track filler frequencies, and unlock streaks.
              </p>
            </div>
            
            <Button
              onClick={handleStartPracticeWizard}
              className="primary-button px-6 h-11 rounded-xl transition-all duration-300 hover:scale-105 shrink-0"
            >
              Start Practice Interview <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>

          {/* Preset Practice Interview Templates */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
                Practice Interview Templates
              </span>
              <span className="text-[9px] text-zinc-450">One-click simulated presets</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRESETS.map((preset, idx) => (
                <Card 
                  key={idx}
                  onClick={() => handleLaunchPreset(preset)}
                  className={cn(
                    "bg-zinc-900/30 border-zinc-850 hover:border-zinc-800 hover:bg-zinc-900/60 transition-all duration-300 cursor-pointer shadow-lg group overflow-hidden relative",
                    preset.bg
                  )}
                >
                  <CardHeader className="p-5 flex flex-row items-start justify-between space-y-0 pb-2.5">
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm text-white group-hover:text-primary transition">{preset.title}</h3>
                      <p className="text-[10px] text-zinc-500 font-semibold">{preset.round} Round • {preset.difficulty}</p>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black uppercase border-zinc-800 bg-zinc-950/80 px-2 py-0.5">
                      {preset.personality}
                    </Badge>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 pt-0">
                    <div className="flex items-center justify-between text-[9px] text-zinc-550 pt-2 border-t border-zinc-900/40">
                      <span>Mode: <span className="text-zinc-300 font-bold">{preset.mode}</span></span>
                      <span className="flex items-center gap-0.5 text-primary group-hover:translate-x-1 transition-transform duration-300">Launch ↗</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Practice History & Comparison Stats */}
          <div className="space-y-4 pt-2 flex-1 min-h-[250px] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                Practice History & reports
              </span>
              {practiceHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear Database
                </button>
              )}
            </div>

            {practiceHistory.length === 0 ? (
              <div className="flex-1 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                <Brain className="w-12 h-12 text-zinc-700 mb-3 animate-pulse" />
                <span className="font-bold text-sm text-zinc-400 block">No practice sessions found</span>
                <p className="text-xs text-zinc-650 max-w-xs mt-1">Initialize onboarding templates above to record simulated assessments, streaks, and speech audits.</p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {practiceHistory.map((report) => (
                  <Card 
                    key={report.id}
                    onClick={() => {
                      setCompletedReport(report);
                      setWizardStep(3); // Loads saved reports view
                    }}
                    className="bg-zinc-900/20 border-zinc-850 hover:border-zinc-800 transition duration-300 cursor-pointer shadow p-5 flex items-center justify-between relative group select-text"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="space-y-0.5">
                        <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {report.date}
                        </span>
                        <h4 className="font-black text-sm text-zinc-200 group-hover:text-white truncate">{report.role}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[8px] font-black uppercase bg-zinc-950 text-zinc-400 border-zinc-800">
                          {report.round}
                        </Badge>
                        <Badge variant="outline" className="text-[8px] font-black uppercase bg-zinc-950 text-zinc-400 border-zinc-800">
                          {report.difficulty}
                        </Badge>
                        <span className="text-[9px] text-zinc-550 font-mono">Fillers: {report.fillerWords}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0 select-none">
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] text-zinc-550 font-bold uppercase tracking-wider leading-none">Readiness</span>
                        <span className={cn(
                          "text-xl font-black mt-1 font-mono leading-none",
                          report.readinessScore >= 80 ? "text-emerald-400" : report.readinessScore >= 60 ? "text-amber-400" : "text-red-400"
                        )}>
                          {report.readinessScore}%
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-650 group-hover:text-white group-hover:translate-x-0.5 transition" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STEP-BY-STEP ONBOARDING WIZARD SCREEN                                  */}
      {/* ========================================================================= */}
      {wizardStep === 1 && (
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full bg-zinc-900/30 border border-zinc-850 rounded-2xl shadow-2xl p-6 select-none relative animate-scale-in">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-6 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-primary/10 border border-primary/20 font-mono font-bold text-primary px-2.5 py-1 rounded-lg">
                Step 0{subStep} / 04
              </span>
              <h3 className="font-extrabold text-sm text-white">Interactive Setup Flow</h3>
            </div>
            
            <button
              onClick={handleReturnToLobby}
              className="text-zinc-500 hover:text-white font-bold text-xs uppercase cursor-pointer"
            >
              Cancel Prep
            </button>
          </div>

          {/* Onboarding Wizard Progress Timeline */}
          <div className="grid grid-cols-4 gap-2 mb-6 shrink-0 select-none">
            {[
              { label: "Choose Role", step: 1 },
              { label: "Settings", step: 2 },
              { label: "Calibration", step: 3 },
              { label: "Countdown", step: 4 }
            ].map((node) => (
              <div key={node.step} className="space-y-1.5 flex flex-col">
                <div className={cn(
                  "h-1 rounded transition-all duration-300",
                  subStep >= node.step ? "bg-primary" : "bg-zinc-800"
                )} />
                <span className={cn(
                  "text-[8px] font-extrabold uppercase tracking-wider",
                  subStep === node.step ? "text-primary animate-pulse" : subStep > node.step ? "text-zinc-400" : "text-zinc-650"
                )}>
                  {node.label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {/* SUBSTEP 1: Choose your Role */}
            {subStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-black text-white tracking-tight">Choose your target Role</h2>
                  <p className="text-xs text-zinc-400">Search from 3000+ roles or pick standard presets to customize questions.</p>
                </div>

                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Search roles e.g. Frontend Engineer, Scrum Master..."
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-3 pl-10 pr-4 text-xs text-zinc-200 focus:border-primary outline-none transition"
                    />
                  </div>

                  {/* Categories */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
                    {["Software Development", "Data Science", "Operations", "Management"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setRoleCategory(cat)}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition shrink-0 cursor-pointer",
                          roleCategory === cat 
                            ? "bg-zinc-800 text-white border border-zinc-700" 
                            : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic roles list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {ROLES
                      .filter(r => r.category === roleCategory && (r.name.toLowerCase().includes(roleSearch.toLowerCase()) || roleSearch === ""))
                      .map((role) => (
                        <div 
                          key={role.id}
                          onClick={() => setSelectedRole(role)}
                          className={cn(
                            "p-4 rounded-xl border cursor-pointer transition flex flex-col gap-2 relative group",
                            selectedRole.id === role.id 
                              ? "bg-primary/5 border-primary/40 shadow shadow-primary/5" 
                              : "bg-zinc-950/40 border-zinc-850 hover:border-zinc-800 hover:bg-zinc-900/40"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "font-extrabold text-xs block",
                              selectedRole.id === role.id ? "text-primary" : "text-zinc-200 group-hover:text-white"
                            )}>
                              {role.name}
                            </span>
                            {selectedRole.id === role.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {role.badges.map((badge, bIdx) => (
                              <Badge key={bIdx} variant="outline" className="text-[7px] font-extrabold px-1 py-0 border-zinc-850 bg-zinc-900/50 text-zinc-500">
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-850 shrink-0">
                  <span className="text-[10px] text-zinc-550 font-mono">Selected: {selectedRole.name}</span>
                  <Button 
                    onClick={() => setSubStep(2)}
                    className="bg-primary hover:bg-primary-hover font-bold text-xs uppercase h-10 px-5 rounded-xl cursor-pointer"
                  >
                    Configure Rounds <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* SUBSTEP 2: Select Interview Type & Difficulty */}
            {subStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-black text-white tracking-tight">Rounds & difficulty settings</h2>
                  <p className="text-xs text-zinc-400">Configure round structures and dynamic interviewer personality coaches.</p>
                </div>

                <div className="space-y-5">
                  {/* Rounds grid */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Interview Round Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {["Warm Up", "Behavioral", "Technical", "Coding", "HR Round", "System Design"].map((round) => (
                        <div 
                          key={round}
                          onClick={() => setSelectedRound(round)}
                          className={cn(
                            "py-3 px-4 rounded-xl border text-center font-bold text-xs cursor-pointer transition select-none",
                            selectedRound === round 
                              ? "bg-primary/10 border-primary text-primary" 
                              : "bg-zinc-950/40 border-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          )}
                        >
                          {round}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Technical round sub-mode selector */}
                  {selectedRound === "Technical" && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Technical Sub-Mode</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { mode: "theory", label: "Theory (OOP, DBMS, OS)", desc: "Conceptual verbal drill" },
                          { mode: "coding", label: "Coding (DSA & Logic)", desc: "Monaco coding challenge" }
                        ].map((sub) => (
                          <div 
                            key={sub.mode}
                            onClick={() => setTechnicalMode(sub.mode as "theory" | "coding")}
                            className={cn(
                              "p-3 rounded-xl border font-bold text-xs cursor-pointer transition select-none flex flex-col text-left justify-center",
                              technicalMode === sub.mode 
                                ? "bg-primary/10 border-primary text-primary" 
                                : "bg-zinc-950/40 border-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200"
                            )}
                          >
                            <span className="font-bold">{sub.label}</span>
                            <span className="text-[9px] font-medium text-zinc-500 mt-0.5">{sub.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Difficulty selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Target Difficulty</label>
                    <div className="grid grid-cols-4 gap-2.5">
                      {["Easy", "Medium", "Hard", "Expert"].map((diff) => (
                        <div 
                          key={diff}
                          onClick={() => setSelectedDifficulty(diff)}
                          className={cn(
                            "py-2.5 rounded-xl border text-center font-bold text-xs cursor-pointer transition select-none",
                            selectedDifficulty === diff 
                              ? "bg-primary/10 border-primary text-primary" 
                              : "bg-zinc-950/40 border-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          )}
                        >
                          {diff}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mode & Personality */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Interviewer Personality</label>
                      <select 
                        value={selectedPersonality}
                        onChange={(e) => setSelectedPersonality(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-xl py-3 px-4 outline-none focus:border-primary cursor-pointer transition"
                      >
                        {["Friendly", "Professional", "Aggressive", "Startup Fast-Paced", "FAANG Style", "HR Conversational"].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Practice Session Mode</label>
                      <select 
                        value={selectedMode}
                        onChange={(e) => setSelectedMode(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-xl py-3 px-4 outline-none focus:border-primary cursor-pointer transition"
                      >
                        {["Timed", "Relaxed", "Pressure", "Rapid Fire"].map(m => (
                          <option key={m} value={m}>{m} Mode</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Skills and Confidence indicators */}
                  <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4.5 font-mono text-[10px] text-zinc-500 space-y-2 select-text">
                    <div className="flex justify-between">
                      <span>• Target skills:</span>
                      <span className="text-zinc-300 font-bold">{selectedRole.skills.slice(0, 3).join(", ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Estimated Duration:</span>
                      <span className="text-zinc-300 font-bold">
                        {selectedMode === "Pressure" ? "5 mins" : selectedMode === "Rapid Fire" ? "3 mins" : "15 mins"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>• AI confidence Level:</span>
                      <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                        High (96%) <Award className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-850 shrink-0">
                  <button 
                    onClick={() => setSubStep(1)}
                    className="text-zinc-400 hover:text-white font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Go Back
                  </button>
                  <Button 
                    onClick={startHardwareCalibration}
                    className="bg-primary hover:bg-primary-hover font-bold text-xs uppercase h-10 px-5 rounded-xl cursor-pointer"
                  >
                    Calibrate Hardware <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
             {/* SUBSTEP 3: Hardware Check & Setup */}
            {subStep === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-black text-white tracking-tight">Hardware Calibration check</h2>
                  <p className="text-xs text-zinc-400">Position your webcam frame and check microphone volume feedback.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Video Box */}
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video flex flex-col items-center justify-center">
                    {hasCameraStream ? (
                      <video ref={calibVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-center p-6 text-zinc-650 space-y-2 select-none">
                        <VideoOff className="w-10 h-10 text-zinc-800 animate-pulse" />
                        <span className="text-xs font-bold text-zinc-555">Camera offline</span>
                        <span className="text-[9px] max-w-[150px]">Real camera feed is required to launch assessment.</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-zinc-950/85 backdrop-blur-md px-2.5 py-1 border border-zinc-800 rounded-lg text-[8px] font-black text-zinc-400 tracking-wider select-none">
                      WEBCAM ACTIVE PREVIEW
                    </div>
                  </div>

                  {/* Volume Visualizer & Hardware Diagnostic Suite */}
                  <div className="space-y-4 flex flex-col justify-center">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <Mic className="w-3.5 h-3.5 text-primary" /> Audio Volume Input feedback
                      </label>
                      <div className="h-6 w-full bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden p-1 flex items-center">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-primary rounded-lg transition-all duration-75"
                          style={{ width: `${micVolume}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-zinc-600">
                        <span>Min (Muted)</span>
                        <span className={micVolume > 10 ? "text-emerald-450 font-bold animate-pulse" : ""}>
                          {micVolume > 10 ? "Capturing Voice Feed" : "Speak to check visualizer"}
                        </span>
                      </div>
                    </div>

                    {/* Premium Hardware Diagnostic Suite */}
                    <div className="bg-zinc-950/60 border border-zinc-850 rounded-xl p-4 space-y-2.5 font-mono text-[10px]">
                      <span className="font-bold text-zinc-350 block border-b border-zinc-850/60 pb-1.5 uppercase tracking-wider text-[9px] text-zinc-400">
                        Hardware Diagnostic Suite
                      </span>
                      
                      {/* Microphone Diagnostic Row */}
                      <div className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2 select-none">
                          {diagMic === "success" && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/35 animate-pulse" />}
                          {diagMic === "checking" && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
                          {diagMic === "failed" && <span className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/35 animate-pulse" />}
                          {diagMic === "pending" && <span className="w-2 h-2 rounded-full bg-zinc-700" />}
                          <span className={diagMic === "success" ? "text-zinc-200" : "text-zinc-500"}>
                            Microphone Connection
                          </span>
                        </div>
                        <span className={cn(
                          "font-bold text-[8px] px-2 py-0.5 rounded uppercase tracking-wider",
                          diagMic === "success" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                          diagMic === "checking" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                          diagMic === "failed" && "bg-red-500/10 text-red-400 border border-red-500/20",
                          diagMic === "pending" && "bg-zinc-900 text-zinc-650 border border-zinc-850"
                        )}>
                          {diagMic === "success" && "Active"}
                          {diagMic === "checking" && "Testing..."}
                          {diagMic === "failed" && "Denied / Error"}
                          {diagMic === "pending" && "Pending"}
                        </span>
                      </div>

                      {/* Webcam Diagnostic Row */}
                      <div className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2 select-none">
                          {diagCam === "success" && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/35 animate-pulse" />}
                          {diagCam === "checking" && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
                          {diagCam === "failed" && <span className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/35 animate-pulse" />}
                          {diagCam === "pending" && <span className="w-2 h-2 rounded-full bg-zinc-700" />}
                          <span className={diagCam === "success" ? "text-zinc-200" : "text-zinc-500"}>
                            Webcam Connection
                          </span>
                        </div>
                        <span className={cn(
                          "font-bold text-[8px] px-2 py-0.5 rounded uppercase tracking-wider",
                          diagCam === "success" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                          diagCam === "checking" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                          diagCam === "failed" && "bg-red-500/10 text-red-400 border border-red-500/20",
                          diagCam === "pending" && "bg-zinc-900 text-zinc-650 border border-zinc-850"
                        )}>
                          {diagCam === "success" && "Ready"}
                          {diagCam === "checking" && "Testing..."}
                          {diagCam === "failed" && "Denied / Error"}
                          {diagCam === "pending" && "Pending"}
                        </span>
                      </div>

                      {/* VAD Diagnostic Row */}
                      <div className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2 select-none">
                          {diagVad === "success" && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/35 animate-pulse" />}
                          {diagVad === "checking" && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
                          {diagVad === "failed" && <span className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/35 animate-pulse" />}
                          {diagVad === "pending" && <span className="w-2 h-2 rounded-full bg-zinc-700" />}
                          <span className={diagVad === "success" ? "text-zinc-200" : "text-zinc-500"}>
                            Speech VAD Engine
                          </span>
                        </div>
                        <span className={cn(
                          "font-bold text-[8px] px-2 py-0.5 rounded uppercase tracking-wider",
                          diagVad === "success" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                          diagVad === "checking" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                          diagVad === "failed" && "bg-red-500/10 text-red-400 border border-red-500/20",
                          diagVad === "pending" && "bg-zinc-900 text-zinc-650 border border-zinc-850"
                        )}>
                          {diagVad === "success" && "Enabled"}
                          {diagVad === "checking" && "Testing..."}
                          {diagVad === "failed" && "Blocked / Unsup"}
                          {diagVad === "pending" && "Pending"}
                        </span>
                      </div>
                    </div>

                    {calibrationError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-[10px] text-red-400 font-mono leading-relaxed select-text animate-fade-in text-left">
                        <strong className="text-red-300">Diagnostic Failure:</strong> {calibrationError}
                      </div>
                    )}

                    {diagMic === "success" && !micInputDetected && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[9px] text-amber-400 font-mono leading-relaxed select-none text-left flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                        <span>No speech detected. Please check your microphone connection or speak louder.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-zinc-850 shrink-0">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSubStep(2)}
                      className="text-zinc-400 hover:text-white font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer bg-zinc-900/60 border border-zinc-800 hover:bg-zinc-800 rounded-xl px-4 h-10 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" /> Go Back
                    </button>
                    <Button 
                      disabled={isGeneratingQuestions}
                      onClick={() => {
                        if (isCodingOrDesign && document.documentElement.requestFullscreen) {
                          document.documentElement.requestFullscreen()
                            .then(() => setIsFullscreenActive(true))
                            .catch(err => console.warn("Bypass start fullscreen request failed", err));
                        }
                        setDiagMic("success");
                        setDiagCam("success");
                        setDiagVad("success");
                        setHasCameraStream(true);
                        setSubStep(4);
                        setTimeout(() => {
                          const sessionId = "practice-" + Math.floor(Math.random() * 10000000);
                          const dbRoundName = selectedRound === "Technical"
                            ? (technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)")
                            : selectedRound;

                          const payload = {
                            id: sessionId,
                            role: selectedRole.name,
                            round: dbRoundName,
                            difficulty: selectedDifficulty,
                            personality: selectedPersonality,
                            questions: generatedQuestions,
                            chatLog: [],
                            evaluation: null,
                            status: "active",
                            mode: selectedMode,
                            errorReason: null,
                            updated_at: new Date().toISOString()
                          };

                          localStorage.setItem("practice_recovery_" + sessionId, JSON.stringify(payload));
                          
                          const supabase = createClient();
                          supabase.auth.getUser().then(({ data: { user } }) => {
                            (payload as any).user_id = user?.id || null;
                            supabase.from("practice_interviews").upsert(payload).then(({ error }) => {
                              if (error) console.warn("Supabase initial save failed:", error);
                            });
                          });

                          window.location.href = `/practice/interview/${sessionId}`;
                        }, 3000);
                      }}
                      variant="outline"
                      className="border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold text-xs uppercase h-10 px-4 rounded-xl cursor-pointer transition-colors"
                    >
                      {isGeneratingQuestions ? "Curating Rubrics..." : "Simulate & Bypass Checks"}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {!(diagMic === "success" && diagCam === "success" && diagVad === "success") && (
                      <span className="text-[10px] text-amber-500/80 font-mono animate-pulse">
                        ⚠️ Please complete hardware calibration to unlock the studio.
                      </span>
                    )}
                    <Button 
                      disabled={!(diagMic === "success" && diagCam === "success" && diagVad === "success") || isGeneratingQuestions}
                      onClick={() => {
                        if (isCodingOrDesign && document.documentElement.requestFullscreen) {
                          document.documentElement.requestFullscreen()
                            .then(() => setIsFullscreenActive(true))
                            .catch(err => console.warn("Lobby start fullscreen request failed", err));
                        }
                        setSubStep(4);
                        setTimeout(() => {
                          const sessionId = "practice-" + Math.floor(Math.random() * 10000000);
                          const dbRoundName = selectedRound === "Technical"
                            ? (technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)")
                            : selectedRound;

                          const payload = {
                            id: sessionId,
                            role: selectedRole.name,
                            round: dbRoundName,
                            difficulty: selectedDifficulty,
                            personality: selectedPersonality,
                            questions: generatedQuestions,
                            chatLog: [],
                            evaluation: null,
                            status: "active",
                            mode: selectedMode,
                            errorReason: null,
                            updated_at: new Date().toISOString()
                          };

                          localStorage.setItem("practice_recovery_" + sessionId, JSON.stringify(payload));
                          
                          const supabase = createClient();
                          supabase.auth.getUser().then(({ data: { user } }) => {
                            (payload as any).user_id = user?.id || null;
                            supabase.from("practice_interviews").upsert(payload).then(({ error }) => {
                              if (error) console.warn("Supabase initial save failed:", error);
                            });
                          });

                          window.location.href = `/practice/interview/${sessionId}`;
                        }, 3000);
                      }}
                      className="bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-850 font-bold text-xs uppercase h-10 px-5 rounded-xl cursor-pointer"
                    >
                      {isGeneratingQuestions ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Curating Rubrics...
                        </>
                      ) : (
                        <>
                          Connect Coach Lobby <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* SUBSTEP 4: Waiting & Countdown Connection Lobby */}
            {subStep === 4 && (
              <div className="space-y-6 py-12 flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-primary/20 bg-primary/5 animate-ping opacity-75" />
                  <div className="absolute -inset-4 rounded-full border border-primary/10 bg-primary/5 animate-pulse" />
                  <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/15 animate-bounce">
                    <Radio className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight animate-pulse">Connecting Interview AI Coach</h3>
                  <p className="text-zinc-500 text-xs font-mono max-w-sm mx-auto leading-relaxed">
                    Establishing simulated P2P WebRTC data connection pipelines for speech, audio context, and adaptive coding workspace...
                  </p>
                </div>

                <div className="w-48 bg-zinc-950 border border-zinc-850 h-2 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-primary rounded-full animate-[shimmer_2s_infinite] w-full" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. IMMERSIVE AI PRACTICE ASSESSMENT STUDIO ROOM                           */}
      {/* ========================================================================= */}
      {wizardStep === 2 && (
        <div className="flex-1 flex flex-col min-h-0 relative select-none animate-fade-in">
          {/* Fullscreen Enforced Lockout Overlay (Glassmorphism) */}
          {isCodingOrDesign && !isFullscreenActive && (
            <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 select-none animate-fade-in text-center">
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
                      Fullscreen mode is required during this practice assessment.
                    </p>
                    <p className="text-zinc-300 font-bold text-base mt-1">
                      Please return to fullscreen immediately.
                    </p>
                  </div>
                </div>

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
                    Enter Fullscreen Mode
                  </span>
                </Button>
                
                <p className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider leading-none">
                  Exiting fullscreen logs an automated proctoring infraction
                </p>
              </div>
            </div>
          )}

          {/* Guided Hardware Recovery Overlay Modal */}
          {(!hasCameraStream || diagMic !== "success" || diagVad !== "success") && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center select-none animate-fade-in">
              <div className="max-w-md w-full bg-zinc-950 border border-zinc-850 rounded-2xl p-6 shadow-2xl relative space-y-6">
                <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-red-500/10 animate-bounce">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white tracking-tight">Microphone or Camera Access Required</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                    Please allow camera and microphone settings in your browser to continue your AI interview.
                  </p>
                </div>

                {calibrationError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-[10px] text-red-450 font-mono leading-relaxed select-text text-left">
                    <strong className="text-red-300">Diagnostic Alert:</strong> {calibrationError}
                  </div>
                )}

                <div className="bg-zinc-900/60 border border-zinc-850 rounded-xl p-4 font-mono text-[9px] text-zinc-500 text-left space-y-2">
                  <span className="font-bold text-zinc-350 block border-b border-zinc-800 pb-1 uppercase tracking-wider text-[8px]">
                    Browser Instruction Guide
                  </span>
                  <div className="space-y-1.5 leading-relaxed">
                    <p>• <strong className="text-zinc-400">Chrome/Edge</strong>: Click the camera or lock icon in your browser's address bar, toggle permissions to <strong className="text-emerald-450 font-bold">Allow</strong>, and reload.</p>
                    <p>• <strong className="text-zinc-400">Safari</strong>: Open Preferences, select Websites, select Camera/Microphone, and set permissions to <strong className="text-emerald-450 font-bold">Allow</strong>.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={startHardwareCalibration}
                    className="flex-1 bg-primary hover:bg-primary-hover font-bold text-xs uppercase h-10 px-5 rounded-xl cursor-pointer"
                  >
                    Retry Connection
                  </Button>
                  <Button 
                    onClick={handleReturnToLobby}
                    className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-350 font-bold text-xs uppercase h-10 px-5 rounded-xl cursor-pointer transition-colors"
                  >
                    Return to Lobby
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Practice Room Sub-header controls */}
          <div className="h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 flex items-center justify-between shrink-0 mb-4 select-none">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider">Simulated AI Prep Room</span>
              <div className="h-4 w-px bg-zinc-800 mx-1.5" />
              <span className="text-[9px] text-zinc-550 font-mono">Role: {selectedRole.name} • Round: {selectedRound}</span>
            </div>
            
            <div className="flex items-center gap-4">
              {selectedMode !== "Relaxed" && (
                <span className={cn(
                  "font-mono text-xs font-bold border px-2.5 py-1 rounded-lg animate-pulse",
                  secondsRemaining < 60 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-zinc-950 text-emerald-400 border-zinc-800"
                )}>
                  {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, "0")}
                </span>
              )}
              <Button
                onClick={() => {
                  if (confirm("Are you sure you want to exit the simulated prep room? Your active mock score and study plan reports will be forfeited.")) {
                    handleReturnToLobby();
                  }
                }}
                variant="destructive"
                className="h-8 text-[9px] font-black uppercase tracking-widest px-3 rounded-lg cursor-pointer"
              >
                Quit Session
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden shadow-2xl relative">
            <PracticeWorkspace
              selectedRound={selectedRound}
              technicalMode={technicalMode}
              currentQuestionText={currentQuestionsList[currentQuestionIndex] || ""}
              currentQuestionIndex={currentQuestionIndex}
              currentQuestionObj={generatedQuestions[currentQuestionIndex]}
              chatLog={chatLog}
              candidateResponseText={candidateResponseText}
              setCandidateResponseText={setCandidateResponseText}
              isDictating={isDictating}
              toggleDictation={toggleDictation}
              silenceCountdown={silenceCountdown}
              aiSpeechState={aiSpeechState}
              handleCandidateAnswerSubmit={handleCandidateAnswerSubmit}
              submitCandidateAnswer={submitCandidateAnswer}
              isUserSpeaking={isUserSpeaking}
              interimSubtitleText={interimSubtitleText}
              micVolume={roomMicVolume}
              diagnostics={diagnostics}
              proctorSandboxLogs={proctorSandboxLogs}
              hasCameraStream={hasCameraStream}
              roomVideoRef={roomVideoRef}
              aiSpeechVisualizerHeight={aiSpeechVisualizerHeight}
              selectedPersonality={selectedPersonality}
              onNextQuestion={goToNextQuestion}
              onFinishSession={finishSession}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DYNAMIC EVALUATION MODAL LOADER SCREEN                                 */}
      {/* ========================================================================= */}
      {isEvaluating && (
        <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 select-none animate-fade-in text-center">
          <div className="max-w-md space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 bg-primary/5 animate-ping opacity-75" />
              <div className="absolute -inset-4 rounded-full border border-primary/10 bg-primary/5 animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/20 animate-[spin_4s_linear_infinite]">
                <Brain className="w-10 h-10 text-primary" />
              </div>
            </div>
            
            <div className="space-y-2.5">
              <h2 className="text-2xl font-black text-white tracking-tight">Synthesizing Interview Metrics</h2>
              <p className="text-zinc-500 font-mono text-[10px] animate-pulse max-w-sm mx-auto leading-relaxed">
                {evaluationStageText}
              </p>
            </div>

            <div className="w-48 bg-zinc-900 border border-zinc-850 h-2 rounded-full overflow-hidden mx-auto mt-4">
              <div className="h-full bg-primary rounded-full animate-[shimmer_2s_infinite] w-full" />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ULTIMATE SaaS PERFORMANCE FEEDBACK REPORT SCREEN                       */}
      {/* ========================================================================= */}
      {/* Evaluation Failed State */}
      {wizardStep === 3 && !completedReport && evaluationError && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative animate-fade-in px-4">
          <Card className="bg-zinc-900/40 border-zinc-800 shadow-2xl max-w-lg w-full">
            <CardHeader className="p-6 pb-3 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <CardTitle className="text-lg font-black text-white">Evaluation Unavailable</CardTitle>
              <CardDescription className="text-sm text-zinc-400 mt-1">
                The AI evaluation engine was unable to score your interview session.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 text-xs text-red-300 font-medium leading-relaxed">
                {evaluationError}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => {
                    setEvaluationError(null);
                    setWizardStep(0);
                    setSubStep(1);
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase h-10 rounded-xl cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Start New Session
                </Button>
                
                {sessionSaveStatus === "in_memory" && (
                  <Button
                    onClick={handleRetryCloudSync}
                    variant="outline"
                    className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-bold text-xs uppercase h-10 rounded-xl cursor-pointer"
                  >
                    Retry Cloud Sync
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dev Debug Console for Failed Evaluations */}
          {isDevMode && evaluationDebugLog && (
            <details className="mt-6 w-full max-w-3xl">
              <summary className="cursor-pointer text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition">
                Developer Debug Console
              </summary>
              <div className="mt-2 bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 text-[10px] font-mono text-zinc-400 overflow-auto max-h-[400px] select-text">
                <div>
                  <span className="text-amber-400 font-bold block mb-1">Evaluation Prompt Sent:</span>
                  <pre className="whitespace-pre-wrap bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-850 text-zinc-500 max-h-[200px] overflow-auto">{evaluationDebugLog.prompt}</pre>
                </div>
                <div>
                  <span className="text-red-400 font-bold block mb-1">Raw LLM Response:</span>
                  <pre className="whitespace-pre-wrap bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-850 text-zinc-500 max-h-[200px] overflow-auto">{evaluationDebugLog.rawLlmResponse}</pre>
                </div>
              </div>
            </details>
          )}
        </div>
      )}

            {wizardStep === 3 && completedReport && (
        <div className="flex-1 flex flex-col min-h-0 relative animate-fade-in select-text overflow-y-auto pr-1 pb-6 scrollbar-thin">
          {/* Controls bar */}
          <div className="h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 flex items-center justify-between shrink-0 mb-6 select-none shadow">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-450 animate-pulse" />
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">AI Mock Performance Assessment Dashboard</h3>
            </div>
            
            <div className="flex items-center gap-3">
              {sessionSaveStatus === "in_memory" && (
                <Button
                  onClick={handleRetryCloudSync}
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-bold text-[10px] uppercase h-9 px-4 rounded-xl cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Sync to Cloud
                </Button>
              )}
              {sessionSaveStatus === "synced" && (
                <span className="text-[9px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Cloud Synced
                </span>
              )}
              <Button
                onClick={handleReturnToLobby}
                className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white uppercase font-bold text-[10px] px-5 h-9 rounded-xl border border-zinc-800 transition cursor-pointer"
              >
                Exit Dashboard
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow min-h-0">
            {/* LEFT COLUMN: Radial cumulative readiness score, XP details, target role skills details */}
            <div className="space-y-6">
              {/* Radial Circular Gauge */}
              <Card className="bg-zinc-900/30 border-zinc-850 shadow-md relative overflow-hidden select-none">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-emerald-500 to-primary" />
                
                <CardHeader className="p-6 pb-2 text-center space-y-1">
                  <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">Interview Readiness Score</span>
                  <CardTitle className="text-lg font-black text-white">Cumulative Assessment Score</CardTitle>
                </CardHeader>
                
                <CardContent className="p-6 pt-2 flex flex-col items-center justify-center space-y-4">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    {/* Glowing outer rings */}
                    <div className="absolute inset-0 rounded-full border border-emerald-500/10 animate-ping opacity-60" />
                    
                    {/* Score display */}
                    <div className="text-center z-10">
                      <span className={cn(
                        "text-4xl font-black font-mono leading-none tracking-tight block",
                        completedReport.readinessScore >= 80 ? "text-emerald-400" : completedReport.readinessScore >= 60 ? "text-amber-400" : "text-red-400"
                      )}>
                        {completedReport.readinessScore}%
                      </span>
                      <span className="text-[8px] text-zinc-500 font-extrabold uppercase mt-1 tracking-wider block font-mono">Ready for Interviews</span>
                    </div>
                    {/* SVG Radial Path */}
                    <svg className="w-full h-full transform -rotate-90 absolute">
                      <circle cx="72" cy="72" r="60" stroke="#1f1f23" strokeWidth="6" fill="transparent" />
                      <circle cx="72" cy="72" r="60" stroke="#10b981" strokeWidth="8" fill="transparent" 
                        strokeDasharray={2 * Math.PI * 60}
                        strokeDashoffset={2 * Math.PI * 60 * (1 - completedReport.readinessScore / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                  </div>

                  <div className="bg-zinc-950/60 border border-zinc-850 rounded-xl p-3 w-full text-center text-[10px] font-mono text-zinc-400 leading-relaxed max-w-[200px]">
                    🔥 Preparation Streak increased to <span className="text-amber-400 font-extrabold">{streakDays} Days</span>! Unlocked <span className="text-primary font-extrabold">150 Practice XP</span>.
                  </div>
                </CardContent>
              </Card>

              {/* Real-time speech analysis & pause auditing Confidence Meter */}
              <Card className="bg-zinc-900/30 border-zinc-850 shadow-md">
                <CardHeader className="p-5 pb-2.5">
                  <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">Audio & pause metrics</span>
                  <CardTitle className="text-sm font-black text-white">Confidence Meter Details</CardTitle>
                </CardHeader>
                
                <CardContent className="p-5 pt-0 space-y-4 font-mono text-[10px]">
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-semibold">
                      <span className="text-zinc-450 uppercase">Filler word frequency</span>
                      <span className={completedReport.fillerWords > 4 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                        {completedReport.fillerWords} logged
                      </span>
                    </div>
                    <div className="h-2 w-full bg-zinc-950 border border-zinc-850 rounded overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, completedReport.fillerWords * 12)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between font-semibold">
                      <span className="text-zinc-450 uppercase">Average Speaking pace</span>
                      <span className="text-zinc-300 font-bold">122 Words / Min</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-950 border border-zinc-850 rounded overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "78%" }} />
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-[9px] text-zinc-500 font-mono leading-relaxed select-text">
                    💡 <span className="font-bold text-zinc-300">Speech coach suggestion:</span> Keep filler counts below 2 per round to prevent pauses from impacting technical confidence metrics.
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CENTRAL COLUMN: Five-Vector score grids, Strengths, Weaknesses, recommended target practice areas */}
            <div className="space-y-6 lg:col-span-2">
              {/* Score bar matrices */}
              <Card className="bg-zinc-900/20 border-zinc-850 shadow-md">
                <CardHeader className="p-6 pb-3 flex flex-row items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">Five-Vector score metrics</span>
                    <CardTitle className="text-base font-black text-white">Performance Vector Breakdown</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black uppercase bg-zinc-950 text-zinc-400 border-zinc-850 px-2.5 py-0.5">
                    {completedReport.difficulty} Mock Round
                  </Badge>
                </CardHeader>
                
                <CardContent className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4.5 font-mono text-[10px]">
                  {/* Comm */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-zinc-450 uppercase">Communication Clarity</span>
                      <span className="text-zinc-200">{completedReport.metrics.communication}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-zinc-850 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-450 rounded-full" style={{ width: `${completedReport.metrics.communication}%` }} />
                    </div>
                  </div>

                  {/* Coding */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-zinc-450 uppercase">Coding accuracy</span>
                      <span className="text-zinc-200">{completedReport.metrics.coding}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-zinc-850 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" style={{ width: `${completedReport.metrics.coding}%` }} />
                    </div>
                  </div>

                  {/* Conf */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-zinc-450 uppercase">Speaking Confidence</span>
                      <span className="text-zinc-200">{completedReport.metrics.confidence}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-zinc-850 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" style={{ width: `${completedReport.metrics.confidence}%` }} />
                    </div>
                  </div>

                  {/* Problem solving */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-zinc-450 uppercase">Problem-Solving Logic</span>
                      <span className="text-zinc-200">{completedReport.metrics.problemSolving}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-zinc-850 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" style={{ width: `${completedReport.metrics.problemSolving}%` }} />
                    </div>
                  </div>

                  {/* Time management */}
                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-zinc-450 uppercase">Time Management</span>
                      <span className="text-zinc-200">{completedReport.metrics.timeManagement}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-zinc-850 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-primary rounded-full" style={{ width: `${completedReport.metrics.timeManagement}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-text">
                <Card className="bg-zinc-900/30 border-zinc-850 shadow-md">
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Key Core Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    <ul className="space-y-3.5">
                      {completedReport.strengths.map((str: string, sIdx: number) => (
                        <li key={sIdx} className="text-xs text-zinc-300 leading-relaxed font-medium pl-3 border-l border-emerald-500">
                          {str}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/30 border-zinc-850 shadow-md">
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Constructive Weaknesses
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    <ul className="space-y-3.5">
                      {completedReport.weaknesses.map((weak: string, wIdx: number) => (
                        <li key={wIdx} className="text-xs text-zinc-300 leading-relaxed font-medium pl-3 border-l border-red-500">
                          {weak}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Question-by-Question Evaluation Review */}
              {completedReport.questionsReview && completedReport.questionsReview.length > 0 && (
                <Card className="bg-zinc-900/30 border-zinc-850 shadow-md select-text">
                  <CardHeader className="p-5 pb-2">
                    <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">Detailed Question Audit</span>
                    <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                      Question-by-Question Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-6">
                    {completedReport.questionsReview.map((review: any, qIdx: number) => (
                      <div key={qIdx} className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-zinc-850 pb-2">
                          <span className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="text-primary font-mono text-[10px]">#0{qIdx + 1}</span>
                            Question Review
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-bold uppercase bg-zinc-950 text-zinc-400 border-zinc-800">
                              Difficulty: {review.difficulty || "Medium"}
                            </Badge>
                            <Badge className={
                              "text-[10px] font-extrabold px-2.5 py-0.5 border " +
                              (review.overall >= 80 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                : review.overall >= 60 
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30" 
                                  : "bg-red-500/20 text-red-400 border-red-500/30")
                            }>
                              Score: {review.overall}%
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-3 text-xs leading-relaxed">
                          <div>
                            <span className="text-zinc-550 font-bold uppercase text-[9px] block tracking-wide font-mono">Question Asked</span>
                            <p className="text-zinc-200 font-semibold">{review.question}</p>
                          </div>

                          <div>
                            <span className="text-zinc-550 font-bold uppercase text-[9px] block tracking-wide font-mono">Your Answer</span>
                            <p className="text-zinc-300 italic bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-900 select-text">&ldquo;{review.candidateAnswer || "Silent / No Answer"}&rdquo;</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <div>
                              <span className="text-zinc-550 font-bold uppercase text-[9px] block tracking-wide font-mono">Expected Answer Key Concepts</span>
                              <p className="text-zinc-300 bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-900/50">{review.expectedAnswerSummary}</p>
                            </div>
                            <div>
                              <span className="text-zinc-550 font-bold uppercase text-[9px] block tracking-wide font-mono">Suggested Model Response</span>
                              <p className="text-zinc-300 bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-900/50 font-medium">{review.recommended_answer}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-[10px] font-mono border-t border-zinc-900">
                            <div className="flex flex-col">
                              <span className="text-zinc-500">Relevance</span>
                              <span className={"font-bold " + (review.relevance >= 80 ? "text-emerald-400" : review.relevance >= 50 ? "text-amber-400" : "text-red-400")}>{review.relevance}%</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500">Technical Accuracy</span>
                              <span className={"font-bold " + (review.technical_accuracy >= 80 ? "text-emerald-400" : review.technical_accuracy >= 50 ? "text-amber-400" : "text-red-400")}>{review.technical_accuracy}%</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500">Completeness</span>
                              <span className={"font-bold " + (review.completeness >= 80 ? "text-emerald-400" : review.completeness >= 50 ? "text-amber-400" : "text-red-400")}>{review.completeness}%</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500">Reasoning</span>
                              <span className={"font-bold " + (review.reasoning >= 80 ? "text-emerald-400" : review.reasoning >= 50 ? "text-amber-400" : "text-red-400")}>{review.reasoning}%</span>
                            </div>
                            <div className="flex flex-col col-span-2 md:col-span-1">
                              <span className="text-zinc-500">Communication</span>
                              <span className={"font-bold " + (review.communication >= 80 ? "text-emerald-400" : review.communication >= 50 ? "text-amber-400" : "text-red-400")}>{review.communication}%</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-900 select-text">
                            {review.strengths && review.strengths.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-emerald-450 font-bold uppercase text-[9px] block tracking-wide font-mono flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500" /> Key Strengths
                                </span>
                                <ul className="list-disc pl-4 space-y-1 text-zinc-350 text-[11px]">
                                  {review.strengths.map((str: string, sIdx: number) => (
                                    <li key={sIdx}>{str}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {((review.mistakes && review.mistakes.length > 0) || (review.missing_topics && review.missing_topics.length > 0)) && (
                              <div className="space-y-1">
                                <span className="text-red-400 font-bold uppercase text-[9px] block tracking-wide font-mono flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-red-500" /> Mistakes & Missed Concepts
                                </span>
                                <ul className="list-disc pl-4 space-y-1 text-zinc-350 text-[11px]">
                                  {review.mistakes?.map((mst: string, mIdx: number) => (
                                    <li key={"m-" + mIdx} className="text-red-300">{mst}</li>
                                  ))}
                                  {review.missing_topics?.map((concept: string, cIdx: number) => (
                                    <li key={"c-" + cIdx}>Missed concept: <span className="font-semibold text-zinc-300">{concept}</span></li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Target practice recommendations */}
              <Card className="bg-zinc-900/20 border-zinc-850 shadow">
                <CardHeader className="p-5 pb-2">
                  <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">Recommended Practice Areas</span>
                  <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-primary animate-pulse" />
                    AI Improvement Strategy
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {completedReport.recommendations.map((rec: string, rIdx: number) => (
                      <span key={rIdx} className="px-3 py-1.5 bg-zinc-950 border border-zinc-850 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-800 transition">
                        {rec}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI-Curated 7-Day Improvement Plan */}
              <Card className="bg-zinc-900/30 border-zinc-850 shadow-md select-text">
                <CardHeader className="p-5 pb-2">
                  <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">7-Day Improvement Plan</span>
                  <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-400 animate-pulse" />
                    Personalized Preparation Roadmap
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="relative border-l-2 border-zinc-800 pl-4 ml-2 space-y-6">
                    {completedReport.improvementPlan.map((dayPlan: any, dIdx: number) => (
                      <div key={dIdx} className="relative space-y-1">
                        <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-zinc-950 shadow shadow-primary/20" />
                        <span className="text-[8px] font-bold font-mono uppercase bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded text-primary">
                          {dayPlan.day}
                        </span>
                        <h4 className="font-extrabold text-xs text-white mt-1.5">{dayPlan.focus}</h4>
                        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">{dayPlan.detail}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Developer Debug Console (Dev Mode Only) */}
              {isDevMode && evaluationDebugLog && (
                <Card className="bg-zinc-950/60 border-zinc-800 shadow-md select-text">
                  <CardHeader className="p-5 pb-2">
                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest font-mono">Development Mode Only</span>
                    <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-amber-400" />
                      Evaluation Debug Console
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-4">
                    <details>
                      <summary className="cursor-pointer text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition">
                        Evaluation Prompt
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap bg-zinc-900/50 p-3 rounded-lg border border-zinc-850 text-[10px] font-mono text-zinc-500 max-h-[300px] overflow-auto">{evaluationDebugLog.prompt}</pre>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition">
                        Raw LLM Response
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap bg-zinc-900/50 p-3 rounded-lg border border-zinc-850 text-[10px] font-mono text-zinc-500 max-h-[300px] overflow-auto">{evaluationDebugLog.rawLlmResponse}</pre>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition">
                        Parsed JSON
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap bg-zinc-900/50 p-3 rounded-lg border border-zinc-850 text-[10px] font-mono text-zinc-500 max-h-[300px] overflow-auto">{JSON.stringify(evaluationDebugLog.parsedJson, null, 2)}</pre>
                    </details>
                  </CardContent>
                </Card>
              )}

              {/* Recording Replay Chat Transcript */}
              <Card className="bg-zinc-900/30 border-zinc-850 shadow-md select-text">
                <CardHeader className="p-5 pb-2">
                  <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">Conversation recording transcript</span>
                  <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-zinc-400" />
                    Simulated Conversation Replay
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-5 pt-0">
                  <div className="max-h-[300px] overflow-y-auto border border-zinc-850 bg-zinc-950/40 rounded-2xl p-4.5 space-y-3.5 custom-scrollbar text-xs">
                    {completedReport.chatTranscript.map((log: any, index: number) => (
                      <div key={index} className={cn(
                        "p-3.5 rounded-xl border flex flex-col gap-1 max-w-[85%]",
                        log.sender === "ai" 
                          ? "bg-zinc-900/50 border-zinc-850 self-start mr-auto rounded-tl-none" 
                          : "bg-primary/5 border-primary/15 self-end ml-auto rounded-tr-none text-primary"
                      )}>
                        <span className="text-[7px] font-mono uppercase text-zinc-650 leading-none">
                          {log.sender === "ai" ? "Coach Sophia" : "You (Candidate)"}
                        </span>
                        <p className="font-sans font-medium whitespace-pre-wrap">{log.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}