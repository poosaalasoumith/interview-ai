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
  readOnly?: boolean;
  onSelectionChange?: (selectedText: string) => void;
}

export function CodeEditor({ 
  language, 
  value, 
  onChange,
  fontSize = 14,
  minimap = false,
  readOnly = false,
  onSelectionChange,
}: CodeEditorProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<any>(null);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    if (onSelectionChange) {
      editor.onDidChangeCursorSelection((e: any) => {
        const model = editor.getModel();
        if (model) {
          const selectedText = model.getValueInRange(e.selection);
          onSelectionChange(selectedText);
        }
      });
    }
  };

  if (!mounted) return null;

  return (
    <div className="h-full w-full relative">
      <Editor
        height="100%"
        language={language === "c" || language === "cpp" ? "cpp" : language}
        value={value}
        theme={theme === "dark" ? "vs-dark" : "light"}
        onChange={readOnly ? undefined : onChange}
        onMount={handleEditorDidMount}
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
          readOnly: readOnly,
          domReadOnly: readOnly,
          automaticLayout: true,
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
