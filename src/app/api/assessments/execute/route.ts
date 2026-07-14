import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeCodeLocal as executeCode } from "@/services/piston-server";
import { compareOutputs } from "@/utils/output-comparator";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { questionId, code, language, runAll } = await req.json();

    if (!questionId || !code || !language) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const { data: question } = await supabase
      .from("assessment_questions")
      .select("starter_code")
      .eq("id", questionId)
      .single();

    const starterCode = question?.starter_code?.[language] || "";

    let testcases: any[] = [];

    if (runAll) {
      // Call secure RPC that bypasses RLS for hidden test cases if authorized
      const { data, error: rpcError } = await supabase.rpc("get_testcases_for_evaluation", {
        q_id: questionId
      });

      if (rpcError) {
        console.error("RPC Fetch error:", rpcError);
        return NextResponse.json({ error: "Unauthorized or failed to retrieve test cases" }, { status: 403 });
      }
      testcases = data || [];
    } else {
      // Normal execution - fetch only visible test cases
      const { data, error: fetchError } = await supabase
        .from("question_testcases")
        .select("*")
        .eq("question_id", questionId)
        .eq("is_hidden", false);

      if (fetchError) {
        console.error("Fetch testcases error:", fetchError);
        return NextResponse.json({ error: "Failed to retrieve test cases" }, { status: 500 });
      }
      testcases = data || [];
    }

    const results = [];
    let overallPassed = true;
    let accumulatedStdout = "";
    let accumulatedStderr = "";
    let maxRuntime = 0;
    let compiled = true;
    let executed = true;
    let overallExitCode = 0;

    // Run test cases sequentially using Piston
    for (const tc of testcases) {
      try {
        const response = await executeCode(language, code, tc.input, tc.expected_output, starterCode);
        const runResult = response.run;
        const compileResult = response.compile;

        let passed = false;
        let runtimeStatus = "Passed";
        const stdout = runResult?.stdout || "";
        const stderr = runResult?.stderr || compileResult?.stderr || "";
        const exitCode = runResult?.code ?? 0;
        if (exitCode !== 0) overallExitCode = exitCode;

        let compResult = null;

        if (compileResult && compileResult.code !== 0) {
          runtimeStatus = "Compilation Error";
          compiled = false;
          executed = false;
          overallPassed = false;
        } else if (runResult && runResult.code !== 0) {
          runtimeStatus = "Runtime Error";
          overallPassed = false;
        } else {
          compResult = compareOutputs(stdout, tc.expected_output);
          if (compResult.result) {
            passed = true;
          } else {
            passed = false;
            runtimeStatus = "Wrong Answer";
            overallPassed = false;
          }
        }

        if (stdout) accumulatedStdout += `[Test Case STDOUT]:\n${stdout}\n`;
        if (stderr) accumulatedStderr += `[Test Case STDERR]:\n${stderr}\n`;
        
        const runtimeMs = parseFloat(runResult?.time || "0") * 1000;
        if (runtimeMs > maxRuntime) maxRuntime = runtimeMs;

        // Mask inputs/outputs for hidden test cases
        if (tc.is_hidden) {
          results.push({
            id: tc.id,
            passed,
            is_hidden: true,
            runtime_status: runtimeStatus,
            execution_time_ms: Math.round(runtimeMs),
            memory_used_kb: 4096,
            diagnostics: compResult
          });
        } else {
          results.push({
            id: tc.id,
            passed,
            is_hidden: false,
            runtime_status: runtimeStatus,
            stdout: stdout,
            stderr: stderr,
            input: tc.input,
            expected_output: tc.expected_output,
            explanation: tc.explanation,
            execution_time_ms: Math.round(runtimeMs),
            memory_used_kb: 4096,
            diagnostics: compResult
          });
        }

      } catch (error: any) {
        overallPassed = false;
        results.push({
          id: tc.id,
          passed: false,
          is_hidden: tc.is_hidden,
          runtime_status: error.message.includes("Rate limit") ? "Time Limit Exceeded" : "Runtime Error",
          stderr: error.message,
          execution_time_ms: 0,
          memory_used_kb: 0
        });
      }

      // Add a small 100ms delay between Piston calls to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;

    const summary = {
      compiled,
      executed,
      stdout: accumulatedStdout.trim(),
      stderr: accumulatedStderr.trim(),
      exitCode: overallExitCode,
      runtimeMs: Math.round(maxRuntime),
      memoryKb: 4096,
      passedTests,
      failedTests,
      overallResult: overallPassed && results.length > 0 ? "PASS" : "FAIL"
    };

    return NextResponse.json({ results, summary });

  } catch (error: any) {
    console.error("Execute API Error:", error);
    return NextResponse.json({ error: error.message || "Execution failed" }, { status: 500 });
  }
}
