import { ConversationTurn } from "./ConversationManager";

export class ReportEngine {
  /**
   * Sends the structured conversation history containing per-turn evaluations
   * to the backend to synthesize the final aggregated report.
   */
  public static async compileReport(
    chatLog: ConversationTurn[],
    questions: any[],
    role: string,
    round: string,
    difficulty: string
  ): Promise<any> {
    const response = await fetch("/api/ai/mock/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        round,
        difficulty,
        questions,
        chatLog,
        fillerWordsCount: 0
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.reason || "Mock evaluations endpoint failed.");
    }

    return response.json();
  }
}
