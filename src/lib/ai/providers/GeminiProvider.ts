import { google } from "@ai-sdk/google";
import { streamText, generateText, tool } from "ai";
import { z } from "zod";
import { AIProvider } from "./AIProvider";

export class GeminiProvider implements AIProvider {
  name = "Gemini";

  async streamChat(
    messages: any[],
    systemPrompt: string,
    context: any,
    options: {
      temperature?: number;
      topP?: number;
      maxTokens?: number;
      abortSignal?: AbortSignal;
    }
  ) {
    const callArgs: any = {
      model: google("models/gemini-2.5-flash"),
      system: systemPrompt,
      messages: messages,
      temperature: options.temperature,
      topP: options.topP,
      maxOutputTokens: options.maxTokens,
      abortSignal: options.abortSignal,
      tools: {
        getCurrentEditorCode: tool({
          description: "Get the candidate's current editor code buffer.",
          parameters: z.object({}),
          execute: async () => ({ code: context?.code || "" })
        } as any),
        getCompilerOutput: tool({
          description: "Get the terminal output from the candidate's compiler run.",
          parameters: z.object({}),
          execute: async () => ({ output: context?.compilerOutput || "" })
        } as any),
        getFailedTestCases: tool({
          description: "Get the test cases that currently fail.",
          parameters: z.object({}),
          execute: async () => {
            const failed = (context?.testCases || []).filter((tc: any) => tc.status === "fail");
            return { failedTestCases: failed };
          }
        } as any),
        getQuestionRubric: tool({
          description: "Get the current active problem description and evaluation rubric criteria.",
          parameters: z.object({}),
          execute: async () => ({
            title: context?.problemStatement?.title || "Theory",
            description: context?.problemStatement?.question || context?.problemStatement?.description || "",
            rubric: context?.problemStatement?.rubric || {}
          })
        } as any),
        getInterviewMetadata: tool({
          description: "Get metadata regarding the interview room: role, session type, difficulty, and time elapsed.",
          parameters: z.object({}),
          execute: async () => ({
            role: context?.role || "candidate",
            sessionType: context?.sessionType || "practice",
            difficulty: context?.difficulty || "Medium",
            elapsedTime: context?.elapsedTime || "00:00"
          })
        } as any)
      } as any
    };

    return await streamText(callArgs);
  }

  async checkHealth() {
    const start = Date.now();
    try {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY env var");
      }
      // Quick, tiny probe call
      await generateText({
        model: google("models/gemini-2.5-flash"),
        prompt: "ping"
      });
      return { status: "healthy" as const, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: "unhealthy" as const, latencyMs: Date.now() - start, error: err.message };
    }
  }
}
