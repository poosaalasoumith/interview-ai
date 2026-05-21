import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const summarySchema = z.object({
  strengths: z.array(z.string()).describe("List of 3-5 technical or behavioral strengths"),
  weaknesses: z.array(z.string()).describe("List of 2-4 areas for improvement"),
  technicalScore: z.number().min(0).max(100).describe("Score out of 100 representing technical capability"),
  communicationScore: z.number().min(0).max(100).describe("Score out of 100 representing communication skills"),
  overallScore: z.number().min(0).max(100).describe("Weighted overall interview score"),
  recommendation: z.enum(["Strong Hire", "Hire", "Lean Hire", "No Hire", "Strong No Hire"]),
  summary: z.string().describe("A 2-3 paragraph detailed summary of the candidate's performance")
});

export async function POST(req: Request) {
  try {
    const { problemStatement, submissions, chatHistory } = await req.json();

    const result = await generateObject({
      model: google("models/gemini-2.5-flash"),
      schema: summarySchema,
      prompt: `You are a Principal Software Engineer evaluating a candidate after a technical interview.
Based on the problem statement, their code submissions (including outputs), and their chat interaction history, provide a structured, objective, and fair evaluation.

Problem Statement:
${JSON.stringify(problemStatement)}

Candidate Submissions:
${JSON.stringify(submissions)}

Chat/Hint History:
${JSON.stringify(chatHistory)}

Evaluate carefully and provide accurate, constructive feedback.`
    });

    return NextResponse.json(result.object);
  } catch (error: any) {
    console.error("AI Summary Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate summary" }, { status: 500 });
  }
}
