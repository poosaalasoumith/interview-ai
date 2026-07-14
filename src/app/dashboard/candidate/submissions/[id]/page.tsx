import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SubmissionDetailClient } from "./detail-client";

export default async function SubmissionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const id = resolvedParams.id;
  const type = resolvedSearchParams.type || "";

  // Strip possible sandbox routing prefix
  const dbId = id.startsWith("sandbox-") ? id.substring(8) : id;

  let detailData: any = null;

  try {
    if (type === "Compiler Sandbox") {
      const { data } = await supabase
        .from("submissions")
        .select("*, interviews(title)")
        .eq("id", dbId)
        .single();
      detailData = data;
    } else if (type === "Practice" || type === "Mock Interview") {
      const { data } = await supabase
        .from("practice_interviews")
        .select("*")
        .eq("id", dbId)
        .single();
      detailData = data;
    } else if (type === "Real Interview") {
      const { data } = await supabase
        .from("feedback")
        .select(`
          *,
          interview:interview_id(title, scheduled_at),
          interviewer:interviewer_id(name, email, avatar)
        `)
        .eq("interview_id", dbId)
        .single();
      detailData = data;
    }
  } catch (err) {
    console.error(`[Detail Server] Error fetching detail data for ${type} ID ${dbId}:`, err);
  }

  return (
    <SubmissionDetailClient id={id} type={type} detailData={detailData} />
  );
}
