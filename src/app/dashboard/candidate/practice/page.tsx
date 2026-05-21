"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeEditor } from "@/components/interview/code-editor";
import { executeCode, ExecutionResult } from "@/services/piston";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";
import { AIReviewModal } from "@/components/interview/ai-review-modal";
import { 
  Play, 
  Terminal, 
  FileCode2, 
  Sparkles, 
  BookOpen, 
  Code2, 
  ChevronRight, 
  Lightbulb, 
  AlertCircle, 
  Copy, 
  Check, 
  Loader2 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

interface CuratedProblem {
  id: string;
  title: string;
  difficulty: string;
  category: string;
  description: string;
  examples: ProblemExample[];
  constraints: string[];
  starterCode: Record<string, string>;
}

// Highly curated starter problems matching premium interview scenarios
const PROBLEMS: CuratedProblem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have *exactly* one solution, and you may not use the *same* element twice.

You can return the answer in any order.`,
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "Because nums[1] + nums[2] == 6, we return [1, 2]."
      }
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists."
    ],
    starterCode: {
      javascript: `// JavaScript Starter Template
function twoSum(nums, target) {
  // Write your code here
  
}`,
      typescript: `// TypeScript Starter Template
function twoSum(nums: number[], target: number): number[] {
  // Write your code here
  return [];
}`,
      python: `# Python Starter Template
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Write your code here
        pass`,
      java: `// Java Starter Template
import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your code here
        return new int[0];
    }
}`,
      cpp: `// C++ Starter Template
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your code here
        return {};
    }
};`,
      c: `// C Starter Template
#include <stdio.h>
#include <stdlib.h>

int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    // Write your code here
    *returnSize = 0;
    return NULL;
}`,
      go: `// Go Starter Template
package main

func twoSum(nums []int, target int) []int {
    // Write your code here
    return []int{}
}`
    }
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Stacks",
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      {
        input: "s = \"()\"",
        output: "true",
      },
      {
        input: "s = \"()[]{}\"",
        output: "true",
      },
      {
        input: "s = \"(]\"",
        output: "false",
      }
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'."
    ],
    starterCode: {
      javascript: `// JavaScript Starter Template
function isValid(s) {
  // Write your code here
  
}`,
      typescript: `// TypeScript Starter Template
function isValid(s: string): boolean {
  // Write your code here
  return false;
}`,
      python: `# Python Starter Template
class Solution:
    def isValid(self, s: str) -> bool:
        # Write your code here
        pass`,
      java: `// Java Starter Template
class Solution {
    public boolean isValid(String s) {
        // Write your code here
        return false;
    }
}`,
      cpp: `// C++ Starter Template
#include <string>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Write your code here
        return false;
    }
};`,
      c: `// C Starter Template
#include <stdbool.h>

bool isValid(char* s) {
    // Write your code here
    return false;
}`,
      go: `// Go Starter Template
package main

func isValid(s string) bool {
    // Write your code here
    return false;
}`
    }
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating",
    difficulty: "Medium",
    category: "Sliding Window",
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.`,
    examples: [
      {
        input: "s = \"abcabcbb\"",
        output: "3",
        explanation: "The answer is \"abc\", with the length of 3."
      },
      {
        input: "s = \"bbbbb\"",
        output: "1",
        explanation: "The answer is \"b\", with the length of 1."
      }
    ],
    constraints: [
      "0 <= s.length <= 5 * 10^4",
      "s consists of English letters, digits, symbols and spaces."
    ],
    starterCode: {
      javascript: `// JavaScript Starter Template
function lengthOfLongestSubstring(s) {
  // Write your code here
  
}`,
      typescript: `// TypeScript Starter Template
function lengthOfLongestSubstring(s: string): number {
  // Write your code here
  return 0;
}`,
      python: `# Python Starter Template
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        # Write your code here
        pass`,
      java: `// Java Starter Template
class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Write your code here
        return 0;
    }
}`,
      cpp: `// C++ Starter Template
#include <string>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        // Write your code here
        return 0;
    }
};`,
      c: `// C Starter Template
int lengthOfLongestSubstring(char* s) {
    // Write your code here
    return 0;
}`,
      go: `// Go Starter Template
package main

func lengthOfLongestSubstring(s string) int {
    // Write your code here
    return 0;
}`
    }
  }
];

