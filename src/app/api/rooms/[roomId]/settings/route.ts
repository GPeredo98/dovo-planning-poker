import { NextRequest, NextResponse } from "next/server";
import { getCredentialHash, notifyRoomChanged, publicDatabaseError } from "@/lib/room/server";
import { isRoomId } from "@/lib/room/session";
import { isRoomSettings } from "@/lib/room/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  if (!isRoomId(roomId)) return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  const credentialHash = getCredentialHash(request, roomId);
  if (!credentialHash) return NextResponse.json({ error: "session_invalid" }, { status: 401 });

  try {
    const settings: unknown = await request.json();
    if (!isRoomSettings(settings)) return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
    const { error } = await getSupabaseAdmin().rpc("update_room_settings", {
      p_room_id: roomId,
      p_credential_hash: credentialHash,
      p_settings: settings,
    });
    if (error) throw error;
    void notifyRoomChanged(roomId);
    const { data: snapshot, error: snapshotError } = await getSupabaseAdmin().rpc("get_room_snapshot", {
      p_room_id: roomId,
      p_credential_hash: credentialHash,
    });
    if (snapshotError) throw snapshotError;
    if (!snapshot) return NextResponse.json({ error: "session_invalid" }, { status: 401 });
    return NextResponse.json(snapshot);
  } catch (error) {
    const result = publicDatabaseError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
