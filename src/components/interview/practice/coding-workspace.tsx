"use client";

import { useState, useEffect } from "react";
import { CodeEditor } from "../code-editor";
import { SUPPORTED_LANGUAGES, LANGUAGE_TEMPLATES } from "@/constants/languages";
import { executeCode } from "@/services/piston";
import { 
  Play, Terminal, ChevronRight, Loader2, Sparkles, MessageSquare,
  Cpu, BarChart2, Shield, AlertCircle, CheckCircle2, XCircle, Info, BookOpen
} from "lucide-react";
import { toast } from "sonner";
import { AIAssistantPanel } from "../ai-assistant-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WorkspaceLayoutManager } from "./workspace-layout-manager";
import ReactMarkdown from "react-markdown";
import { compareOutputs } from "@/utils/output-comparator";
import { VoiceDebugPanel } from "./voice-debug-panel";
import { VoiceDiagnostics } from "@/services/voice-interview/InterviewOrchestrator";

interface CodingWorkspaceProps {
  currentQuestionText: string;
  currentQuestionIndex: number;
  currentQuestionObj: any;
  candidateResponseText: string;
  setCandidateResponseText: (text: string) => void;
  submitCandidateAnswer: (answer: string) => void;
  roundName: string;
  diagnostics: VoiceDiagnostics | null;
  
  // Forwarded shared properties
  hasCameraStream: boolean;
  roomVideoRef: (node: HTMLVideoElement | null) => void;
  proctorSandboxLogs: string[];
  
  // Custom navigation callbacks
  onNextQuestion?: () => void;
  onFinishSession?: () => void;

  // Unused parameters kept for interface compatibility
  isDictating?: boolean;
  toggleDictation?: () => void;
  silenceCountdown?: number | null;
  aiSpeechState?: string;
}

interface TestCase {
  id: string;
  input: string;
  expected: string;
  actual?: string;
  status?: "pass" | "fail" | "running" | "idle";
  runtime?: string;
  error?: string;
  isHidden?: boolean;
  diagnostics?: any;
}

