import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { IntentDetector } from "@/lib/voice-interview/IntentDetector";

const chatSchema = z.object({
  status: z.enum(["follow_up", "proceed"]).describe("Whether to issue a follow-up probe ('follow_up') or proceed to the next question ('proceed')"),
  response: z.string().describe("The AI interviewer's speaking response/utterance to the candidate"),
  analysis: z.object({
    relevance: z.number().min(0).max(100).describe("Relevance score between 0 and 100"),
    completeness: z.number().min(0).max(100).describe("Completeness score between 0 and 100"),
    technicalAccuracy: z.number().min(0).max(100).describe("Technical accuracy score between 0 and 100"),
    confidence: z.number().min(0).max(100).describe("Confidence score between 0 and 100"),
    communication: z.number().min(0).max(100).describe("Communication score between 0 and 100"),
    starStructure: z.boolean().describe("True if response matches STAR structure (Situation, Task, Action, Result)"),
    vocabulary: z.array(z.string()).describe("Important technical words or industry-specific terms used"),
    fluency: z.number().min(0).max(100),
    grammar: z.number().min(0).max(100),
    depth: z.number().min(0).max(100),
    score: z.number().min(0).max(100).describe("Overall weighted score for this specific turn"),
    suggestions: z.array(z.string()).describe("List of 2-3 specific suggestions for improvement on this answer")
  }).describe("Immediate turn evaluation breakdown")
});

