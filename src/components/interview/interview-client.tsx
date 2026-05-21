"use client";

import { useEffect, useState, useTransition } from "react";
import {
  LiveKitRoom,
  PreJoin,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Loader2, Terminal, FileCode2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { CodingEnvironment } from "./coding-environment";
import { ProblemPanel } from "./problem-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import { endInterviewAndGenerateReport } from "@/app/actions/interviews";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LiveKitErrorBoundary } from "./error-boundary";

interface InterviewClientProps {
  roomId: string;
  username: string;
  isInterviewer?: boolean;
}

export function InterviewClient({ roomId, username, isInterviewer = false }: InterviewClientProps) {
  const [token, setToken] = useState<string>("");
  const [preJoinComplete, setPreJoinComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemStatement, setProblemStatement] = useState<any>(null);
  const [isEnding, startEndingTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/livekit?room=${roomId}&username=${username}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch token");
        }
        setToken(data.token);
      } catch (err: any) {
        setError(err.message);
      }
    };

    const fetchProblem = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("interviews")
        .select("problem_statement")
        .eq("id", roomId)
        .single();
        
      if (data?.problem_statement) {
        setProblemStatement(data.problem_statement);
      }
    };

    fetchToken();
    fetchProblem();
  }, [roomId, username]);

  const handleEndInterview = async () => {
    if (!confirm("Are you sure you want to end this interview and generate the AI feedback report? This will complete the session for both participants.")) return;

    startEndingTransition(async () => {
      const res = await endInterviewAndGenerateReport(roomId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Interview completed! AI Report successfully generated and saved.");
        router.push("/dashboard/interviewer");
      }
    });
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <div className="text-red-500 font-semibold bg-red-500/10 p-4 rounded-lg border border-red-500/20">
          Failed to join room: {error}
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (token === "") {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-zinc-950 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Initializing secure connection...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-zinc-950 text-white" data-lk-theme="default">
      {!preJoinComplete ? (
        <div className="flex h-full items-center justify-center bg-zinc-950">
          <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />
            
            <h1 className="text-2xl font-bold text-center mb-6 z-10 relative">Join Interview Room</h1>
            <p className="text-center text-zinc-400 mb-8 z-10 relative text-sm">
              Please check your audio and video settings before joining.
            </p>
            
            <div className="z-10 relative">
              <PreJoin
                onSubmit={(values) => setPreJoinComplete(true)}
                defaults={{
                  username: username,
                  audioEnabled: false,
                  videoEnabled: false,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          className="h-full w-full flex flex-col"
          onDisconnected={() => {
            router.push("/dashboard");
          }}
        >
          {/* Top Header */}
          <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-white/10 bg-black/50 backdrop-blur-md z-10 relative">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium tracking-wide">REC</span>
              </div>
              <div className="h-4 w-px bg-white/20" />
              <h2 className="text-sm font-medium text-white/90">Interview Room: <span className="font-mono text-primary/80">{roomId}</span></h2>
            </div>
            
            {isInterviewer && (
              <Button 
                onClick={handleEndInterview}
                disabled={isEnding}
                variant="destructive"
                className="bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-red-650/20 text-xs px-4 h-9 cursor-pointer"
              >
                {isEnding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Generating AI Report...
                  </>
                ) : (
                  "End Interview & Evaluate"
                )}
              </Button>
            )}
          </header>

          <div className="flex-1 min-h-0">
            <ResizablePanelGroup orientation="horizontal">
              {/* Left Video Panel */}
              <ResizablePanel defaultSize={30} minSize={20} className="bg-zinc-950 relative">
                <div className="h-full p-4">
                  <LiveKitErrorBoundary>
                    <VideoConference />
                    <RoomAudioRenderer />
                  </LiveKitErrorBoundary>
                </div>
              </ResizablePanel>

              <ResizableHandle className="w-1 bg-zinc-800 hover:bg-primary/50 transition-colors z-10" />

              {/* Right Coding & Problem Panel */}
              <ResizablePanel defaultSize={70} minSize={30}>
                <Tabs defaultValue="code" className="h-full flex flex-col">
                  <div className="h-12 shrink-0 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between">
                    <TabsList className="bg-zinc-950/50">
                      <TabsTrigger value="problem" className="data-[state=active]:bg-zinc-800 flex items-center gap-2">
                        <FileCode2 className="w-4 h-4" />
                        Problem
                      </TabsTrigger>
                      <TabsTrigger value="code" className="data-[state=active]:bg-zinc-800 flex items-center gap-2">
                        <Terminal className="w-4 h-4" />
                        Code Editor
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <div className="flex-1 min-h-0 bg-zinc-950 relative">
                    <TabsContent value="problem" className="h-full m-0 data-[state=inactive]:hidden">
                      <ProblemPanel 
                        interviewId={roomId}
                        problem={problemStatement} 
                        onProblemUpdate={setProblemStatement}
                      />
                    </TabsContent>
                    <TabsContent value="code" className="h-full m-0 data-[state=inactive]:hidden">
                      <CodingEnvironment interviewId={roomId} problemStatement={problemStatement} />
                    </TabsContent>
                  </div>
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </LiveKitRoom>
      )}
      {isEnding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">Generating AI Evaluation Report</h2>
          <p className="text-zinc-400 text-sm max-w-xs text-center">
            Gemini is evaluating code submissions, algorithmic efficiency, and communication quality. Please wait...
          </p>
        </div>
      )}
    </div>
  );
}