export function CodingWorkspace({
  currentQuestionText,
  currentQuestionIndex,
  currentQuestionObj,
  candidateResponseText,
  setCandidateResponseText,
  submitCandidateAnswer,
  roundName,
  diagnostics,
  hasCameraStream,
  roomVideoRef,
  proctorSandboxLogs,
  onNextQuestion,
  onFinishSession,
}: CodingWorkspaceProps) {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [isExecuting, setIsExecuting] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  
  // Submission & evaluation states
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiCodeReview, setAiCodeReview] = useState("");
  const [hasRunEvaluation, setHasRunEvaluation] = useState(false);
  const [anyCompileError, setAnyCompileError] = useState(false);
  const [complexityAnalysis, setComplexityAnalysis] = useState<any>(null);
  const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);

  // AI Assistant Three-State Mode
  const [assistantMode, setAssistantMode] = useState<"closed" | "collapsed" | "docked">("closed");
  const [selectedCode, setSelectedCode] = useState("");

  // Tab control for bottom panel
  const [bottomTab, setBottomTab] = useState<"testcases" | "console" | "evaluation" | "complexity" | "aifeedback">("testcases");

  // State for Test Cases (Visible + Hidden)
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [activeTestCaseId, setActiveTestCaseId] = useState<string>("");

  // Sync question, template code and test cases
  useEffect(() => {
    setIsSubmitted(false);
    setAiCodeReview("");
    setTerminalOutput("");
    setHasRunEvaluation(false);
    setAnyCompileError(false);
    setComplexityAnalysis(null);
    
    setCandidateResponseText("");
    
    const starterTemplate = currentQuestionObj?.starterCode || LANGUAGE_TEMPLATES[language] || `// Write your solution code here\nfunction solve() {\n  // your code\n}\n`;
    setCode(starterTemplate);

    const tempCases: TestCase[] = [];
    
    if (currentQuestionObj?.visibleTestCases && Array.isArray(currentQuestionObj.visibleTestCases)) {
      currentQuestionObj.visibleTestCases.forEach((tc: any, idx: number) => {
        tempCases.push({
          id: `visible-${idx}`,
          input: tc.input,
          expected: tc.expected,
          status: "idle",
          isHidden: false
        });
      });
    }

    if (currentQuestionObj?.hiddenTestCases && Array.isArray(currentQuestionObj.hiddenTestCases)) {
      currentQuestionObj.hiddenTestCases.forEach((tc: any, idx: number) => {
        tempCases.push({
          id: `hidden-${idx}`,
          input: tc.input,
          expected: tc.expected,
          status: "idle",
          isHidden: true
        });
      });
    }

    if (tempCases.length === 0) {
      tempCases.push(
        { id: "visible-0", input: "5\n2,3", expected: "true", status: "idle", isHidden: false },
        { id: "visible-1", input: "10\n1,2", expected: "false", status: "idle", isHidden: false },
        { id: "hidden-0", input: "8\n4,4", expected: "true", status: "idle", isHidden: true }
      );
    }

    setTestCases(tempCases);
    const firstVisible = tempCases.find(tc => !tc.isHidden);
    if (firstVisible) {
      setActiveTestCaseId(firstVisible.id);
    } else {
      setActiveTestCaseId(tempCases[0].id);
    }
  }, [currentQuestionIndex, currentQuestionObj, language]);



  // Handle complexity analysis query
  const handleAnalyzeComplexity = async () => {
    setIsAnalyzingComplexity(true);
    try {
      const response = await fetch("/api/assessments/analyze-complexity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language })
      });
      if (response.ok) {
        const data = await response.json();
        setComplexityAnalysis(data);
      }
    } catch (e) {
      console.error("Complexity analysis failed:", e);
    } finally {
      setIsAnalyzingComplexity(false);
    }
  };

  // Handle single run code against selected testcase
  const handleRunCode = async () => {
    const activeCase = testCases.find(tc => tc.id === activeTestCaseId);
    if (!activeCase) {
      toast.error("Please select a test case to run.");
      return;
    }
    setIsExecuting(true);
    setBottomTab("console");
    setTerminalOutput("Compiling and executing code against test case...\n");

    try {
      const response = await fetch("/api/assessments/execute-raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          stdin: activeCase.input,
          expected: activeCase.expected
        })
      });
      
      if (!response.ok) {
        throw new Error("Execution failed on compiler server");
      }

      const responseData = await response.json();
      const runData = responseData.run;
      const compileData = responseData.compile;

      if (compileData && compileData.code === 503) {
        setTerminalOutput(`Environment Error:\n${compileData.stderr || compileData.output}`);
        toast.error("Execution environment is temporarily unavailable on this server.");
      } else if (compileData && compileData.code !== 0) {
        setTerminalOutput(`Compilation Error:\n${compileData.stderr || compileData.output}`);
        toast.error("Compilation failed.");
      } else if (runData) {
        const out = runData.stdout || "";
        const err = runData.stderr || "";
        const exitMsg = runData.code !== 0 ? `\nProcess exited with status ${runData.code}` : "";
        const statsMsg = `\n\n-----------------------------------\nRuntime: ${runData.time ? (parseFloat(runData.time) * 1000).toFixed(0) : "15"} ms | Memory: 4096 KB\nExit Code: ${runData.code}`;
        setTerminalOutput(out + (err ? `\nErrors:\n${err}` : "") + exitMsg + statsMsg);
        
        setTestCases(prev => prev.map(tc => {
          if (tc.id === activeTestCaseId) {
            const actualOut = out.trim();
            const comp = compareOutputs(actualOut, tc.expected);
            return {
              ...tc,
              actual: actualOut,
              status: comp.result ? "pass" : "fail",
              runtime: runData.time || "N/A",
              diagnostics: comp
            };
          }
          return tc;
        }));
        toast.success("Run completed.");
      }
    } catch (err: any) {
      setTerminalOutput(`Error: ${err.message || "Failed to execute"}`);
      toast.error("Execution failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  // Run all test cases for Automated Evaluation
  const evaluateSolution = async () => {
    if (testCases.length === 0) return;
    setIsEvaluating(true);
    setBottomTab("evaluation");
    setHasRunEvaluation(false);
    setAnyCompileError(false);
    
    setTestCases(prev => prev.map(tc => ({ ...tc, status: "running" })));
    let passCount = 0;
    let compiled = true;
    const evaluatedCases = [...testCases];

    for (let i = 0; i < evaluatedCases.length; i++) {
      const tc = evaluatedCases[i];
      try {
        const response = await fetch("/api/assessments/execute-raw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            code,
            stdin: tc.input,
            expected: tc.expected
          })
        });
        
        if (!response.ok) {
          throw new Error("Evaluation run failed");
        }

        const responseData = await response.json();
        const runData = responseData.run;
        const compileData = responseData.compile;

        if (compileData && compileData.code !== 0) {
          tc.status = "fail";
          tc.error = compileData.stderr || compileData.output;
          compiled = false;
        } else if (runData) {
          const actualOut = (runData.stdout || "").trim();
          const comp = compareOutputs(actualOut, tc.expected);
          if (comp.result) passCount++;
          
          tc.actual = actualOut;
          tc.status = comp.result ? "pass" : "fail";
          tc.runtime = runData.time || "N/A";
          tc.diagnostics = comp;
        }
      } catch (err: any) {
        tc.status = "fail";
        tc.error = err.message || "Failed";
      }
    }

    setTestCases(evaluatedCases);
    setAnyCompileError(!compiled);
    setHasRunEvaluation(true);
    setIsEvaluating(false);

    // Automatically trigger complexity analysis
    await handleAnalyzeComplexity();
    toast.success(`Evaluation complete. Passed ${passCount}/${testCases.length} cases.`);
  };

  // Final submission of validated code
  const submitFinalSolution = async () => {
    setIsEvaluating(true);
    
    const structuredResponse = `### Workspace: Coding IDE

**Language**: ${language}

#### Code:
\`\`\`${language}
${code}
\`\`\`

#### Complexity Analysis:
- Time Complexity: ${complexityAnalysis?.timeComplexity || "O(N)"}
- Space Complexity: ${complexityAnalysis?.spaceComplexity || "O(1)"}
- Detected Algorithm: ${complexityAnalysis?.detectedAlgorithm || "Scanning Loop"}
- Comments: ${candidateResponseText || "No additional trade-offs commented."}
`;
    
    submitCandidateAnswer(structuredResponse);
    generateAICodeReview();
    setIsSubmitted(true);
    setIsEvaluating(false);
    toast.success("Solution submitted successfully!");
  };

  // Stream AI Code Review from route
  const generateAICodeReview = async () => {
    setAiCodeReview("");
    try {
      const response = await fetch("/api/ai/code-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code, 
          language, 
          problemStatement: currentQuestionObj || { question: currentQuestionText } 
        })
      });

      if (!response.ok) throw new Error("Failed to generate AI code review");

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
              setAiCodeReview(prev => prev + text);
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      toast.error("Failed to stream AI Code Review.");
    }
  };

  // Add custom testcase
  const addTestCase = () => {
    const newId = `custom-${Date.now()}`;
    const newCase: TestCase = {
      id: newId,
      input: "custom_input",
      expected: "expected_output",
      status: "idle",
      isHidden: false
    };
    setTestCases(prev => [...prev, newCase]);
    setActiveTestCaseId(newId);
  };

  const isLastQuestion = currentQuestionIndex === 2;

  // ---------------------------------------------------------------------------
  // LAYOUT SUB-COMPONENTS (Left, Center, Right, Bottom Panes)
  // ---------------------------------------------------------------------------
  
  // Left: Problem statement
  const leftPane = (
    <div className="p-4.5 space-y-5 bg-zinc-900/10">
      <div className="space-y-2 border-b border-zinc-850 pb-4 select-none">
        <span className="text-[8px] font-black text-primary uppercase tracking-widest block">
          Active Assessment Task
        </span>
        <h3 className="text-base font-black text-white leading-snug tracking-tight">
          {currentQuestionObj?.title || `Algorithm Challenge #${currentQuestionIndex + 1}`}
        </h3>
        <div className="flex gap-2.5 mt-2">
          <span className={cn(
            "text-[8px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider",
            currentQuestionObj?.difficulty === "Hard" ? "bg-red-500/10 text-red-400 border-red-500/25" :
            currentQuestionObj?.difficulty === "Easy" ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/25" :
            "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"
          )}>
            {currentQuestionObj?.difficulty || "Medium"}
          </span>
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400">
            TIME LIMIT: 2000ms
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 select-none font-mono">
          <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
          Problem Description
        </h4>
        <div className="text-xs text-zinc-350 leading-relaxed font-sans whitespace-pre-wrap font-medium">
          {currentQuestionObj?.question || currentQuestionText}
        </div>
      </div>

      {currentQuestionObj?.inputFormat && (
        <div className="grid grid-cols-1 gap-4 border-t border-b border-zinc-850 py-4">
          <div className="space-y-1">
            <h5 className="text-[9px] font-bold text-zinc-555 uppercase tracking-wider select-none">Input Format</h5>
            <p className="text-[10px] text-zinc-400 leading-relaxed">{currentQuestionObj.inputFormat}</p>
          </div>
          <div className="space-y-1">
            <h5 className="text-[9px] font-bold text-zinc-555 uppercase tracking-wider select-none">Output Format</h5>
            <p className="text-[10px] text-zinc-400 leading-relaxed">{currentQuestionObj.outputFormat}</p>
          </div>
        </div>
      )}

      {currentQuestionObj?.examples && currentQuestionObj.examples.length > 0 && (
        <div className="space-y-3.5">
          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 select-none font-mono">
            Examples & Explainers
          </h4>
          <div className="space-y-3">
            {currentQuestionObj.examples.map((ex: any, idx: number) => (
              <div key={idx} className="bg-zinc-900/50 border border-zinc-850 rounded-xl p-3 space-y-2 font-mono text-[10px]">
                <div className="text-zinc-500 font-bold border-b border-zinc-900 pb-1 flex justify-between select-none">
                  <span>EXAMPLE #{idx + 1}</span>
                </div>
                <div className="space-y-1 leading-normal">
                  <div>
                    <span className="text-zinc-555 font-bold uppercase select-none">Input: </span>
                    <span className="text-zinc-300 whitespace-pre-wrap">{ex.input}</span>
                  </div>
                  <div>
                    <span className="text-zinc-555 font-bold uppercase select-none">Output: </span>
                    <span className="text-emerald-450">{ex.output}</span>
                  </div>
                  {ex.explanation && (
                    <div className="text-zinc-400 mt-1 border-t border-zinc-900 pt-1 leading-relaxed">
                      <span className="text-zinc-555 font-bold uppercase select-none">Explain: </span>
                      <span className="font-sans italic">{ex.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentQuestionObj?.constraints && currentQuestionObj.constraints.length > 0 && (
        <div className="space-y-2 border-t border-zinc-850 pt-4">
          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 select-none font-mono">
            Constraints & Limits
          </h4>
          <ul className="space-y-1 font-mono text-[10px] text-zinc-500 list-disc pl-4 leading-relaxed">
            {currentQuestionObj.constraints.map((c: string, idx: number) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-2 border-t border-zinc-900">
        <VoiceDebugPanel diagnostics={diagnostics} />
      </div>
    </div>
  );

  // Center: Monaco Code Editor Panel
  const centerPane = (
    <div className="flex flex-col h-full w-full bg-zinc-950">
      {/* Editor Toolbar */}
      <div className="h-10 bg-zinc-900 border-b border-zinc-855 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            Coding Arena IDE
          </span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-zinc-950 border border-zinc-850 rounded text-[10px] font-bold text-zinc-350 px-2 py-1 outline-none focus:border-primary/50 cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-zinc-800 rounded bg-zinc-950 px-1 py-0.5 gap-1.5 select-none">
            <span className="text-[8px] text-zinc-550 font-mono">Font:</span>
            <button onClick={() => setFontSize(prev => Math.max(10, prev - 1))} className="text-[10px] text-zinc-400 px-1 hover:bg-zinc-850 rounded font-bold">-</button>
            <span className="text-[9px] font-mono font-bold text-zinc-300">{fontSize}px</span>
            <button onClick={() => setFontSize(prev => Math.min(22, prev + 1))} className="text-[10px] text-zinc-400 px-1 hover:bg-zinc-850 rounded font-bold">+</button>
          </div>
          <Button
            onClick={() => setAssistantMode(prev => prev === "closed" ? "docked" : "closed")}
            className="h-7 text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-350 hover:bg-zinc-850 font-bold uppercase tracking-wider px-3 rounded-lg flex items-center gap-1.5"
          >
            <MessageSquare className="w-3 h-3 text-primary" />
            {assistantMode !== "closed" ? "Close Assistant" : "Ask Assistant"}
          </Button>
        </div>
      </div>

      {/* Embedded Monaco CodeEditor */}
      <div className="flex-grow min-h-0 relative">
        <CodeEditor
          language={language}
          value={code}
          onChange={(val) => setCode(val || "")}
          fontSize={fontSize}
          minimap={false}
          onSelectionChange={setSelectedCode}
        />
        

      </div>
    </div>
  );

  // Bottom: Tabbed Console
  const bottomPane = (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="h-10 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center justify-between shrink-0 select-none">
        <Tabs value={bottomTab} onValueChange={(v: any) => setBottomTab(v)} className="w-full">
          <TabsList className="bg-transparent border-0 h-9 p-0 flex gap-4">
            <TabsTrigger value="testcases" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
              Test Cases
            </TabsTrigger>
            <TabsTrigger value="console" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
              Run Console
            </TabsTrigger>
            <TabsTrigger value="complexity" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
              Complexity Analysis
            </TabsTrigger>
            {hasRunEvaluation && (
              <TabsTrigger value="evaluation" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
                Evaluation Results
              </TabsTrigger>
            )}
            {isSubmitted && (
              <TabsTrigger value="aifeedback" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-[10px] font-bold uppercase rounded-none tracking-wider px-1">
                AI Code Review
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-1.5 shrink-0 select-none">
          <Button
            onClick={handleRunCode}
            disabled={isExecuting || isEvaluating || !code.trim() || isSubmitted}
            className="h-7 text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-350 hover:bg-zinc-850 font-bold uppercase tracking-wider px-3 rounded-lg flex items-center gap-1"
          >
            {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-2.5 h-2.5 text-emerald-500" />}
            Run Code
          </Button>

          {!isSubmitted ? (
            <>
              <Button
                onClick={evaluateSolution}
                disabled={isEvaluating || isExecuting || !code.trim()}
                className="h-7 text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-350 hover:bg-zinc-850 font-bold uppercase tracking-wider px-3 rounded-lg flex items-center gap-1"
              >
                {isEvaluating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5 text-primary" />}
                Run Test Cases
              </Button>
              
              <Button
                onClick={submitFinalSolution}
                disabled={!hasRunEvaluation || anyCompileError || isEvaluating || isExecuting}
                className={cn(
                  "h-7 text-[9px] font-bold uppercase tracking-wider px-3 rounded-lg transition-all",
                  (!hasRunEvaluation || anyCompileError) 
                    ? "bg-primary/20 text-zinc-550 border border-transparent cursor-not-allowed" 
                    : "bg-primary hover:bg-primary/95 text-white"
                )}
              >
                Submit Solution
              </Button>
            </>
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

      {/* Console Panels content */}
      <div className="flex-grow min-h-0 p-4 overflow-y-auto custom-scrollbar bg-zinc-950">
        {bottomTab === "testcases" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {testCases.filter(tc => !tc.isHidden).map((tc, idx) => (
                  <button
                    key={tc.id}
                    onClick={() => setActiveTestCaseId(tc.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center gap-2",
                      activeTestCaseId === tc.id
                        ? "bg-zinc-900 border-zinc-700 text-white"
                        : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    <span>Case {idx + 1}</span>
                    {tc.status === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {tc.status === "fail" && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                ))}
              </div>
              <button
                onClick={addTestCase}
                disabled={isSubmitted}
                className="text-[9px] font-bold text-primary hover:text-primary-hover flex items-center gap-1 uppercase tracking-widest bg-zinc-900/60 border border-zinc-850 hover:border-zinc-800 px-2.5 py-1 rounded-lg disabled:opacity-50"
              >
                Add Case
              </button>
            </div>

            {testCases.map((tc) => {
              if (tc.id !== activeTestCaseId) return null;
              return (
                <div key={tc.id} className="space-y-3 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-555 uppercase tracking-widest">Standard Stdin Input</label>
                    <textarea
                      value={tc.input}
                      disabled={isSubmitted}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTestCases(prev => prev.map(item => item.id === tc.id ? { ...item, input: val } : item));
                      }}
                      className="w-full bg-zinc-950 border border-zinc-855 rounded-xl p-3 text-xs text-zinc-400 font-mono h-18 resize-none focus:border-zinc-700 outline-none disabled:opacity-80"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-555 uppercase tracking-widest">Expected Stdout Output</label>
                    <input
                      type="text"
                      value={tc.expected}
                      disabled={isSubmitted}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTestCases(prev => prev.map(item => item.id === tc.id ? { ...item, expected: val } : item));
                      }}
                      className="w-full bg-zinc-950 border border-zinc-855 rounded-xl p-3 text-xs text-zinc-400 font-mono focus:border-zinc-700 outline-none disabled:opacity-80"
                    />
                  </div>
                  {(tc.actual !== undefined || tc.error !== undefined) && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-zinc-555 uppercase tracking-widest">
                        {tc.error ? "Execution Error / Stderr" : "Actual Output"}
                      </label>
                      <div className={cn(
                        "p-3 rounded-xl border font-mono text-xs select-text whitespace-pre-wrap",
                        tc.status === "pass" ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-450" : "bg-red-500/5 border-red-500/10 text-red-450"
                      )}>
                        {tc.error || tc.actual || "[Empty Output]"}
                      </div>
                    </div>
                  )}

                  {tc.diagnostics && (
                    <div className="p-3.5 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-2 select-text font-mono text-zinc-400">
                      <div className="font-bold text-zinc-450 border-b border-zinc-800 pb-1.5 flex items-center gap-1.5 uppercase text-[9px] tracking-wider">
                        <Info className="w-3.5 h-3.5 text-primary" />
                        Comparison Diagnostics
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                        <div>
                          <span className="text-[8px] text-zinc-550 uppercase block font-semibold">Expected Type</span>
                          <span className="text-zinc-350">{tc.diagnostics.expectedType}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-550 uppercase block font-semibold">Actual Type</span>
                          <span className="text-zinc-350">{tc.diagnostics.actualType}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[8px] text-zinc-550 uppercase block font-semibold">Expected Parsed</span>
                          <span className="text-zinc-350 whitespace-pre-wrap">{tc.diagnostics.expectedParsed}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[8px] text-zinc-550 uppercase block font-semibold">Actual Parsed</span>
                          <span className="text-zinc-350 whitespace-pre-wrap">{tc.diagnostics.actualParsed}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {bottomTab === "console" && (
          <div data-testid="terminal-output" className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 font-mono text-xs text-zinc-400 select-text h-full overflow-y-auto whitespace-pre-wrap">
            {terminalOutput || "No compilation output. Write code and press Run Code."}
          </div>
        )}

        {bottomTab === "complexity" && (
          <div className="space-y-4 h-full flex flex-col overflow-y-auto custom-scrollbar pr-1">
            <div className="flex flex-col sm:flex-row gap-3 select-none">
              <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-1.5 shadow-sm">
                <span className="text-[9px] font-bold text-zinc-450 uppercase tracking-wider">Estimated Time</span>
                <span className="text-lg font-bold font-mono text-primary">{complexityAnalysis?.timeComplexity || (isAnalyzingComplexity ? "Evaluating..." : "O(N)")}</span>
              </div>
              <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-1.5 shadow-sm">
                <span className="text-[9px] font-bold text-zinc-450 uppercase tracking-wider">Estimated Space</span>
                <span className="text-lg font-bold font-mono text-emerald-450">{complexityAnalysis?.spaceComplexity || (isAnalyzingComplexity ? "Evaluating..." : "O(1)")}</span>
              </div>
              <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-1.5 shadow-sm">
                <span className="text-[9px] font-bold text-zinc-450 uppercase tracking-wider">Algorithm Class</span>
                <span className="text-xs font-bold font-sans text-zinc-300 truncate">{complexityAnalysis?.detectedAlgorithm || (isAnalyzingComplexity ? "Analyzing..." : "Linear Scan")}</span>
              </div>
            </div>
            
            {complexityAnalysis && (
              <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 space-y-3 text-xs animate-fade-in">
                <div className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                  <span>Big-O Complexity & Trade-offs</span>
                </div>
                <p className="text-zinc-400 leading-relaxed font-sans">{complexityAnalysis.suggestions}</p>
                <div className="text-zinc-450 leading-relaxed font-sans bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl flex gap-2">
                  <span className="font-extrabold text-emerald-400 uppercase text-[9px] tracking-wider shrink-0 mt-0.5">Tip:</span>
                  <span>{complexityAnalysis.optimizationTips}</span>
                </div>
                {complexityAnalysis.possibleBetterSolution && complexityAnalysis.possibleBetterSolution !== "None" && (
                  <div className="text-zinc-450 leading-relaxed font-sans bg-primary/5 border border-primary/10 p-3 rounded-xl flex gap-2">
                    <span className="font-extrabold text-primary-400 uppercase text-[9px] tracking-wider shrink-0 mt-0.5">Optimal:</span>
                    <span>{complexityAnalysis.possibleBetterSolution}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5 flex-grow flex flex-col min-h-[100px]">
              <label className="text-[9px] font-bold text-zinc-555 uppercase tracking-widest">Candidate Explanation Notes</label>
              <textarea
                value={candidateResponseText}
                disabled={isSubmitted}
                onChange={(e) => setCandidateResponseText(e.target.value)}
                placeholder="Explain your algorithmic trade-offs (e.g. why you chose a Hash Table over sorting)..."
                className="w-full flex-grow bg-zinc-950 border border-zinc-855 rounded-xl p-3.5 text-xs text-zinc-400 font-mono focus:border-zinc-700 outline-none resize-none disabled:opacity-80"
              />
            </div>
          </div>
        )}

        {bottomTab === "evaluation" && (
          <div className="space-y-3 animate-fade-in">
            <span className="text-[9px] font-bold text-zinc-555 uppercase tracking-widest block">Automated Test Execution Summary</span>
            <div className="border border-zinc-850 rounded-xl overflow-hidden bg-zinc-950 font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-zinc-900 border-b border-zinc-850 text-zinc-500 text-[10px] uppercase tracking-wider select-none">
                  <tr>
                    <th className="p-3">Test Case</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Expected Output</th>
                    <th className="p-3">Actual Output</th>
                    <th className="p-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {testCases.map((tc, idx) => (
                    <tr key={tc.id}>
                      <td className="p-3 font-semibold text-zinc-350 select-none font-sans">
                        Case {idx + 1}
                      </td>
                      <td className="p-3">
                        <span className={cn(
                          "text-[8px] font-extrabold px-1.5 py-0.5 rounded border uppercase",
                          tc.isHidden ? "bg-red-500/10 text-red-450 border-red-500/10" : "bg-emerald-500/10 text-emerald-450 border-emerald-500/10"
                        )}>
                          {tc.isHidden ? "Hidden" : "Visible"}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-500 truncate max-w-[120px]">{tc.expected}</td>
                      <td className="p-3 text-zinc-500 truncate max-w-[120px]">{tc.actual || tc.error || "—"}</td>
                      <td className="p-3">
                        {tc.status === "running" ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : tc.status === "pass" ? (
                          <span className="text-emerald-450 font-bold font-sans">PASS</span>
                        ) : tc.status === "fail" ? (
                          <span className="text-red-450 font-bold font-sans">FAIL</span>
                        ) : (
                          <span className="text-zinc-650 font-sans">UNRUN</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {bottomTab === "aifeedback" && (
          <div className="space-y-4">
            <span className="text-[9px] font-bold text-zinc-555 uppercase tracking-widest block">AI Code Review Feedback</span>
            <div className="bg-zinc-900/50 border border-zinc-850 rounded-xl p-4 font-sans text-xs text-zinc-300 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar select-text">
              {aiCodeReview ? (
                <div className="prose prose-invert prose-xs whitespace-pre-wrap">
                  <ReactMarkdown>{aiCodeReview}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-primary animate-pulse py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">AI is generating code review feedback...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render Assistant Prop handler
  const renderAssistant = (mode: "docked") => {
    const derivedAssistantMode = 
      roundName === "Behavioral" || roundName === "HR Round"
        ? "behavioral_practice"
        : roundName === "System Design"
        ? "system_design_practice"
        : roundName === "Technical"
        ? "technical_practice"
        : "coding_practice";

    return (
      <AIAssistantPanel
        isOpen={true}
        onClose={() => setAssistantMode("closed")}
        mode="docked"
        onModeChange={setAssistantMode}
        code={code}
        language={language}
        problemStatement={currentQuestionObj || { question: currentQuestionText }}
        compilerOutput={terminalOutput}
        testCases={testCases}
        selectedCode={selectedCode}
        assistantMode={derivedAssistantMode}
        role="candidate"
        sessionType="practice"
        difficulty={currentQuestionObj?.difficulty || "Medium"}
      />
    );
  };

  return (
    <WorkspaceLayoutManager
      leftPane={leftPane}
      editorPane={centerPane}
      consolePane={bottomPane}
      assistantMode={assistantMode}
      setAssistantMode={setAssistantMode}
      renderAssistant={renderAssistant}
    />
  );
}
