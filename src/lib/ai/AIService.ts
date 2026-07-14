import { createClient } from "@/utils/supabase/server";
import { GeminiProvider } from "./providers/GeminiProvider";
import { MockProvider } from "./providers/MockProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { ClaudeProvider } from "./providers/ClaudeProvider";
import { AzureProvider } from "./providers/AzureProvider";
import { AIProvider } from "./providers/AIProvider";
import { ASSISTANT_POLICIES, type AssistantMode } from "./RolePolicies";
import { AIPromptBuilder } from "./PromptBuilder";
import { AISessionContextManager } from "./SessionContextManager";
import { AIResponseCache } from "./ResponseCache";
import { AIResponseValidator } from "./ResponseValidator";
import { AIErrorHandler } from "./ErrorHandler";

export class AIService {
  static getProvider(providerName?: string): AIProvider {
    const name = providerName || process.env.AI_PROVIDER || "Gemini";
    
    if (process.env.NODE_ENV === "test") {
      return new MockProvider();
    }

    switch (name.toLowerCase()) {
      case "mock":
        return new MockProvider();
      case "openai":
        return new OpenAIProvider();
      case "claude":
        return new ClaudeProvider();
      case "azure":
        return new AzureProvider();
      case "gemini":
      default:
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
          return new MockProvider();
        }
        return new GeminiProvider();
    }
  }

  static async streamChat(req: Request): Promise<Response> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    let sessionId = "global";

    try {
      const { messages, context } = await req.json();
      sessionId = context?.sessionId || "global";

      // 1. Server-side session & role verification
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const verifiedRole = user?.user_metadata?.role || "candidate";

      // Enforce correct assistantMode based on verified database role
      let assistantMode: AssistantMode = (context?.assistantMode as AssistantMode) || "coding_practice";
      if (verifiedRole === "admin") {
        if (assistantMode !== "admin_live") {
          assistantMode = "admin_live";
        }
      } else if (verifiedRole === "interviewer") {
        if (assistantMode !== "interviewer_live") {
          assistantMode = "interviewer_live";
        }
      } else {
        // Candidate role restrictions
        if (assistantMode === "interviewer_live" || assistantMode === "admin_live") {
          assistantMode = (context?.sessionType === "live" || context?.sessionType === "assessment")
            ? "candidate_live"
            : "coding_practice";
        }
        
        // Strict anti-cheating check: Candidates in live sessions can ONLY use candidate_live
        if (context?.sessionType === "live" || context?.sessionType === "assessment") {
          assistantMode = "candidate_live";
        }
      }

      const policy = ASSISTANT_POLICIES[assistantMode] || ASSISTANT_POLICIES.coding_practice;
      const cleanCtx = AISessionContextManager.cleanContext({
        ...context,
        role: verifiedRole,
        assistantMode,
        sessionId,
        messages
      });

      const history = AISessionContextManager.buildHistory(messages);
      const userMessage = history[history.length - 1]?.content || "";
      const systemPrompt = AIPromptBuilder.build(policy.systemPrompt, cleanCtx);
      const promptSize = systemPrompt.length;
      const contextSize = JSON.stringify(cleanCtx).length;

      // 2. AI Response Caching Layer
      const cachedResponse = await AIResponseCache.get(assistantMode, cleanCtx.problemStatement?.title || "Theory", userMessage);
      if (cachedResponse) {
        console.log(`[AI Cache Hit] Mode: ${assistantMode} | Query: "${userMessage.substring(0, 30)}..."`);
        
        let parserStatus = "fallback";
        try {
          const parsed = JSON.parse(cachedResponse);
          if (parsed && typeof parsed === "object") {
            parserStatus = "success";
          }
        } catch (e) {}

        return this.serializeStreamResponse(cachedResponse, {
          requestId,
          sessionId,
          provider: "Cache",
          latency: Date.now() - startTime,
          tokens: 0,
          retries: 0,
          policy: assistantMode,
          model: "Cache-DB",
          success: true,
          promptSize,
          contextSize,
          validationStatus: "valid",
          parserStatus
        });
      }

      // Update rolling conversation memory (kept for backward compatibility, although client handles it now)
      AISessionContextManager.updateHistory(sessionId, messages);

      const provider = this.getProvider();

      // 3. Provider Health Check (Pre-verification)
      if (provider.name === "Gemini" && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.NODE_ENV !== "test") {
        throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable on the server.");
      }

      // 4. Generation with Retry (Exponential Backoff)
      let execution = await this.generateWithRetry(provider, history, systemPrompt, cleanCtx, policy);
      
      // 5. Output Validation & Anti-Cheating Gate
      let validation = AIResponseValidator.validate(execution.fullText, policy.allowSolutions);
      let retriesCount = 0;

      if (!validation.isValid) {
        console.warn(`[AI Validation Failed] ${validation.reason}. Triggering one-time regeneration...`);
        retriesCount++;
        
        const securityOverridePrompt = `${systemPrompt}\n\nCRITICAL OVERRIDE: Your previous response was rejected because it violated security parameters (revealed direct code/solutions in live mode or was invalid JSON). You must strictly output your response as a valid JSON object without any code implementations or direct solutions.`;
        
        execution = await this.generateWithRetry(provider, history, securityOverridePrompt, cleanCtx, policy);
        validation = AIResponseValidator.validate(execution.fullText, policy.allowSolutions);

        if (!validation.isValid) {
          throw new Error(`AI generated response failed validation safety checks: ${validation.reason}`);
        }
      }

      // Save valid responses in cache
      await AIResponseCache.set(assistantMode, cleanCtx.problemStatement?.title || "Theory", userMessage, execution.fullText);

      const latency = Date.now() - startTime;
      console.log(`[AI Request Success] Mode: ${assistantMode} | Latency: ${latency}ms | Provider: ${provider.name}`);

      let parserStatus = "fallback";
      try {
        const parsed = JSON.parse(execution.fullText);
        if (parsed && typeof parsed === "object") {
          parserStatus = "success";
        }
      } catch (e) {}

      return this.serializeStreamResponse(execution.fullText, {
        requestId,
        sessionId,
        provider: provider.name,
        latency,
        tokens: Math.round(execution.fullText.length / 4),
        retries: retriesCount,
        policy: assistantMode,
        model: provider.name === "Gemini" ? "gemini-2.5-flash" : provider.name.toLowerCase(),
        success: true,
        promptSize,
        contextSize,
        validationStatus: "valid",
        parserStatus
      });

    } catch (err: any) {
      console.error("[AI Service Error]", err);
      const statusCode = err.status || 500;
      const errorMsg = AIErrorHandler.translate(err);

      return new Response(JSON.stringify({
        error: errorMsg,
        message: "Unable to reach the AI service. Please try again in a few moments."
      }), {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          "x-ai-request-id": requestId,
          "x-ai-success": "false"
        }
      });
    }
  }

  private static async generateWithRetry(
    provider: AIProvider,
    messages: any[],
    systemPrompt: string,
    context: any,
    policy: any
  ): Promise<{ result: any; fullText: string }> {
    let delay = 1000;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await provider.streamChat(messages, systemPrompt, context, {
          temperature: policy.temperature,
          topP: policy.topP,
          maxTokens: policy.maxTokens,
        });

        // Resolve text output to validate completely before streaming to user
        const fullText = await result.text;
        return { result, fullText };
      } catch (err: any) {
        const status = err.status || 500;
        const isRetryable = status === 429 || status >= 500;
        if (attempt === maxRetries || !isRetryable) {
          throw err;
        }
        console.warn(`AI Provider failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`, err);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    throw new Error("Max retries reached");
  }

  private static serializeStreamResponse(text: string, diagnostics: any): Response {
    const encoder = new TextEncoder();
    
    // Split the text into small chunks of size 8 to simulate smooth streaming/typing
    const chunks: string[] = [];
    let i = 0;
    const chunkSize = 8;
    while (i < text.length) {
      chunks.push(text.substring(i, i + chunkSize));
      i += chunkSize;
    }

    const customStream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
          // Wait 10ms between chunks to simulate smooth typewriter flow
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        controller.close();
      }
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-vercel-id": "ai-response-stream",
        "x-ai-request-id": diagnostics.requestId,
        "x-ai-session-id": diagnostics.sessionId,
        "x-ai-provider": diagnostics.provider,
        "x-ai-latency": String(diagnostics.latency),
        "x-ai-tokens": String(diagnostics.tokens),
        "x-ai-retries": String(diagnostics.retries),
        "x-ai-policy": diagnostics.policy,
        "x-ai-model": diagnostics.model,
        "x-ai-success": String(diagnostics.success),
        "x-ai-prompt-size": String(diagnostics.promptSize || 0),
        "x-ai-context-size": String(diagnostics.contextSize || 0),
        "x-ai-validation-status": String(diagnostics.validationStatus || "unknown"),
        "x-ai-parser-status": String(diagnostics.parserStatus || "unknown"),
        "x-ai-streaming-status": "complete"
      }
    });
  }
}
