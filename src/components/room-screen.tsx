"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserMinus,
} from "lucide-react";
import { AdSlot } from "@/components/adsense";
import { SiteHeader } from "@/components/site-header";
import { usePreferences } from "@/components/preferences-provider";
import { useTranslation } from "@/lib/i18n/use-translation";
import { normalizeAvatarUrl } from "@/lib/room/avatar";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { VOTE_CARDS, type RoomMember, type RoomSnapshot, type VoteValue } from "@/lib/room/types";

type RoomScreenProps = {
  roomId: string;
};

type PageState = "loading" | "join" | "ready" | "missing" | "error";

function initials(name: string) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";
}

function hueFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function SeatFigure({ member }: { member: RoomMember }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = member.avatarUrl;

  return (
    <span className={`seat-figure${member.isHost ? " is-host" : ""}`} aria-hidden="true">
      <span className="seat-shoulders" />
      <span className="seat-avatar">
        {url && failedUrl !== url ? (
          // User-supplied remote image; next/image would need an allowlist of every host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setFailedUrl(url)} />
        ) : initials(member.name)}
      </span>
    </span>
  );
}

function errorMessage(code: string | undefined, t: ReturnType<typeof useTranslation>) {
  if (code === "supabase_not_configured") return t("configurationMissing");
  if (code === "room_expired") return t("roomExpired");
  if (code === "room_not_found") return t("roomNotFound");
  if (code === "session_invalid") return t("sessionExpired");
  if (code === "enter_name" || code === "invalid_name") return t("enterName");
  if (code === "invalid_avatar") return t("avatarInvalid");
  return t("actionFailed");
}

