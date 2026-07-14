import { openai } from "@ai-sdk/openai";
import { streamText, generateText } from "ai";
import { AIProvider } from "./AIProvider";

export class OpenAIProvider implements AIProvider {
  name = "OpenAI";

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
    return await streamText({
      model: openai("gpt-4o-mini") as any,
      system: systemPrompt,
      messages: messages,
      temperature: options.temperature,
      topP: options.topP,
      maxTokens: options.maxTokens,
      abortSignal: options.abortSignal,
    } as any);
  }

  async checkHealth() {
    const start = Date.now();
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("Missing OPENAI_API_KEY environment variable.");
      }
      await generateText({
        model: openai("gpt-4o-mini") as any,
        prompt: "ping"
      } as any);
      return { status: "healthy" as const, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: "unhealthy" as const, latencyMs: Date.now() - start, error: err.message };
    }
  }
}
