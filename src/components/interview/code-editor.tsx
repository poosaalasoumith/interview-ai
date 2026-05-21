import { useEffect, useState, useRef } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string | undefined) => void;
  fontSize?: number;
  minimap?: boolean;
}

export function CodeEditor({ 
  language, 
  value, 
  onChange,
  fontSize = 14,
  minimap = false,
}: CodeEditorProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="h-full w-full relative">
      <Editor
        height="100%"
        language={language === "c" || language === "cpp" ? "cpp" : language}
        value={value}
        theme={theme === "dark" ? "vs-dark" : "light"}
        onChange={onChange}
        options={{
          fontSize,
          minimap: { enabled: minimap },
          wordWrap: "on",
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          formatOnPaste: true,
        }}
        loading={
          <div className="flex h-full items-center justify-center bg-zinc-950">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        }
      />
    </div>
  );
}
