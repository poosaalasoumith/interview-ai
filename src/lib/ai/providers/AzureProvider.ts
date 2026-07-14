import { azure } from "@ai-sdk/azure";
import { streamText, generateText } from "ai";
import { AIProvider } from "./AIProvider";

export class AzureProvider implements AIProvider {
  name = "Azure";

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
      model: azure("gpt-4o") as any,
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
      if (!process.env.AZURE_RESOURCE_NAME || !process.env.AZURE_API_KEY) {
        throw new Error("Missing Azure OpenAI credentials (AZURE_RESOURCE_NAME or AZURE_API_KEY).");
      }
      await generateText({
        model: azure("gpt-4o") as any,
        prompt: "ping"
      });
      return { status: "healthy" as const, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: "unhealthy" as const, latencyMs: Date.now() - start, error: err.message };
    }
  }
}
