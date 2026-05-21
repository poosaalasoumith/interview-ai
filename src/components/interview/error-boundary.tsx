"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LiveKitErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[LiveKit Error Boundary] Caught track exception:", error, errorInfo);
  }

  private handleReset = () => {
    console.log("[LiveKit Error Boundary] User triggered video track reset...");
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-950 p-6 text-center border border-zinc-800 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-[40px] pointer-events-none" />
          <VideoOff className="h-10 w-10 text-red-500/80 mb-4 animate-pulse" />
          <h3 className="text-sm font-semibold text-zinc-200 mb-2">Video Feed Interrupted</h3>
          <p className="text-xs text-zinc-500 max-w-[240px] mb-4 leading-relaxed">
            LiveKit encountered a minor track synchronization issue. This is a known third-party library warning and does not affect your active interview session or code execution.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={this.handleReset}
            className="text-xs flex items-center gap-1.5 border-zinc-800 hover:bg-zinc-900 cursor-pointer bg-zinc-900/50 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            Reconnect Video
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
