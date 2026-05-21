"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-red-500/20 blur-[80px] rounded-full w-48 h-48 -z-10" />
        <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl relative z-10 mx-auto">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
      </div>
      
      <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">Something went wrong!</h1>
      
      <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">
        We encountered an unexpected error. Please try refreshing the page or return to the dashboard.
      </p>

      <div className="flex items-center gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 bg-zinc-800 text-white hover:bg-zinc-700 px-6 py-3 rounded-full font-medium transition"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-full font-medium transition shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
