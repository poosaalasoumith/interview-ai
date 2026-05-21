"use client";

import { useChat, Message } from "ai/react";
import { Bot, Send, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { MarkdownRenderer } from "./markdown-renderer";

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
  problemStatement?: any;
}

export function AIAssistantPanel({ isOpen, onClose, code, language, problemStatement }: AIAssistantPanelProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/ai/chat",
    body: {
      context: {
        code,
        language,
        problemStatement
      }
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-zinc-950/80 backdrop-blur-xl border-l border-zinc-800/50 shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-zinc-800/80 bg-zinc-900/50 relative z-10">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Sparkles className="w-4 h-4 fill-primary/20" />
          <span>AI Interview Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 relative z-10 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-zinc-400 max-w-[200px]">
              I can help explain concepts, find bugs, or give hints. Ask me anything!
            </p>
            <div className="flex flex-col gap-2 mt-4 w-full px-4">
              <button 
                onClick={() => append({ role: 'user', content: 'Can you please explain the code I currently have written?' })}
                className="w-full text-xs text-left bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 px-3 rounded-md transition border border-zinc-700"
              >
                ✨ Explain This Code
              </button>
              <button 
                onClick={() => append({ role: 'user', content: 'Can I get a subtle hint for the next step?' })}
                className="w-full text-xs text-left bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 px-3 rounded-md transition border border-zinc-700"
              >
                💡 Give me a contextual hint
              </button>
            </div>
          </div>
        )}

        {messages.map((message: Message) => (
          <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              message.role === "user" 
                ? "bg-primary text-primary-foreground rounded-tr-sm" 
                : "bg-zinc-900/80 border border-zinc-800/50 rounded-tl-sm backdrop-blur-sm shadow-xl"
            }`}>
              {message.role === "user" ? (
                <p className="text-sm leading-relaxed">{message.content}</p>
              ) : (
                <MarkdownRenderer content={message.content} />
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-900/50 border-t border-zinc-800/50 shrink-0 relative z-10 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask for a hint or explanation..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-full py-3 pl-4 pr-12 text-sm text-zinc-200 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="absolute right-2 w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
