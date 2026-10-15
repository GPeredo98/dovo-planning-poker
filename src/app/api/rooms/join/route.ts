import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, cleanName, isValidName, notifyRoomChanged, publicDatabaseError } from "@/lib/room/server";
import { createGuestCredential, hashGuestCredential, isRoomId, setGuestSessionCookie } from "@/lib/room/session";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
    }

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const values = body as { name?: unknown; roomId?: unknown; roomCode?: unknown };
    if (!isValidName(values.name)) return NextResponse.json({ error: "invalid_name" }, { status: 400 });

    const roomId = typeof values.roomId === "string" && isRoomId(values.roomId) ? values.roomId : null;
    const roomCode = typeof values.roomCode === "string" ? values.roomCode.trim().toUpperCase() : null;
    if (!roomId && (!roomCode || !/^[A-F0-9]{8}$/.test(roomCode))) {
      return NextResponse.json({ error: "invalid_room_code" }, { status: 400 });
    }

    if (!(await checkRateLimit(request, "join", 20))) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const credential = createGuestCredential();
    const { data, error } = await getSupabaseAdmin().rpc("join_room", {
      p_room_id: roomId,
      p_room_code: roomCode,
      p_name: cleanName(values.name),
      p_credential_hash: hashGuestCredential(credential),
    });
    if (error) throw error;

    const joinedRoomId = data?.roomId;
    if (typeof joinedRoomId !== "string" || !isRoomId(joinedRoomId)) throw new Error("room_not_found");

    const response = NextResponse.json({ roomId: joinedRoomId }, { status: 200 });
    setGuestSessionCookie(response, joinedRoomId, credential);
    void notifyRoomChanged(joinedRoomId);
    return response;
  } catch (error) {
    const result = publicDatabaseError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
