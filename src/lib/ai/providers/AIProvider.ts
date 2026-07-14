export interface AIProvider {
  name: string;
  streamChat(
    messages: any[],
    systemPrompt: string,
    context: any,
    options: {
      temperature?: number;
      topP?: number;
      maxTokens?: number;
      abortSignal?: AbortSignal;
    }
  ): Promise<any>;
  checkHealth(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; error?: string }>;
}
