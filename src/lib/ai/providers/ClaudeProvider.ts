import { anthropic } from "@ai-sdk/anthropic";
import { streamText, generateText } from "ai";
import { AIProvider } from "./AIProvider";

export class ClaudeProvider implements AIProvider {
  name = "Claude";

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
      model: anthropic("claude-3-5-sonnet-20241022") as any,
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
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("Missing ANTHROPIC_API_KEY environment variable.");
      }
      await generateText({
        model: anthropic("claude-3-5-sonnet-20241022") as any,
        prompt: "ping"
      } as any);
      return { status: "healthy" as const, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: "unhealthy" as const, latencyMs: Date.now() - start, error: err.message };
    }
  }
}
