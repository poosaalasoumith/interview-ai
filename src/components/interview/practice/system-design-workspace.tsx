"use client";

import { useState, useEffect, useRef } from "react";
import { CodeEditor } from "../code-editor";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChevronRight, Loader2, Sparkles, Layout, BookOpen, CheckSquare, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { VoiceDebugPanel } from "./voice-debug-panel";
import { VoiceDiagnostics } from "@/services/voice-interview/InterviewOrchestrator";

interface SystemDesignWorkspaceProps {
  currentQuestionText: string;
  currentQuestionIndex: number;
  currentQuestionObj: any;
  chatLog: { sender: "ai" | "user"; text: string; timestamp: string }[];
  candidateResponseText: string;
  setCandidateResponseText: (text: string) => void;
  submitCandidateAnswer: (answer: string) => void;
  roundName: string;
  diagnostics: VoiceDiagnostics | null;
  
  // Forwarded shared properties
  hasCameraStream: boolean;
  roomVideoRef: (node: HTMLVideoElement | null) => void;
  
  // Custom navigation callbacks
  onNextQuestion?: () => void;
  onFinishSession?: () => void;

  // Unused parameters kept for interface compatibility
  isDictating?: boolean;
  toggleDictation?: () => void;
  silenceCountdown?: number | null;
  aiSpeechState?: string;
}

