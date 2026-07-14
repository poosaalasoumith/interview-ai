import React, { useEffect, useState, useRef, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Bot, Code2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutManagerProps {
  leftPane: React.ReactNode;      // Problem Panel
  editorPane: React.ReactNode;    // Monaco Editor
  consolePane: React.ReactNode;   // Attached Console
  
  // Assistant states & panels
  assistantMode: "closed" | "collapsed" | "docked";
  setAssistantMode: (mode: "closed" | "collapsed" | "docked") => void;
  renderAssistant: (mode: "docked") => React.ReactNode;
}

export function WorkspaceLayoutManager({
  leftPane,
  editorPane,
  consolePane,
  assistantMode,
  setAssistantMode,
  renderAssistant
}: WorkspaceLayoutManagerProps) {
  const [assistantWidth, setAssistantWidth] = useState(380);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync window resizes when assistant mode changes (to trigger Monaco layout adjustments)
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("resize"));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [assistantMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    // Assistant slides from right edge, so width is container right minus mouse cursor X
    const newWidth = containerRect.right - e.clientX;
    const constrainedWidth = Math.max(340, Math.min(500, newWidth));
    setAssistantWidth(constrainedWidth);
    
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("resize"));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="h-full w-full flex flex-row min-h-0 min-w-0 bg-zinc-950 text-zinc-100 overflow-hidden select-text relative">
      
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full flex-grow">
        
        {/* LEFT PANEL: Problem Statement (40% default) */}
        <ResizablePanel 
          defaultSize={40} 
          minSize={30} 
          className="flex flex-col min-h-0 min-w-[420px] bg-zinc-900/10 border-r border-zinc-850"
        >
          <div className="flex-1 overflow-y-auto custom-scrollbar select-text">
            {leftPane}
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-1.5 bg-zinc-900 hover:bg-primary/50 transition-colors z-20" />

        {/* RIGHT PANEL: Coding IDE + optional Assistant (60% default) */}
        <ResizablePanel 
          defaultSize={60} 
          minSize={50} 
          className="flex flex-row min-h-0 min-w-0"
        >
          <div ref={containerRef} className="flex-grow flex flex-row min-h-0 min-w-0 h-full w-full relative">
            
            {/* Coding IDE Column (Editor + Console vertical split) */}
            <div className="flex-grow flex-shrink min-h-0 min-w-[500px] h-full flex flex-col">
              <ResizablePanelGroup orientation="vertical" className="h-full w-full">
                
                {/* Editor Viewport */}
                <ResizablePanel 
                  defaultSize={60} 
                  minSize={30} 
                  className="flex flex-col min-h-0"
                >
                  <div className="flex-1 min-h-0 relative h-full w-full">
                    {editorPane}
                  </div>
                </ResizablePanel>

                <ResizableHandle className="h-1.5 bg-zinc-900 hover:bg-primary/50 transition-colors z-20" />

                {/* Vertically Attached Console Viewport (Minimum height: 220px) */}
                <ResizablePanel 
                  defaultSize={40} 
                  minSize={25} 
                  className="flex flex-col min-h-[220px] bg-zinc-950 border-t border-zinc-850"
                >
                  <div className="flex-1 min-h-0 relative h-full w-full">
                    {consolePane}
                  </div>
                </ResizablePanel>

              </ResizablePanelGroup>
            </div>

            {/* AI Assistant Column */}
            <div 
              className={cn(
                "h-full flex flex-row shrink-0 relative overflow-hidden",
                isTransitioning && "transition-[width] duration-200 ease"
              )}
              style={{
                width: assistantMode === "docked" ? `${assistantWidth}px` : "0px",
              }}
            >
              {/* Resizer Handle */}
              {assistantMode === "docked" && (
                <div
                  onMouseDown={handleMouseDown}
                  className={cn(
                    "w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-20 flex-shrink-0 h-full",
                    isDragging ? "bg-primary/60" : "bg-zinc-900"
                  )}
                />
              )}
              
              {/* Panel content container */}
              <div className="flex-1 min-w-[340px] h-full">
                {renderAssistant("docked")}
              </div>
            </div>

            {/* Collapsed Sidebar Stripe (Fixed 48px vertical stripe) */}
            {assistantMode === "collapsed" && (
              <div className="w-12 border-l border-zinc-850 bg-zinc-900/90 flex flex-col items-center py-4 gap-4 shrink-0 select-none h-full z-10 animate-fade-in">
                <button
                  onClick={() => setAssistantMode("docked")}
                  className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary/25 transition cursor-pointer"
                  title="Expand Assistant Sidebar"
                >
                  <Bot className="w-4.5 h-4.5 animate-pulse" />
                </button>
                <span className="h-px w-6 bg-zinc-800" />
                <button
                  onClick={() => {
                    setAssistantMode("docked");
                    toast.info("Ask for code explanation in the workspace!");
                  }}
                  className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center hover:bg-zinc-800 transition cursor-pointer"
                  title="Explain Code"
                >
                  <Code2 className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => {
                    setAssistantMode("docked");
                    toast.info("Ask for hints to guide your solution!");
                  }}
                  className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center hover:bg-zinc-800 transition cursor-pointer"
                  title="Give Hint"
                >
                  <Lightbulb className="w-4.5 h-4.5" />
                </button>
              </div>
            )}
          </div>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}
