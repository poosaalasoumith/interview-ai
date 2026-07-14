"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { 
  Bot, Send, Loader2, Sparkles, X, Minimize2, Maximize2, 
  Trash2, ArrowRight, Code2, Lightbulb, CornerDownLeft,
  Copy, RotateCcw, Octagon, Settings, Shield, Clock, RefreshCw
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { MarkdownRenderer } from "./markdown-renderer";
import { cn } from "@/lib/utils";
import { type AssistantMode } from "@/lib/assistant-policy";
import { toast } from "sonner";
import { AIResponseParser, type ParsedAIResponse } from "@/lib/ai/ResponseParser";

function getMessageTextContent(msg: UIMessage): string {
  if ((msg as any).content) {
    return (msg as any).content;
  }
  if (!msg.parts) return "";
  return msg.parts
    .map((part) => (part.type === "text" ? (part as any).text : ""))
    .join("");
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onModeChange?: (mode: "closed" | "collapsed" | "docked") => void;
  mode?: "closed" | "collapsed" | "docked";
  code: string;
  language: string;
  problemStatement?: any;
  compilerOutput?: string;
  testCases?: any[];
  selectedCode?: string;
  
  // Policy engine parameters
  assistantMode?: AssistantMode;
  role?: string;
  sessionType?: string;
  difficulty?: string;
  elapsedTime?: string;
  candidateTranscript?: string;
}

function getAssistantSuggestions(assistantMode: AssistantMode, problemStatement: any) {
  const concepts = problemStatement?.concepts || ["Algorithms", "Problem Solving"];
  
  if (assistantMode.includes("coding") || assistantMode === "candidate_live" || assistantMode === "candidate_mock") {
    return {
      questions: [
        "Can you give me a progressive hint on the current problem?",
        "What are the edge cases for this problem statement?",
        "Explain the time and space complexity of my active code.",
      ],
      concepts: concepts,
      hints: [
        "Check array boundaries and empty input checks.",
        "Consider if a two-pointer approach or hashmap can optimize it.",
        "Compare active implementation logic with the ideal approach."
      ]
    };
  }
  
  if (assistantMode.includes("behavioral")) {
    return {
      questions: [
        "How should I structure my answer using the STAR method?",
        "Can you evaluate my verbal communication flow?",
        "Give me HR tips on answering leadership and ownership questions.",
      ],
      concepts: ["STAR Method", "Leadership Principles", "Conflict Resolution", "Storytelling"],
      hints: [
        "Always define the Situation, Task, Action, and Result.",
        "Highlight your personal contributions and decision metrics."
      ]
    };
  }
  
  if (assistantMode.includes("system_design")) {
    return {
      questions: [
        "How do I scale this service to handle millions of operations?",
        "Where should I introduce caching or CDN layers?",
        "Discuss the CAP theorem tradeoffs for this architecture.",
      ],
      concepts: ["Scalability", "Microservices", "Load Balancing", "CAP Theorem", "Sharding"],
      hints: [
        "Consider introducing a message queue for async workloads.",
        "Choose between SQL and NoSQL based on transactional needs."
      ]
    };
  }

  return {
    questions: [
      "Explain the core technical concepts of this topic.",
      "Ask me a follow-up question to test my understanding.",
      "What are the best practices for this engineering area?",
    ],
    concepts: ["Computer Science Theory", "Best Practices", "System Architecture"],
    hints: [
      "Focus on explaining foundational concepts clearly.",
      "Relate theory to real-world deployment analogies."
    ]
  };
}

