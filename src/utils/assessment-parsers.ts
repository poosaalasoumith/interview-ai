import mammoth from "mammoth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// Normalize schema Zod object
export const normalizedAssessmentSchema = z.object({
  title: z.string().describe("General title of the question paper/template"),
  questions: z.array(z.object({
    title: z.string().describe("Problem title (e.g. 'Two Sum')"),
    description: z.string().describe("Comprehensive problem description in Markdown format. Explain task clearly."),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    constraints: z.array(z.string()).describe("Constraints, e.g., '1 <= nums.length <= 10^5'"),
    examples: z.array(z.object({
      input: z.string().describe("Example input"),
      output: z.string().describe("Example output"),
      explanation: z.string().optional().describe("Explanation for output")
    })),
    starter_code: z.object({
      javascript: z.string().describe("JavaScript starter function template"),
      python: z.string().describe("Python starter function template"),
      java: z.string().describe("Java starter class/method template"),
      cpp: z.string().describe("C++ starter class/method template")
    }).describe("Starter code templates for the candidate"),
    marks: z.number().default(10).describe("Marks allocated to this question"),
    tags: z.array(z.string()).describe("Tags/categories (e.g. ['Array', 'Hash Map'])"),
    visible_testcases: z.array(z.object({
      input: z.string().describe("Standard test case input"),
      output: z.string().describe("Expected test case output"),
      explanation: z.string().optional()
    })).min(2).describe("At least 2-3 visible test cases for run code"),
    hidden_testcases: z.array(z.object({
      input: z.string().describe("Hidden evaluation input"),
      output: z.string().describe("Expected output for evaluation")
    })).min(3).describe("At least 3-5 hidden test cases for submit code, representing boundary and edge cases")
  }))
});

export type NormalizedAssessment = z.infer<typeof normalizedAssessmentSchema>;

export interface IAssessmentParser {
  parse(buffer: Buffer, fileName: string): Promise<NormalizedAssessment>;
}

// 1. PDF Parser using Gemini multimodal capabilities
export class PdfParser implements IAssessmentParser {
  async parse(buffer: Buffer, fileName: string): Promise<NormalizedAssessment> {
    const base64Pdf = buffer.toString("base64");
    const response = await generateObject({
      model: google("models/gemini-2.5-flash"),
      schema: normalizedAssessmentSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert technical assessment creator. Analyze this question paper (PDF) and extract all programming/coding questions. 
              
For each question:
1. Provide a clear Markdown-formatted description.
2. If there are no starter code templates in the document, you MUST design clean starter code functions/templates for javascript, python, java, and cpp.
3. If no test cases are explicitly present, you MUST generate:
   - At least 2-3 visible test cases (including input, expected output, and explanation).
   - At least 3-5 hidden test cases representing boundary conditions, empty inputs, negative numbers, or large limits.
4. Set marks and difficulty dynamically if not defined.
5. Provide a general title for the overall paper.`
            },
            {
              type: "file",
              data: base64Pdf,
              mediaType: "application/pdf"
            }
          ]
        }
      ]
    });
    return response.object;
  }
}

// 2. DOCX Parser using Mammoth and AI Normalization
export class DocxParser implements IAssessmentParser {
  async parse(buffer: Buffer, fileName: string): Promise<NormalizedAssessment> {
    const result = await mammoth.extractRawText({ buffer });
    const extractedText = result.value;
    return runAiNormalization(extractedText);
  }
}

// 3. Markdown Parser
export class MarkdownParser implements IAssessmentParser {
  async parse(buffer: Buffer, fileName: string): Promise<NormalizedAssessment> {
    const extractedText = buffer.toString("utf-8");
    return runAiNormalization(extractedText);
  }
}

// 4. Text Parser (Plain Text)
export class TextParser implements IAssessmentParser {
  async parse(buffer: Buffer, fileName: string): Promise<NormalizedAssessment> {
    const extractedText = buffer.toString("utf-8");
    return runAiNormalization(extractedText);
  }
}

// Unified helper to run AI Normalization on extracted text
async function runAiNormalization(text: string): Promise<NormalizedAssessment> {
  const response = await generateObject({
    model: google("models/gemini-2.5-flash"),
    schema: normalizedAssessmentSchema,
    prompt: `You are an expert technical assessment creator. Analyze this question paper text and extract all programming/coding questions.
    
Document Text Content:
${text}

For each question:
1. Provide a clear Markdown-formatted description.
2. If there are no starter code templates in the document, you MUST design clean starter code functions/templates for javascript, python, java, and cpp.
3. If no test cases are explicitly present, you MUST generate:
   - At least 2-3 visible test cases (including input, expected output, and explanation).
   - At least 3-5 hidden test cases representing boundary conditions, empty inputs, negative numbers, or large limits.
4. Set marks and difficulty dynamically if not defined.
5. Provide a general title for the overall paper.`
  });
  return response.object;
}

// Unified parser factory
export class AssessmentParser {
  static getParser(fileExtension: string): IAssessmentParser {
    switch (fileExtension.toLowerCase()) {
      case "pdf":
        return new PdfParser();
      case "docx":
        return new DocxParser();
      case "md":
      case "markdown":
        return new MarkdownParser();
      case "txt":
      case "text":
        return new TextParser();
      default:
        throw new Error(`Unsupported file format: .${fileExtension}`);
    }
  }
}
