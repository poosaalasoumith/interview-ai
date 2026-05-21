import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    const systemPrompt = `You are a helpful and technical AI assistant guiding a candidate through a coding interview.
You act as a supportive technical interviewer or copilot.
You have access to the candidate's current editor code and the problem statement.

Context:
- Problem Statement: ${context?.problemStatement ? JSON.stringify(context.problemStatement) : "Unknown"}
- Current Code: \`\`\`\n${context?.code || "Empty"}\n\`\`\`
- Current Language: ${context?.language || "Unknown"}

Guidelines:
1. Provide hints, NOT direct answers. Lead the candidate to the solution.
2. Explain concepts concisely (time/space complexity, language features).
3. If they have a syntax error or bug, point them in the right direction but let them fix it.
4. Keep your responses short and use Markdown.
5. Emphasize best practices.`;

    const result = await streamText({
      model: google("models/gemini-2.5-flash"),
      system: systemPrompt,
      messages: messages,
    });

    return result.toAIStreamResponse();
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    return NextResponse.json({ error: error.message || "Failed to chat" }, { status: 500 });
  }
}
