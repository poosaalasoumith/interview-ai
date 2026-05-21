import { createClient } from "@/utils/supabase/client";

export interface SubmissionPayload {
  interview_id: string;
  code: string;
  language: string;
  output: string;
  status: string;
  execution_time: number;
}

export async function logSubmission(payload: SubmissionPayload) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.warn("No authenticated user found for submission logging.");
    return null;
  }

  const { data, error } = await supabase
    .from("submissions")
    .insert([
      {
        interview_id: payload.interview_id,
        user_id: user.id,
        code: payload.code,
        language: payload.language,
        output: payload.output,
        status: payload.status,
        execution_time: payload.execution_time,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Failed to log submission:", error);
    return null;
  }

  return data;
}
