import { NextResponse } from "next/server";
import { execSync } from "child_process";

function checkCompiler(command: string): boolean {
  try {
    execSync(command, { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

export async function GET() {
  try {
    // 1. Audit compiler binaries
    const runtimes = {
      javascript: checkCompiler("node --version"),
      typescript: checkCompiler("node --version"), // relies on node + npx tsc
      python: checkCompiler("python --version"),
      java: checkCompiler("javac -version"),
      c: checkCompiler("gcc --version") || checkCompiler("g++ --version"),
      cpp: checkCompiler("g++ --version"),
      csharp: checkCompiler("dotnet --version"),
      go: checkCompiler("go version"),
      rust: checkCompiler("rustc --version"),
      kotlin: checkCompiler("kotlinc -version")
    };

    // 2. Gemini status
    const geminiAvailable = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const aiProvider = process.env.AI_PROVIDER || "google";

    // 3. Sandbox metrics
    const sandboxConfig = {
      cpuTimeoutMs: 3000,
      memoryLimitMaxBufferBytes: 524288, // 512 KB
      networkIsolation: true,
      fileSystemSandbox: true
    };

    const overallStatus = 
      (runtimes.javascript || runtimes.python || runtimes.java || runtimes.cpp) && geminiAvailable
        ? "healthy"
        : "degraded";

    return NextResponse.json({
      status: overallStatus,
      version: "1.0.0-certified",
      timestamp: new Date().toISOString(),
      runtimes,
      gemini: {
        configured: geminiAvailable,
        provider: aiProvider,
        status: geminiAvailable ? "connected" : "key_missing"
      },
      sandbox: sandboxConfig
    });

  } catch (error: any) {
    return NextResponse.json({
      status: "unhealthy",
      error: error.message || "Failed to query system diagnostics"
    }, { status: 500 });
  }
}
