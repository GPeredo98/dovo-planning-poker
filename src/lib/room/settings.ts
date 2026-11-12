import { DEFAULT_ROOM_SETTINGS, isRoomSettings, type RoomSettings } from "@/lib/room/types";

const storageKey = "dovo.roomSettings";

export function readRoomSettings(): RoomSettings {
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return DEFAULT_ROOM_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isRoomSettings(parsed) ? parsed : DEFAULT_ROOM_SETTINGS;
  } catch (error) {
    if (error instanceof SyntaxError) return DEFAULT_ROOM_SETTINGS;
    throw error;
  }
}

export function saveRoomSettings(settings: RoomSettings) {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}
