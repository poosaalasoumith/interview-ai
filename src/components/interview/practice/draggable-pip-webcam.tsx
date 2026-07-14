"use client";

import { useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2, Move, CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggablePipWebcamProps {
  hasCameraStream: boolean;
  roomVideoRef: (node: HTMLVideoElement | null) => void;
}

const SIZE_DIMENSIONS = {
  sm: { width: 160, height: 100 },
  md: { width: 220, height: 140 },
  lg: { width: 300, height: 190 },
};

export function DraggablePipWebcam({ hasCameraStream, roomVideoRef }: DraggablePipWebcamProps) {
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  // Absolute translation coordinates (top-left offset relative to viewport)
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const coordsRef = useRef({ x: 0, y: 0 });
  
  // Track dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, webcamX: 0, webcamY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentDimension = isMinimized ? { width: 56, height: 56 } : SIZE_DIMENSIONS[size];
  const margin = 16; // 16px safety margins

  // Initialize position in bottom-right corner once window is loaded
  useEffect(() => {
    const width = currentDimension.width;
    const height = currentDimension.height;
    const initialX = window.innerWidth - width - margin;
    const initialY = window.innerHeight - height - margin - 80; // slightly above bottom bar
    
    setCoords({ x: initialX, y: initialY });
    coordsRef.current = { x: initialX, y: initialY };
  }, []);

  // Sync coordsRef when coords state updates from outside resize/snapping events
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  // Keep webcam clamped inside the viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      const width = currentDimension.width;
      const height = currentDimension.height;
      
      const clampedX = Math.max(margin, Math.min(window.innerWidth - width - margin, coordsRef.current.x));
      const clampedY = Math.max(margin, Math.min(window.innerHeight - height - margin, coordsRef.current.y));
      
      setCoords({ x: clampedX, y: clampedY });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentDimension]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only start dragging if clicking the drag handler or handle bar
    if (!(e.target as HTMLElement).closest(".drag-handle")) return;
    
    e.preventDefault();
    isDraggingRef.current = true;
    setIsSnapping(false); // disable snapping transitions during active drag

    // Store starting mouse coordinates and initial webcam coordinates
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      webcamX: coordsRef.current.x,
      webcamY: coordsRef.current.y
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    
    // Calculate new position
    const newX = dragStartRef.current.webcamX + dx;
    const newY = dragStartRef.current.webcamY + dy;
    
    // Perform boundary clamping during drag to prevent moving offscreen
    const width = currentDimension.width;
    const height = currentDimension.height;
    const clampedX = Math.max(margin, Math.min(window.innerWidth - width - margin, newX));
    const clampedY = Math.max(margin, Math.min(window.innerHeight - height - margin, newY));
    
    coordsRef.current = { x: clampedX, y: clampedY };
    
    // Smooth direct DOM mutation (bypasses React render loop for 60fps dragging)
    containerRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Trigger Snapping logic
    setIsSnapping(true);
    const width = currentDimension.width;
    const height = currentDimension.height;
    
    // Snap to the closest vertical edge (Left or Right)
    const midPoint = window.innerWidth / 2;
    const currentCenterX = coordsRef.current.x + width / 2;
    const snapX = currentCenterX < midPoint 
      ? margin 
      : window.innerWidth - width - margin;
      
    const finalY = Math.max(margin, Math.min(window.innerHeight - height - margin, coordsRef.current.y));
    
    setCoords({ x: snapX, y: finalY });
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
  };

  // Adjust coordinates when size changes, to keep it within safe margins
  const changeSize = (newSize: "sm" | "md" | "lg") => {
    setIsSnapping(true);
    const prevDim = SIZE_DIMENSIONS[size];
    const nextDim = SIZE_DIMENSIONS[newSize];
    
    // Center alignment adjust
    let nextX = coordsRef.current.x - (nextDim.width - prevDim.width);
    let nextY = coordsRef.current.y - (nextDim.height - prevDim.height);
    
    // Re-clamp
    nextX = Math.max(margin, Math.min(window.innerWidth - nextDim.width - margin, nextX));
    nextY = Math.max(margin, Math.min(window.innerHeight - nextDim.height - margin, nextY));
    
    setSize(newSize);
    setCoords({ x: nextX, y: nextY });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: `${currentDimension.width}px`,
        height: `${currentDimension.height}px`,
        transform: `translate3d(${coords.x}px, ${coords.y}px, 0)`,
        zIndex: 50,
      }}
      className={cn(
        "bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden select-none flex flex-col group touch-none",
        isSnapping && "transition-transform duration-200 ease-out",
        isDraggingRef.current && "scale-[1.02] border-primary/40 shadow-primary/10",
        isMinimized ? "rounded-full" : "aspect-video"
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Draggable Drag bar handle overlay */}
      <div 
        className={cn(
          "drag-handle absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between px-3 z-20 transition-opacity opacity-0 group-hover:opacity-100",
          isMinimized ? "opacity-100 h-full justify-center px-0 bg-transparent cursor-grab active:cursor-grabbing" : "cursor-grab active:cursor-grabbing",
          isDraggingRef.current && "cursor-grabbing"
        )}
      >
        {!isMinimized ? (
          <>
            <div className="flex items-center gap-1 text-[8px] font-bold text-zinc-300 font-mono pointer-events-none select-none">
              <Move className="w-3 h-3 text-zinc-400" />
              <span>WEBCAM</span>
            </div>
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  changeSize(size === "sm" ? "md" : size === "md" ? "lg" : "sm");
                }}
                className="text-[8px] font-mono font-bold text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 cursor-pointer"
                title="Resize Webcam"
              >
                {size.toUpperCase()}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSnapping(true);
                  setIsMinimized(true);
                  // center coordinates for circle
                  setCoords(curr => ({
                    x: Math.max(margin, Math.min(window.innerWidth - 56 - margin, curr.x)),
                    y: Math.max(margin, Math.min(window.innerHeight - 56 - margin, curr.y))
                  }));
                }}
                className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                title="Minimize Webcam"
              >
                <Minimize2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSnapping(true);
              setIsMinimized(false);
            }}
            className="w-full h-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-900/60 rounded-full cursor-pointer"
            title="Restore Webcam"
          >
            <Maximize2 className="w-4 h-4 text-primary animate-pulse" />
          </button>
        )}
      </div>

      {/* Webcam content stream */}
      {!isMinimized && (
        <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center pointer-events-none select-none">
          {hasCameraStream ? (
            <video
              ref={roomVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror-mode pointer-events-none select-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center text-[9px] text-zinc-550 font-mono select-none pointer-events-none">
              <CameraOff className="w-4 h-4 mb-1 text-zinc-650" />
              <span>Camera Off</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
