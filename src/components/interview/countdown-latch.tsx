"use client";

import { useEffect, useState } from "react";
import { Timer, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface CountdownLatchProps {
  scheduledAt: string;
  title: string;
}

export function CountdownLatch({ scheduledAt, title }: CountdownLatchProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  }>({ hours: 0, minutes: 0, seconds: 0, total: 1 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const scheduledTime = new Date(scheduledAt).getTime();
      const difference = scheduledTime - Date.now();

      if (difference <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, total: 0 };
      }

      return {
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        total: difference,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining.total <= 0) {
        clearInterval(timer);
        // Refresh page to trigger server guard re-evaluation and enter room
        window.location.reload();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [scheduledAt, router]);

  const padZero = (num: number) => String(num).padStart(2, "0");

  return (
    <div className="max-w-xl w-full p-8 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
      {/* Decorative Neon Glimmer */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/15 transition-all duration-700" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/15 transition-all duration-700" />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Glowing Clock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(99,102,241,0.15)] animate-pulse">
          <Timer className="w-8 h-8 text-indigo-400" />
        </div>

        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">
          Waiting Room
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-3">
          {title || "Interview Session"}
        </h2>
        <p className="text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
          Your interview is scheduled to start soon. This lobby will automatically unlock when the timer reaches zero.
        </p>

        {/* Ticking Countdown Digits */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-xs mb-8">
          <div className="flex flex-col p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 backdrop-blur-md">
            <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {padZero(timeLeft.hours)}
            </span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-1">
              Hours
            </span>
          </div>
          <div className="flex flex-col p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 backdrop-blur-md">
            <span className="text-3xl font-extrabold text-indigo-400 tracking-tight tabular-nums">
              {padZero(timeLeft.minutes)}
            </span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-1">
              Mins
            </span>
          </div>
          <div className="flex flex-col p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 backdrop-blur-md">
            <span className="text-3xl font-extrabold text-violet-400 tracking-tight tabular-nums animate-pulse">
              {padZero(timeLeft.seconds)}
            </span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-1">
              Secs
            </span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800/50 text-left text-xs text-zinc-400 max-w-md w-full">
          <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-300 block mb-1">
              Join Window Rules
            </span>
            You must enter the interview room within 15 minutes of the scheduled start time. Late entries after the 15-minute mark will be permanently barred.
          </div>
        </div>
      </div>
    </div>
  );
}
