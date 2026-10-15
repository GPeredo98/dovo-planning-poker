import { NextRequest, NextResponse } from "next/server";
import { getCredentialHash, publicDatabaseError } from "@/lib/room/server";
import { isRoomId } from "@/lib/room/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  if (!isRoomId(roomId)) return NextResponse.json({ error: "room_not_found" }, { status: 404 });

  const credentialHash = getCredentialHash(request, roomId);
  if (!credentialHash) return NextResponse.json({ error: "session_missing" }, { status: 401 });

  try {
    const { data, error } = await getSupabaseAdmin().rpc("get_room_snapshot", {
      p_room_id: roomId,
      p_credential_hash: credentialHash,
    });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "session_invalid" }, { status: 401 });

    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const result = publicDatabaseError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
