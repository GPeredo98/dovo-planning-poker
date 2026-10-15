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
    const values = typeof body === "object" && body !== null
      ? body as { name?: unknown; topic?: unknown }
      : {};
    const name = values.name;
    const topic = typeof values.topic === "string" ? values.topic.trim() : "";
    if (!isValidName(name)) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    if (topic.length < 1 || topic.length > 80) return NextResponse.json({ error: "invalid_topic" }, { status: 400 });

    if (!(await checkRateLimit(request, "create", 10))) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const credential = createGuestCredential();
    const { data, error } = await getSupabaseAdmin().rpc("create_room", {
      p_name: cleanName(name),
      p_topic: topic,
      p_credential_hash: hashGuestCredential(credential),
    });
    if (error) throw error;

    const roomId = data?.roomId;
    if (typeof roomId !== "string" || !isRoomId(roomId)) throw new Error("room_not_found");

    const response = NextResponse.json({ roomId }, { status: 201 });
    setGuestSessionCookie(response, roomId, credential);
    void notifyRoomChanged(roomId);
    return response;
  } catch (error) {
    const result = publicDatabaseError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
