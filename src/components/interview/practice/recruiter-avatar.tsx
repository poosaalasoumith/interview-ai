"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { WORKSPACE_CONFIGS } from "./workspace-config";

interface RecruiterAvatarProps {
  state: "idle" | "thinking" | "typing" | "speaking";
  personality: string;
  userVolume: number;
  aiVolumeHeights: number[];
  isUserSpeaking: boolean;
  interimSubtitleText: string;
  roundName: string;
  technicalMode: "theory" | "coding";
}

export function RecruiterAvatar({ 
  state, 
  personality, 
  userVolume, 
  aiVolumeHeights, 
  isUserSpeaking, 
  interimSubtitleText,
  roundName,
  technicalMode
}: RecruiterAvatarProps) {
  // Blinking loop for eyes
  const [isBlinking, setIsBlinking] = useState(false);
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 4500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Determine styling dynamically based on the round type configuration
  let lookupKey = roundName;
  if (roundName === "Technical") {
    lookupKey = technicalMode === "coding" ? "Technical (Coding)" : "Technical (Theory)";
  }
  const config = WORKSPACE_CONFIGS[lookupKey] || WORKSPACE_CONFIGS["Warm Up"];

  const themeColor = config.avatar.themeColor;
  const themeBg = config.avatar.themeBg;
  const coachName = config.avatar.name;
  const coachTitle = config.avatar.title;
  const coreStyle = config.avatar.coreStyle;

  // Active status text
  let statusText = `${coachName} is listening...`;
  if (state === "speaking") statusText = `${coachName} is speaking...`;
  else if (state === "thinking") statusText = `${coachName} is analyzing...`;
  else if (isUserSpeaking) statusText = "Receiving candidate voice...";
  else statusText = `Awaiting response...`;

  return (
    <Card className={cn("bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden shrink-0 select-none relative pb-4.5", coreStyle)}>
      {/* Top personality color bar */}
      <div className="absolute top-0 inset-x-0 h-1 transition-colors duration-500" style={{ backgroundColor: themeColor }} />
      
      <div className="p-4.5 flex flex-col items-center justify-center space-y-4 select-none">
        
        {/* Animated Avatar Core Visual Canvas */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          
          {/* Pulsing Outer Ring (Reacts to Speech / thinking) */}
          <div 
            className={cn(
              "absolute inset-0 rounded-full border-2 transition-all duration-300 opacity-60",
              state === "speaking" && "animate-[ping_1.5s_infinite] opacity-30",
              state === "thinking" && "animate-[spin_4s_linear_infinite] border-dashed"
            )}
            style={{ borderColor: themeColor }}
          />

          {/* Secondary Concentric Ring */}
          <div 
            className={cn(
              "absolute inset-3 rounded-full border transition-all duration-500 opacity-40",
              state === "speaking" && "scale-105 opacity-80",
              state === "thinking" && "animate-[spin_2s_linear_infinite] border-dotted"
            )}
            style={{ borderColor: themeColor }}
          />

          {/* Central Animated Recruiter Face/Eye Canvas */}
          <div 
            className="w-18 h-18 rounded-2xl border flex flex-col items-center justify-center relative shadow-inner overflow-hidden transition-all duration-500"
            style={{ backgroundColor: themeBg, borderColor: `${themeColor}40` }}
          >
            {/* Blinking Attentive Eye Element (Center) */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              {/* Outer Glowing Scanner Ring */}
              <div 
                className={cn(
                  "absolute inset-0 rounded-full border transition-all duration-300",
                  state === "speaking" && "scale-110",
                  isUserSpeaking && "animate-ping opacity-70"
                )}
                style={{ borderColor: `${themeColor}80` }}
              />
              
              {/* Pupil Eye with Blinking mask */}
              <div 
                className={cn(
                  "w-3.5 transition-all duration-150 rounded-full bg-white relative flex items-center justify-center",
                  isBlinking ? "h-0.5" : "h-3.5"
                )}
              >
                {/* Pupil Iris Accent */}
                {!isBlinking && (
                  <div 
                    className={cn(
                      "w-2 h-2 rounded-full transition-transform duration-300",
                      state === "thinking" && "scale-110 animate-pulse"
                    )}
                    style={{ backgroundColor: themeColor }}
                  />
                )}
              </div>
            </div>

            {/* Glowing Mouth Speaking Sine visualizer */}
            {state === "speaking" ? (
              <div className="absolute bottom-3.5 flex items-center gap-0.5 h-3 justify-center w-full">
                {aiVolumeHeights.slice(0, 5).map((h, i) => (
                  <div 
                    key={i} 
                    className="w-0.5 rounded transition-all duration-75"
                    style={{ 
                      height: `${Math.min(100, Math.max(15, h / 3))}%`, 
                      backgroundColor: themeColor 
                    }}
                  />
                ))}
              </div>
            ) : isUserSpeaking ? (
              <div className="absolute bottom-3 text-[7px] font-mono tracking-wider animate-pulse font-bold" style={{ color: themeColor }}>
                LISTENING
              </div>
            ) : (
              /* Idle Mouth Line */
              <div 
                className="absolute bottom-4 w-5 h-0.5 rounded transition-all duration-500 opacity-60"
                style={{ backgroundColor: themeColor }}
              />
            )}
          </div>
        </div>

        {/* Informative Visual Indicators */}
        <div className="text-center space-y-1 w-full select-text">
          <span 
            className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border inline-flex items-center gap-1.5"
            style={{ color: themeColor, borderColor: `${themeColor}30`, backgroundColor: `${themeColor}0d` }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: themeColor }} />
            {coachTitle}
          </span>
          
          <h4 className="text-base font-extrabold text-white leading-tight">Coach {coachName}</h4>
          
          <p className="text-[10px] text-zinc-500 font-medium tracking-wide mt-1.5 italic transition-all duration-300">
            {statusText}
          </p>
        </div>

        {/* Real-time Subtitles & Live Telemetry stream */}
        <div className="w-full bg-zinc-950/85 border border-zinc-850 rounded-xl p-3 select-text shadow-inner space-y-2.5">
          <span className="text-[7px] font-mono font-bold text-zinc-500 uppercase tracking-widest block flex items-center justify-between">
            <span>Conversational Telemetry (Voice)</span>
            {isUserSpeaking ? (
              <span className="text-emerald-450 font-extrabold animate-pulse tracking-wide flex items-center gap-1 uppercase text-[6px] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                dictating...
              </span>
            ) : state === "speaking" ? (
              <span className="text-primary font-extrabold animate-pulse tracking-wide flex items-center gap-1 uppercase text-[6px] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping inline-block" />
                AI Speaking...
              </span>
            ) : (
              <span className="text-zinc-550 font-bold tracking-wide uppercase text-[6px] flex items-center gap-1 select-none">
                <span className="w-1 h-1 rounded-full bg-zinc-705 inline-block" />
                AI Listening...
              </span>
            )}
          </span>
          
          <div className="min-h-[40px] flex items-center justify-center">
            {interimSubtitleText ? (
            <p className="text-xs text-zinc-200 font-semibold leading-relaxed italic w-full text-left select-text">
              &ldquo;{interimSubtitleText}&rdquo;
            </p>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-1 text-center py-1 select-none w-full">
                {isUserSpeaking ? (
                  <div className="flex items-center gap-0.5 h-3">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-0.5 bg-emerald-450 rounded animate-[bounce_0.8s_infinite]" 
                        style={{ animationDelay: `${i * 0.1}s`, height: '100%' }} 
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-zinc-650 font-medium italic animate-pulse tracking-wide">
                    {state === "speaking" ? "Listening to Coach response..." : "Speak to answer - voice dictation active"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
