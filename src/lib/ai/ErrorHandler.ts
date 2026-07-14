export class AIErrorHandler {
  static translate(error: any): string {
    const message = (error?.message || "").toLowerCase();
    const status = error?.status;

    if (message.includes("quota") || message.includes("limit") || message.includes("rate") || status === 429) {
      return "AI quota reached. Please wait or check your plan details.";
    }
    if (message.includes("timeout") || message.includes("abort") || status === 504 || error?.name === "AbortError") {
      return "The AI service timed out. Please retry.";
    }
    if (message.includes("auth") || message.includes("key") || message.includes("unauthorized") || status === 401) {
      return "Authentication error. Invalid AI credentials.";
    }
    if (message.includes("fetch") || message.includes("network") || message.includes("conn") || status === 502 || status === 503) {
      return "Connection lost. AI service is temporarily offline.";
    }
    return error?.message || "Failed to contact AI service.";
  }
}
