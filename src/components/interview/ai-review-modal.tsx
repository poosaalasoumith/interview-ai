"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";

interface AIReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
  problemStatement?: any;
}

export function AIReviewModal({ isOpen, onClose, code, language, problemStatement }: AIReviewModalProps) {
  const [review, setReview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReviewTime, setLastReviewTime] = useState<number>(0);

  useEffect(() => {
    if (isOpen && code.trim()) {
      generateReview();
    } else {
      setReview("");
      setError(null);
    }
  }, [isOpen]);

  const generateReview = async () => {
    const now = Date.now();
    if (now - lastReviewTime < 15000) {
      setError("Please wait at least 15 seconds between AI reviews.");
      return;
    }
    setLastReviewTime(now);

    setIsLoading(true);
    setReview("");
    setError(null);

    try {
      const response = await fetch("/api/ai/code-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, problemStatement })
      });

      if (!response.ok) {
        throw new Error("Failed to generate review");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      
      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // Use a simple split approach for Vercel AI SDK text stream parsing
        // Vercel AI SDK streamText returns parts starting with '0:'
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              // Parse the JSON string portion
              const text = JSON.parse(line.substring(2));
              setReview((prev) => prev + text);
            } catch (e) {
              // Ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col bg-zinc-950 border-zinc-800 text-zinc-200">
        <DialogHeader className="shrink-0 border-b border-zinc-800 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Code Review
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Analyzing your code for time/space complexity, readability, and best practices.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-400 gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>{error}</p>
              <button 
                onClick={generateReview}
                className="mt-4 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-md hover:bg-zinc-800 transition text-white"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <MarkdownRenderer content={review} />
              {isLoading && (
                <div className="flex items-center gap-3 text-primary animate-pulse py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">AI is analyzing your code...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