export function SystemDesignWorkspace({
  currentQuestionText,
  currentQuestionIndex,
  currentQuestionObj,
  candidateResponseText,
  setCandidateResponseText,
  submitCandidateAnswer,
  roundName,
  diagnostics,
  onNextQuestion,
  onFinishSession,
}: SystemDesignWorkspaceProps) {
  const [activeCenterTab, setActiveCenterTab] = useState<"notes" | "mermaid" | "whiteboard">("notes");
  const [activeRightTab, setActiveRightTab] = useState<"canvas" | "evaluation">("canvas");
  
  const [architectureNotes, setArchitectureNotes] = useState<string>("");
  const [mermaidCode, setMermaidCode] = useState<string>(`graph TD
  User([User]) --> LB[Load Balancer]
  LB --> Web[Web Servers]
  Web --> Cache[Redis Cache]
  Web --> DB[(PostgreSQL Database)]`);
  const [snippetCode, setSnippetCode] = useState<string>("// Optional schema definition or helper code\n");
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiEvaluationReview, setAiEvaluationReview] = useState("");

  // Checklist states
  const [checklist, setChecklist] = useState([
    { id: "lb", label: "Load Balancer & Routing", checked: false },
    { id: "cache", label: "Caching Layer (Redis/Memcached)", checked: false },
    { id: "db", label: "Database Sharding & Replication", checked: false },
    { id: "queue", label: "Message Queue (Kafka/RabbitMQ)", checked: false },
    { id: "cdn", label: "CDN for Static Assets", checked: false },
    { id: "auth", label: "Security & Authentication (JWT/OAuth)", checked: false }
  ]);

  // Mermaid Rendering URL via mermaid.ink
  const [mermaidImgUrl, setMermaidImgUrl] = useState<string>("");

  useEffect(() => {
    try {
      const cleanedCode = mermaidCode.trim();
      if (!cleanedCode) {
        setMermaidImgUrl("");
        return;
      }
      // Safely Base64 encode the mermaid code for mermaid.ink
      const base64Code = btoa(unescape(encodeURIComponent(cleanedCode)));
      setMermaidImgUrl(`https://mermaid.ink/img/${base64Code}`);
    } catch (e) {
      console.warn("Mermaid encoding failed:", e);
    }
  }, [mermaidCode]);

  // Load template instructions when question changes
  useEffect(() => {
    setIsSubmitted(false);
    setAiEvaluationReview("");
    setActiveRightTab("canvas");

    setArchitectureNotes(`# Architectural Overview

## 1. Core Requirements & Assumptions
- High Availability (99.99%)
- Scalability: 10M+ Daily Active Users
- Low Latency Read Path

## 2. API Design & Data Schemas
-
`);
    setSnippetCode(`// Optional configuration or SQL DB schema snippet
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`);
  }, [currentQuestionIndex]);

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleFinalSubmit = async () => {
    setIsEvaluating(true);
    setActiveRightTab("evaluation");

    const formattedAnswer = `### System Design Assessment Workspace

#### 1. Architecture Notes & Trade-offs
${architectureNotes}

#### 2. Mermaid Infrastructure Layout
\`\`\`mermaid
${mermaidCode}
\`\`\`

#### 3. Optional Schema / Snippets
\`\`\`typescript
${snippetCode}
\`\`\`
`;
    // Save to the dialogue/history engine
    submitCandidateAnswer(formattedAnswer);

    // Fetch AI Architectural Review
    try {
      const response = await fetch("/api/ai/code-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formattedAnswer,
          language: "markdown",
          problemStatement: { question: currentQuestionObj?.question || currentQuestionText }
        })
      });

      if (!response.ok) throw new Error("Failed to generate blueprint evaluation review");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.substring(2));
              setAiEvaluationReview(prev => prev + text);
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      toast.error("Failed to generate AI blueprint review.");
    } finally {
      setIsEvaluating(false);
      setIsSubmitted(true);
    }
  };

  const isLastQuestion = currentQuestionIndex === 2;

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 relative select-text">
      {/* Dynamic Monaco Editor Split Panel */}
      <ResizablePanelGroup orientation="horizontal" className="flex-grow">
        
        {/* Left Column: Problem & Checklist */}
        <ResizablePanel defaultSize={28} minSize={25} className="bg-zinc-900/30 border-r border-zinc-850 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar select-none">
          <div className="space-y-2 border-b border-zinc-800 pb-3">
            <span className="text-[8px] font-black text-primary uppercase tracking-widest block">
              System Architecture Task
            </span>
            <h3 className="text-sm font-bold text-white leading-snug">
              {currentQuestionObj?.question || currentQuestionText}
            </h3>
            <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded uppercase tracking-wider block w-max mt-1.5 font-bold">
              System Design Round
            </span>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            <span className="text-[8px] font-bold text-zinc-555 uppercase tracking-widest block">
              Architectural Checklist
            </span>
            <div className="space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleChecklistItem(item.id)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-xl border text-[10px] font-bold cursor-pointer transition select-none",
                    item.checked
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-zinc-950/40 border-zinc-850 text-zinc-400 hover:border-zinc-800"
                  )}
                >
                  <CheckSquare className={cn("w-3.5 h-3.5", item.checked ? "text-primary" : "text-zinc-650")} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-900 mt-2">
            <VoiceDebugPanel diagnostics={diagnostics} />
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-1 bg-zinc-850 hover:bg-primary/50 transition-colors" />

        {/* Center Panel: Editors & Whiteboard */}
        <ResizablePanel defaultSize={42} minSize={30} className="flex flex-col border-r border-zinc-850 bg-zinc-950">
          <Tabs value={activeCenterTab} onValueChange={(v: any) => setActiveCenterTab(v)} className="flex-grow flex flex-col min-h-0">
            <div className="h-10 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center justify-between shrink-0 select-none">
              <TabsList className="bg-transparent border-0 h-9 p-0 flex gap-4">
                <TabsTrigger value="notes" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
                  Markdown Notes
                </TabsTrigger>
                <TabsTrigger value="mermaid" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
                  Mermaid Diagram
                </TabsTrigger>
                <TabsTrigger value="whiteboard" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
                  Whiteboard
                </TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-2">
                {!isSubmitted ? (
                  <Button
                    onClick={handleFinalSubmit}
                    disabled={isEvaluating || !architectureNotes.trim()}
                    className="h-7 text-[9px] bg-primary hover:bg-primary/95 text-white font-bold uppercase tracking-wider px-3 rounded-lg"
                  >
                    {isEvaluating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Submit Blueprint"}
                  </Button>
                ) : (
                  !isLastQuestion ? (
                    <Button
                      onClick={onNextQuestion}
                      className="h-7 text-[9px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider px-3 rounded-lg flex items-center gap-1"
                    >
                      Next Question <ChevronRight className="w-3 h-3" />
                    </Button>
                  ) : (
                    <Button
                      onClick={onFinishSession}
                      className="h-7 text-[9px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider px-3 rounded-lg flex items-center gap-1"
                    >
                      Finish Assessment <ChevronRight className="w-3 h-3" />
                    </Button>
                  )
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 relative bg-zinc-950">
              <TabsContent value="notes" className="m-0 h-full">
                <textarea
                  value={architectureNotes}
                  disabled={isSubmitted}
                  onChange={(e) => setArchitectureNotes(e.target.value)}
                  placeholder="Describe your system requirements, APIs, data flows, and scalability design trade-offs..."
                  className="w-full h-full bg-zinc-950 border-0 p-4 text-xs font-mono text-zinc-350 outline-none resize-none custom-scrollbar select-text leading-relaxed animate-fade-in disabled:opacity-85"
                />
              </TabsContent>

              <TabsContent value="mermaid" className="m-0 h-full flex flex-col">
                <textarea
                  value={mermaidCode}
                  disabled={isSubmitted}
                  onChange={(e) => setMermaidCode(e.target.value)}
                  placeholder="Write Mermaid diagram layout..."
                  className="w-full flex-1 bg-zinc-950 border-0 p-4 text-xs font-mono text-zinc-350 outline-none resize-none custom-scrollbar select-text leading-relaxed animate-fade-in disabled:opacity-85"
                />
              </TabsContent>

              <TabsContent value="whiteboard" className="m-0 h-full">
                <Whiteboard />
              </TabsContent>
            </div>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle className="w-1 bg-zinc-850 hover:bg-primary/50 transition-colors z-10" />

        {/* Right Column: Live Mermaid Canvas Preview & AI Evaluation Panel */}
        <ResizablePanel defaultSize={30} minSize={25} className="flex flex-col bg-zinc-950">
          <Tabs value={activeRightTab} onValueChange={(v: any) => setActiveRightTab(v)} className="flex-grow flex flex-col min-h-0">
            <div className="h-10 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center justify-between shrink-0 select-none">
              <TabsList className="bg-transparent border-0 h-9 p-0 flex gap-4">
                <TabsTrigger value="canvas" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
                  Architecture Canvas
                </TabsTrigger>
                {isSubmitted && (
                  <TabsTrigger value="evaluation" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
                    Evaluation Panel
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="flex-grow min-h-0 bg-zinc-950">
              <TabsContent value="canvas" className="m-0 h-full flex flex-col">
                <div className="p-2 bg-zinc-900/60 border-b border-zinc-850 text-[9px] font-mono text-zinc-555 select-none">
                  Mermaid.ink SVG Layout Render
                </div>
                <div className="flex-grow flex items-center justify-center p-4 overflow-auto custom-scrollbar">
                  {mermaidImgUrl ? (
                    <img
                      src={mermaidImgUrl}
                      alt="System Architecture Diagram"
                      className="max-w-full max-h-full object-contain filter invert opacity-95 transition-all duration-300"
                      onError={(e) => {
                        (e.target as any).src = "";
                      }}
                    />
                  ) : (
                    <span className="text-[9px] font-mono text-zinc-650">No valid Mermaid syntax to display.</span>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="evaluation" className="m-0 h-full p-4 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <span className="text-[9px] font-bold text-zinc-555 uppercase tracking-widest block border-b border-zinc-900 pb-2">
                    AI Architectural Blueprint Review
                  </span>
                  <div className="bg-zinc-900/50 border border-zinc-850 rounded-xl p-4 font-sans text-xs text-zinc-300 leading-relaxed select-text">
                    {aiEvaluationReview ? (
                      <div className="prose prose-zinc prose-invert prose-xs max-w-none">
                        <ReactMarkdown>
                          {aiEvaluationReview}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-primary animate-pulse py-4">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="font-medium">AI is generating architecture blueprint evaluation...</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// Whiteboard Interactive HTML5 Canvas component
function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#a855f7"); // primary purple
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = (rect?.width || 800) * window.devicePixelRatio;
      canvas.height = (rect?.height || 500) * window.devicePixelRatio;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = tool === "eraser" ? "#09090b" : color;
    ctx.lineWidth = brushSize;
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden select-none">
      <div className="h-10 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTool("pen")}
            className={cn(
              "px-2.5 py-1 rounded text-[10px] font-bold uppercase transition",
              tool === "pen" ? "bg-primary text-white" : "bg-zinc-950 text-zinc-400 hover:text-white"
            )}
          >
            Pen
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={cn(
              "px-2.5 py-1 rounded text-[10px] font-bold uppercase transition",
              tool === "eraser" ? "bg-primary text-white" : "bg-zinc-950 text-zinc-400 hover:text-white"
            )}
          >
            Eraser
          </button>
          <button
            onClick={clearCanvas}
            className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-zinc-950 text-red-400 hover:bg-red-500/10 transition"
          >
            Clear
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-zinc-555 font-bold uppercase">Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-20 accent-primary cursor-pointer"
            />
            <span className="text-[9px] text-zinc-400 font-mono">{brushSize}px</span>
          </div>
          
          {tool === "pen" && (
            <div className="flex items-center gap-1">
              {["#a855f7", "#3b82f6", "#10b981", "#ef4444", "#ffffff"].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-4 h-4 rounded-full border transition",
                    color === c ? "border-white scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-grow min-h-0 bg-[#09090b] relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair block"
        />
      </div>
    </div>
  );
}
