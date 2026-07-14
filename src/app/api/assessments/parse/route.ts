import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { AssessmentParser } from "@/utils/assessment-parsers";
import { z } from "zod";

const problemSchema = z.object({
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const fileSize = file.size;
    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    // 1. Upload file to Supabase Storage in assessments bucket
    const bucketName = "assessments";
    const storagePath = `${user.id}/${Date.now()}_${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 550 });
    }

    // 2. Insert into assessment_documents with status = 'processing'
    const { data: docRecord, error: docError } = await supabase
      .from("assessment_documents")
      .insert({
        interviewer_id: user.id,
        file_name: fileName,
        file_path: storagePath,
        file_size: fileSize,
        status: "processing"
      })
      .select()
      .single();

    if (docError || !docRecord) {
      console.error("Doc db log error:", docError);
      return NextResponse.json({ error: "Failed to create document record" }, { status: 500 });
    }

    // 3 & 4. Parse file using unified AssessmentParser pipeline
    let parsedResult;
    try {
      const parser = AssessmentParser.getParser(fileExtension || "");
      parsedResult = await parser.parse(fileBuffer, fileName);
    } catch (parseError: any) {
      console.error("Document parsing failed:", parseError);
      await supabase
        .from("assessment_documents")
        .update({ status: "failed", error_message: parseError.message || "Parsing failed" })
        .eq("id", docRecord.id);

      return NextResponse.json({ error: `Document parsing failed: ${parseError.message}` }, { status: 400 });
    }

    // 5. Store template & questions in DB
    const { data: templateRecord, error: templateError } = await supabase
      .from("assessment_templates")
      .insert({
        title: parsedResult.title || fileName.replace(/\.[^/.]+$/, ""),
        interviewer_id: user.id,
        document_id: docRecord.id
      })
      .select()
      .single();

    if (templateError || !templateRecord) {
      console.error("Template save error:", templateError);
      return NextResponse.json({ error: "Failed to save assessment template" }, { status: 500 });
    }

    // Save questions and testcases
    for (let i = 0; i < parsedResult.questions.length; i++) {
      const q = parsedResult.questions[i];
      const { data: questionRecord, error: questionError } = await supabase
        .from("assessment_questions")
        .insert({
          template_id: templateRecord.id,
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
          constraints: q.constraints,
          examples: q.examples,
          starter_code: q.starter_code,
          marks: q.marks,
          tags: q.tags,
          order_index: i
        })
        .select()
        .single();

      if (questionError || !questionRecord) {
        console.error("Question save error:", questionError);
        continue;
      }

      // Save visible test cases
      if (q.visible_testcases) {
        const visibleInserts = q.visible_testcases.map((tc) => ({
          question_id: questionRecord.id,
          input: tc.input,
          expected_output: tc.output,
          is_hidden: false,
          explanation: tc.explanation || null
        }));
        await supabase.from("question_testcases").insert(visibleInserts);
      }

      // Save hidden test cases
      if (q.hidden_testcases) {
        const hiddenInserts = q.hidden_testcases.map((tc) => ({
          question_id: questionRecord.id,
          input: tc.input,
          expected_output: tc.output,
          is_hidden: true
        }));
        await supabase.from("question_testcases").insert(hiddenInserts);
      }
    }

    // Update document status to parsed
    await supabase
      .from("assessment_documents")
      .update({ status: "parsed" })
      .eq("id", docRecord.id);

    return NextResponse.json({
      success: true,
      templateId: templateRecord.id,
      title: templateRecord.title,
      questionsCount: parsedResult.questions.length
    });

  } catch (error: any) {
    console.error("Upload & parse error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
  }
}
