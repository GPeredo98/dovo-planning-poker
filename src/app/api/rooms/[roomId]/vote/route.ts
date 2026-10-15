import { NextRequest, NextResponse } from "next/server";
import { getCredentialHash, notifyRoomChanged, publicDatabaseError } from "@/lib/room/server";
import { isRoomId } from "@/lib/room/session";
import { VOTE_CARDS } from "@/lib/room/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  if (!isRoomId(roomId)) return NextResponse.json({ error: "room_not_found" }, { status: 404 });

  const credentialHash = getCredentialHash(request, roomId);
  if (!credentialHash) return NextResponse.json({ error: "session_invalid" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const value = typeof body === "object" && body !== null && "value" in body ? body.value : null;
    if (typeof value !== "string" || !VOTE_CARDS.includes(value as (typeof VOTE_CARDS)[number])) {
      return NextResponse.json({ error: "invalid_vote" }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin().rpc("submit_room_vote", {
      p_room_id: roomId,
      p_credential_hash: credentialHash,
      p_value: value,
    });
    if (error) throw error;

    void notifyRoomChanged(roomId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const result = publicDatabaseError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
