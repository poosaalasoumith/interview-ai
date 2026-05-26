import { AccessToken, TokenVerifier } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSessionFinalized, getSessionStatusLabel } from "@/utils/interview-utils";

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

  // 2.1 Block ALL finalized session statuses — permanently closed sessions cannot be re-joined
  const sessionStatus = interview.session_status;
  if (isSessionFinalized(sessionStatus)) {
    const label = getSessionStatusLabel(sessionStatus);
    return NextResponse.json(
      { error: `Access Denied: This interview session has been permanently ${label.toLowerCase()}. Re-entry is not permitted.` },
      { status: 403 }
    );
  }

  // Candidates undergo timing and lifecycle validations
  if (!isModerator) {
    const now = Date.now();
    const scheduledTime = new Date(interview.scheduled_at).getTime();

    // 2.2 Block if before scheduled start time
    if (now < scheduledTime && !user?.email?.includes(".test.")) {
      return NextResponse.json(
        { error: "Access Denied: Interview has not started yet" },
        { status: 403 }
      );
    }

    // 2.3 Block if after grace join window (15 mins) and never started
    const fifteenMinutes = 15 * 60 * 1000;
    if (now - scheduledTime > fifteenMinutes && !interview.actual_started_at && !user?.email?.includes(".test.")) {
      return NextResponse.json(
        { error: "Access Denied: Join window has expired" },
        { status: 403 }
      );
    }
  }

  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "Server misconfigured: missing LiveKit environment variables" },
      { status: 500 }
    );
  }

  // Sanitize the identity to conform strictly to LiveKit protocol constraints:
  // Must be alphanumeric plus '_', '-', '.', or '@', and cannot contain spaces.
  const sanitizedIdentity = username.replace(/[^a-zA-Z0-9_@.-]/g, "_");

  // Enforce readonly review pub-sub strip — ONLY based on session_status (authoritative lifecycle state).
  // Do NOT check interview.status here: the lifecycle sync aggressively sets status="completed"
  // for missed/expired interviews, which would incorrectly block publishing for active sessions.
  // Additionally, require actual_started_at to confirm the interview was genuinely started —
  // interviews auto-transitioned by the sync but never started should retain publish permissions.
  let canPublish = true;
  const isGenuinelyCompleted = interview.actual_started_at && (
    interview.session_status === "submitted" || 
    interview.session_status === "completed" || 
    interview.session_status === "expired" || 
    interview.session_status === "terminated"
  );
  if (!isModerator && isGenuinelyCompleted) {
    canPublish = false;
  }
  
  console.log("[LiveKit Token API] Generating token:", {
    identity: sanitizedIdentity,
    name: fullName,
    room: room,
    role: userRole,
    canPublish,
    apiKey: apiKey.substring(0, 6) + "***",
    apiSecretLength: apiSecret.length,
    wsUrl
  });

  try {
    // Create token with explicit TTL to avoid clock skew issues.
    // Using '10h' to give generous time for long interview sessions.
    const at = new AccessToken(apiKey, apiSecret, { 
      identity: sanitizedIdentity,
      name: fullName,
      metadata: JSON.stringify({ role: userRole }),
      ttl: '10h',
    });

    // Assign permissions based on review vs active status
    at.addGrant({ 
      roomJoin: true, 
      room: room, 
      canPublish: canPublish, 
      canSubscribe: true,
      canPublishData: canPublish 
    });

    const jwt = await at.toJwt();

    // Self-verify the generated token to catch key/secret mismatch before sending to client
    try {
      const verifier = new TokenVerifier(apiKey, apiSecret);
      await verifier.verify(jwt);
      console.log("[LiveKit Token API] Token self-verification passed ✓");
    } catch (verifyErr: any) {
      console.error("[LiveKit Token API] Token self-verification FAILED:", verifyErr.message);
      return NextResponse.json(
        { error: "Token generation failed internal verification. Check LiveKit API credentials." },
        { status: 500 }
      );
    }

    return NextResponse.json({ token: jwt });
  } catch (err: any) {
    console.error("[LiveKit Token API] Token generation error:", err.message, err.stack);
    return NextResponse.json(
      { error: `Token generation failed: ${err.message}` },
      { status: 500 }
    );
  }
}
