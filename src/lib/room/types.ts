export type Locale = "en" | "es" | "ar" | "pt";
export type Theme = "light" | "dark";

export type RoomMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
  hasVoted: boolean;
  vote: string | null;
};

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
  };
  members: RoomMember[];
  currentParticipantId: string;
  myVote: string | null;
};

export const VOTE_CARDS = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "?"] as const;
export type VoteValue = (typeof VOTE_CARDS)[number];
