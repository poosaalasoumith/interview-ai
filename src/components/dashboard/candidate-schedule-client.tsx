"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Play, Clock, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface CandidateInterview {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  interviewer?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

interface CandidateScheduleClientProps {
  upcomingInterviews: CandidateInterview[];
}

export function CandidateScheduleClient({ upcomingInterviews }: CandidateScheduleClientProps) {
  const [timeLefts, setTimeLefts] = useState<Record<string, string>>({});
  const [activeLobbies, setActiveLobbies] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const calculateTimeLefts = () => {
      const newTimeLefts: Record<string, string> = {};
      const newActiveLobbies: Record<string, boolean> = {};

      upcomingInterviews.forEach((interview) => {
        const target = new Date(interview.scheduled_at).getTime();
        const now = new Date().getTime();
        const diff = target - now;

        if (diff <= 0) {
          // Interview has passed scheduled time or is live now
          newTimeLefts[interview.id] = "Live Now";
          newActiveLobbies[interview.id] = true;
        } else if (diff < 1000 * 60 * 10) {
          // Less than 10 minutes left
          const minutes = Math.floor(diff / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          newTimeLefts[interview.id] = `Starts in ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
          newActiveLobbies[interview.id] = true;
        } else if (diff < 1000 * 60 * 60 * 24) {
          // Less than 24 hours left: show HH:MM:SS
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          newTimeLefts[interview.id] = `${hours < 10 ? "0" : ""}${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
          newActiveLobbies[interview.id] = diff < 1000 * 60 * 30; // Active lobby 30 mins prior
        } else {
          // More than 24 hours away
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          newTimeLefts[interview.id] = `Starts in ${days} days`;
          newActiveLobbies[interview.id] = false;
        }
      });

      setTimeLefts(newTimeLefts);
      setActiveLobbies(newActiveLobbies);
    };

    // Calculate immediately and then every second
    calculateTimeLefts();
    const timer = setInterval(calculateTimeLefts, 1000);

    return () => clearInterval(timer);
  }, [upcomingInterviews]);

  if (upcomingInterviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <Calendar className="h-10 w-10 text-zinc-700 animate-pulse" />
        <div>
          <p className="text-zinc-300 font-semibold text-sm">No interviews scheduled</p>
          <p className="text-zinc-550 text-xs mt-1">You will be notified here as soon as an recruiter lists a new technical round.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {upcomingInterviews.map((interview) => {
        const date = new Date(interview.scheduled_at);
        const formattedDate = date.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const formattedTime = date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });

        const isLive = timeLefts[interview.id] === "Live Now" || timeLefts[interview.id]?.startsWith("Starts in ");
        const isActiveLobby = activeLobbies[interview.id];

        return (
          <div 
            key={interview.id} 
            className={cn(
              "flex flex-col md:flex-row md:items-center justify-between p-4.5 rounded-xl border transition-all duration-300 gap-4 group relative overflow-hidden",
              isActiveLobby 
                ? "bg-violet-600/5 border-violet-500/30 hover:border-violet-500/50 shadow-md shadow-violet-500/5" 
                : "bg-stone-900/25 border-stone-850 hover:border-stone-800"
            )}
          >
            {/* Visual glow indicator for active lobby */}
            {isActiveLobby && (
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-xl animate-pulse pointer-events-none" />
            )}

            <div className="flex items-start gap-4 min-w-0">
              <div className={cn(
                "p-3 rounded-xl shrink-0 transition-colors duration-300",
                isActiveLobby 
                  ? "bg-violet-500/10 text-violet-300" 
                  : "bg-stone-900 text-zinc-400 group-hover:bg-stone-800 group-hover:text-zinc-200"
              )}>
                <Calendar className="h-5.5 w-5.5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors truncate">
                    {interview.title}
                  </h4>
                  {isActiveLobby && (
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1 font-medium truncate">
                  {formattedDate} at {formattedTime} • with {interview.interviewer?.name || interview.interviewer?.email || "Guest Interviewer"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className={cn(
                    "text-xs font-semibold tracking-wider font-mono",
                    isActiveLobby ? "text-violet-400" : "text-zinc-400"
                  )}>
                    {timeLefts[interview.id] || "Loading..."}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center shrink-0">
              <Link 
                href={`/interview/${interview.id}`}
                className={cn(
                  buttonVariants({ 
                    variant: isActiveLobby ? "default" : "outline", 
                    size: "sm" 
                  }),
                  "w-full md:w-auto font-bold text-xs h-8.5 px-4.5 cursor-pointer shadow-sm transition-all",
                  isActiveLobby 
                    ? "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/10 animate-bounce" 
                    : "border-stone-800 bg-transparent text-zinc-400 hover:bg-stone-900 hover:text-zinc-200"
                )}
              >
                <Play className={cn("h-3 w-3 mr-1.5", isActiveLobby && "fill-current")} />
                {isActiveLobby ? "Join Live Lobby" : "Lobby Preview"}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
