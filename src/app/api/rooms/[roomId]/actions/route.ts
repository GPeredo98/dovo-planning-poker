import { NextRequest, NextResponse } from "next/server";
import { getCredentialHash, notifyRoomChanged, publicDatabaseError } from "@/lib/room/server";
import { isRoomId } from "@/lib/room/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const allowedActions = new Set([
  "reveal",
  "clear",
  "rename_room",
  "rename_topic",
  "transfer_host",
  "remove_member",
]);

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
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const values = body as { action?: unknown; value?: unknown; targetParticipantId?: unknown };
    if (typeof values.action !== "string" || !allowedActions.has(values.action)) {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    if (values.value !== undefined && (typeof values.value !== "string" || values.value.trim().length > 80)) {
      return NextResponse.json({ error: "invalid_value" }, { status: 400 });
    }
    if (values.targetParticipantId !== undefined && typeof values.targetParticipantId !== "string") {
      return NextResponse.json({ error: "invalid_target" }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin().rpc("perform_room_action", {
      p_room_id: roomId,
      p_credential_hash: credentialHash,
      p_action: values.action,
      p_value: typeof values.value === "string" ? values.value.trim() : null,
      p_target_participant_id: typeof values.targetParticipantId === "string" ? values.targetParticipantId : null,
    });
    if (error) throw error;

    void notifyRoomChanged(roomId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const result = publicDatabaseError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
