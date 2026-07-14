import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export type ConversationalIntent =
  | "repeat_question"
  | "skip_question"
  | "clarify_question"
  | "request_hint"
  | "ask_interviewer"
  | "end_interview"
  | "continue_interview"
  | "general_conversation"
  | "answer_submission";

const intentSchema = z.object({
  intent: z.enum([
    "repeat_question",
    "skip_question",
    "clarify_question",
    "request_hint",
    "ask_interviewer",
    "end_interview",
    "continue_interview",
    "general_conversation",
    "answer_submission"
  ]).describe("The detected intent of the candidate's utterance"),
  reasoning: z.string().describe("A brief explanation for the classified intent")
});

export class IntentDetector {
  /**
   * Deterministic rule-based intent matching for speed and 100% accuracy on common commands.
   */
  private static matchRules(text: string): ConversationalIntent | null {
    const clean = text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

    // 1. Repeat Question
    if (
      clean === "repeat" ||
      clean === "repeat the question" ||
      clean === "what was the question" ||
      clean === "could you say that again" ||
      clean === "say that again" ||
      clean === "repeat question" ||
      clean === "can you repeat" ||
      clean === "repeat it" ||
      clean === "pardon" ||
      clean === "can you say that again"
    ) {
      return "repeat_question";
    }

    // 2. Skip/Change Question
    if (
      clean === "skip" ||
      clean === "skip this" ||
      clean === "skip this question" ||
      clean === "change the question" ||
      clean === "change question" ||
      clean === "next question" ||
      clean === "don't know" ||
      clean === "i don't know" ||
      clean === "i do not know" ||
      clean === "pass" ||
      clean === "move on" ||
      clean === "no idea" ||
      clean === "i have no idea" ||
      clean === "lets move on" ||
      clean === "lets skip"
    ) {
      return "skip_question";
    }

    // 3. Clarify Question
    if (
      clean === "clarify" ||
      clean.startsWith("explain") ||
      clean.startsWith("what do you mean") ||
      clean === "explain the question" ||
      clean === "can you clarify" ||
      clean === "please clarify" ||
      clean === "i don't understand the question" ||
      clean === "what does this mean"
    ) {
      return "clarify_question";
    }

    // 4. Request Hint
    if (
      clean === "hint" ||
      clean === "give me a hint" ||
      clean === "need a hint" ||
      clean === "can i get a hint" ||
      clean === "stuck" ||
      clean === "help me" ||
      clean === "give hint" ||
      clean === "hint please" ||
      clean === "i need a hint"
    ) {
      return "request_hint";
    }

    // 5. Ask Interviewer
    if (
      clean === "who are you" ||
      clean === "what is your name" ||
      clean === "tell me about yourself" ||
      clean === "how are you" ||
      clean === "what's your name"
    ) {
      return "ask_interviewer";
    }

    // 6. End Interview
    if (
      clean === "end" ||
      clean === "stop" ||
      clean === "finish the interview" ||
      clean === "quit" ||
      clean === "exit" ||
      clean === "stop the interview" ||
      clean === "terminate" ||
      clean === "end interview" ||
      clean === "finish interview"
    ) {
      return "end_interview";
    }

    // 7. Continue Interview
    if (
      clean === "continue" ||
      clean === "resume" ||
      clean === "go on" ||
      clean === "resume interview" ||
      clean === "let's continue"
    ) {
      return "continue_interview";
    }

    // 8. General Conversation
    if (
      clean === "hello" ||
      clean === "hi" ||
      clean === "hey" ||
      clean === "hows it going" ||
      clean === "thank you" ||
      clean === "thanks" ||
      clean === "ok" ||
      clean === "okay" ||
      clean === "alright"
    ) {
      return "general_conversation";
    }

    return null;
  }

  /**
   * Routes the final transcript and classifies the conversational intent.
   */
  public static async detect(text: string): Promise<ConversationalIntent> {
    if (!text.trim()) {
      return "answer_submission";
    }

    // First attempt quick deterministic keyword/regex match
    const ruleMatch = this.matchRules(text);
    if (ruleMatch) {
      console.log(`[IntentDetector] Rule-based match succeeded: "${text}" -> ${ruleMatch}`);
      return ruleMatch;
    }

    // Fallback to LLM semantic classification
    try {
      const prompt = `You are a conversational intent classifier for an AI technical job interview platform.
Analyze the following candidate's spoken utterance and classify their exact intent:
- Utterance: "${text}"

Available Intents:
1. "repeat_question": The candidate is asking the interviewer to repeat or say the current question again (e.g., "what was that?", "can you say that again?", "repeat please").
2. "skip_question": The candidate wants to skip, change, pass on the current question, or admits they do not know the answer (e.g., "skip", "i don't know", "i do not know", "next question please", "pass", "no idea").
3. "clarify_question": The candidate is asking for clarification, explanation, or elaboration of what the question means (e.g., "what do you mean by that?", "can you explain this question?").
4. "request_hint": The candidate explicitly asks for a hint, clue, or help because they are stuck (e.g., "can I get a hint?", "help me with this", "give me a clue").
5. "ask_interviewer": The candidate is asking the interviewer personal or friendly questions (e.g., "what is your name?", "who are you?", "tell me about yourself").
6. "end_interview": The candidate wants to terminate, stop, exit, or end the interview early (e.g., "stop the interview", "end now", "quit").
7. "continue_interview": The candidate wants to continue, resume, or proceed with the interview flow (e.g., "let's continue", "resume").
8. "general_conversation": Friendly greeting, acknowledgement, or polite conversational fillers that do not constitute a full answer (e.g., "hello", "hi there", "thank you", "thanks", "ok", "got it").
9. "answer_submission": The candidate is actually attempting to answer the question technically or behaviorally. This is the default if they are explaining their thoughts, code, or background.

Respond using the requested JSON schema.`;

      const result = await generateObject({
        model: google("models/gemini-2.5-flash"),
        schema: intentSchema,
        prompt: prompt
      });

      console.log(`[IntentDetector] LLM match succeeded: "${text}" -> ${result.object.intent} (Reason: ${result.object.reasoning})`);
      return result.object.intent;
    } catch (e) {
      console.warn("[IntentDetector] LLM classification error, defaulting to answer_submission:", e);
      return "answer_submission";
    }
  }
}
