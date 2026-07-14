import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const standardQuestionSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("The text of the interview question"),
      idealAnswer: z.string().describe("The expected perfect technical or behavioral answer"),
      keywords: z.array(z.string()).describe("5-10 core technical keywords or terminology expected in a strong response"),
      concepts: z.array(z.string()).describe("3-5 high-level concepts that the candidate should cover"),
      rubric: z.object({
        beginner: z.string().describe("Criteria or characteristics of a weak/beginner level response"),
        intermediate: z.string().describe("Criteria or characteristics of an average/intermediate level response"),
        expert: z.string().describe("Criteria or characteristics of a strong/expert level response")
      }).describe("The detailed evaluation rubrics across different experience levels"),
      difficulty: z.enum(["Easy", "Medium", "Hard"]).describe("The difficulty level of this specific question"),
      modelAnswer: z.string().describe("A complete, detailed perfect answer written in the first person as a candidate response")
    })
  ).length(3)
});

const codingQuestionSchema = z.object({
  questions: z.array(
    z.object({
      title: z.string().describe("The LeetCode-style title of the problem"),
      question: z.string().describe("The detailed problem description with markdown formatting. DO NOT ask spoken, behavioral, or HR questions. Focus purely on algorithmic coding challenges."),
      idealAnswer: z.string().describe("The optimal reference solution in Javascript"),
      keywords: z.array(z.string()),
      concepts: z.array(z.string()),
      rubric: z.object({
        beginner: z.string(),
        intermediate: z.string(),
        expert: z.string()
      }),
      difficulty: z.enum(["Easy", "Medium", "Hard"]),
      modelAnswer: z.string().describe("A brief description of the optimal approach in first person"),
      inputFormat: z.string().describe("Description of standard input format"),
      outputFormat: z.string().describe("Description of standard output format"),
      examples: z.array(
        z.object({
          input: z.string(),
          output: z.string(),
          explanation: z.string().optional()
        })
      ).describe("Examples showing input, expected output, and explanation"),
      constraints: z.array(z.string()).describe("List of time/space complexity and input value constraints"),
      notes: z.string().describe("Interviewer hints/notes"),
      starterCode: z.string().describe("Javascript starter code template function"),
      visibleTestCases: z.array(
        z.object({
          input: z.string().describe("STDIN input text"),
          expected: z.string().describe("Expected STDOUT output text"),
          label: z.string()
        })
      ).min(2).max(4).describe("Visible test cases for running in console"),
      hiddenTestCases: z.array(
        z.object({
          input: z.string().describe("STDIN input text"),
          expected: z.string().describe("Expected STDOUT output text"),
          label: z.string()
        })
      ).min(2).max(4).describe("Hidden test cases for automated evaluation submission")
    })
  ).length(3)
});

export async function POST(req: Request) {
  // Ensure the Google Generative AI API key is available
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable');
    return NextResponse.json({ error: 'Missing Google Generative AI API key' }, { status: 500 });
  }
  try {
    const { role, round, difficulty, personality } = await req.json();

    const isCodingRound = round === "Coding" || round === "Technical (Coding)" || round === "Technical Coding";
    const targetSchema = isCodingRound ? codingQuestionSchema : standardQuestionSchema;

    let promptText = "";
    if (isCodingRound) {
      promptText = `You are an expert Senior Technical Recruiter and Engineering Manager.
Generate exactly 3 structured algorithmic coding challenges for a candidate preparing for:
- Target Role: ${role}
- Target Difficulty: ${difficulty}
- Interview Round: ${round} (algorithmic Coding IDE Assessment)

Ensure these are pure coding problems (like LeetCode or HackerRank).
Do NOT generate behavioral, spoken, HR, theory, or verbal questions.
For each coding problem:
1. Provide a title and description.
2. Outline input and output formats.
3. List 2-3 input/output examples with explanations.
4. Set realistic constraints (e.g., nums.length <= 10^5).
5. Generate a starter Javascript code template (e.g., function twoSum(nums, target) { ... }).
6. Provide 2-3 visible test cases and 2-3 hidden test cases (with inputs and expected outputs matching the problem description). Ensure inputs and expected outputs are clear, short strings that match standard JS parsing.
7. Provide the optimal reference solution (idealAnswer) in Javascript and standard rubrics.`;
    } else if (round === "System Design") {
      promptText = `You are an expert Senior Systems Architect and Engineering Manager.
Generate exactly 3 structured system design scenarios for a candidate preparing for:
- Target Role: ${role}
- Target Difficulty: ${difficulty}
- Interview Round: System Design

For each scenario:
1. Formulate a highly realistic system design question (e.g., "Design a distributed rate limiter", "Design a real-time chat service").
2. Detail the exact ideal architecture summary, key scalability trade-offs, database choices, and caching structures.
3. Provide grading rubrics for beginner, intermediate, and expert candidates.`;
    } else {
      promptText = `You are an expert Senior Technical Recruiter and Engineering Manager.
Generate exactly 3 structured interview questions for a candidate preparing for:
- Target Role: ${role}
- Interview Round: ${round}
- Target Difficulty: ${difficulty}
- Interviewer Personality Type: ${personality}

For each question:
1. Formulate a highly realistic question. If it is behavioral, focus on situation-based questions (STAR method).
2. Detail the exact ideal response, key technical terms (keywords), and high-level concepts they must discuss.
3. Outline a detailed grading rubric corresponding to beginner, intermediate, and expert answers.
4. Set the specific difficulty and generate a modelAnswer containing a complete, highly comprehensive response written in the first person as if spoken by a top-tier candidate.
Ensure the questions are distinct and highly specific to the selected role and round.`;
    }

    const result = await generateObject({
      model: google('models/gemini-2.5-flash'),
      schema: targetSchema,
      prompt: promptText
    });

    return NextResponse.json(result.object);
  } catch (error: any) {
    console.error('AI Generate Mock Questions Error:', error);
    const message = error?.message || 'Failed to generate mock questions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
