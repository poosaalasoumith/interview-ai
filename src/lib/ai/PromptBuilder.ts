import { SessionContext } from "./SessionContextManager";

export class AIPromptBuilder {
  static build(policyPrompt: string, context: SessionContext): string {
    const formattedTestCases =
      context.testCases.length > 0
        ? context.testCases
            .map(
              (tc: any, i: number) =>
                `TC #${i + 1}: Input: ${tc.input} | Expected: ${tc.expected} | Status: ${tc.status || "idle"} | Error: ${tc.error || "none"}`
            )
            .join("\n")
        : "No test cases executed yet";

    const problemDesc =
      context.problemStatement?.question ||
      context.problemStatement?.description ||
      "Not Specified";
      
    const rubrics = context.problemStatement?.rubric
      ? JSON.stringify(context.problemStatement.rubric)
      : "Standard Rubric";

    const hintEngineInstruction = `
=========================================
PROGRESSIVE HINT ENGINE STATE
=========================================
- Previous Hints Count: ${context.hintLevel - 1}
- Next Hint to Provide: Hint #${context.hintLevel} (out of 3)

PROGRESSIVE HINT ENGINE PROTOCOL:
If the user is asking for a hint or help:
1. If this is Hint #1: Provide a conceptual, high-level guide. Do not give away coding implementations.
2. If this is Hint #2: Provide a more specific logic prompt or pseudo-code strategy.
3. If this is Hint #3: Provide a detailed step-by-step logic breakdown.
4. If this is after Hint #3: Provide a conceptual explanation.
Never repeat a hint that was already given. Never restart the sequence from Hint #1.
`;

    const structuredResponseTemplate = `
=========================================
RESPONSE FORMATTING PROTOCOL
=========================================
You MUST structure your response strictly inside the "message" field of the JSON object. Use Markdown formatting inside the "message" string. Keep other keys as metadata.
Your response message text MUST include the following sections, formatted with these exact markdown headers:
### Summary
[A concise summary of the issue, compiler errors, or concepts discussed]

### Explanation
[Detailed explanation of the engineering logic, theory, or patterns]

### Reasoning
[Your reasoning and code analysis about the candidate's current approach]

### Hints / Recommendations
[Actionable guidance and progressive hints]

### Next Step
[A single clear question or action for the candidate to take next]

### Related Concepts
[A list of related engineering or computer science concepts]

Do not output single-paragraph dumps. Be structured, professional, and clear.
`;

    return `${policyPrompt}

${hintEngineInstruction}
${structuredResponseTemplate}

=========================================
CURRENT SESSION CONTEXT
=========================================
- User Role: ${context.role}
- Mode: ${context.assistantMode}
- Session Type: ${context.sessionType}
- Difficulty: ${context.difficulty}
- Elapsed Time: ${context.elapsedTime}

=========================================
ACTIVE QUESTION DETAILS
=========================================
- Question Title: ${context.problemStatement?.title || "Theory / General Practice"}
- Description: ${problemDesc}
- Stored Evaluation Rubric: ${rubrics}

=========================================
CODE & COMPILER STATES
=========================================
- Programming Language: ${context.language}
- Cursor Selection: ${context.selectedCode ? `\n\`\`\`\n${context.selectedCode}\n\`\`\`` : "None"}
- Compiler/Terminal Output: ${context.compilerOutput}
- Active Code in Editor:
\`\`\`${context.language}
${context.code || "// No code written yet"}
\`\`\`

=========================================
TEST CASE RUNS
=========================================
${formattedTestCases}

=========================================
VERBAL TRANSCRIPT (SPEECH DICTATION LOGS)
=========================================
${context.candidateTranscript || "No voice inputs recorded yet."}
`;
  }
}