export function RoomScreen({ roomId }: RoomScreenProps) {
  const router = useRouter();
  const t = useTranslation();
  const { locale, name, setName, avatar, setAvatar } = usePreferences();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState("");
  const [avatarInvalid, setAvatarInvalid] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const departureSent = useRef(false);
  const syncedAvatar = useRef<string | null>(null);
  const inRoom = pageState === "ready" && snapshot !== null;
  const serverAvatar = snapshot?.members.find((member) => member.id === snapshot.currentParticipantId)?.avatarUrl ?? "";

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

  useEffect(() => {
    if (!inRoom) return;
    if (serverAvatar === avatar) {
      syncedAvatar.current = avatar;
      return;
    }
    if (syncedAvatar.current === avatar) return;
    syncedAvatar.current = avatar;

    fetch(`/api/rooms/${roomId}/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: avatar }),
    }).then((response) => {
      if (response.ok) setRefreshKey((value) => value + 1);
    }).catch(() => {
      syncedAvatar.current = null;
    });
  }, [roomId, inRoom, avatar, serverAvatar]);

  useEffect(() => {
    const roomPath = `/room/${roomId}`;

    function sendDeparture() {
      if (departureSent.current) return;
      departureSent.current = true;
      const endpoint = `/api/rooms/${roomId}/leave`;
      const queued = navigator.sendBeacon(endpoint, new Blob([], { type: "text/plain" }));
      if (!queued) {
        void fetch(endpoint, { method: "POST", keepalive: true }).catch(() => undefined);
      }
    }

    function handleHistoryNavigation() {
      if (window.location.pathname !== roomPath) sendDeparture();
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        departureSent.current = false;
        setRefreshKey((value) => value + 1);
      }
    }

    window.addEventListener("pagehide", sendDeparture);
    window.addEventListener("popstate", handleHistoryNavigation, true);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", sendDeparture);
      window.removeEventListener("popstate", handleHistoryNavigation, true);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [roomId]);

  function handleHomeClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!snapshot) return;
    event.preventDefault();
    if (!pending) void leaveToHome();
  }

  async function leaveToHome() {
    if (departureSent.current) return;
    departureSent.current = true;
    setPending(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/rooms/${roomId}/leave`, {
        method: "POST",
        keepalive: true,
      });
      if (!response.ok && response.status !== 401 && response.status !== 404) {
        departureSent.current = false;
        setNotice("action_failed");
        return;
      }
      router.push("/");
    } catch {
      departureSent.current = false;
      setNotice("action_failed");
    } finally {
      setPending(false);
    }
  }

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

  function openAvatarEditor() {
    setAvatarDraft(avatar);
    setAvatarInvalid(false);
    setEditingAvatar(true);
  }

  function saveAvatar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeAvatarUrl(avatarDraft);
    if (normalized === null) {
      setAvatarInvalid(true);
      return;
    }
    setAvatar(normalized);
    setEditingAvatar(false);
  }

  function removeAvatar() {
    setAvatar("");
    setEditingAvatar(false);
  }

  const isHost = snapshot?.room.hostParticipantId === snapshot?.currentParticipantId;
  const voteCount = snapshot?.members.filter((member) => member.hasVoted).length ?? 0;
  const memberTotal = snapshot?.members.length ?? 0;
  const progress = memberTotal ? Math.round((voteCount / memberTotal) * 100) : 0;
  const average = snapshot?.room.revealed
    ? snapshot.members.map((member) => member.vote).filter((vote): vote is string => vote !== null && vote !== "?").map(Number).filter(Number.isFinite)
    : [];
  const averageValue = average.length
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(average.reduce((sum, value) => sum + value, 0) / average.length)
    : null;

  return (
    <main className="app-frame room-frame">
      <SiteHeader onHomeClick={snapshot ? handleHomeClick : undefined} />

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
            <Link className="back-link" href="/" aria-disabled={pending} onClick={handleHomeClick}>
              <ArrowLeft size={15} />{t("home")}
            </Link>
            <span className="room-live"><span className="live-dot" />{t("joined")}</span>
          </div>

          <section className="room-heading-area backdrop-blur-md">
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

          <section className="topic-hero" aria-live="polite">
            <span className="topic-kicker">
              <span className={`round-state-dot${snapshot.room.revealed ? " is-revealed" : ""}`} />
              {t("currentRound")} {String(snapshot.room.round).padStart(2, "0")} · {snapshot.room.revealed ? t("revealed") : t("voting")}
            </span>
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
              <div className="topic-title-row">
                <h2 className="topic-title">{snapshot.room.topic}</h2>
                {isHost && (
                  <button className="icon-button tiny-icon" type="button" onClick={() => setEditingTopic(true)} title={t("renameTopic")} aria-label={t("renameTopic")}>
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </section>

          <div className="room-stage">
            <section className={`table-panel${snapshot.room.revealed ? " is-revealed" : ""}`} aria-label={t("members")}>
              <div className="seat-list">
                {snapshot.members.map((member, index) => {
                  const isMe = member.id === snapshot.currentParticipantId;
                  const stateText = snapshot.room.revealed
                    ? member.hasVoted ? t("voteRecorded") : t("noVote")
                    : member.hasVoted ? t("cardReady") : t("choosing");

                  return (
                    <div
                      className={`seat${member.hasVoted ? " has-voted" : ""}${isMe ? " is-me" : ""}`}
                      key={member.id}
                      style={{ "--seat-index": index, "--seat-hue": hueFor(member.id) } as React.CSSProperties}
                    >
                      <div className="seat-card-slot">
                        {member.hasVoted ? (
                          <div className="seat-card">
                            <span className="seat-card-face seat-card-back" aria-hidden="true">◆</span>
                            <span className="seat-card-face seat-card-front">{member.vote}</span>
                          </div>
                        ) : (
                          <div className="seat-card-empty" aria-hidden="true" />
                        )}
                      </div>
                      {isMe ? (
                        <button className="seat-figure-button" type="button" onClick={openAvatarEditor} title={t("avatarEdit")} aria-label={t("avatarEdit")}>
                          <SeatFigure member={member} />
                          <span className="seat-camera" aria-hidden="true"><Camera size={11} /></span>
                        </button>
                      ) : (
                        <SeatFigure member={member} />
                      )}
                      <span className="seat-name">
                        <span className="seat-name-text">{isMe ? t("you") : member.name}</span>
                        {member.isHost && <span className="seat-host"><Crown size={10} />{t("host")}</span>}
                      </span>
                      <span className={`seat-state${member.hasVoted ? " is-ready" : ""}`}>{stateText}</span>
                      {isHost && !isMe && (
                        <span className="seat-actions">
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
                  );
                })}
              </div>
            </section>

            <section className="vote-dock backdrop-blur-md">
              <div className="dock-status">
                <div className="dock-progress">
                  <span className="dock-progress-text"><strong>{voteCount}</strong> / {memberTotal} {t("votedLabel")}</span>
                  <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={memberTotal} aria-valuenow={voteCount}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>
                {isHost ? (
                  !snapshot.room.revealed ? (
                    <button className="primary-button host-primary" type="button" disabled={pending || voteCount === 0} onClick={() => void sendAction("reveal")}>
                      <Eye size={16} /><span>{t("revealVotes")}</span>
                    </button>
                  ) : (
                    <button className="primary-button host-primary" type="button" disabled={pending} onClick={() => void sendAction("clear")}>
                      <RotateCcw size={16} /><span>{t("clearVotes")}</span>
                    </button>
                  )
                ) : (
                  !snapshot.room.revealed && <span className="dock-hint"><EyeOff size={14} />{t("onlyHostReveals")}</span>
                )}
              </div>

              {snapshot.room.revealed ? (
                averageValue && <div className="average-readout"><span>{t("average")}</span><strong>{averageValue}</strong></div>
              ) : (
                <div className="dock-deck">
                  <div className="dock-deck-heading">
                    <strong>{t("selectCard")}</strong>
                    <span>{t("votesHidden")}</span>
                  </div>
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
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {notice && <p className="inline-notice" role="status">{errorMessage(notice, t)}</p>}
            </section>
          </div>

          {editingAvatar && (
            <div className="modal-backdrop" onClick={() => setEditingAvatar(false)}>
              <form
                className="avatar-dialog backdrop-blur-md"
                role="dialog"
                aria-modal="true"
                aria-labelledby="avatar-dialog-title"
                noValidate
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => { if (event.key === "Escape") setEditingAvatar(false); }}
                onSubmit={saveAvatar}
              >
                <h2 id="avatar-dialog-title">{t("avatarTitle")}</h2>
                <label className="field-label" htmlFor="avatar-url">{t("avatarLabel")}</label>
                <input
                  id="avatar-url"
                  className="text-field"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  autoFocus
                  maxLength={500}
                  value={avatarDraft}
                  placeholder={t("avatarPlaceholder")}
                  onChange={(event) => { setAvatarDraft(event.target.value); setAvatarInvalid(false); }}
                />
                <p className="avatar-hint">{t("avatarHint")}</p>
                {avatarInvalid && <p className="inline-notice" role="alert">{t("avatarInvalid")}</p>}
                <div className="avatar-dialog-actions">
                  {avatar && (
                    <button className="secondary-button" type="button" onClick={removeAvatar}>
                      <Trash2 size={15} /><span>{t("avatarRemove")}</span>
                    </button>
                  )}
                  <button className="secondary-button" type="button" onClick={() => setEditingAvatar(false)}>{t("cancel")}</button>
                  <button className="primary-button" type="submit">{t("save")}</button>
                </div>
              </form>
            </div>
          )}

          <footer className="room-footer">
            <span>{t("roomCode")}: <code>{snapshot.room.code}</code></span>
            <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_ROOM_SLOT} />
          </footer>
        </>
      )}

      {toast && <div className="toast-message backdrop-blur-md" role="status"><Check size={15} />{toast}</div>}
    </main>
  );
}
