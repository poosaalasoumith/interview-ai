import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const problemSchema = z.object({
  title: z.string().describe("The name of the problem (e.g., 'Two Sum', 'Design a URL Shortener')"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  description: z.string().describe("A comprehensive problem description formatted in Markdown. Should include background, core task, and expectations."),
  examples: z.array(z.object({
    input: z.string().describe("Input string/parameters"),
    output: z.string().describe("Expected output"),
    explanation: z.string().optional().describe("Optional explanation for why this output occurs")
  })),
  constraints: z.array(z.string()).describe("A list of constraints (e.g. '2 <= nums.length <= 10^4')"),
  hints: z.array(z.string()).describe("A list of 2-3 helpful hints that an interviewer could provide")
});

export async function POST(req: Request) {
  try {
    const { topic, difficulty, additionalContext } = await req.json();

    const result = await generateObject({
      model: google("models/gemini-2.5-flash"),
      schema: problemSchema,
      prompt: `You are an expert technical interviewer at a FAANG company. Generate a high-quality interview coding problem.
      
Topic: ${topic}
Target Difficulty: ${difficulty}
Additional Context: ${additionalContext || "None"}

Ensure the problem is unique but structurally similar to premium LeetCode or HackerRank questions. The description should be extremely clear and well-formatted. Do not provide the solution.`
    });

    return NextResponse.json(result.object);
  } catch (error: any) {
    console.error("AI Question Gen Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate question" }, { status: 500 });
  }
}
