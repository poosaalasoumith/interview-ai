import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const username = req.nextUrl.searchParams.get("username");

  if (!room) {
    return NextResponse.json(
      { error: 'Missing "room" query parameter' },
      { status: 400 }
    );
  } else if (!username) {
    return NextResponse.json(
      { error: 'Missing "username" query parameter' },
      { status: 400 }
    );
  }

  // 1. Verify user is authenticated
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized access" },
      { status: 401 }
    );
  }

  // Fetch role and name from public.users profile, fallback to user_metadata
  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role || user.user_metadata?.role || "candidate";
  const fullName = profile?.name || user.user_metadata?.full_name || username;
  const isModerator = userRole === "interviewer" || userRole === "admin";

  // 2. Fetch the interview details to perform security & timing validation
  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", room)
    .single();

  if (fetchError || !interview) {
    return NextResponse.json(
      { error: "Interview room not found" },
      { status: 404 }
    );
  }

  // Candidates undergo timing and lifecycle validations
  if (!isModerator) {
    const sessionStatus = interview.session_status;
    const now = Date.now();
    const scheduledTime = new Date(interview.scheduled_at).getTime();

    // 2.1 Block if forcefully terminated or expired
    if (sessionStatus === "terminated" || sessionStatus === "expired") {
      return NextResponse.json(
        { error: "Access Denied: Session is terminated or expired" },
        { status: 403 }
      );
    }

    // 2.2 Block if before scheduled start time
    if (now < scheduledTime) {
      return NextResponse.json(
        { error: "Access Denied: Interview has not started yet" },
        { status: 403 }
      );
    }

    // 2.3 Block if after grace join window (15 mins) and never started
    const fifteenMinutes = 15 * 60 * 1000;
    if (now - scheduledTime > fifteenMinutes && !interview.actual_started_at) {
      return NextResponse.json(
        { error: "Access Denied: Join window has expired" },
        { status: 403 }
      );
    }
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "Server misconfigured: missing LiveKit environment variables" },
      { status: 500 }
    );
  }

  const at = new AccessToken(apiKey, apiSecret, { identity: username });
  
  at.name = fullName;
  at.metadata = JSON.stringify({ role: userRole });

  // Enforce readonly review pub-sub strip
  let canPublish = true;
  if (!isModerator && (interview.session_status === "submitted" || interview.session_status === "completed" || interview.status === "completed")) {
    canPublish = false;
  }

  // Assign permissions based on review vs active status
  at.addGrant({ 
    roomJoin: true, 
    room: room, 
    canPublish: canPublish, 
    canSubscribe: true,
    canPublishData: canPublish 
  });

  return NextResponse.json({ token: await at.toJwt() });
}
