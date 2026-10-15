"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Pencil,
  RotateCcw,
  ShieldCheck,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { AdSlot } from "@/components/adsense";
import { SiteHeader } from "@/components/site-header";
import { usePreferences } from "@/components/preferences-provider";
import { useTranslation } from "@/lib/i18n/use-translation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { VOTE_CARDS, type RoomSnapshot, type VoteValue } from "@/lib/room/types";

type RoomScreenProps = {
  roomId: string;
};

type PageState = "loading" | "join" | "ready" | "missing" | "error";

function initials(name: string) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";
}

function errorMessage(code: string | undefined, t: ReturnType<typeof useTranslation>) {
  if (code === "supabase_not_configured") return t("configurationMissing");
  if (code === "room_expired") return t("roomExpired");
  if (code === "room_not_found") return t("roomNotFound");
  if (code === "session_invalid") return t("sessionExpired");
  if (code === "enter_name" || code === "invalid_name") return t("enterName");
  return t("actionFailed");
}

export function RoomScreen({ roomId }: RoomScreenProps) {
  const t = useTranslation();
  const { locale, name, setName } = usePreferences();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [topicDraft, setTopicDraft] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadRoom() {
      setNotice(null);
      try {
        const response = await fetch(`/api/rooms/${roomId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json() as RoomSnapshot & { error?: string };

        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setPageState("join");
          setSnapshot(null);
          if (result.error === "session_invalid") setNotice(result.error);
          return;
        }
        if (response.status === 404 || response.status === 410) {
          setPageState("missing");
          setNotice(result.error ?? "room_not_found");
          return;
        }
        if (!response.ok) {
          setPageState("error");
          setNotice(result.error ?? "action_failed");
          return;
        }

        setSnapshot(result);
        setSelectedVote(result.myVote ?? null);
        setRoomNameDraft(result.room.name);
        setTopicDraft(result.room.topic);
        setPageState("ready");
      } catch {
        if (!controller.signal.aborted) {
          setPageState("error");
          setNotice("action_failed");
        }
      }
    }

    void loadRoom();
    return () => controller.abort();
  }, [roomId, refreshKey, t]);

  useEffect(() => {
    const client = getSupabaseBrowser();
    const channel = client?.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    }).on("broadcast", { event: "changed" }, () => {
      setRefreshKey((value) => value + 1);
    }).subscribe();

    const fallbackRefresh = window.setInterval(() => {
      setRefreshKey((value) => value + 1);
    }, 20000);

    return () => {
      window.clearInterval(fallbackRefresh);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [roomId]);

  async function joinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (!name.trim()) {
      setNotice("enter_name");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, name }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "action_failed");
        return;
      }

      setRefreshKey((value) => value + 1);
      setPageState("loading");
    } catch {
      setNotice("action_failed");
    } finally {
      setPending(false);
    }
  }

  async function sendAction(action: string, value?: string, targetParticipantId?: string) {
    if (!snapshot) return false;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value, targetParticipantId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "action_failed");
        if (response.status === 401) setPageState("join");
        return false;
      }
      setRefreshKey((current) => current + 1);
      return true;
    } catch {
      setNotice("action_failed");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function submitVote(value: VoteValue) {
    if (!snapshot || snapshot.room.revealed) return;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "action_failed");
        if (response.status === 401) setPageState("join");
        return;
      }
      setSelectedVote(value);
      setRefreshKey((current) => current + 1);
    } catch {
      setNotice("action_failed");
    } finally {
      setPending(false);
    }
  }

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(message);
      window.setTimeout(() => setToast(""), 2200);
    } catch {
      setNotice("action_failed");
    }
  }

  const isHost = snapshot?.room.hostParticipantId === snapshot?.currentParticipantId;
  const voteCount = snapshot?.members.filter((member) => member.hasVoted).length ?? 0;
  const average = snapshot?.room.revealed
    ? snapshot.members.map((member) => member.vote).filter((vote): vote is string => vote !== null && vote !== "?").map(Number).filter(Number.isFinite)
    : [];
  const averageValue = average.length
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(average.reduce((sum, value) => sum + value, 0) / average.length)
    : null;

  return (
    <main className="app-frame room-frame">
      <SiteHeader />

      {pageState === "loading" && (
        <div className="room-loading" role="status"><span className="loading-mark" />{t("connecting")}</div>
      )}

      {(pageState === "join" || pageState === "missing" || pageState === "error") && (
        <section className="room-gate">
          <Link className="back-link" href="/"><ArrowLeft size={16} />{t("home")}</Link>
          <div className="gate-mark"><ShieldCheck size={23} /></div>
          <h1>{pageState === "join" ? t("joinThisRoom") : pageState === "missing" ? t("roomNotFound") : t("actionFailed")}</h1>
          <p>{notice ? errorMessage(notice, t) : ""}</p>
          {pageState === "join" && (
            <form className="gate-form" onSubmit={(event) => void joinRoom(event)}>
              <label className="field-label" htmlFor="room-join-name">{t("nameLabel")}</label>
              <input
                id="room-join-name"
                className="text-field"
                autoComplete="nickname"
                maxLength={32}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("namePlaceholder")}
              />
              <button className="primary-button" type="submit" disabled={pending}>
                <span>{pending ? t("loading") : t("joinThisRoom")}</span>
                <ArrowLeft className="join-arrow" size={17} />
              </button>
            </form>
          )}
        </section>
      )}

      {pageState === "ready" && snapshot && (
        <>
          <div className="room-overline">
            <Link className="back-link" href="/"><ArrowLeft size={15} />{t("home")}</Link>
            <span className="room-live"><span className="live-dot" />{t("joined")}</span>
          </div>

          <section className="room-heading-area">
            <div className="room-title-block">
              <div className="room-title-row">
                {editingRoom && isHost ? (
                  <form className="inline-edit room-name-edit" onSubmit={(event) => {
                    event.preventDefault();
                    void sendAction("rename_room", roomNameDraft).then((saved) => { if (saved) setEditingRoom(false); });
                  }}>
                    <input
                      className="title-input"
                      value={roomNameDraft}
                      maxLength={48}
                      onChange={(event) => setRoomNameDraft(event.target.value)}
                      aria-label={t("roomTitle")}
                    />
                    <button className="small-action-button" type="submit" disabled={pending} aria-label={t("save")}><Check size={17} /></button>
                  </form>
                ) : (
                  <h1>{snapshot.room.name}</h1>
                )}
                {isHost && !editingRoom && (
                  <button className="icon-button subtle-icon" type="button" onClick={() => setEditingRoom(true)} title={t("editRoom")} aria-label={t("editRoom")}>
                    <Pencil size={15} />
                  </button>
                )}
              </div>
              <div className="room-topic-row">
                <span className="topic-label">{t("topic")}</span>
                {editingTopic && isHost ? (
                  <form className="inline-edit topic-edit" onSubmit={(event) => {
                    event.preventDefault();
                    void sendAction("rename_topic", topicDraft).then((saved) => { if (saved) setEditingTopic(false); });
                  }}>
                    <input
                      className="topic-input"
                      value={topicDraft}
                      maxLength={80}
                      onChange={(event) => setTopicDraft(event.target.value)}
                      placeholder={t("topicPlaceholder")}
                      aria-label={t("topic")}
                    />
                    <button className="small-action-button" type="submit" disabled={pending} aria-label={t("save")}><Check size={16} /></button>
                  </form>
                ) : (
                  <>
                    <span className="topic-value">{snapshot.room.topic}</span>
                    {isHost && (
                      <button className="icon-button tiny-icon" type="button" onClick={() => setEditingTopic(true)} title={t("renameTopic")} aria-label={t("renameTopic")}>
                        <Pencil size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="invite-controls">
              <button className="invite-button" type="button" onClick={() => void copyText(window.location.href, t("linkCopied"))}>
                <Copy size={16} /><span>{t("copyLink")}</span>
              </button>
              <button className="code-copy-button" type="button" onClick={() => void copyText(snapshot.room.code, t("codeCopied"))}>
                <span className="code-copy-label">{t("showRoomCode")}</span>
                <code>{snapshot.room.code}</code>
                <Copy size={14} />
              </button>
            </div>
          </section>

          <section className="round-strip" aria-live="polite">
            <div className="round-label"><span className="round-number">{String(snapshot.room.round).padStart(2, "0")}</span><span>{t("currentRound")}</span></div>
            <span className={`round-state ${snapshot.room.revealed ? "is-revealed" : ""}`}>
              <span className="round-state-dot" />{snapshot.room.revealed ? t("revealed") : t("voting")}
            </span>
            <span className="round-vote-count">{voteCount}/{snapshot.members.length} {t("membersCount")}</span>
          </section>

          <div className="room-content-grid">
            <section className="voting-stage">
              <div className="stage-heading">
                <div>
                  <span className="stage-kicker">{t("vote")}</span>
                  <h2>{snapshot.room.revealed ? t("revealed") : t("selectCard")}</h2>
                </div>
                {isHost && (
                  <div className="host-controls">
                    {!snapshot.room.revealed ? (
                      <button className="primary-button host-primary" type="button" disabled={pending || voteCount === 0} onClick={() => void sendAction("reveal")}>
                        <Eye size={16} /><span>{t("revealVotes")}</span>
                      </button>
                    ) : (
                      <button className="primary-button host-primary" type="button" disabled={pending} onClick={() => void sendAction("clear")}>
                        <RotateCcw size={16} /><span>{t("clearVotes")}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {snapshot.room.revealed ? (
                <div className="revealed-results">
                  {snapshot.members.map((member, index) => (
                    <div className="result-tile" key={member.id} style={{ "--tile-index": index } as React.CSSProperties}>
                      <span className="result-name">{member.id === snapshot.currentParticipantId ? t("you") : member.name}</span>
                      <strong>{member.vote ?? "–"}</strong>
                    </div>
                  ))}
                  {averageValue && <div className="average-readout"><span>{t("average")}</span><strong>{averageValue}</strong></div>}
                </div>
              ) : (
                <>
                  <div className="vote-deck" role="group" aria-label={t("selectCard")}>
                    {VOTE_CARDS.map((card, index) => (
                      <button
                        className={`vote-card${selectedVote === card ? " is-selected" : ""}`}
                        key={card}
                        type="button"
                        disabled={pending}
                        aria-pressed={selectedVote === card}
                        onClick={() => void submitVote(card)}
                        style={{ "--card-index": index } as React.CSSProperties}
                      >
                        <span className="card-value">{card}</span>
                        <span className="card-mark" aria-hidden="true">{selectedVote === card ? <Check size={14} /> : ""}</span>
                      </button>
                    ))}
                  </div>
                  <p className="vote-privacy"><EyeOff size={14} />{t("votesHidden")}</p>
                </>
              )}

              {notice && <p className="inline-notice" role="status">{errorMessage(notice, t)}</p>}
            </section>

            <aside className="member-rail">
              <div className="member-rail-heading">
                <div><span className="stage-kicker">{t("members")}</span><strong>{snapshot.members.length}</strong></div>
                <UsersRound size={17} aria-hidden="true" />
              </div>
              <div className="member-list">
                {snapshot.members.map((member) => (
                  <div className="member-row" key={member.id}>
                    <span className={`member-avatar${member.isHost ? " is-host" : ""}`}>{initials(member.name)}</span>
                    <span className="member-name-wrap">
                      <span className="member-name">{member.id === snapshot.currentParticipantId ? t("you") : member.name}</span>
                      {member.isHost && <span className="member-role"><Crown size={11} />{t("host")}</span>}
                    </span>
                    <span className={`member-vote-state${member.hasVoted ? " has-voted" : ""}`} aria-label={member.hasVoted ? t("voteRecorded") : t("waitingForVotes")}>
                      {snapshot.room.revealed ? member.vote ?? "–" : member.hasVoted ? <Check size={14} /> : <span />}
                    </span>
                    {isHost && member.id !== snapshot.currentParticipantId && (
                      <span className="member-actions">
                        <button
                          className="icon-button tiny-icon"
                          type="button"
                          title={t("makeHost")}
                          aria-label={`${t("makeHost")}: ${member.name}`}
                          disabled={pending}
                          onClick={() => void sendAction("transfer_host", undefined, member.id)}
                        ><Crown size={14} /></button>
                        <button
                          className="icon-button tiny-icon remove-icon"
                          type="button"
                          title={t("removeMember")}
                          aria-label={`${t("removeMember")}: ${member.name}`}
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(t("confirmRemove"))) void sendAction("remove_member", undefined, member.id);
                          }}
                        ><UserMinus size={14} /></button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {!snapshot.room.revealed && (
                <div className="member-rail-footnote"><EyeOff size={14} />{t("waitingHost")}</div>
              )}
            </aside>
          </div>

          <footer className="room-footer">
            <span>{t("roomCode")}: <code>{snapshot.room.code}</code></span>
            <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_ROOM_SLOT} />
          </footer>
        </>
      )}

      {toast && <div className="toast-message" role="status"><Check size={15} />{toast}</div>}
    </main>
  );
}
