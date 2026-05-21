import { SUPPORTED_LANGUAGES } from "@/constants/languages";

const PISTON_API_URL = "https://emkc.org/api/v2/piston/execute";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  output: string;
  code: number;
  signal: string;
  time: string;
}

export interface PistonResponse {
  language: string;
  version: string;
  run: ExecutionResult;
  compile?: ExecutionResult;
}

let lastExecutionTime = 0;
const EXECUTION_COOLDOWN = 2000; // 2 seconds between executions

export async function executeCode(languageId: string, sourceCode: string): Promise<PistonResponse> {
  const now = Date.now();
  if (now - lastExecutionTime < EXECUTION_COOLDOWN) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil((EXECUTION_COOLDOWN - (now - lastExecutionTime)) / 1000)}s before running again.`);
  }

  const languageObj = SUPPORTED_LANGUAGES.find((lang) => lang.id === languageId);
  
  if (!languageObj) {
    throw new Error(`Unsupported language: ${languageId}`);
  }

  try {
    const response = await fetch(PISTON_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: languageObj.id,
        version: languageObj.version,
        files: [
          {
            content: sourceCode,
          },
        ],
        stdin: "",
        args: [],
        compile_timeout: 10000,
        run_timeout: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Execution service error: ${response.statusText}`);
    }

    const data: PistonResponse = await response.json();
    lastExecutionTime = Date.now();
    return data;
  } catch (error: any) {
    throw new Error(error.message || "An unexpected error occurred during execution.");
  }
}
