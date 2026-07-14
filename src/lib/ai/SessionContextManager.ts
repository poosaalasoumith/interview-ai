export interface SessionContext {
  role: string;
  assistantMode: string;
  sessionType: string;
  difficulty: string;
  elapsedTime: string;
  code: string;
  language: string;
  problemStatement: any;
  compilerOutput: string;
  testCases: any[];
  selectedCode?: string;
  candidateTranscript?: string;
  history: any[];
  hintLevel: number;
}

export class AISessionContextManager {
  // In-Memory rolling conversation registry mapping sessionId -> rolling messages array
  private static sessions = new Map<string, any[]>();

  static getHistory(sessionId: string): any[] {
    if (!sessionId) return [];
    return this.sessions.get(sessionId) || [];
  }

  static updateHistory(sessionId: string, messages: any[]): void {
    if (!sessionId) return;
    // Retain only the last 8 messages (rolling memory window) to prevent token bloat
    const rolling = messages.slice(-8);
    this.sessions.set(sessionId, rolling);
  }

  static countHints(history: any[]): number {
    let count = 0;
    for (const msg of history) {
      if (msg.role === "assistant") {
        const content = msg.content || "";
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === "object") {
            if (
              parsed.type === "hint" ||
              (parsed.message && (
                parsed.message.toLowerCase().includes("hint") ||
                parsed.message.toLowerCase().includes("hint 1") ||
                parsed.message.toLowerCase().includes("hint 2") ||
                parsed.message.toLowerCase().includes("hint 3")
              ))
            ) {
              count++;
            }
          }
        } catch (e) {
          if (content.toLowerCase().includes("hint")) {
            count++;
          }
        }
      }
    }
    return count;
  }

  static cleanContext(context: any): SessionContext {
    const history = context?.messages || this.getHistory(context?.sessionId || "");
    const hintLevel = this.countHints(history) + 1;

    return {
      role: context?.role || "candidate",
      assistantMode: context?.assistantMode || "coding_practice",
      sessionType: context?.sessionType || "practice",
      difficulty: context?.difficulty || "Medium",
      elapsedTime: context?.elapsedTime || "00:00",
      code: context?.code || "",
      language: context?.language || "javascript",
      problemStatement: context?.problemStatement || {},
      compilerOutput: context?.compilerOutput || "No compiler run yet",
      testCases: Array.isArray(context?.testCases) ? context.testCases : [],
      selectedCode: context?.selectedCode || "",
      candidateTranscript: context?.candidateTranscript || "",
      history,
      hintLevel
    };
  }

  static buildHistory(messages: any[]): any[] {
    if (!Array.isArray(messages)) return [];
    return messages.map(msg => {
      const role = msg.role === "user" ? "user" : "assistant";
      let content = "";
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (msg.parts && Array.isArray(msg.parts)) {
        content = msg.parts
          .map((p: any) => (p.type === "text" ? p.text : ""))
          .join("");
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .map((p: any) => (p.type === "text" ? p.text : ""))
          .join("");
      }
      return {
        role,
        content
      };
    });
  }
}
