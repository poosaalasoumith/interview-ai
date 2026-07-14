"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { useDataChannel } from "@livekit/components-react";
import { createClient } from "@/utils/supabase/client";
import { MarkdownRenderer } from "./markdown-renderer";
import { cn } from "@/lib/utils";

interface ProblemPanelProps {
  interviewId?: string;
  problem?: any;
  onProblemUpdate?: (problem: any) => void;
  isInterviewer?: boolean;

  // Custom assessment props
  assessmentTemplateId?: string | null;
  questions?: any[];
  activeQIdx?: number;
  onQuestionSelect?: (index: number) => void;
  attempt?: any;
}

export function ProblemPanel({ 
  interviewId, 
  problem, 
  onProblemUpdate,
  isInterviewer = false,
  assessmentTemplateId = null,
  questions = [],
  activeQIdx = 0,
  onQuestionSelect,
  attempt
}: ProblemPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState("DSA");
  const [difficulty, setDifficulty] = useState("Medium");

  // LiveKit Data Channel for syncing generated problems
  const { send } = useDataChannel("problem-sync", (msg) => {
    const payload = new TextDecoder().decode(msg.payload);
    try {
      const data = JSON.parse(payload);
      if (data.type === "PROBLEM_UPDATE" && onProblemUpdate) {
        onProblemUpdate(data.problem);
        toast.info("A new interview problem was generated!");
      }
    } catch (e) {
      console.error("Failed to parse problem sync message:", e);
    }
  });

  const handleGenerateProblem = async () => {
    if (!interviewId) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, difficulty })
      });

      if (!response.ok) {
        throw new Error("Failed to generate problem");
      }

      const generatedProblem = await response.json();
      
      // Save to Supabase
      const supabase = createClient();
      await supabase
        .from("interviews")
        .update({ problem_statement: generatedProblem })
        .eq("id", interviewId);

      // Update local state
      if (onProblemUpdate) {
        onProblemUpdate(generatedProblem);
      }

      // Broadcast to room
      const payload = JSON.stringify({ type: "PROBLEM_UPDATE", problem: generatedProblem });
      send(new TextEncoder().encode(payload), { reliable: true });

      toast.success("Problem generated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!problem) {
    if (!isInterviewer) {
      return (
        <div className="h-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6 border border-indigo-500/20 animate-pulse shadow-[0_0_30px_rgba(99,102,241,0.2)]">
            <BrainCircuit className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Waiting for Problem</h2>
          <p className="text-zinc-400 max-w-xs text-sm">
            Please wait. Your interviewer will generate or assign a technical problem statement shortly.
          </p>
        </div>
      );
    }

    return (
      <div className="h-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.2)]">
          <BrainCircuit className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No Problem Selected</h2>
        <p className="text-zinc-400 max-w-sm mb-8 text-sm">
          Generate an AI-powered technical question for this interview or wait for the interviewer to assign one.
        </p>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 w-full max-w-md backdrop-blur-sm space-y-4 text-left">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Topic</label>
            <select 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            >
              <option value="DSA">Data Structures & Algorithms</option>
              <option value="Frontend">Frontend Development</option>
              <option value="Backend">Backend Development</option>
              <option value="System Design">System Design</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Difficulty</label>
            <select 
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <button
            onClick={handleGenerateProblem}
            disabled={isGenerating}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md py-2.5 font-medium transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate AI Problem
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const isCustomAssessment = questions && questions.length > 0;

  if (isCustomAssessment && problem) {
    return (
      <div className="h-full bg-zinc-950 text-zinc-300 flex flex-col">
        <header className="h-12 flex items-center px-6 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md shrink-0">
          <h2 className="font-semibold text-white tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Custom Assessment
          </h2>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Question Navigator */}
          <div className="w-44 bg-zinc-950 border-r border-zinc-900 flex flex-col p-3.5 space-y-3 shrink-0 overflow-y-auto select-none">
            <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase">Challenges</span>
            <div className="flex-grow flex flex-col gap-2">
              {questions.map((q, idx) => {
                const isSelected = idx === activeQIdx;
                const isSolved = q.status === "solved";
                const isSubmitted = q.status === "submitted";
                const isStarted = q.status === "in_progress";

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onQuestionSelect && onQuestionSelect(idx)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-xl border text-xs font-semibold transition-all duration-300 flex items-start gap-2 relative group cursor-pointer",
                      isSelected
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-zinc-900/20 border-zinc-900/60 text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
                    )}
                  >
                    <span className={cn(
                      "text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      isSelected ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500"
                    )}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold tracking-tight">{q.title}</p>
                      <p className="text-[8px] text-zinc-500 font-medium mt-0.5 flex items-center gap-1 font-mono">
                        <span>{q.marks} Marks</span>
                        <span className="opacity-40">•</span>
                        <span className={cn(
                          isSolved && "text-emerald-400 font-bold",
                          isSubmitted && "text-blue-400 font-bold",
                          isStarted && "text-amber-500 font-bold",
                          !isSolved && !isSubmitted && !isStarted && "text-zinc-650"
                        )}>
                          {isSolved ? "Solved" : isSubmitted ? "Sub" : isStarted ? "Prog" : "New"}
                        </span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Details */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white">{problem.title}</h1>
                  <Badge 
                    variant="outline" 
                    className={
                      problem.difficulty === "Easy" ? "text-green-400 border-green-400/20 bg-green-400/10" :
                      problem.difficulty === "Medium" ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/10" :
                      "text-red-400 border-red-400/20 bg-red-400/10"
                    }
                  >
                    {problem.difficulty}
                  </Badge>
                </div>
                
                <MarkdownRenderer content={problem.description} />
              </div>

              {problem.constraints && problem.constraints.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Constraints</h3>
                  <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1 font-mono bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/50">
                    {problem.constraints.map((constraint: string, idx: number) => (
                      <li key={idx}>{constraint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {problem.examples && problem.examples.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Examples</h3>
                  {problem.examples.map((ex: any, idx: number) => (
                    <div key={idx} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 space-y-2 font-mono text-xs select-text">
                      <div className="flex gap-2">
                        <span className="text-zinc-500 font-bold">Input:</span>
                        <span className="text-zinc-300">{ex.input}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-zinc-500 font-bold">Output:</span>
                        <span className="text-green-400">{ex.output}</span>
                      </div>
                      {ex.explanation && (
                        <div className="flex gap-2 text-zinc-500 mt-2 pt-2 border-t border-zinc-800/50">
                          <span>Explanation:</span>
                          <span>{ex.explanation}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-950 text-zinc-300 flex flex-col">
      <header className="h-12 flex items-center px-6 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md shrink-0">
        <h2 className="font-semibold text-white tracking-wide flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Generated Problem
        </h2>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{problem.title}</h1>
              <Badge 
                variant="outline" 
                className={
                  problem.difficulty === "Easy" ? "text-green-400 border-green-400/20 bg-green-400/10" :
                  problem.difficulty === "Medium" ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/10" :
                  "text-red-400 border-red-400/20 bg-red-400/10"
                }
              >
                {problem.difficulty}
              </Badge>
            </div>
            
            <MarkdownRenderer content={problem.description} />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Examples</h3>
            {problem.examples?.map((ex: any, idx: number) => (
              <div key={idx} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 space-y-2 font-mono text-sm">
                <div className="flex gap-2">
                  <span className="text-zinc-500">Input:</span>
                  <span className="text-zinc-300">{ex.input}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500">Output:</span>
                  <span className="text-green-400">{ex.output}</span>
                </div>
                {ex.explanation && (
                  <div className="flex gap-2 text-zinc-500 mt-2 pt-2 border-t border-zinc-800/50">
                    <span>Explanation:</span>
                    <span>{ex.explanation}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Constraints</h3>
            <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1 font-mono bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/50">
              {problem.constraints?.map((constraint: string, idx: number) => (
                <li key={idx}>{constraint}</li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