export function AIAssistantPanel({ 
  isOpen, 
  onClose, 
  onModeChange,
  mode = "docked",
  code, 
  language, 
  problemStatement,
  compilerOutput = "No compiler run yet",
  testCases = [],
  selectedCode = "",
  assistantMode = "coding_practice",
  role = "candidate",
  sessionType = "practice",
  difficulty = "Medium",
  elapsedTime = "00:00",
  candidateTranscript = ""
}: AIAssistantPanelProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = problemStatement?.title ? `session_${problemStatement.title.replace(/\s+/g, "_")}` : "global";

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<{
    requestId: string;
    latency: string;
    provider: string;
    tokens: string;
    retries: string;
    policy: string;
    model: string;
    promptSize: string;
    contextSize: string;
    validationStatus: string;
    parserStatus: string;
    streamStatus: string;
  } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Time stamp tracker
  const [timestamps, setTimestamps] = useState<Record<string, string>>({});

  // Client-side automatic retries state
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const localRetryRef = useRef<number>(0);

  // Vercel AI SDK useChat
  const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/ai/chat",
      fetch: async (input: any, init: any) => {
        const response = await fetch(input, init);
        
        // Capture diagnostics headers from response
        const reqId = response.headers.get("x-ai-request-id");
        const latency = response.headers.get("x-ai-latency");
        const provider = response.headers.get("x-ai-provider");
        const tokens = response.headers.get("x-ai-tokens");
        const retries = response.headers.get("x-ai-retries");
        const policy = response.headers.get("x-ai-policy");
        const model = response.headers.get("x-ai-model");
        const promptSize = response.headers.get("x-ai-prompt-size");
        const contextSize = response.headers.get("x-ai-context-size");
        const validationStatus = response.headers.get("x-ai-validation-status");
        const parserStatus = response.headers.get("x-ai-parser-status");

        setDiagnostics({
          requestId: reqId || "unknown",
          latency: latency ? `${latency}ms` : "unknown",
          provider: provider || "unknown",
          tokens: tokens || "0",
          retries: retries || "0",
          policy: policy || "unknown",
          model: model || "unknown",
          promptSize: promptSize || "unknown",
          contextSize: contextSize || "unknown",
          validationStatus: validationStatus || "unknown",
          parserStatus: parserStatus || "unknown",
          streamStatus: "complete"
        });

        return response;
      },
      body: {
        context: {
          code,
          language,
          problemStatement,
          compilerOutput,
          testCases,
          selectedCode,
          assistantMode,
          role,
          sessionType,
          difficulty,
          elapsedTime,
          candidateTranscript,
          sessionId
        }
      }
    }),
    onError: (error) => {
      console.error("AI Assistant stream error:", error);
      
      let errorMessage = "Unable to reach the AI service. Please try again in a few moments.";
      let isQuota = false;
      try {
        const parsedError = JSON.parse(error.message);
        if (parsedError.error) {
          errorMessage = parsedError.error;
        } else if (parsedError.message) {
          errorMessage = parsedError.message;
        }
        const lowerMsg = errorMessage.toLowerCase();
        if (lowerMsg.includes("quota") || lowerMsg.includes("limit") || lowerMsg.includes("rate")) {
          isQuota = true;
        }
      } catch (e) {
        if (error.message && typeof error.message === "string" && !error.message.startsWith("{")) {
          errorMessage = error.message;
        }
      }

      // Auto-retry up to 2 times (total 3 attempts) for non-quota errors
      if (!isQuota && localRetryRef.current < 2) {
        localRetryRef.current += 1;
        setSystemNotice(`System Notice: The AI service is temporarily unavailable. Retrying (Attempt ${localRetryRef.current}/2)...`);
        
        setTimeout(() => {
          regenerate();
        }, 1500 * localRetryRef.current);
      } else {
        setSystemNotice(null);
        setGlobalError(errorMessage);
      }
    },
    onFinish: () => {
      localRetryRef.current = 0;
      setSystemNotice(null);
      setGlobalError(null);
    }
  });

  const isLoading = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamic context sender
  const handleSend = useCallback((textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
    
    // Clear any previous error states
    setSystemNotice(null);
    setGlobalError(null);
    localRetryRef.current = 0;

    // Track local timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg_${Date.now()}`;
    setTimestamps(prev => ({ ...prev, [msgId]: timeStr }));

    sendMessage(
      { text: textToSend },
      {
        body: {
          context: {
            code,
            language,
            problemStatement,
            compilerOutput,
            testCases,
            selectedCode,
            assistantMode,
            role,
            sessionType,
            difficulty,
            elapsedTime,
            candidateTranscript,
            sessionId
          }
        }
      }
    );
  }, [code, language, problemStatement, compilerOutput, testCases, selectedCode, assistantMode, role, sessionType, difficulty, elapsedTime, candidateTranscript, sessionId, isLoading, sendMessage]);

  // Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(96, textareaRef.current.scrollHeight)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSend(input);
        setInput("");
      }
    }
  };

  const clearChat = () => {
    if (confirm("Are you sure you want to clear this conversation history?")) {
      setMessages([]);
      setDiagnostics(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const suggestions = getAssistantSuggestions(assistantMode, problemStatement);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-zinc-950/80 backdrop-blur-xl border-l border-zinc-850 shadow-2xl relative select-text overflow-hidden">
      {/* Background neon ambient mesh */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      {/* 1. Header Toolbar */}
      <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-zinc-850 bg-zinc-900/40 relative z-10 select-none">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">AI Coding Assistant</span>
            <span className="text-[8px] text-zinc-500 font-medium flex items-center gap-1">
              {isLoading ? "Streaming..." : "Ready"}
              {diagnostics && (role !== "candidate" || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && (
                <button 
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="text-primary hover:underline ml-1 cursor-pointer flex items-center gap-0.5"
                >
                  <Settings className="w-2.5 h-2.5" />
                  Diag
                </button>
              )}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button 
              onClick={clearChat} 
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 rounded-md transition cursor-pointer"
              title="Clear Chat History"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          
          {/* Mode Switchers */}
          {onModeChange && mode !== "docked" && (
            <button
              onClick={() => onModeChange("docked")}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-md transition cursor-pointer"
              title="Dock Sidebar"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onModeChange && (
            <button
              onClick={() => onModeChange("collapsed")}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-md transition cursor-pointer"
              title="Collapse to Sidebar Stripe"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button 
            onClick={onClose} 
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-md transition cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Diagnostics Panel overlay if toggled */}
      {showDiagnostics && diagnostics && (role !== "candidate" || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && (
        <div className="bg-zinc-900 border-b border-zinc-800 p-3 text-[10px] space-y-1.5 relative z-20 text-zinc-400 animate-slide-down">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1">
            <span className="font-bold text-white uppercase flex items-center gap-1">
              <Shield className="w-3 h-3 text-primary" /> Developer Diagnostics
            </span>
            <button onClick={() => setShowDiagnostics(false)} className="text-zinc-500 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div><span className="text-zinc-500">Request ID:</span> <span className="font-mono">{diagnostics.requestId}</span></div>
            <div><span className="text-zinc-500">Provider:</span> <span className="text-white font-bold">{diagnostics.provider}</span></div>
            <div><span className="text-zinc-500">Model:</span> <span className="text-white">{diagnostics.model}</span></div>
            <div><span className="text-zinc-500">Latency:</span> <span className="text-amber-400 font-bold">{diagnostics.latency}</span></div>
            <div><span className="text-zinc-500">Retries:</span> <span className="text-white font-mono">{diagnostics.retries}</span></div>
            <div><span className="text-zinc-500">Policy:</span> <span className="text-primary font-mono">{diagnostics.policy}</span></div>
            <div><span className="text-zinc-500">Prompt Size:</span> <span className="text-white">{diagnostics.promptSize} chars</span></div>
            <div><span className="text-zinc-500">Context Size:</span> <span className="text-white">{diagnostics.contextSize} chars</span></div>
            <div><span className="text-zinc-500">Validation:</span> <span className="text-emerald-400 font-mono">{diagnostics.validationStatus}</span></div>
            <div><span className="text-zinc-500">Parser:</span> <span className="text-white font-mono">{diagnostics.parserStatus}</span></div>
          </div>
        </div>
      )}

      {/* 2. Messages conversation viewport */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 scroll-smooth custom-scrollbar">
        {/* System Error / Retry Alerts */}
        {systemNotice && (
          <div className="bg-amber-950/40 border border-amber-900/40 rounded-xl p-3.5 text-xs text-amber-300 flex items-center gap-2.5 animate-pulse select-none">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <span className="font-medium">{systemNotice}</span>
          </div>
        )}

        {globalError && (
          <div className="bg-rose-950/30 border border-rose-900/30 rounded-xl p-3.5 text-xs text-rose-350 flex flex-col gap-2 animate-bounce select-none">
            <span className="font-bold flex items-center gap-2">
              <Octagon className="w-4 h-4 text-rose-500 shrink-0" /> System Notice
            </span>
            <p className="leading-relaxed font-medium">{globalError}</p>
            <button 
              onClick={() => {
                setGlobalError(null);
                localRetryRef.current = 0;
                regenerate();
              }}
              className="mt-1 self-start flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800 text-rose-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-rose-350 shrink-0" /> Retry Now
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="space-y-5 py-2 select-none animate-fade-in">
            {/* 1. Context Status Card */}
            <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-4 space-y-3 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Assistant Mode</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary/10 border border-primary/20 text-primary">
                  <span className="w-1 h-1 rounded-full bg-primary animate-ping" />
                  {assistantMode.replace("_", " ")}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="space-y-0.5">
                  <span className="text-zinc-500">Active Topic / Problem</span>
                  <p className="text-zinc-200 font-bold truncate">{problemStatement?.title || "Theory & Practice Prep"}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-zinc-500">Difficulty</span>
                  <p className={cn(
                    "font-bold",
                    difficulty === "Easy" ? "text-emerald-400" : difficulty === "Medium" ? "text-amber-400" : "text-rose-400"
                  )}>{difficulty}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-zinc-500">Active Language</span>
                  <p className="text-zinc-200 font-bold capitalize">{language}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-zinc-500">Time Elapsed</span>
                  <p className="text-zinc-200 font-bold">{elapsedTime}</p>
                </div>
              </div>
            </div>

            {/* 2. Suggested Questions Grid */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">Suggested Questions</h3>
              <div className="space-y-2">
                {suggestions.questions.map((q: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    className="w-full text-left text-[11px] bg-zinc-900/60 border border-zinc-850 hover:bg-zinc-850/50 hover:border-zinc-800 text-zinc-350 hover:text-white p-3 rounded-xl transition flex items-start justify-between gap-3 group cursor-pointer"
                  >
                    <span className="leading-normal">{q}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition mt-0.5 text-primary" />
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Related Concepts Badges */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">Related Concepts</h3>
              <div className="flex flex-wrap gap-1.5 px-1">
                {suggestions.concepts.map((concept: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-zinc-250 transition cursor-default"
                  >
                    <Sparkles className="w-3 h-3 text-primary/70" />
                    {concept}
                  </span>
                ))}
              </div>
            </div>

            {/* 4. Recent Hints / Guidelines */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">Recent Hints / Guidelines</h3>
              <div className="bg-zinc-900/20 border border-zinc-850/60 rounded-xl p-3.5 space-y-2.5">
                {suggestions.hints.map((hint: string, idx: number) => (
                  <div key={idx} className="flex gap-2.5 text-[10px] text-zinc-400 leading-normal">
                    <span className="text-primary font-bold shrink-0">•</span>
                    <span>{hint}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message: UIMessage) => {
          const isUser = message.role === "user";
          const rawText = getMessageTextContent(message);
          const parsed = (isUser 
            ? { message: rawText, type: "user", relatedConcepts: [], citations: [] } 
            : AIResponseParser.parse(rawText)) as ParsedAIResponse;
          const time = timestamps[message.id] || "Just now";

          return (
            <div key={message.id} className={cn("flex gap-3 flex-col w-full", isUser ? "items-end" : "items-start")}>
              <div className={cn("flex gap-3 max-w-[90%] w-auto min-w-0", isUser ? "flex-row-reverse" : "flex-row")}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-inner mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                
                <div className={cn(
                  "rounded-2xl p-3.5 text-xs leading-relaxed font-sans shadow-xl relative group select-text min-w-0 break-words [word-break:break-word]",
                  isUser 
                    ? "bg-primary/15 border border-primary/30 text-white rounded-tr-sm" 
                    : parsed.type === "alert"
                    ? "bg-rose-950/20 border border-rose-900/30 text-rose-350 rounded-tl-sm w-full"
                    : "bg-zinc-900/60 border border-zinc-850 rounded-tl-sm backdrop-blur-sm text-zinc-200"
                )}>
                  {isUser ? (
                    <p className="whitespace-pre-wrap font-medium break-words [word-break:break-word]">{parsed.message}</p>
                  ) : (
                    <div className="space-y-3 min-w-0 max-w-full">
                      <MarkdownRenderer content={parsed.message} />
                      
                      {/* Secondary metadata display if structured JSON keys are populated */}
                      {parsed.nextSuggestion && (
                        <div className="mt-2.5 pt-2.5 border-t border-zinc-800 text-[10px] text-zinc-500 italic break-words">
                          💡 Suggestion: {parsed.nextSuggestion}
                        </div>
                      )}
                      {parsed.relatedConcepts && parsed.relatedConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {parsed.relatedConcepts.map((c, i) => (
                            <span key={i} className="text-[9px] bg-zinc-950/60 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions overlay for assistant responses */}
                  {!isUser && parsed.type !== "alert" && (
                    <div className="opacity-0 group-hover:opacity-100 absolute -bottom-6 right-2 flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md shadow-lg transition z-10 select-none">
                      <button 
                        onClick={() => copyToClipboard(parsed.message || "")}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                        title="Copy Response"
                      >
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamp label */}
              <span className="text-[8px] text-zinc-650 flex items-center gap-1 px-1 mt-0.5 select-none">
                <Clock className="w-2.5 h-2.5" /> {time}
              </span>
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 justify-start animate-pulse">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary animate-spin" />
            </div>
            <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl rounded-tl-sm p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="text-[10px] text-zinc-550 font-bold ml-1">Thinking...</span>
              </div>
              <button 
                onClick={stop}
                className="text-[9px] text-zinc-400 hover:text-red-400 flex items-center gap-1 border border-zinc-800 bg-zinc-950 px-2 py-1 rounded cursor-pointer"
              >
                <Octagon className="w-2.5 h-2.5 text-red-500" /> Stop Generating
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 3. Input Form bar */}
      <div className="p-3 bg-zinc-900/40 border-t border-zinc-850 shrink-0 relative z-10 backdrop-blur-md">
        <div className="relative flex items-end bg-zinc-950 border border-zinc-850 rounded-xl pl-4 pr-12 py-2.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/40 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              assistantMode === "candidate_live"
                ? "Ask for conceptual guidance..."
                : "Ask about the current coding problem..."
            }
            rows={1}
            className="w-full bg-transparent text-xs text-zinc-200 outline-none resize-none font-sans font-medium max-h-24 custom-scrollbar"
            style={{ height: "auto" }}
          />
          <button 
            onClick={() => {
              if (input.trim() && !isLoading) {
                handleSend(input);
                setInput("");
              }
            }}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center bg-primary hover:bg-primary/90 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Send Message"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
