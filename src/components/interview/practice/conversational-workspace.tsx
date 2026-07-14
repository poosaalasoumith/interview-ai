"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Mic, ChevronRight, Sparkles, BookOpen, Shield, CameraOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { RecruiterAvatar } from "./recruiter-avatar";
import { VoiceDebugPanel } from "./voice-debug-panel";
import { VoiceDiagnostics } from "@/services/voice-interview/InterviewOrchestrator";

interface ConversationalWorkspaceProps {
  chatLog: { sender: "ai" | "user"; text: string; timestamp: string }[];
  candidateResponseText: string;
  setCandidateResponseText: (text: string) => void;
  isDictating: boolean;
  toggleDictation: () => void;
  silenceCountdown: number | null;
  aiSpeechState: "speaking" | "listening" | "transcribing" | "evaluating" | "idle" | "thinking";
  currentQuestionText: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  handleCandidateAnswerSubmit: () => void;
  isUserSpeaking: boolean;
  interimSubtitleText: string;
  micVolume: number;
  roundName: string;
  diagnostics: VoiceDiagnostics | null;
  
  // Forwarded shared properties
  proctorSandboxLogs: string[];
  hasCameraStream: boolean;
  roomVideoRef: (node: HTMLVideoElement | null) => void;
  aiSpeechVisualizerHeight: number[];
  selectedPersonality: string;
  technicalMode: "theory" | "coding";
}

