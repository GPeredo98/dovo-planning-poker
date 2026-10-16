import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export function isRoomId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createGuestCredential() {
  return randomBytes(32).toString("base64url");
}

export function hashGuestCredential(credential: string) {
  return createHash("sha256").update(credential).digest("hex");
}

function cookieName(roomId: string) {
  return `dovo_room_${roomId}`;
}

export function readGuestCredential(request: NextRequest, roomId: string) {
  return request.cookies.get(cookieName(roomId))?.value ?? null;
}

export function setGuestSessionCookie(response: NextResponse, roomId: string, credential: string) {
  response.cookies.set(cookieName(roomId), credential, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/rooms/${roomId}`,
  });

  return response;
}

export function clearGuestSessionCookie(response: NextResponse, roomId: string) {
  response.cookies.set(cookieName(roomId), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/rooms/${roomId}`,
    maxAge: 0,
  });

  return response;
}
