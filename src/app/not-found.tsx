"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ghost, ArrowLeft, Loader2 } from "lucide-react";
import { isValidRoute, Routes } from "@/lib/routes";
import { SafeLink } from "@/components/ui/safe-link";

export default function NotFound() {
  const router = useRouter();
  const [isRecovering, setIsRecovering] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Verifying path...");

  useEffect(() => {
    const attemptRecovery = async () => {
      if (typeof window === "undefined") return;

      const path = window.location.pathname;
      console.log(`[404 Recovery] Triggered for path: ${path}`);

      // 1. Verify route
      const isPathValid = isValidRoute(path);

      if (isPathValid) {
        setStatusMessage("Refreshing connection cache...");
        console.log(`[404 Recovery] Path is valid. Refreshing router cache and retrying.`);
        
        // 2. Refresh router cache
        router.refresh();

        // 3. Retry navigation
        setTimeout(() => {
          console.log(`[404 Recovery] Retrying navigation to: ${path}`);
          router.replace(path);
          
          // If still stuck in 404 after retrying, fall back
          setTimeout(() => {
            console.warn(`[404 Recovery] Retry navigation stalled. Bouncing to dashboard.`);
            router.push(Routes.dashboard);
          }, 1500);
        }, 800);
      } else {
        // 4. Fallback redirect
        setStatusMessage("Redirecting to your workspace...");
        console.warn(`[404 Recovery] Path is invalid. Redirecting to dashboard.`);
        setTimeout(() => {
          router.push(Routes.dashboard);
        }, 1000);
      }
    };

    attemptRecovery();
  }, [router]);

  if (isRecovering) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full w-48 h-48 -z-10 animate-pulse" />
          <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl relative z-10 mx-auto">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        </div>
        
        <h2 className="text-2xl font-semibold text-zinc-300 mb-2">Restoring Workspace</h2>
        <p className="text-zinc-500 max-w-md mb-8 leading-relaxed font-mono text-xs">
          {statusMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full w-48 h-48 -z-10" />
        <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl relative z-10 mx-auto">
          <Ghost className="w-12 h-12 text-primary" />
        </div>
      </div>
      
      <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">404</h1>
      <h2 className="text-2xl font-semibold text-zinc-300 mb-4">Page not found</h2>
      
      <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">
        We couldn't find the page you're looking for. It might have been moved, deleted, or never existed in the first place.
      </p>

      <SafeLink 
        href={Routes.home}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-full font-medium transition shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Return Home
      </SafeLink>
    </div>
  );
}