export function ConversationalWorkspace({
  chatLog,
  candidateResponseText,
  setCandidateResponseText,
  isDictating,
  toggleDictation,
  silenceCountdown,
  aiSpeechState,
  currentQuestionText,
  currentQuestionIndex,
  totalQuestions,
  handleCandidateAnswerSubmit,
  isUserSpeaking,
  interimSubtitleText,
  micVolume,
  roundName,
  diagnostics,
  proctorSandboxLogs,
  hasCameraStream,
  roomVideoRef,
  aiSpeechVisualizerHeight,
  selectedPersonality,
  technicalMode,
}: ConversationalWorkspaceProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Keep chat log scrolled to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, interimSubtitleText]);

  // Determine round specific tips
  let tipTitle = "General Tip";
  let tipDescription = "Speak clearly and confidently. Answer concisely and follow up with examples.";
  if (roundName === "Behavioral") {
    tipTitle = "STAR Methodology Coach";
    tipDescription = "Structure your answer using Situation (context), Task (goal), Action (what you did), and Result (outcome). Highlight key accomplishments and challenges.";
  } else if (roundName.includes("Technical")) {
    tipTitle = "Technical Depth Guidelines";
    tipDescription = "Discuss CS fundamentals, OOP, or system architecture. Be factually precise and provide concrete examples.";
  } else if (roundName === "HR Round") {
    tipTitle = "HR Alignment Blueprint";
    tipDescription = "Align your values with company goals. Highlight teamwork, career aspirations, and clear, professional reasoning.";
  } else if (roundName === "Warm Up") {
    tipTitle = "Warm Up Icebreaker";
    tipDescription = "Relax and walk through your resume. Share a brief summary of your background, experience, and interests.";
  }

  // Get active status state label
  const getInterviewerStatusText = () => {
    switch (aiSpeechState) {
      case "speaking":
        return "Interviewer Speaking...";
      case "listening":
        return "Listening to Candidate...";
      case "transcribing":
        return "Transcribing Audio...";
      case "evaluating":
        return "Evaluating Response...";
      case "thinking":
        return "Synthesizing next steps...";
      default:
        return "Ready";
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950">
      <ResizablePanelGroup orientation="horizontal">
        {/* Left Column: AI Interrogator, Webcam feed, Anti-Cheat companion */}
        <ResizablePanel defaultSize={35} minSize={25} className="bg-zinc-900/30 border-r border-zinc-850 flex flex-col p-4 gap-4 overflow-y-auto scrollbar-none">
          <RecruiterAvatar 
            state={aiSpeechState === "speaking" ? "speaking" : aiSpeechState === "thinking" || aiSpeechState === "evaluating" ? "thinking" : "idle"}
            personality={selectedPersonality}
            userVolume={micVolume}
            aiVolumeHeights={aiSpeechVisualizerHeight}
            isUserSpeaking={isUserSpeaking}
            interimSubtitleText={interimSubtitleText}
            roundName={roundName}
            technicalMode={technicalMode}
          />

          {/* Camera preview bubble */}
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video shrink-0 flex items-center justify-center">
            {hasCameraStream ? (
              <video 
                ref={roomVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover mirror-mode"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center text-[10px] text-zinc-550 font-mono">
                <CameraOff className="w-5 h-5 mb-1.5 text-zinc-650" />
                Webcam feed disabled
              </div>
            )}
          </div>

          {/* Proctor Sandbox Companion Log */}
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 flex-1 min-h-[140px] flex flex-col font-mono text-[9px] text-zinc-400 space-y-1.5 select-text">
            <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider flex items-center gap-1 select-none">
              <Shield className="w-3.5 h-3.5 text-zinc-550" /> Proctor Sandbox Companion Log
            </span>
            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
              {proctorSandboxLogs.map((log, lIdx) => (
                <p key={lIdx} className={cn(
                  "leading-relaxed border-b border-zinc-900 pb-1.5 last:border-0",
                  log.startsWith("⚠️") ? "text-amber-500 font-bold" : "text-zinc-650 font-semibold"
                )}>
                  {log}
                </p>
              ))}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-1 bg-zinc-850 hover:bg-primary/50 transition-colors z-10" />

        {/* Right Column: Interaction interface */}
        <ResizablePanel defaultSize={65} minSize={35} className="flex flex-col relative bg-zinc-950 select-text">
          <div className="h-full flex flex-col min-h-0 bg-zinc-950/20">
            {/* Dynamic Header */}
            <div className="h-12 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center justify-between shrink-0 select-none">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                Conversational Dialogue Interface
              </span>
              <span className="text-[9px] text-zinc-550 font-mono">
                Question {currentQuestionIndex + 1} / {totalQuestions}
              </span>
            </div>

            <div className="flex-1 min-h-0 flex flex-col md:flex-row">
              {/* Left/Main Column: Chat dialogues */}
              <div className="flex-1 flex flex-col min-h-0 border-r border-zinc-850 bg-zinc-950/40">
                <div className="flex-grow min-h-0 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                  {chatLog.map((chat, cIdx) => (
                    <div
                      key={cIdx}
                      className={cn(
                        "max-w-[85%] flex flex-col gap-1 p-3.5 rounded-2xl text-xs leading-relaxed border transition-all duration-300 animate-fade-in",
                        chat.sender === "ai"
                          ? "bg-zinc-900/60 border-zinc-850 text-zinc-200 self-start mr-auto rounded-tl-none"
                          : "bg-primary/10 border-primary/20 text-primary self-end ml-auto rounded-tr-none shadow-sm"
                      )}
                    >
                      <div className="flex justify-between items-center gap-4 text-[9px] text-zinc-500 select-none">
                        <span className="font-bold tracking-wide uppercase">
                          {chat.sender === "ai" ? "Interviewer" : "You"}
                        </span>
                        <span>{chat.timestamp}</span>
                      </div>
                      <p className="whitespace-pre-wrap mt-0.5">{chat.text}</p>
                    </div>
                  ))}

                  {/* Interim Subtitles / Transcription preview bubble */}
                  {interimSubtitleText && (
                    <div className="max-w-[85%] bg-primary/5 border border-dashed border-primary/20 text-zinc-300 self-end ml-auto rounded-2xl rounded-tr-none p-3.5 text-xs leading-relaxed animate-pulse">
                      <span className="text-[8px] font-bold text-primary/70 uppercase tracking-wider block mb-1">
                        Transcribing...
                      </span>
                      <p className="italic">{interimSubtitleText}</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Hands-Free Automated Interaction Panel */}
                <div className="p-5 bg-zinc-900/60 border-t border-zinc-850 flex flex-col gap-4">
                  {/* Silence Countdown VAD alert */}
                  {silenceCountdown !== null && (
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2.5 rounded-xl animate-pulse select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      Silence detected! Submitting response in {silenceCountdown}s...
                    </div>
                  )}

                  {/* Active Transcript Display Feed */}
                  <div className="flex-1 bg-zinc-950/80 border border-zinc-850 rounded-xl p-4 min-h-[100px] flex flex-col justify-between shadow-inner">
                    <span className="text-[8px] font-black text-zinc-550 uppercase tracking-widest block mb-2 select-none">
                      Live Transcription Feed
                    </span>
                    <p className={cn(
                      "text-xs leading-relaxed transition-colors",
                      candidateResponseText || interimSubtitleText ? "text-zinc-200" : "text-zinc-500 italic"
                    )}>
                      {candidateResponseText || interimSubtitleText || "The interviewer is currently speaking. Your microphone will automatically activate as soon as the question finishes..."}
                    </p>
                    {interimSubtitleText && (
                      <span className="text-[8px] font-bold text-primary/70 uppercase tracking-wider block mt-2 animate-pulse select-none">
                        ● Streaming voice input...
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between select-none">
                    {/* Automated Status Card */}
                    <div className="flex items-center gap-2">
                      {isDictating ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                          🎙️ Mic Active - Speak Now
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-850 text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                          Muted - AI Speaking
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider">
                        Active State:
                      </span>
                      <Badge variant="outline" className={cn(
                        "text-[9px] uppercase tracking-wider px-2.5 py-0.5 font-mono",
                        aiSpeechState === "speaking" && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                        aiSpeechState === "listening" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        aiSpeechState === "transcribing" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse",
                        aiSpeechState === "evaluating" && "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse",
                        aiSpeechState === "thinking" && "bg-zinc-800 text-zinc-400"
                      )}>
                        {getInterviewerStatusText()}
                      </Badge>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Coach & Guidelines panel */}
              <div className="w-full md:w-64 p-4 space-y-4 bg-zinc-900/10 flex flex-col overflow-y-auto custom-scrollbar select-none">
                {/* Interviewer Status Box */}
                <div className="bg-zinc-950/80 border border-zinc-850 rounded-2xl p-4 space-y-3 shadow-inner">
                  <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-zinc-500" /> Interview Status
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Intelligent VAD:</span>
                      <span className="text-zinc-300 font-bold">1.8s Threshold</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Memory Sync:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        Active
                      </span>
                    </div>
                  </div>
                </div>

                <VoiceDebugPanel diagnostics={diagnostics} />

                {/* Coach Advice panel */}
                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 space-y-2 flex-1 min-h-[160px] flex flex-col justify-start">
                  <span className="text-[8px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-primary" /> {tipTitle}
                  </span>
                  <p className="text-xs text-zinc-450 leading-relaxed font-medium mt-1">
                    {tipDescription}
                  </p>

                  <div className="mt-4 border-t border-zinc-900 pt-3 space-y-2">
                    <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider block">
                      Evaluation Guidelines:
                    </span>
                    <div className="space-y-1.5 leading-relaxed text-[10px] text-zinc-550 font-mono">
                      <p>• Speak naturally; no buttons to press.</p>
                      <p>• A 2s pause auto-submits responses.</p>
                      <p>• Avoid simple yes/no answers.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
