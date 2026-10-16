import "server-only";

import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashGuestCredential, readGuestCredential } from "@/lib/room/session";

export function isValidName(value: unknown): value is string {
  return typeof value === "string" && Array.from(value.trim()).length > 0 && Array.from(value.trim()).length <= 32;
}

export function cleanName(value: string) {
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 32);
}

export function getCredentialHash(request: NextRequest, roomId: string) {
  const credential = readGuestCredential(request, roomId);
  return credential ? hashGuestCredential(credential) : null;
}

export async function checkRateLimit(request: NextRequest, scope: "create" | "join", limit: number) {
  const address = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || "unknown";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return false;

  const key = createHmac("sha256", serviceKey).update(address).digest("hex");
  const { data, error } = await getSupabaseAdmin().rpc("consume_rate_limit", {
    p_scope: scope,
    p_key: key,
    p_limit: limit,
    p_window_seconds: 600,
  });

  if (error) throw error;
  return data === true;
}

export async function notifyRoomChanged(roomId: string) {
  try {
    const client = getSupabaseAdmin();
    const channel = client.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    const subscribed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });

    if (subscribed) {
      await channel.send({
        type: "broadcast",
        event: "changed",
        payload: { at: Date.now() },
      });
    }

    await client.removeChannel(channel);
  } catch {
    // Realtime is a notification path; clients also refresh snapshots periodically.
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "";
}

export function publicDatabaseError(error: unknown) {
  const code = getErrorMessage(error).toLowerCase();

  if (code.includes("supabase_not_configured")) {
    return { status: 503, error: "supabase_not_configured" };
  }
  if (code.includes("host_required")) return { status: 403, error: "host_required" };
  if (code.includes("participant_not_found")) return { status: 401, error: "session_invalid" };
  if (code.includes("room_not_found")) return { status: 404, error: "room_not_found" };
  if (code.includes("room_expired")) return { status: 410, error: "room_expired" };
  if (code.includes("round_revealed")) return { status: 409, error: "round_revealed" };
  if (code.includes("invalid_vote")) return { status: 400, error: "invalid_vote" };
  if (code.includes("target_not_found")) return { status: 404, error: "target_not_found" };
  if (code.includes("invalid_room_name")) return { status: 400, error: "invalid_room_name" };
  return { status: 500, error: "action_failed" };
}
