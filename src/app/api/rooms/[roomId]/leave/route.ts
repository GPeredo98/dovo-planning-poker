import { NextRequest, NextResponse } from "next/server";
import { getCredentialHash, notifyRoomChanged, publicDatabaseError } from "@/lib/room/server";
import { clearGuestSessionCookie, isRoomId } from "@/lib/room/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  if (!isRoomId(roomId)) return NextResponse.json({ error: "room_not_found" }, { status: 404 });

  const credentialHash = getCredentialHash(request, roomId);
  if (!credentialHash) {
    return clearGuestSessionCookie(NextResponse.json({ error: "session_missing" }, { status: 401 }), roomId);
  }

  try {
    const { error } = await getSupabaseAdmin().rpc("leave_room", {
      p_room_id: roomId,
      p_credential_hash: credentialHash,
    });
    if (error) throw error;

    const response = clearGuestSessionCookie(NextResponse.json({ ok: true }), roomId);
    void notifyRoomChanged(roomId);
    return response;
  } catch (error) {
    const result = publicDatabaseError(error);
    const response = NextResponse.json({ error: result.error }, { status: result.status });
    if (result.status === 401 || result.status === 404) {
      return clearGuestSessionCookie(response, roomId);
    }
    return response;
  }
}