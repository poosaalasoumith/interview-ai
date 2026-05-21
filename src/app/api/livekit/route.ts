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
      { error: 'Unauthorized access' },
      { status: 401 }
    );
  }

  // Optional: We can check if the user is authorized for this specific room via Supabase
  // using: const { data: interview } = await supabase.from('interview_sessions').select().eq('room_id', room).single();

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
  
  // Assign permissions: The user can join the room, publish audio, video, and screen share
  at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });

  return NextResponse.json({ token: await at.toJwt() });
}
