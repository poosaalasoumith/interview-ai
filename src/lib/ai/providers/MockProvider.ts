import { AIProvider } from "./AIProvider";

export class MockProvider implements AIProvider {
  name = "Mock";

  async streamChat(
    messages: any[],
    systemPrompt: string,
    context: any,
    options: any
  ) {
    // Generate a structured JSON response mock
    const structuredMock = {
      message: "Mock Hint: Think about optimization techniques like using a HashMap or checking loop boundaries.",
      type: "hint",
      confidence: 0.95,
      relatedConcepts: ["Time Complexity", "Hashing", "Data Structures"],
      nextSuggestion: "Double check if you have handled the empty array input case.",
      citations: []
    };

    const payload = JSON.stringify(structuredMock);
    const encoder = new TextEncoder();

    // Standard Vercel AI SDK data stream format chunk
    const customStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(payload)}\n`));
        controller.close();
      }
    });

    return {
      text: Promise.resolve(payload),
      toTextStreamResponse: () => new Response(customStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "x-vercel-id": "mock-stream"
        }
      })
    };
  }

  async checkHealth() {
    return { status: "healthy" as const, latencyMs: 2 };
  }
}
