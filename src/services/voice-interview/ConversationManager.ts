import { createClient } from "@/utils/supabase/client";

export interface ConversationTurn {
  sender: "ai" | "user";
  text: string;
  timestamp: string;
  turnId: string;
  interviewId: string;
  questionId: string;
  followUpId: string | null;
  transcriptId: string;
  analysisId: string;
  ttsId: string;
  recognitionId: string;
  audioUrl?: string | null;
  analysis?: any;
}

export class ConversationManager {
  public interviewId: string;
  public chatLog: ConversationTurn[] = [];
  public currentQuestionIndex = 0;
  public followUpCount = 0;

  public roleName = "Software Engineer";
  public roundType = "Coding";
  public difficulty = "Medium";
  public personality = "FAANG Style";
  public questionsList: string[] = [];
  public generatedQuestions: any[] = [];
  public currentPlaybackId: string | null = null;
  public currentGenerationId: string | null = null;

  constructor(interviewId: string) {
    this.interviewId = interviewId;
  }

  /**
   * Generates a unique UUID or a high-entropy fallback ID.
   */
  public generateId(prefix: string): string {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
  }

  public addTurn(turn: ConversationTurn) {
    this.chatLog.push(turn);
    this.saveState();
  }

  public async saveState(status: string = "active", errorReason: string | null = null, finalEvaluation: any = null) {
    const supabase = createClient();
    const payload = {
      id: this.interviewId,
      role: this.roleName,
      round: this.roundType,
      difficulty: this.difficulty,
      personality: this.personality,
      questions: this.generatedQuestions,
      chat_log: this.chatLog,
      evaluation: finalEvaluation,
      status: status,
      error_reason: errorReason,
      updated_at: new Date().toISOString()
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      (payload as any).user_id = user?.id || null;

      await supabase.from("practice_interviews").upsert(payload);
      localStorage.setItem("practice_recovery_" + this.interviewId, JSON.stringify(payload));
    } catch (e) {
      console.warn("[ConversationManager] Database state sync warning. Saved to recovery cache:", e);
      localStorage.setItem("practice_recovery_" + this.interviewId, JSON.stringify(payload));
    }
  }

  public loadFromState(data: any) {
    this.roleName = data.role || this.roleName;
    this.roundType = data.round || this.roundType;
    this.difficulty = data.difficulty || this.difficulty;
    this.personality = data.personality || this.personality;
    this.generatedQuestions = data.questions || [];
    this.questionsList = (data.questions || []).map((q: any) => q.question);
    this.chatLog = data.chat_log || data.chatLog || [];

    this.resumePointersFromHistory();
  }

  /**
   * Audits log history to restore state variables on session reconnection.
   */
  private resumePointersFromHistory() {
    if (this.chatLog.length === 0) {
      this.currentQuestionIndex = 0;
      this.followUpCount = 0;
      return;
    }

    let resolvedQIndex = 0;
    let resolvedFollowUp = 0;

    for (const turn of this.chatLog) {
      if (turn.sender === "ai") {
        if (turn.questionId) {
          const idx = this.questionsList.indexOf(turn.questionId);
          if (idx !== -1) {
            resolvedQIndex = idx;
          }
        }
        if (turn.followUpId) {
          const match = turn.followUpId.match(/\d+/);
          if (match) {
            resolvedFollowUp = parseInt(match[0]);
          }
        } else {
          resolvedFollowUp = 0;
        }
      }
    }

    this.currentQuestionIndex = resolvedQIndex;
    this.followUpCount = resolvedFollowUp;
  }
}
