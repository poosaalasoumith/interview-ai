import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeCodeLocal as executeCode } from "@/services/piston-server";
import { z } from "zod";

import { compareOutputs } from "@/utils/output-comparator";

const aiEvaluationSchema = z.object({
  logicalCorrectness: z.string().describe("Explanation of logic correctness"),
  isLogicalCorrect: z.boolean().describe("True if code is logically correct"),
  isRelevanceValid: z.boolean().describe("True if code is actually solving the problem, not random code"),
  timeComplexity: z.string().describe("Big O time complexity analysis"),
  spaceComplexity: z.string().describe("Big O space complexity analysis"),
  isOptimal: z.boolean().describe("True if the approach is optimal"),
  readabilityScore: z.number().describe("Code quality and readability score out of 100"),
  overallScore: z.number().describe("Overall score for this answer out of 100"),
  feedback: z.string().describe("Detailed, constructive technical feedback for the candidate")
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { attemptId, questionId, code, language } = await req.json();

    if (!attemptId || !questionId || !code || !language) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Fetch the question details
    const { data: question, error: qError } = await supabase
      .from("assessment_questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (qError || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // 2. Fetch all test cases (both visible and hidden) using secure RPC
    const { data: testcases, error: tcError } = await supabase.rpc("get_testcases_for_evaluation", {
      q_id: questionId
    });

    if (tcError || !testcases) {
      console.error("Fetch testcases failed:", tcError);
      return NextResponse.json({ error: "Failed to retrieve test cases" }, { status: 403 });
    }

    // 3. Upsert candidate answer record to get an ID
    const { data: answerRecord, error: ansError } = await supabase
      .from("candidate_answers")
      .upsert({
        attempt_id: attemptId,
        question_id: questionId,
        code: code,
        language: language,
        status: "in_progress", // temporary status
        updated_at: new Date().toISOString()
      }, {
        onConflict: "attempt_id,question_id"
      })
      .select()
      .single();

    if (ansError || !answerRecord) {
      console.error("Answer upsert error:", ansError);
      return NextResponse.json({ error: "Failed to save answer draft" }, { status: 500 });
    }

    const results = [];
    let allTestcasesPassed = true;
    let anyCompilationError = false;

    // 4. Run candidate code against all test cases on Piston
    for (const tc of testcases) {
      let passed = false;
      let runtimeStatus = "Passed";
      let stdout = "";
      let stderr = "";
      let executionTime = 0;

      let compResult: any = null;

      try {
        const response = await executeCode(language, code, tc.input, tc.expected_output, question.starter_code?.[language] || "");
        const runResult = response.run;
        const compileResult = response.compile;

        stdout = runResult?.stdout || "";
        stderr = runResult?.stderr || compileResult?.stderr || "";
        executionTime = parseFloat(runResult?.time || "0") * 1000;

        if (compileResult && compileResult.code !== 0) {
          runtimeStatus = "Compilation Error";
          allTestcasesPassed = false;
          anyCompilationError = true;
        } else if (runResult && runResult.code !== 0) {
          runtimeStatus = "Runtime Error";
          allTestcasesPassed = false;
        } else {
          compResult = compareOutputs(stdout, tc.expected_output);
          if (compResult.result) {
            passed = true;
          } else {
            passed = false;
            runtimeStatus = "Wrong Answer";
            allTestcasesPassed = false;
          }
        }
      } catch (error: any) {
        runtimeStatus = error.message.includes("Rate limit") ? "Time Limit Exceeded" : "Runtime Error";
        stderr = error.message;
        allTestcasesPassed = false;
      }

      results.push({
        testcase_id: tc.id,
        passed,
        stdout,
        stderr,
        runtime_status: runtimeStatus,
        execution_time_ms: Math.round(executionTime),
        diagnostics: compResult
      });

      // Save execution result
      await supabase
        .from("execution_results")
        .upsert({
          candidate_answer_id: answerRecord.id,
          testcase_id: tc.id,
          passed,
          stdout,
          stderr,
          runtime_status: runtimeStatus,
          execution_time_ms: Math.round(executionTime),
          memory_used_kb: 0
        }, {
          onConflict: "candidate_answer_id,testcase_id"
        });

      // Delay to avoid Piston rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 5. Run Semantic Correctness Evaluation with Gemini
    let aiEvaluation;
    try {
      const prompt = `You are a Senior Software Engineer assessing a candidate's code submission for a coding test.
      
Question Title: ${question.title}
Problem Description:
${question.description}
Constraints:
${JSON.stringify(question.constraints)}

Candidate Submission Details:
Language: ${language}
Code:
\`\`\`${language}
${code}
\`\`\`

Execution Analysis:
- Test Cases Passed: ${results.filter(r => r.passed).length} / ${results.length}
- Compilation Error: ${anyCompilationError ? "Yes" : "No"}

Evaluate the submission based on logical correctness, coding best practices, formatting, and optimality. If the code is completely unrelated or a dummy/empty solution, set isRelevanceValid to false.`;

      const response = await generateObject({
        model: google("models/gemini-2.5-flash"),
        schema: aiEvaluationSchema,
        prompt: prompt
      });

      aiEvaluation = response.object;
    } catch (aiError: any) {
      console.error("AI Evaluation error:", aiError);
      // Fallback evaluation structure
      aiEvaluation = {
        logicalCorrectness: "Unable to analyze code logic due to an AI service interruption.",
        isLogicalCorrect: allTestcasesPassed,
        isRelevanceValid: code.trim().length > 10,
        timeComplexity: "Unknown",
        spaceComplexity: "Unknown",
        isOptimal: false,
        readabilityScore: 70,
        overallScore: allTestcasesPassed ? 100 : Math.round((results.filter(r => r.passed).length / results.length) * 100),
        feedback: "Your code was submitted. Test case execution results will be used as the primary score."
      };
    }

    // 6. Enforce Auto-Submission Rules (Section 8)
    // Mark as solved only if: Required visible test cases pass AND hidden validation passes AND code is relevant
    const passedAllTestCasesAndRelevant = allTestcasesPassed && aiEvaluation.isRelevanceValid;
    const finalStatus = passedAllTestCasesAndRelevant ? "solved" : "submitted";

    // Update candidate answer status
    await supabase
      .from("candidate_answers")
      .update({ status: finalStatus })
      .eq("id", answerRecord.id);

    // Save overall score
    const finalScore = passedAllTestCasesAndRelevant 
      ? question.marks 
      : Math.round((results.filter(r => r.passed).length / results.length) * question.marks);

    await supabase
      .from("assessment_scores")
      .upsert({
        attempt_id: attemptId,
        question_id: questionId,
        score: finalScore,
        ai_evaluation: aiEvaluation
      }, {
        onConflict: "attempt_id,question_id"
      });

    return NextResponse.json({
      success: true,
      status: finalStatus,
      score: finalScore,
      passedCount: results.filter(r => r.passed).length,
      totalCount: results.length,
      aiEvaluation
    });

  } catch (error: any) {
    console.error("Submit API Error:", error);
    return NextResponse.json({ error: error.message || "Submission failed" }, { status: 500 });
  }
}
