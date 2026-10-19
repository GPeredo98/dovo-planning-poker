import { NextRequest, NextResponse } from "next/server";
import { getCredentialHash, notifyRoomChanged, publicDatabaseError } from "@/lib/room/server";
import { isRoomId } from "@/lib/room/session";
import { normalizeAvatarUrl } from "@/lib/room/avatar";
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
    const avatarUrl = typeof body === "object" && body !== null ? (body as { avatarUrl?: unknown }).avatarUrl : undefined;
    if (typeof avatarUrl !== "string") return NextResponse.json({ error: "invalid_avatar" }, { status: 400 });

    const normalized = normalizeAvatarUrl(avatarUrl);
    if (normalized === null) return NextResponse.json({ error: "invalid_avatar" }, { status: 400 });

    const { error } = await getSupabaseAdmin().rpc("set_participant_avatar", {
      p_room_id: roomId,
      p_credential_hash: credentialHash,
      p_avatar_url: normalized || null,
    });
    if (error) throw error;

    void notifyRoomChanged(roomId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const result = publicDatabaseError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
