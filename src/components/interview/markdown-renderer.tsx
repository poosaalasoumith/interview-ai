"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface MarkdownRendererProps {
  content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-zinc-800/80 rounded transition flex items-center gap-1.5 text-zinc-400 hover:text-white cursor-pointer select-none"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-450" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert max-w-none text-xs text-zinc-300 break-words [word-break:break-word]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            if (!inline && match) {
              return (
                <div className="relative group my-4 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/40 max-w-full">
                  <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/60 border-b border-zinc-800 text-[10px] text-zinc-400 font-mono select-none">
                    <span>{match[1].toUpperCase()}</span>
                    <CopyButton text={codeString} />
                  </div>
                  <div className="w-full overflow-x-auto custom-scrollbar">
                    <SyntaxHighlighter
                      {...props}
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
                      className="!m-0 text-xs font-mono !bg-transparent p-4 min-w-full whitespace-pre"
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  </div>
                </div>
              );
            }
            return (
              <code {...props} className="bg-zinc-850 text-zinc-200 px-1.5 py-0.5 rounded text-[11px] font-mono border border-zinc-800 break-all">
                {children}
              </code>
            );
          },
          h1: ({ children }) => <h1 className="text-sm font-bold text-white mt-5 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xs font-bold text-white mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[11px] font-semibold text-zinc-100 mt-3 mb-1.5">{children}</h3>,
          p: ({ children }) => <p className="mb-3 leading-relaxed break-words [word-break:break-word]">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 pl-1 break-words">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 pl-1 break-words">{children}</ol>,
          li: ({ children }) => <li className="text-zinc-300 mb-0.5 break-words">{children}</li>,
          a: ({ children, href }) => <a href={href} className="text-primary hover:underline break-all">{children}</a>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-3 italic text-zinc-400 bg-primary/5 py-1.5 pr-3 rounded-r-lg mb-3 break-words">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
