export type Locale = "en" | "es" | "ar" | "pt";
export type Theme = "light" | "dark";

export type RoomMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
  hasVoted: boolean;
  vote: string | null;
  originalVote: string | null;
};

export const VOTE_SCALES = {
  fibonacci: ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "?"],
  numbers: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?"],
  shirts: ["XS", "S", "M", "L", "XL", "XXL", "?"],
} as const;
export type VoteScale = keyof typeof VOTE_SCALES;
export type VoteValue = (typeof VOTE_SCALES)[VoteScale][number];
export type RoomSettings = {
  allowVoteChanges: boolean;
  allowReactions: boolean;
  voteScale: VoteScale;
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  allowVoteChanges: true,
  allowReactions: true,
  voteScale: "fibonacci",
};

export function isVoteScale(value: unknown): value is VoteScale {
  return typeof value === "string" && Object.hasOwn(VOTE_SCALES, value);
}

export function isRoomSettings(value: unknown): value is RoomSettings {
  if (typeof value !== "object" || value === null) return false;
  const settings = value as Record<string, unknown>;
  return typeof settings.allowVoteChanges === "boolean"
    && typeof settings.allowReactions === "boolean"
    && isVoteScale(settings.voteScale);
}

export function isVoteValue(value: unknown): value is VoteValue {
  return typeof value === "string" && Object.values(VOTE_SCALES).some((cards) => (cards as readonly string[]).includes(value));
}

export type RoomSnapshot = {
  room: {
    id: string;
    code: string;
    name: string;
    topic: string;
    hostParticipantId: string;
    round: number;
    revealed: boolean;
    expiresAt: string;
    settings: RoomSettings;
    roundSettings: RoomSettings;
  };
  members: RoomMember[];
  currentParticipantId: string;
  myVote: string | null;
};
