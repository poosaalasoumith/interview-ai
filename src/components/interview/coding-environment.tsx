"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from "react";
import { CodeEditor } from "./code-editor";
import { SUPPORTED_LANGUAGES, LANGUAGE_TEMPLATES } from "@/constants/languages";
import { executeCode, ExecutionResult } from "@/services/piston";
import { logSubmission } from "@/services/submissions";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Play, Maximize2, Minimize2, Copy, Check, Settings2, Loader2, RefreshCw, Sparkles, Terminal } from "lucide-react";
import { toast } from "sonner";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { AIAssistantPanel } from "./ai-assistant-panel";
import dynamic from "next/dynamic";

const AIReviewModal = dynamic(
  () => import("./ai-review-modal").then((mod) => mod.AIReviewModal),
  { ssr: false }
);

interface CodingEnvironmentProps {
  interviewId: string;
  problemStatement?: any;
  isInterviewer?: boolean;
  isLocked?: boolean;
  interviewMode?: string;
}

export function CodingEnvironment({ 
  interviewId, 
  problemStatement,
  isInterviewer = false,
  isLocked = false,
  interviewMode = "assessment"
}: CodingEnvironmentProps) {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(LANGUAGE_TEMPLATES["javascript"]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const { localParticipant } = useLocalParticipant();

  const [fontSize, setFontSize] = useState(14);
  const [minimap, setMinimap] = useState(false);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);
  const [defaultLayout, setDefaultLayout] = useState<number[]>([70, 30]);
  const consolePanelRef = useRef<any>(null);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const isAssessmentMode = interviewMode === "assessment";

  // LiveKit Data Channel for Code Sync
  const { send } = useDataChannel("code-sync", (msg) => {
    const payload = new TextDecoder().decode(msg.payload);
    try {
      const data = JSON.parse(payload);
      if (data.type === "CODE_UPDATE") {
        setCode(data.code);
        if (data.language) {
          setLanguage((prev) => prev !== data.language ? data.language : prev);
        }
      } else if (data.type === "EXECUTION_UPDATE") {
        setOutput(data.output);
      }
    } catch (e) {
      console.error("Failed to parse data channel message:", e);
    }
  });

  // Load preferences and draft from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const draft = localStorage.getItem(`draft_${interviewId}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setCode(parsed.code);
        setLanguage(parsed.language);
      } catch (e) {}
    }

    const savedFontSize = localStorage.getItem(`fontSize_${interviewId}`);
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize, 10));
    }

    const savedMinimap = localStorage.getItem(`minimap_${interviewId}`);
    if (savedMinimap) {
      setMinimap(savedMinimap === "true");
    }

    const savedLayout = localStorage.getItem(`layout_${interviewId}`);
    if (savedLayout) {
      try {
        setDefaultLayout(JSON.parse(savedLayout));
      } catch (e) {}
    }

    const savedConsoleCollapsed = localStorage.getItem(`consoleCollapsed_${interviewId}`);
    if (savedConsoleCollapsed) {
      setIsConsoleCollapsed(savedConsoleCollapsed === "true");
    }
  }, [interviewId]);

  // Programmatically apply console collapse state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (consolePanelRef.current) {
        if (isConsoleCollapsed) {
          consolePanelRef.current.collapse();
        } else {
          consolePanelRef.current.expand();
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isConsoleCollapsed]);

  // Handle Code Change
  const handleCodeChange = useCallback(
    (newCode: string | undefined) => {
      if (isInterviewer || isLocked) return;
      const val = newCode || "";
      setCode(val);
      
      // Save draft
      localStorage.setItem(`draft_${interviewId}`, JSON.stringify({ code: val, language }));

      // Broadcast change
      const payload = JSON.stringify({ type: "CODE_UPDATE", code: val, language });
      send(new TextEncoder().encode(payload), { reliable: true });
    },
    [interviewId, language, send, isInterviewer, isLocked]
  );

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isInterviewer || isLocked) return;
    const newLang = e.target.value;
    setLanguage(newLang);
    const newCode = LANGUAGE_TEMPLATES[newLang];
    setCode(newCode);
    
    // Broadcast change
    const payload = JSON.stringify({ type: "CODE_UPDATE", code: newCode, language: newLang });
    send(new TextEncoder().encode(payload), { reliable: true });
  };

  const handleRunCode = async () => {
    if (!code.trim() || isInterviewer || isLocked) return;
    setIsExecuting(true);
    setOutput(null);

    try {
      const result = await executeCode(language, code);
      const executionData = result.run || result.compile;
      if (executionData) {
        setOutput(executionData);
        
        // Log to Supabase
        await logSubmission({
          interview_id: interviewId,
          code,
          language,
          output: executionData.output,
          status: executionData.code === 0 ? "success" : "error",
          execution_time: parseFloat(executionData.time || "0"),
        });

        // Broadcast Execution output
        const payload = JSON.stringify({ type: "EXECUTION_UPDATE", output: executionData });
        send(new TextEncoder().encode(payload), { reliable: true });
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyOutput = () => {
    if (output) {
      navigator.clipboard.writeText(output.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Output copied to clipboard");
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-950 items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-primary animate-spin" />
        </div>
        <p className="text-xs text-zinc-500 font-medium">Loading editor environment...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-zinc-950 border-l border-zinc-800 ${isFullscreen ? "fixed inset-0 z-50 animate-fade-in" : "h-full w-full"}`}>
      {/* Editor Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md shrink-0 select-none">
        <div className="flex items-center gap-3">
          <select 
            value={language}
            onChange={handleLanguageChange}
            disabled={isInterviewer || isLocked}
            className="bg-zinc-850 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-700/60 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          <button 
            onClick={() => {
              if (confirm("Reset editor to original template? This will erase your current code drafts.")) {
                setCode(LANGUAGE_TEMPLATES[language]);
                handleCodeChange(LANGUAGE_TEMPLATES[language]);
              }
            }}
            disabled={isInterviewer || isLocked}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-lg border border-transparent hover:border-zinc-700/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset to Template"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* Font Sizer Widget */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800/80 rounded-lg px-1.5 py-0.5">
            <button
              onClick={() => {
                const newSize = Math.max(10, fontSize - 1);
                setFontSize(newSize);
                localStorage.setItem(`fontSize_${interviewId}`, String(newSize));
              }}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition text-[10px] font-bold cursor-pointer h-5 w-5 flex items-center justify-center"
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="text-[10px] font-mono text-zinc-400 px-2 font-semibold min-w-[28px] text-center">{fontSize}px</span>
            <button
              onClick={() => {
                const newSize = Math.min(24, fontSize + 1);
                setFontSize(newSize);
                localStorage.setItem(`fontSize_${interviewId}`, String(newSize));
              }}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition text-[10px] font-bold cursor-pointer h-5 w-5 flex items-center justify-center"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          {/* Minimap toggle widget */}
          <button
            onClick={() => {
              const nextMinimap = !minimap;
              setMinimap(nextMinimap);
              localStorage.setItem(`minimap_${interviewId}`, String(nextMinimap));
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              minimap 
                ? "bg-zinc-800 text-zinc-100 border-zinc-700/80" 
                : "text-zinc-500 border-transparent hover:bg-zinc-850 hover:text-zinc-300"
            }`}
            title="Toggle Editor Minimap"
          >
            Minimap
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          {(isInterviewer || isLocked) && (
            <span className="px-2.5 py-1 bg-zinc-800/80 border border-zinc-700 text-[10px] font-bold tracking-wider text-indigo-400 uppercase rounded-md">
              {isLocked ? "Submission Frozen" : "Viewing Mode (ReadOnly)"}
            </span>
          )}

          {/* Console Toggle Button */}
          <button 
            onClick={() => {
              const nextCollapsed = !isConsoleCollapsed;
              setIsConsoleCollapsed(nextCollapsed);
              localStorage.setItem(`consoleCollapsed_${interviewId}`, String(nextCollapsed));
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              !isConsoleCollapsed 
                ? "bg-zinc-800 text-zinc-200 border-zinc-700" 
                : "text-zinc-400 hover:text-zinc-250 border-transparent hover:bg-zinc-850"
            }`}
            title={isConsoleCollapsed ? "Show Terminal Console" : "Hide Terminal Console"}
          >
            <Terminal className="w-3.5 h-3.5" />
            Console
          </button>

          {/* AI Tools restricted in assessment mode for candidates */}
          {(!isAssessmentMode || isInterviewer) && (
            <>
              <button 
                onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                  isAssistantOpen 
                    ? "bg-primary/20 text-primary border-primary/30" 
                    : "bg-zinc-850 text-zinc-300 hover:text-white border-zinc-700/50 hover:bg-zinc-800"
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAssistantOpen ? "fill-primary/20" : ""}`} />
                Assistant
              </button>

              <button 
                onClick={() => setIsReviewOpen(true)}
                disabled={!code.trim() || isExecuting}
                className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                AI Review
              </button>
            </>
          )}

          <button 
            onClick={handleRunCode}
            disabled={isExecuting || isInterviewer || isLocked}
            className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-primary/5"
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            Run Code
          </button>
          
          <div className="w-px h-5 bg-zinc-800 mx-1" />
          
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-700/30 transition cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Editor"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Editor & Console Split */}
      <div className="flex-1 min-h-0 relative flex">
        <div className="flex-1 min-w-0 relative">
          <ResizablePanelGroup 
            orientation="vertical"
            onLayoutChange={(layout: any) => {
              localStorage.setItem(`layout_${interviewId}`, JSON.stringify(layout));
            }}
          >
            <ResizablePanel defaultSize={defaultLayout[0]} minSize={30}>
              <CodeEditor 
                language={language}
                value={code}
                onChange={handleCodeChange}
                fontSize={fontSize}
                minimap={minimap}
                readOnly={isInterviewer || isLocked}
              />
            </ResizablePanel>
            
            <ResizableHandle className="h-1 bg-zinc-800 hover:bg-primary/50 transition-colors z-10" />
            
            <ResizablePanel 
              ref={consolePanelRef}
              defaultSize={defaultLayout[1]} 
              minSize={15}
              collapsible={true}
              onPanelCollapse={() => {
                setIsConsoleCollapsed(true);
                localStorage.setItem(`consoleCollapsed_${interviewId}`, "true");
              }}
              onPanelExpand={() => {
                setIsConsoleCollapsed(false);
                localStorage.setItem(`consoleCollapsed_${interviewId}`, "false");
              }}
            >
              <div className="h-full flex flex-col bg-zinc-900/80">
                <div className="h-9 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Terminal Console</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {output && (
                      <button 
                        onClick={handleCopyOutput} 
                        className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded transition cursor-pointer"
                        title="Copy Console Output"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setIsConsoleCollapsed(true);
                        localStorage.setItem(`consoleCollapsed_${interviewId}`, "true");
                      }}
                      className="p-1 hover:bg-zinc-850 text-zinc-500 hover:text-red-400 rounded transition cursor-pointer"
                      title="Collapse Console"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                {isExecuting ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executing...
                  </div>
                ) : output ? (
                  <div className="flex flex-col gap-2">
                    {output.stderr && <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>}
                    {output.stdout && <pre className="text-zinc-300 whitespace-pre-wrap">{output.stdout}</pre>}
                    {!output.stderr && !output.stdout && <span className="text-zinc-600 italic">Program exited with no output.</span>}
                    
                    <div className="mt-4 pt-4 border-t border-zinc-800/50 flex gap-4 text-xs text-zinc-500">
                      <span>Exit Code: <span className={output.code === 0 ? "text-green-500" : "text-red-500"}>{output.code}</span></span>
                      <span>Time: {output.time}ms</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-600 italic">Run your code to see output here.</div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        </div>

        {/* AI Assistant Sidebar Overlay (Slides in from right) */}
        {(!isAssessmentMode || isInterviewer) && (
          <div 
            className={`absolute top-0 right-0 bottom-0 w-80 lg:w-96 transform transition-transform duration-300 ease-in-out z-20 ${
              isAssistantOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <AIAssistantPanel 
              isOpen={isAssistantOpen} 
              onClose={() => setIsAssistantOpen(false)}
              code={code}
              language={language}
              problemStatement={problemStatement}
            />
          </div>
        )}
      </div>

      {(!isAssessmentMode || isInterviewer) && (
        <AIReviewModal 
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          code={code}
          language={language}
          problemStatement={problemStatement}
        />
      )}
    </div>
  );
}
