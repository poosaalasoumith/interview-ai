import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert max-w-none text-sm text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <SyntaxHighlighter
                {...props}
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                className="rounded-md border border-zinc-800 my-4 text-xs font-mono"
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code {...props} className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded text-sm font-mono border border-zinc-700/50">
                {children}
              </code>
            );
          },
          h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-6 mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-5 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-zinc-100 mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-zinc-300">{children}</li>,
          a: ({ children, href }) => <a href={href} className="text-primary hover:underline">{children}</a>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-4 italic text-zinc-400 bg-primary/5 py-2 pr-4 rounded-r-lg mb-4">
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
