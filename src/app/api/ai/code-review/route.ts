import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { code, language, problemStatement } = await req.json();

    const systemPrompt = `You are a strict but helpful Senior Software Engineer conducting a code review.
Review the candidate's code submission based on the provided problem statement.
Your review MUST be formatted in Markdown and include the following sections:
1. **Time Complexity**: Big-O notation and explanation.
2. **Space Complexity**: Big-O notation and explanation.
3. **Code Readability & Style**: Feedback on naming, structure, and clarity.
4. **Optimization Suggestions**: Actionable improvements.
5. **Best Practices**: Any security, language-specific, or architectural best practices.
6. **Overall Score**: Out of 100.

Keep responses professional, constructive, and concise.`;

    const result = await streamText({
      model: google("models/gemini-2.5-flash"),
      system: systemPrompt,
      prompt: `Problem Statement:
${problemStatement ? JSON.stringify(problemStatement) : "Unknown"}

Language: ${language}

Candidate Code:
\`\`\`${language}
${code}
\`\`\`

Please review the code.`
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("AI Code Review Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate review" }, { status: 500 });
  }
}
