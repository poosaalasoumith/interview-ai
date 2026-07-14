import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const evaluationResponseSchema = z.object({
  questionsReview: z.array(
    z.object({
      question: z.string(),
      candidateAnswer: z.string().describe("Concatenated responses from the candidate for this question"),
      expectedAnswerSummary: z.string().describe("A summary of the ideal answer"),
      relevance: z.number().min(0).max(100),
      technical_accuracy: z.number().min(0).max(100),
      completeness: z.number().min(0).max(100),
      communication: z.number().min(0).max(100),
      reasoning: z.number().min(0).max(100),
      overall: z.number().min(0).max(100).describe("The final calculated score for this question using the weighted formula, subject to capping rules"),
      strengths: z.array(z.string()).describe("1-2 strengths specific to this question's answer"),
      mistakes: z.array(z.string()).describe("1-2 mistakes or misconceptions in their response"),
      missing_topics: z.array(z.string()).describe("Core concepts from the expected answer that they missed"),
      recommended_answer: z.string().describe("A professional, high-scoring model answer for this question")
    })
  ),
  readinessScore: z.number().min(0).max(100).describe("Average of the final question scores"),
  metrics: z.object({
    communication: z.number().min(0).max(100),
    coding: z.number().min(0).max(100).describe("Technical accuracy / coding score"),
    confidence: z.number().min(0).max(100),
    problemSolving: z.number().min(0).max(100),
    timeManagement: z.number().min(0).max(100)
  }),
  strengths: z.array(z.string()).describe("List of 3 global technical/behavioral strengths"),
  weaknesses: z.array(z.string()).describe("List of 2-3 global areas for improvement"),
  recommendations: z.array(z.string()).describe("List of 3 actionable study/practice recommendations"),
  improvementPlan: z.array(
    z.object({
      day: z.string(),
      focus: z.string(),
      detail: z.string()
    })
  ).describe("7-day personalized roadmap")
});

