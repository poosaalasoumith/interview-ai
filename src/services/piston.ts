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

export async function executeCode(
  languageId: string,
  sourceCode: string,
  stdin: string = ""
): Promise<PistonResponse> {
  const response = await fetch("/api/assessments/execute-raw", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: languageId,
      code: sourceCode,
      stdin,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Execution failed with status ${response.status}`);
  }

  return response.json();
}
