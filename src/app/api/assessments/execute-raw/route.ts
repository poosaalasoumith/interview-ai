import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeCodeLocal } from "@/services/piston-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { language, code, stdin } = await req.json();

    if (!language || !code) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const result = await executeCodeLocal(language, code, stdin || "");
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Execute Raw API Error:", error);
    return NextResponse.json({ error: error.message || "Execution failed" }, { status: 500 });
  }
}