export async function POST(req: Request) {
  try {
    const { role, round, difficulty, questions, chatLog, fillerWordsCount } = await req.json();

    // 1. Transcript Verification (Phase 2)
    let totalChars = 0;
    let userTurnsCount = 0;
    const cleanLogs = chatLog ? chatLog.filter((turn: any) => turn && turn.text) : [];

    for (const turn of cleanLogs) {
      if (turn.sender === "user") {
        const text = turn.text.trim();
        // Check for placeholder/empty/whitespace/default greetings
        if (
          text &&
          text !== "No answer" &&
          text !== "..." &&
          !text.toLowerCase().includes("press enter to submit") &&
          !text.toLowerCase().includes("loading")
        ) {
          totalChars += text.length;
          userTurnsCount++;
        }
      }
    }

    if (userTurnsCount === 0 || totalChars < 5) {
      return NextResponse.json({
        success: false,
        error: "Unable to evaluate candidate response.",
        reason: "The transcript is empty, invalid, or contains no genuine candidate input."
      }, { status: 400 });
    }

    // Determine custom scoring weights and guidelines based on round type
    let scoringGuidelines = "";
    if (round === "Coding" || round === "Technical (Coding)") {
      scoringGuidelines = `
Round Focus: Coding IDE Assessment (Test cases, complexity, code quality, optimization).
Weighted Score Formula:
  Weighted Score = (technical_accuracy * 0.40) + (completeness * 0.20) + (reasoning * 0.20) + (communication * 0.10) + (relevance * 0.10)
- technical_accuracy: evaluates test cases passed, code correctness, and syntax correctness.
- completeness: evaluates coverage of problem constraints.
- reasoning: evaluates time and space complexity efficiency (Big-O analysis).
- communication: code cleanliness and readability.
- relevance: matches the problem description.
Capping Rule: If technical_accuracy is less than 50% or relevance is less than 50%, the final overall score MUST be capped at the minimum of technical_accuracy and relevance. Code quality cannot compensate for broken code.`;
    } else if (round === "Technical (Theory)") {
      scoringGuidelines = `
Round Focus: Technical Theory check (Technical accuracy, depth, reasoning).
Weighted Score Formula:
  Weighted Score = (technical_accuracy * 0.40) + (reasoning * 0.25) + (completeness * 0.15) + (communication * 0.10) + (relevance * 0.10)
- technical_accuracy: factual accuracy of computer science, OOP, DBMS, OS, or networking concepts.
- reasoning: depth of explanation and logical technical justifications.
- completeness: details of technical definitions covered.
Capping Rule: If technical_accuracy is less than 50% or relevance is less than 50%, the final overall score MUST be capped at the minimum of technical_accuracy and relevance.`;
    } else if (round === "Behavioral") {
      scoringGuidelines = `
Round Focus: Behavioral Simulation (STAR framework, leadership, ownership).
Weighted Score Formula:
  Weighted Score = (reasoning * 0.35) + (completeness * 0.25) + (communication * 0.20) + (relevance * 0.10) + (technical_accuracy * 0.10)
- reasoning: logic, STAR structuring (Situation, Task, Action, Result).
- completeness: details of candidate's own impact and ownership.
- communication: leadership qualities, confidence, and fluency.
Capping Rule: If relevance is less than 50%, the overall score is capped at relevance.`;
    } else if (round === "HR Round") {
      scoringGuidelines = `
Round Focus: HR Fit Assessment (Communication, professionalism, confidence).
Weighted Score Formula:
  Weighted Score = (communication * 0.40) + (relevance * 0.25) + (reasoning * 0.15) + (completeness * 0.10) + (technical_accuracy * 0.10)
- communication: confidence, professionalism, vocabulary, fluency.
- relevance: alignment with job logistics and career alignment.
Capping Rule: If relevance is less than 50%, the overall score is capped at relevance.`;
    } else if (round === "Warm Up") {
      scoringGuidelines = `
Round Focus: Conversational Warm Up (Fluency, clarity, confidence).
Weighted Score Formula:
  Weighted Score = (communication * 0.40) + (relevance * 0.30) + (completeness * 0.10) + (reasoning * 0.10) + (technical_accuracy * 0.10)
- communication: fluency, ease of speech, vocal clarity, confidence.
- relevance: answering the simple introduction queries.`;
    } else if (round === "System Design") {
      scoringGuidelines = `
Round Focus: System Design Architecture (Scalability, trade-off analysis, architecture completeness).
Weighted Score Formula:
  Weighted Score = (technical_accuracy * 0.35) + (reasoning * 0.30) + (completeness * 0.15) + (relevance * 0.10) + (communication * 0.10)
- technical_accuracy: sharding, replication, cache layers, CAP theorem choices.
- reasoning: trade-off analysis (why SQL over NoSQL, why Kafka, scalability bottlenecks).
- completeness: diagramming completeness and API/Schema sketch depth.
Capping Rule: If technical_accuracy is less than 50% or relevance is less than 50%, the overall score is capped at the minimum of technical_accuracy and relevance.`;
    } else {
      scoringGuidelines = `
Weighted Score Formula:
  Weighted Score = (technical_accuracy * 0.40) + (relevance * 0.25) + (completeness * 0.15) + (reasoning * 0.10) + (communication * 0.10)
Capping Rule: If relevance is less than 50% or technical_accuracy is less than 50%, the final overall score MUST be capped at the minimum of technical_accuracy and relevance.`;
    }

    // 2. Format Prompt (Phase 4, Phase 6, Phase 7, Phase 8, Recommendation 10)
    const prompt = `You are an expert Senior Engineering Recruiter and Principal Architect.
Perform a rigorous technical/behavioral evaluation of a candidate's mock interview.

Target Role: ${role}
Round Type: ${round}
Difficulty: ${difficulty}
Filler Words Logged: ${fillerWordsCount}

Questions asked (with their pre-saved ideal answers and rubrics):
${JSON.stringify(questions)}

Complete Chat Transcript (Contains pre-computed turn evaluations in 'analysis' object for user turns):
${JSON.stringify(cleanLogs)}

Round-Specific Scoring Matrix Guidelines:
${scoringGuidelines}

Evaluation Instructions:
1. Aggregate turn evaluations: The Complete Chat Transcript contains pre-computed evaluations and scores for each candidate response in the 'analysis' property. You MUST aggregate these scores (e.g. by averaging them for each question) to compute the final question ratings and overall readiness metrics. Do not ignore these evaluations; they represent the authoritative ground truth collected during the interview.
2. For each question, extract all responses given by the candidate in the transcript (including both their initial response, written code, and any replies to follow-up questions).
3. Rate each question response across five dimensions (0-100%) by aggregating the per-turn evaluations:
   - relevance: Does the answer address the question? Completely unrelated or silent answers MUST receive 0-10%.
   - technical_accuracy: Factual accuracy of CS theory, STAR structure, or coding logic. Misconceptions or incorrect statements MUST receive below 30%.
   - completeness: Did they hit the ideal answer criteria and rubric requirements?
   - reasoning: Problem solving depth, logic, trade-offs, and structure.
   - communication: Clarity, confidence, fluency, structure.
4. Compute the final overall score for each question using the round-specific Weighted Score and Capping Rules defined above. Communication quality or confidence must NEVER compensate for an incorrect or off-topic response.
5. Semantic Evaluation: Do NOT do simple keyword matching. Understand synonyms, paraphrasing, conceptual correctness, logical explanations, and alternative valid implementations. If a candidate explains the concept correctly using different wording than the idealAnswer or modelAnswer, score them highly.
6. Calculate the overall metrics:
   - readinessScore: Average of the three final question overall scores.
   - metrics.communication: Average of communication scores.
   - metrics.coding: Average of technical_accuracy scores.
   - metrics.confidence: Adjust based on communication and fillerWordsCount.
   - metrics.problemSolving: Average of reasoning scores.
   - metrics.timeManagement: Calculate a score between 75-95 based on pacing and length.

Respond ONLY with a JSON object matching the following structure:
{
  "questionsReview": [
    {
      "question": "The exact question text",
      "candidateAnswer": "Concatenated responses from candidate for this question",
      "expectedAnswerSummary": "Summary of ideal answer",
      "relevance": 95,
      "technical_accuracy": 90,
      "completeness": 88,
      "communication": 84,
      "reasoning": 91,
      "overall": 90,
      "strengths": ["string"],
      "mistakes": ["string"],
      "missing_topics": ["string"],
      "recommended_answer": "Model answer suggestion"
    }
  ],
  "readinessScore": 90,
  "metrics": {
    "communication": 84,
    "coding": 90,
    "confidence": 88,
    "problemSolving": 91,
    "timeManagement": 85
  },
  "strengths": ["List of 3 global strengths"],
  "weaknesses": ["List of 2-3 global weaknesses"],
  "recommendations": ["List of 3 actionable study items"],
  "improvementPlan": [
    { "day": "Day 1-2", "focus": "...", "detail": "..." }
  ]
}`;

    const result = await generateObject({
      model: google("models/gemini-2.5-flash"),
      schema: evaluationResponseSchema,
      prompt
    });

    const parsedJson = result.object;

    return NextResponse.json({
      success: true,
      evaluation: parsedJson,
      debugLog: {
        prompt,
        rawLlmResponse: JSON.stringify(parsedJson),
        parsedJson
      }
    });

  } catch (error: any) {
    console.error("AI Mock Evaluation Error:", error);
    
    // Extract validation details if present
    const validationErrors = typeof error.toJson === 'function' ? error.toJson() : null;
    const errors = error.errors || null;
    const value = error.value || null;

    return NextResponse.json({
      success: false,
      error: "Evaluation Failed",
      reason: error.message || "Failed to generate evaluation report.",
      validationErrors,
      errors,
      value,
      retry: true
    }, { status: 500 });
  }
}
