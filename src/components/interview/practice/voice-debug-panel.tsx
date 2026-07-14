"use client";

import { useState } from "react";
import { 
  Terminal, Shield, Mic, CheckCircle2, AlertTriangle, 
  Activity, RefreshCw, Cpu, Volume2, Clock, Copy, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { VoiceDiagnostics } from "@/services/voice-interview/InterviewOrchestrator";

interface VoiceDebugPanelProps {
  diagnostics: VoiceDiagnostics | null;
}

export function VoiceDebugPanel({ diagnostics }: VoiceDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!diagnostics) {
    return (
      <div className="bg-zinc-950/60 border border-zinc-850 rounded-2xl p-4 text-center select-none shadow-md">
        <span className="text-[10px] text-zinc-500 font-mono animate-pulse">
          Connecting Voice Engine Diagnostics...
        </span>
      </div>
    );
  }

  const handleCopySessionId = () => {
    navigator.clipboard.writeText(diagnostics.sessionId);
    toast.success("Session ID copied!");
  };

  // Helper colors for state badges
  const getPermissionBadge = (perm: string) => {
    switch (perm) {
      case "granted":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "denied":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "prompt":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  const getStreamBadge = (status: string) => {
    return status === "active" 
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-red-500/10 text-red-400 border-red-500/20";
  };

  const getVadBadge = (vad: string) => {
    switch (vad) {
      case "speaking":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse font-bold";
      case "silence_countdown":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse font-bold";
      default:
        return "bg-zinc-900 text-zinc-550 border-zinc-800";
    }
  };

  return (
    <div className="bg-zinc-950/90 border border-zinc-850 rounded-2xl shadow-xl overflow-hidden select-none transition-all duration-300">
      {/* Header section with toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 bg-zinc-900/50 hover:bg-zinc-900/80 transition border-b border-zinc-900 text-left cursor-pointer"
      >
        <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-primary" /> 
          Voice Loop Diagnostics
        </span>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
      </button>

      {/* Diagnostics details grid */}
      {isOpen && (
        <div className="p-4 space-y-3.5 text-xs font-medium">
          {/* Active State indicators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-650" /> Loop State:
              </span>
              <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-mono bg-primary/10 text-primary border-primary/20">
                {diagnostics.currentState}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-zinc-650" /> STT Engine:
              </span>
              <span className="font-mono text-[10px] text-zinc-350">
                {diagnostics.sttEngineName}
              </span>
            </div>
          </div>

          <div className="border-t border-zinc-900 my-2" />

          {/* Hardward and Stream properties */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-zinc-650" /> Mic Access:
              </span>
              <Badge variant="outline" className={cn("text-[9px] uppercase tracking-wider font-mono", getPermissionBadge(diagnostics.micPermission))}>
                {diagnostics.micPermission}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-zinc-650" /> Stream Status:
              </span>
              <Badge variant="outline" className={cn("text-[9px] uppercase tracking-wider font-mono", getStreamBadge(diagnostics.mediaStreamStatus))}>
                {diagnostics.mediaStreamStatus}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-zinc-650" /> Active Mic:
              </span>
              <span className="text-zinc-350 max-w-[120px] truncate text-right text-[10px]" title={diagnostics.activeMicrophone}>
                {diagnostics.activeMicrophone}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Sample Rate:</span>
              <span className="font-mono text-zinc-300">{diagnostics.sampleRate ? `${diagnostics.sampleRate / 1000} kHz` : "0 kHz"}</span>
            </div>
          </div>

          {/* Real-time volume capture visualizer */}
          <div className="space-y-1.5 bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 shadow-inner">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">Capture Levels</span>
              <span className="font-mono text-zinc-400">{diagnostics.audioLevel}% | {diagnostics.framesPerSecond} FPS</span>
            </div>
            <div className="h-2 bg-zinc-900 rounded-full overflow-hidden relative">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-75",
                  diagnostics.audioLevel > 30 ? "bg-gradient-to-r from-emerald-500 to-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${diagnostics.audioLevel}%` }}
              />
            </div>
          </div>

          <div className="border-t border-zinc-900 my-2" />

          {/* VAD & Transcription States */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">VAD State:</span>
              <Badge variant="outline" className={cn("text-[9px] uppercase tracking-wider font-mono", getVadBadge(diagnostics.vadState))}>
                {diagnostics.vadState}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">STT Engine State:</span>
              <Badge variant="outline" className={cn(
                "text-[9px] uppercase tracking-wider font-mono",
                diagnostics.recognitionState === "started" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                diagnostics.recognitionState === "stopped" && "bg-zinc-800 text-zinc-450 border-zinc-700",
                diagnostics.recognitionState === "error" && "bg-red-500/10 text-red-400 border-red-500/20"
              )}>
                {diagnostics.recognitionState}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">STT Running Status:</span>
              <Badge variant="outline" className={cn(
                "text-[9px] uppercase tracking-wider font-mono",
                diagnostics.sttRunningStatus === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
              )}>
                {diagnostics.sttRunningStatus}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">TTS Playback State:</span>
              <Badge variant="outline" className={cn(
                "text-[9px] uppercase tracking-wider font-mono",
                diagnostics.ttsState === "PLAYING" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse" : "bg-zinc-800 text-zinc-400 border-zinc-700"
              )}>
                {diagnostics.ttsState}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">AI Processing State:</span>
              <Badge variant="outline" className={cn(
                "text-[9px] uppercase tracking-wider font-mono",
                diagnostics.aiProcessingState === "processing" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse" : "bg-zinc-800 text-zinc-400 border-zinc-700"
              )}>
                {diagnostics.aiProcessingState}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Transcript Length:</span>
              <span className="text-zinc-300 font-mono">{diagnostics.transcriptLength} chars</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">STT Confidence:</span>
              <span className="text-zinc-300 font-mono">{(diagnostics.recognitionConfidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="border-t border-zinc-900 my-2" />

          {/* Latency and Timestamps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-650" /> LLM Turn Latency:
              </span>
              <span className="font-mono text-zinc-300">{(diagnostics.audioLatency / 1000).toFixed(2)}s</span>
            </div>

            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-550">Last Transcript:</span>
              <span className="font-mono text-zinc-400">{diagnostics.lastTranscriptTimestamp}</span>
            </div>

            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-550">Last AI Response:</span>
              <span className="font-mono text-zinc-400">{diagnostics.lastAiResponseTimestamp}</span>
            </div>
          </div>

          <div className="border-t border-zinc-900 my-2" />

          {/* Transcript Feed Previews */}
          <div className="space-y-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 text-[10px]">
            <span className="text-zinc-550 font-bold uppercase tracking-wider block text-[8px]">Diagnostics Transcript Feed</span>
            <div className="space-y-1">
              <span className="text-zinc-500 font-bold text-[8px] block">Partial Transcript:</span>
              <div className="font-mono text-[9px] text-zinc-400 bg-zinc-900/50 p-1.5 rounded border border-zinc-850/50 min-h-[22px] max-h-[50px] overflow-y-auto italic">
                {diagnostics.partialTranscript || <span className="text-zinc-650 italic">None</span>}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-500 font-bold text-[8px] block">Final Transcript:</span>
              <div className="font-mono text-[9px] text-zinc-400 bg-zinc-900/50 p-1.5 rounded border border-zinc-850/50 min-h-[22px] max-h-[60px] overflow-y-auto">
                {diagnostics.finalTranscript || <span className="text-zinc-650 italic">None</span>}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 my-2" />

          {/* Session info */}
          <div className="space-y-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 font-mono text-[9px] text-zinc-500">
            <div className="flex items-center justify-between">
              <span>Question Index:</span>
              <span className="text-zinc-400">Q{diagnostics.currentQuestionIndex + 1}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Turn Count:</span>
              <span className="text-zinc-400">Turn {diagnostics.currentTurn}</span>
            </div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-900">
              <span className="truncate max-w-[130px]" title={diagnostics.sessionId}>
                ID: {diagnostics.sessionId}
              </span>
              <button 
                onClick={handleCopySessionId}
                className="hover:text-white transition flex items-center gap-0.5 cursor-pointer ml-1"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
