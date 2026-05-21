"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CodeEditor } from "./code-editor";
import { SUPPORTED_LANGUAGES, LANGUAGE_TEMPLATES } from "@/constants/languages";
import { executeCode, ExecutionResult } from "@/services/piston";
import { logSubmission } from "@/services/submissions";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Play, Maximize2, Minimize2, Copy, Check, Settings2, Loader2, RefreshCw, Sparkles } from "lucide-react";
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
}

export function CodingEnvironment({ interviewId, problemStatement }: CodingEnvironmentProps) {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(LANGUAGE_TEMPLATES["javascript"]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const { localParticipant } = useLocalParticipant();

  const [fontSize, setFontSize] = useState(14);
  const [minimap, setMinimap] = useState(false);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

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

  // Load draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem(`draft_${interviewId}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setCode(parsed.code);
        setLanguage(parsed.language);
      } catch (e) {}
    }
  }, [interviewId]);

  // Handle Code Change
  const handleCodeChange = useCallback(
    (newCode: string | undefined) => {
      const val = newCode || "";
      setCode(val);
      
      // Save draft
      localStorage.setItem(`draft_${interviewId}`, JSON.stringify({ code: val, language }));

      // Broadcast change
      const payload = JSON.stringify({ type: "CODE_UPDATE", code: val, language });
      send(new TextEncoder().encode(payload), { reliable: true });
    },
    [interviewId, language, send]
  );

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    const newCode = LANGUAGE_TEMPLATES[newLang];
    setCode(newCode);
    
    // Broadcast change
    const payload = JSON.stringify({ type: "CODE_UPDATE", code: newCode, language: newLang });
    send(new TextEncoder().encode(payload), { reliable: true });
  };

  const handleRunCode = async () => {
    if (!code.trim()) return;
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

  return (
    <div className={`flex flex-col bg-zinc-950 border-l border-zinc-800 ${isFullscreen ? "fixed inset-0 z-50" : "h-full w-full"}`}>
      {/* Editor Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <select 
            value={language}
            onChange={handleLanguageChange}
            className="bg-zinc-800 text-sm text-zinc-200 border border-zinc-700 rounded-md px-2 py-1 outline-none focus:border-primary transition"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          <button 
            onClick={() => {
              setCode(LANGUAGE_TEMPLATES[language]);
              handleCodeChange(LANGUAGE_TEMPLATES[language]);
            }}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition tooltip-trigger"
            title="Reset to Template"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition border ${
              isAssistantOpen 
                ? "bg-primary/20 text-primary border-primary/30" 
                : "bg-zinc-800/50 text-zinc-300 hover:text-white border-zinc-700/50 hover:bg-zinc-800"
            }`}
          >
            <Sparkles className={`w-4 h-4 ${isAssistantOpen ? "fill-primary/20" : ""}`} />
            Assistant
          </button>

          <button 
            onClick={() => setIsReviewOpen(true)}
            disabled={!code.trim() || isExecuting}
            className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Settings2 className="w-4 h-4" />
            AI Review
          </button>

          <button 
            onClick={handleRunCode}
            disabled={isExecuting}
            className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            Run Code
          </button>
          
          <div className="w-px h-5 bg-zinc-800 mx-1" />
          
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Editor & Console Split */}
      <div className="flex-1 min-h-0 relative flex">
        <div className="flex-1 min-w-0 relative">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize={70} minSize={30}>
              <CodeEditor 
                language={language}
                value={code}
                onChange={handleCodeChange}
                fontSize={fontSize}
                minimap={minimap}
              />
            </ResizablePanel>
            
            <ResizableHandle className="h-1 bg-zinc-800 hover:bg-primary/50 transition-colors" />
            
            <ResizablePanel defaultSize={30} minSize={15}>
            <div className="h-full flex flex-col bg-zinc-900/80">
              <div className="h-9 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Console Output</span>
                {output && (
                  <button onClick={handleCopyOutput} className="text-zinc-500 hover:text-white transition">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
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
      </div>

      <AIReviewModal 
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        code={code}
        language={language}
        problemStatement={problemStatement}
      />
    </div>
  );
}