export default function PracticePlayground() {
  const [selectedProblem, setSelectedProblem] = useState(PROBLEMS[0]);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Synchronize starter code when problem or language changes
  useEffect(() => {
    const templates = selectedProblem.starterCode as any;
    setCode(templates[language] || templates["javascript"] || "");
    setOutput(null);
  }, [selectedProblem, language]);

  const handleRunCode = async () => {
    if (!code.trim()) return;
    setIsExecuting(true);
    setOutput(null);

    try {
      const result = await executeCode(language, code);
      const executionData = result.run || result.compile;
      if (executionData) {
        setOutput(executionData);
        toast.success("Execution completed successfully.");
      } else {
        throw new Error("No compilation or run outputs received.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to execute code.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyOutput = () => {
    if (output) {
      navigator.clipboard.writeText(output.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Output copied to clipboard");
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] w-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent flex items-center gap-2">
            <Code2 className="w-8 h-8 text-primary" />
            AI Coding Playground
          </h1>
          <p className="text-muted-foreground mt-1">
            Accelerate your learning. Solve curated algorithmic rounds and trigger instant Gemini reviews.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden shadow-2xl">
        <ResizablePanelGroup orientation="horizontal">
          {/* Left panel - Selection & Description */}
          <ResizablePanel defaultSize={35} minSize={25} className="bg-zinc-900/20 backdrop-blur-sm border-r border-zinc-850">
            <Tabs defaultValue="problems" className="h-full flex flex-col">
              <div className="h-12 shrink-0 bg-zinc-900/60 border-b border-zinc-850 px-4 flex items-center">
                <TabsList className="bg-zinc-950/60 w-full grid grid-cols-2">
                  <TabsTrigger value="problems" className="data-[state=active]:bg-zinc-800 flex items-center gap-1.5 text-xs">
                    <BookOpen className="w-3.5 h-3.5" />
                    Problem Catalog
                  </TabsTrigger>
                  <TabsTrigger value="desc" className="data-[state=active]:bg-zinc-800 flex items-center gap-1.5 text-xs">
                    <FileCode2 className="w-3.5 h-3.5" />
                    Focus View
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 min-h-0 relative overflow-y-auto custom-scrollbar">
                {/* Problems Catalog Tab */}
                <TabsContent value="problems" className="h-full m-0 p-4 space-y-3 data-[state=inactive]:hidden">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">Practice Questions</p>
                  {PROBLEMS.map((prob) => (
                    <div 
                      key={prob.id}
                      onClick={() => setSelectedProblem(prob)}
                      className={cn(
                        "p-4.5 rounded-lg border cursor-pointer transition-all duration-200 flex justify-between items-center group",
                        selectedProblem.id === prob.id 
                          ? "bg-primary/5 border-primary/45" 
                          : "bg-zinc-900/40 border-zinc-850 hover:border-zinc-800 hover:bg-zinc-900/70"
                      )}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-bold text-sm truncate",
                            selectedProblem.id === prob.id ? "text-primary" : "text-zinc-200 group-hover:text-white"
                          )}>
                            {prob.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            "text-[10px] font-black uppercase px-1.5 py-0.5",
                            prob.difficulty === "Easy" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            prob.difficulty === "Medium" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                            prob.difficulty === "Hard" && "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {prob.difficulty}
                          </Badge>
                          <span className="text-[10px] text-zinc-500">{prob.category}</span>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 transition-transform duration-300",
                        selectedProblem.id === prob.id ? "text-primary translate-x-0.5" : "text-zinc-600 group-hover:text-zinc-400"
                      )} />
                    </div>
                  ))}
                </TabsContent>

                {/* Focus description Tab */}
                <TabsContent value="desc" className="h-full m-0 p-6 space-y-6 data-[state=inactive]:hidden">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5",
                        selectedProblem.difficulty === "Easy" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        selectedProblem.difficulty === "Medium" && "bg-amber-500/10 text-amber-400 border-emerald-500/20",
                        selectedProblem.difficulty === "Hard" && "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        {selectedProblem.difficulty}
                      </Badge>
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{selectedProblem.category}</span>
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight">{selectedProblem.title}</h2>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedProblem.description}
                    </p>
                  </div>

                  {/* Examples */}
                  <div className="space-y-4 pt-4 border-t border-zinc-850">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      Examples
                    </h4>
                    <div className="space-y-3.5">
                      {selectedProblem.examples.map((example, idx) => (
                        <div key={idx} className="p-3 bg-zinc-950/40 rounded border border-zinc-850 space-y-1.5">
                          <p className="text-xs font-bold text-zinc-400">Example {idx + 1}:</p>
                          <div className="font-mono text-xs text-zinc-300 space-y-1 pl-1">
                            <p><span className="text-zinc-500 font-semibold">Input:</span> {example.input}</p>
                            <p><span className="text-zinc-500 font-semibold">Output:</span> {example.output}</p>
                            {example.explanation && (
                              <p className="italic text-zinc-450 mt-1 pl-1 border-l border-zinc-800"><span className="text-zinc-500 font-semibold not-italic">Explanation:</span> {example.explanation}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Constraints */}
                  <div className="space-y-3 pt-4 border-t border-zinc-850">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-primary" />
                      Constraints
                    </h4>
                    <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1 pl-1 font-mono">
                      {selectedProblem.constraints.map((constraint, idx) => (
                        <li key={idx}>{constraint}</li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-zinc-800 hover:bg-primary/50 transition-colors z-10" />

          {/* Right panel - Code Editor & Console */}
          <ResizablePanel defaultSize={65} minSize={35} className="flex flex-col">
            {/* Editor Controls */}
            <div className="h-12 shrink-0 bg-zinc-900/60 border-b border-zinc-850 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-zinc-800 text-xs text-zinc-200 border border-zinc-700 rounded-md px-2 py-1 outline-none focus:border-primary transition"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsReviewOpen(true)}
                  disabled={!code.trim() || isExecuting}
                  className="flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 h-8.5 rounded-md text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Code Review
                </button>

                <button 
                  onClick={handleRunCode}
                  disabled={isExecuting}
                  className="flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 h-8.5 rounded-md text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  Run Sandbox
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 relative">
              <ResizablePanelGroup orientation="vertical">
                {/* Monaco Editor Pane */}
                <ResizablePanel defaultSize={70} minSize={30}>
                  <CodeEditor 
                    language={language}
                    value={code}
                    onChange={(val) => setCode(val || "")}
                  />
                </ResizablePanel>

                <ResizableHandle className="h-1 bg-zinc-800 hover:bg-primary/50 transition-colors" />

                {/* Console Pane */}
                <ResizablePanel defaultSize={30} minSize={15} className="flex flex-col bg-zinc-900/60">
                  <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-zinc-850 bg-zinc-900">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5" />
                      Interactive Terminal Output
                    </span>
                    {output && (
                      <button onClick={handleCopyOutput} className="text-zinc-500 hover:text-white transition">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto p-4.5 font-mono text-xs leading-relaxed">
                    {isExecuting ? (
                      <div className="flex items-center gap-2 text-zinc-500 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        Executing compiler and test cases...
                      </div>
                    ) : output ? (
                      <div className="flex flex-col gap-2">
                        {output.stderr && <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>}
                        {output.stdout && <pre className="text-zinc-300 whitespace-pre-wrap">{output.stdout}</pre>}
                        {!output.stderr && !output.stdout && <span className="text-zinc-650 italic">Compilation succeeded. Sandbox exited with 0.</span>}
                        
                        <div className="mt-4 pt-4 border-t border-zinc-800/60 flex gap-4 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                          <span>Status: <span className={output.code === 0 ? "text-green-500" : "text-red-500"}>{output.code === 0 ? "Success" : "Run Error"}</span></span>
                          <span>Duration: {output.time}ms</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-600 italic">Playground terminal active. Select problems in Focus View tab, type solutions, and click Run Sandbox.</div>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Shared Streaming AI Review Component */}
      <AIReviewModal 
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        code={code}
        language={language}
        problemStatement={selectedProblem}
      />
    </div>
  );
}