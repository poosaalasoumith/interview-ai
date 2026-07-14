import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

const complexitySchema = z.object({
  detectedAlgorithm: z.string().describe("Main algorithmic pattern or data structure detected (e.g. Binary Search, DFS, Hash Table)"),
  timeComplexity: z.string().describe("Big O time complexity notation (e.g. O(N), O(log N))"),
  spaceComplexity: z.string().describe("Big O space complexity notation (e.g. O(1), O(N))"),
  suggestions: z.string().describe("A concise summary suggestion of the code's complexity tradeoffs"),
  optimizationTips: z.string().describe("Constructive tip on how the algorithm or data structure can be optimized further"),
  possibleBetterSolution: z.string().describe("Better time/space complexity approach if possible, or 'None' if already optimal")
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { code, language } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Missing source code" }, { status: 400 });
    }

    // Default mock response if key is missing or we are running in local mock provider mode
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.AI_PROVIDER === "mock") {
      const lower = code.toLowerCase();
      const isLoop = code.includes("for") || code.includes("while");
      const isNested = (code.match(/for|while/g) || []).length > 1;
      const isRecursion = code.includes("solve(") || code.includes("helper(") || code.includes("recurse(") || code.includes("dfs(");
      
      let timeComp = "O(N)";
      let spaceComp = "O(1)";
      let detectedAlg = "Linear Scanning Loop";

      if (lower.includes("bubble") || (lower.includes("swap") && isNested)) {
        timeComp = "O(N^2)";
        spaceComp = "O(1)";
        detectedAlg = "Bubble Sort";
      } else if (lower.includes("merge") || (lower.includes("divide") && lower.includes("conquer"))) {
        timeComp = "O(N log N)";
        spaceComp = "O(N)";
        detectedAlg = "Merge Sort";
      } else if (lower.includes("binary") || (lower.includes("mid") && (lower.includes("low") || lower.includes("left")) && (lower.includes("high") || lower.includes("right")))) {
        timeComp = "O(log N)";
        spaceComp = "O(1)";
        detectedAlg = "Binary Search";
      } else if (lower.includes("dfs") || lower.includes("depth") || (lower.includes("visit") && isRecursion)) {
        timeComp = "O(V+E)";
        spaceComp = "O(V)";
        detectedAlg = "Depth-First Search (DFS)";
      } else if (code.includes("Map") || code.includes("dict") || code.includes("set") || code.includes("new Set") || code.includes("new Map")) {
        timeComp = "O(1)";
        spaceComp = "O(N)";
        detectedAlg = "HashMap Lookup";
      } else if (isNested) {
        timeComp = "O(N^2)";
        detectedAlg = "Nested Loops";
      } else if (isRecursion) {
        timeComp = "O(2^N)";
        detectedAlg = "Recursive Tree Search";
      } else if (!isLoop) {
        timeComp = "O(1)";
        detectedAlg = "Constant Time Operations";
      }

      return NextResponse.json({
        detectedAlgorithm: detectedAlg,
        timeComplexity: timeComp,
        spaceComplexity: spaceComp,
        suggestions: `The code executes successfully with standard ${detectedAlg} complexity characteristics.`,
        optimizationTips: timeComp === "O(N^2)" ? "Look to optimize the nested loops using a hash map or sorting preprocessing to achieve O(N) or O(N log N)." : "Code is optimal for the detected structure.",
        possibleBetterSolution: timeComp === "O(N^2)" ? "An optimal O(N) Hash Table approach can reduce nested loop traversals." : "None"
      });
    }

    const promptText = `Analyze the complexity of the following code snippet.
Language: ${language}
Source Code:
\`\`\`${language}
${code}
\`\`\`

Identify:
1. Loops, nested loops, recursive functions, data structures like HashMap/Set.
2. Time complexity (Big O).
3. Space complexity (Big O).
4. Algorithm suggestions, optimization tips, and if there is a possible better solution.`;

    const response = await generateObject({
      model: google("models/gemini-2.5-flash"),
      schema: complexitySchema,
      prompt: promptText
    });

    return NextResponse.json(response.object);

  } catch (error: any) {
    console.error("Complexity Analysis Error:", error);
    return NextResponse.json({
      detectedAlgorithm: "Unknown",
      timeComplexity: "O(N)",
      spaceComplexity: "O(N)",
      suggestions: "Could not complete static evaluation due to API error.",
      optimizationTips: "Review loop iterations.",
      possibleBetterSolution: "None"
    });
  }
}
