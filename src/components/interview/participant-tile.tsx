"use client";

import { useEffect, useState } from "react";
import { TrackReferenceOrPlaceholder, VideoTrack } from "@livekit/components-react";
import { ConnectionQuality } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, Wifi, WifiOff, Tv, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  isLocal?: boolean;
  warningsCount?: number;
}

export function ParticipantTile({ trackRef, isLocal = false, warningsCount }: ParticipantTileProps) {
  const { participant } = trackRef;
  
  // Track reactive participant state manually to force React updates
  // because LiveKit properties (isSpeaking, connectionQuality) are modified by reference
  const [isSpeaking, setIsSpeaking] = useState(participant.isSpeaking);
  const [isCameraEnabled, setIsCameraEnabled] = useState(participant.isCameraEnabled);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(participant.isMicrophoneEnabled);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(participant.isScreenShareEnabled);
  const [quality, setQuality] = useState<ConnectionQuality>(participant.connectionQuality);
  const [displayName, setDisplayName] = useState(participant.name || participant.identity || "Participant");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Sync states initially
    setIsSpeaking(participant.isSpeaking);
    setIsCameraEnabled(participant.isCameraEnabled);
    setIsMicrophoneEnabled(participant.isMicrophoneEnabled);
    setIsScreenShareEnabled(participant.isScreenShareEnabled);
    setQuality(participant.connectionQuality);
    setDisplayName(participant.name || participant.identity || "Participant");
    /* eslint-enable react-hooks/set-state-in-effect */

    // LiveKit Participant events to trigger React re-renders
    const handleUpdate = () => {
      setIsSpeaking(participant.isSpeaking);
      setIsCameraEnabled(participant.isCameraEnabled);
      setIsMicrophoneEnabled(participant.isMicrophoneEnabled);
      setIsScreenShareEnabled(participant.isScreenShareEnabled);
      setQuality(participant.connectionQuality);
      setDisplayName(participant.name || participant.identity || "Participant");
    };

    const handleSpeaking = (speaking: boolean) => setIsSpeaking(speaking);
    const handleQuality = (q: ConnectionQuality) => setQuality(q);

    participant.on("trackMuted", handleUpdate);
    participant.on("trackUnmuted", handleUpdate);
    participant.on("trackPublished", handleUpdate);
    participant.on("trackUnpublished", handleUpdate);
    participant.on("isSpeakingChanged", handleSpeaking);
    participant.on("connectionQualityChanged", handleQuality);
    participant.on("participantMetadataChanged", handleUpdate);

    return () => {
      participant.off("trackMuted", handleUpdate);
      participant.off("trackUnmuted", handleUpdate);
      participant.off("trackPublished", handleUpdate);
      participant.off("trackUnpublished", handleUpdate);
      participant.off("isSpeakingChanged", handleSpeaking);
      participant.off("connectionQualityChanged", handleQuality);
      participant.off("participantMetadataChanged", handleUpdate);
    };
  }, [participant]);

  // Decode role from metadata or name fallback
  let role: "interviewer" | "candidate" | "admin" | "guest" = "guest";
  const lowercaseIdentity = participant.identity.toLowerCase();
  const lowercaseName = displayName.toLowerCase();

  // Try parsing LiveKit metadata first
  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);
      if (meta && typeof meta === "object" && meta.role) {
        const r = String(meta.role).toLowerCase();
        if (r === "admin" || r === "interviewer" || r === "candidate") {
          role = r as any;
        }
      }
    } catch (e) {
      // Check if raw metadata is role
      const rawMeta = participant.metadata.trim().toLowerCase();
      if (rawMeta === "admin" || rawMeta === "interviewer" || rawMeta === "candidate") {
        role = rawMeta as any;
      }
    }
  }

  // Fallback to name/identity checks
  if (role === "guest") {
    if (lowercaseIdentity.includes("admin") || lowercaseName.includes("admin") || participant.metadata?.toLowerCase().includes("admin")) {
      role = "admin";
    } else if (lowercaseIdentity.includes("interviewer") || lowercaseName.includes("interviewer") || participant.metadata?.toLowerCase().includes("interviewer")) {
      role = "interviewer";
    } else if (lowercaseIdentity.includes("candidate") || lowercaseName.includes("candidate") || participant.metadata?.toLowerCase().includes("candidate")) {
      role = "candidate";
    } else {
      role = "candidate";
    }
  }

  // Get name initials
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Helper for connection quality coloring
  const renderWifiIcon = () => {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return <Wifi className="w-3.5 h-3.5 text-emerald-400" />;
      case ConnectionQuality.Good:
        return <Wifi className="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
      case ConnectionQuality.Poor:
        return <Wifi className="w-3.5 h-3.5 text-amber-500 animate-bounce" />;
      case ConnectionQuality.Lost:
        return <WifiOff className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Wifi className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  const getQualityTitle = () => {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return "Excellent Connection";
      case ConnectionQuality.Good:
        return "Good Connection";
      case ConnectionQuality.Poor:
        return "Poor Connection";
      case ConnectionQuality.Lost:
        return "Disconnected";
      default:
        return "Checking quality...";
    }
  };

  const isCameraMuted = !isCameraEnabled || trackRef.publication?.isMuted;

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden border bg-zinc-900 aspect-video w-full transition-all duration-300 group flex items-center justify-center select-none",
        isSpeaking
          ? role === "admin"
            ? "border-red-500 ring-2 ring-red-500/25 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            : role === "interviewer"
              ? "border-indigo-500 ring-2 ring-indigo-500/25 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              : "border-emerald-500 ring-2 ring-emerald-500/25 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          : "border-zinc-800 hover:border-zinc-700 shadow-lg"
      )}
    >
      {/* Video Track Component */}
      {!isCameraMuted ? (
        <VideoTrack
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          trackRef={trackRef as any}
          className="w-full h-full object-cover rounded-xl"
        />
      ) : (
        /* Premium Glassmorphic Camera Disabled Placeholder */
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center p-4">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/10 via-transparent to-transparent opacity-60 pointer-events-none" />
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shadow-2xl relative transition-all duration-500",
              "bg-zinc-900/60 border backdrop-blur-xl",
              isSpeaking
                ? "border-emerald-500/80 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-105"
                : "border-zinc-700/50 text-zinc-400 shadow-black/40"
            )}
          >
            {initials}
            
            {/* Speaking visual ripples in background */}
            {isSpeaking && (
              <span className="absolute -inset-1.5 rounded-full border border-emerald-500/30 animate-ping opacity-60 pointer-events-none" />
            )}
          </div>
          <span className="text-zinc-500 text-[10px] uppercase tracking-widest mt-3.5 font-bold animate-pulse">
            Camera Off
          </span>
        </div>
      )}

      {/* Top Left Overlay Icons (Quality & Role Badge) */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
        <span 
          title={getQualityTitle()}
          className="flex items-center justify-center p-1.5 rounded-lg bg-zinc-950/75 backdrop-blur-md border border-zinc-800/80 shadow-md pointer-events-auto"
        >
          {renderWifiIcon()}
        </span>
        <span className={cn(
          "px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase border shadow-md flex items-center gap-1 bg-zinc-950/75 backdrop-blur-md",
          role === "admin" 
            ? "text-red-400 border-red-500/30 bg-red-500/10"
            : role === "interviewer"
              ? "text-indigo-400 border-indigo-500/30 bg-indigo-500/10"
              : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
        )}>
          {role === "admin" ? (
            <Shield className="w-3 h-3 text-red-400" />
          ) : role === "interviewer" ? (
            <Shield className="w-3 h-3 text-indigo-400" />
          ) : (
            <User className="w-3 h-3 text-emerald-400" />
          )}
          {role}
        </span>

        {/* Candidate Warning Badge */}
        {role === "candidate" && warningsCount !== undefined && warningsCount > 0 && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse flex items-center gap-1 shadow-md">
            ⚠️ WARNING {warningsCount}/3
          </span>
        )}
      </div>

      {/* Offline/Disconnected Blur Overlay */}
      {quality === ConnectionQuality.Lost && (
        <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
          <WifiOff className="w-8 h-8 text-red-500 animate-bounce mb-2" />
          <span className="text-red-500 text-xs font-bold uppercase tracking-wider">Disconnected</span>
          <span className="text-zinc-550 text-[9px] mt-1 font-semibold text-zinc-400">Reconnecting to session...</span>
        </div>
      )}

      {/* Top Right Screen Share Overlay */}
      {isScreenShareEnabled && (
        <div 
          title="Sharing Screen"
          className="absolute top-3 right-3 z-10 flex items-center justify-center p-1.5 rounded-lg bg-zinc-950/75 backdrop-blur-md border border-zinc-800/80 shadow-md pointer-events-auto animate-pulse"
        >
          <Tv className="w-3.5 h-3.5 text-primary" />
        </div>
      )}

      {/* Bottom Center Status Bar (Name & Mic Indicator) */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 backdrop-blur-md border border-zinc-800/50 shadow-md pointer-events-none">
        <span className="text-xs font-semibold text-zinc-100 truncate pr-2 max-w-[70%]">
          {displayName} {isLocal && <span className="text-[10px] text-zinc-400 font-normal font-sans">(You)</span>}
        </span>
        <span className="shrink-0 flex items-center">
          {isMicrophoneEnabled ? (
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Mic className={cn("w-3 h-3 text-emerald-400", isSpeaking && "animate-bounce")} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-red-500/10 border border-red-500/20">
              <MicOff className="w-3 h-3 text-red-500" />
            </div>
          )}
        </span>
      </div>
    </div>
  );
}