export async function POST(req: Request) {
  try {
    const { question, candidateResponse, chatHistory, attemptCount, personality, round } = await req.json();

    // Defensive fallback if question details are undefined
    const activeQuestion = question || {
      question: "Can you tell me about yourself and your journey?",
      idealAnswer: "A summary of professional background, key achievements, and relevant skills.",
      keywords: ["experience", "background", "projects"],
      concepts: ["career", "role"],
      rubric: {
        beginner: "Very brief response with little structure.",
        intermediate: "Chronological summary of jobs but lacks highlight of achievements.",
        expert: "An articulate narrative connecting past success with this role's requirements."
      }
    };

    const intent = await IntentDetector.detect(candidateResponse);
    console.log(`[POST /api/ai/mock/chat] Intent detected: ${intent} for response: "${candidateResponse}"`);
    
    if (intent !== "answer_submission") {
      let responseText = "";
      if (intent === "repeat_question") {
        responseText = `Sure, let me repeat that for you. Here is the question: ${activeQuestion.question}`;
        return NextResponse.json({
          status: "repeat",
          response: responseText,
          intent,
          analysis: null
        });
      } else if (intent === "skip_question") {
        responseText = "No problem at all. Let's move on to the next topic.";
        return NextResponse.json({
          status: "skip",
          response: responseText,
          intent,
          analysis: null
        });
      } else if (intent === "end_interview") {
        responseText = "I understand. Let's conclude the interview now. I will assemble your final performance report.";
        return NextResponse.json({
          status: "end",
          response: responseText,
          intent,
          analysis: null
        });
      } else if (intent === "continue_interview") {
        responseText = `Alright, let's continue. The question is: ${activeQuestion.question}`;
        return NextResponse.json({
          status: "continue",
          response: responseText,
          intent,
          analysis: null
        });
      } else {
        // Dynamic response generation using Gemini for clarify, hint, ask_interviewer, general_conversation
        let prompt = "";
        if (intent === "clarify_question") {
          prompt = `You are a professional technical interviewer style: ${personality || "Professional"}.
The candidate asked for clarification on the current question: "${activeQuestion.question}".
The expected answer details are: "${activeQuestion.idealAnswer}".
Generate a brief, helpful explanation (maximum 2-3 sentences) of what the question is asking, without giving away the actual solution. Remain in your interviewer persona.`;
        } else if (intent === "request_hint") {
          prompt = `You are a professional technical interviewer style: ${personality || "Professional"}.
The candidate is stuck and asked for a hint on the current question: "${activeQuestion.question}".
The ideal answer details are: "${activeQuestion.idealAnswer}" and key terms are: "${activeQuestion.keywords?.join(", ") || ""}".
Generate a helpful, progressive hint (maximum 1-2 sentences) that points them in the right direction without revealing the complete solution or code. Remain in your interviewer persona.`;
        } else if (intent === "ask_interviewer") {
          prompt = `You are a professional technical interviewer style: ${personality || "Professional"}.
The candidate asked you a general or conversational question: "${candidateResponse}".
Answer their question briefly and professionally in character, then politely guide them back to the active interview question: "${activeQuestion.question}".`;
        } else {
          // general_conversation
          prompt = `You are a professional technical interviewer style: ${personality || "Professional"}.
The candidate made a polite conversational remark, greeting, or filler: "${candidateResponse}".
Briefly acknowledge it and keep the interview focused by asking them to respond to the active question: "${activeQuestion.question}".`;
        }

        const { text } = await generateText({
          model: google("models/gemini-2.5-flash"),
          prompt: prompt
        });

        responseText = text;

        return NextResponse.json({
          status: intent === "request_hint" ? "hint" : intent === "clarify_question" ? "clarify" : "chit_chat",
          response: responseText,
          intent,
          analysis: null
        });
      }
    }

    // Mapped AI behaviors and system instructions
    let roundInstructions = "";
    if (round === "Warm Up") {
      roundInstructions = `You are Ava, a Friendly Mentor warming up the candidate.
- Style: Warm, encouraging, conversational.
- Speaking Pace: Normal and friendly.
- Interruption: None. Let them speak freely.
- Task: Ask short, encouraging questions. Focus on comfort, and transition gently.`;
    } else if (round === "Behavioral") {
      roundInstructions = `You are Ava, an HR Conversational Specialist conducting a Behavioral round.
- Style: Conversational, structured, uses the STAR method.
- Speaking Pace: Normal.
- Interruption: Occasional. Interrupt if they drift too far or are overly verbose.
- Task: Dig deeper. Ask "Why?", explore challenges, and ask for specific Action/Result details if they missed them. Reference their earlier responses if they connect.`;
    } else if (round === "HR Round") {
      roundInstructions = `You are Sophia, a professional HR Lead.
- Style: Professional, structured, culture-oriented.
- Speaking Pace: Normal.
- Interruption: None.
- Task: Assess career goals, company alignment, and professional logistics. Ask natural follow-up questions about their career aspirations.`;
    } else if (round === "Technical (Theory)") {
      roundInstructions = `You are Marcus, a Senior Software Engineer.
- Style: Direct, technical, intellectually challenging.
- Speaking Pace: Normal.
- Interruption: Active. Gently challenge incorrect assumptions or clarify hand-wavy technical descriptions immediately.
- Task: Question OOP, database, OS, or network theory. Request concrete architectural examples. Challenge their technical justifications.`;
    } else if (round === "Technical (Coding)" || round === "Coding") {
      roundInstructions = `You are Marcus, a Senior Software Engineer.
- Style: Direct, quiet, focused (LeetCode style).
- Speaking Pace: Normal.
- Interruption: None.
- Task: Keep verbal dialogue to a minimum. Let them focus on coding. Give short tips or hints ONLY if they are struggling or ask for help. Otherwise, transition directly to the next question.`;
    } else if (round === "System Design") {
      roundInstructions = `You are Zara, a Principal Architect.
- Style: Deeply analytical, system scalability and trade-off oriented.
- Speaking Pace: Normal.
- Interruption: Occasional. Interrupt if they suggest unrealistic designs or ignore major scalability limits.
- Task: Lead discussions on high-scale systems. Explore cache eviction, sharding, replication, single points of failure, load balancing, and CAP theorem trade-offs.`;
    } else {
      roundInstructions = `You are a professional AI interviewer. Style: ${personality || "Professional"}.`;
    }

    const systemPrompt = `${roundInstructions}

You are currently processing the candidate's response to the current question:
- Question: ${activeQuestion.question}
- Expected Ideal Answer: ${activeQuestion.idealAnswer}
- Expected Concepts: ${activeQuestion.concepts?.join(", ") || ""}
- Expected Keywords: ${activeQuestion.keywords?.join(", ") || ""}
- Evaluation Rubric:
  - Beginner: ${activeQuestion.rubric?.beginner || ""}
  - Intermediate: ${activeQuestion.rubric?.intermediate || ""}
  - Expert: ${activeQuestion.rubric?.expert || ""}

Complete Session Chat History (for Conversation Memory context):
${JSON.stringify(chatHistory)}

Candidate's Latest Response: "${candidateResponse}"
Current Follow-Up Attempt Count for this specific question: ${attemptCount} (Maximum allowed follow-up attempts: 2)

Guidelines:
1. Conversation Memory: Read the Complete Session Chat History. If the candidate mentions something related to an answer they gave in a previous question, acknowledge it naturally (e.g., "Earlier you mentioned working with Redis, how does that apply here?"). Avoid treating each question as a completely independent silo.
2. Determine if the candidate's response is weak or incomplete relative to the expert rubric.
3. If the response is completely unrelated, off-topic, or vacuous:
   - Set status to "follow_up" (if attemptCount < 2).
   - Generate a polite redirection response (e.g., "Thank you. However, could we focus more on how you would design the schema itself?").
4. If the response is weak/incomplete AND the current attemptCount is less than 2:
   - Set status to "follow_up".
   - Generate an intelligent follow-up question asking them to elaborate, explain a specific concept they missed, or clarify their approach. Examples: "What specific example can you provide?", "What challenges did you face?", "Can you elaborate on that?", "Why did you choose that approach?".
5. If the response is strong/complete, OR if they have reached the maximum of 2 follow-ups (attemptCount >= 2):
   - Set status to "proceed".
   - Generate a transition response concluding the discussion for this question.
6. Human-like Interviewer Transitions: If status is "proceed", vary your transition speech naturally (e.g., "Great.", "Thank you.", "Let's explore that further.", "Interesting.", "Let's move to another topic.", "Now I'd like to discuss..."). Avoid repeating the exact phrase "Let's move to the next question" every time. Keep responses short, natural, and highly aligned with your assigned round persona.
7. Perform a rigorous, immediate analysis of the candidate's latest response and fill out the 'analysis' object schema.`;

    const result = await generateObject({
      model: google("models/gemini-2.5-flash"),
      schema: chatSchema,
      prompt: systemPrompt
    });

    return NextResponse.json(result.object);
  } catch (error: any) {
    console.error("AI Mock Chat Error:", error);
    return NextResponse.json({
      status: "proceed",
      response: "Thank you for the explanation. Let's move on.",
      analysis: {
        relevance: 100,
        completeness: 50,
        technicalAccuracy: 50,
        confidence: 80,
        communication: 80,
        starStructure: false,
        vocabulary: [],
        fluency: 80,
        grammar: 80,
        depth: 50,
        score: 60,
        suggestions: ["Explain your approach in more detail."]
      }
    });
  }
}
