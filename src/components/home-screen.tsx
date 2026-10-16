"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, DoorOpen, Plus, UsersRound } from "lucide-react";
import { AdSlot } from "@/components/adsense";
import { SiteHeader } from "@/components/site-header";
import { usePreferences } from "@/components/preferences-provider";
import { useTranslation } from "@/lib/i18n/use-translation";

function messageForError(code: string | undefined, t: ReturnType<typeof useTranslation>) {
  if (code === "supabase_not_configured") return t("configurationMissing");
  if (code === "invalid_name" || code === "enter_name") return t("enterName");
  if (code === "invalid_room_code" || code === "enter_code") return t("enterCode");
  if (code === "room_expired") return t("roomExpired");
  if (code === "room_not_found") return t("roomNotFound");
  return t("joinFailed");
}

export function HomeScreen() {
  const router = useRouter();
  const t = useTranslation();
  const { name, setName } = usePreferences();
  const [roomCode, setRoomCode] = useState("");
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitRoom(action: "create" | "join") {
    setNotice(null);
    if (!name.trim()) {
      setNotice("enter_name");
      return;
    }
    if (action === "join" && !roomCode.trim()) {
      setNotice("enter_code");
      return;
    }

    setPending(action);
    try {
      const response = await fetch(action === "create" ? "/api/rooms" : "/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "create"
          ? { name, topic: t("defaultTopic") }
          : { name, roomCode: roomCode.trim().toUpperCase() }),
      });
      const result = await response.json() as { roomId?: string; error?: string };
      if (!response.ok || !result.roomId) {
        setNotice(result.error ?? "action_failed");
        return;
      }
      router.push(`/room/${result.roomId}`);
    } catch {
      setNotice("action_failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="app-frame">
      <SiteHeader />
      <section className="home-intro">
        <div className="eyebrow"><span className="live-dot" /> {t("tagline")}</div>
        <h1>{t("homeTitle")}</h1>
        <p>{t("homeDescription")}</p>
      </section>

      <section className="entry-grid" aria-label={t("appName")}>
        <form className="entry-section create-section backdrop-blur-md" onSubmit={(event) => { event.preventDefault(); void submitRoom("create"); }}>
          <div className="section-index">01 <span /></div>
          <div className="entry-copy">
            <h2><Plus size={19} aria-hidden="true" />{t("createSection")}</h2>
            <p>{t("createHint")}</p>
          </div>
          <label className="field-label" htmlFor="create-name">{t("nameLabel")}</label>
          <input
            id="create-name"
            className="text-field"
            autoComplete="nickname"
            maxLength={32}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
          />
          <button className="primary-button" type="submit" disabled={pending !== null}>
            <span>{pending === "create" ? t("loading") : t("createButton")}</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        </form>

        <form className="entry-section join-section backdrop-blur-md" onSubmit={(event) => { event.preventDefault(); void submitRoom("join"); }}>
          <div className="section-index">02 <span /></div>
          <div className="entry-copy">
            <h2><DoorOpen size={19} aria-hidden="true" />{t("joinSection")}</h2>
            <p>{t("joinHint")}</p>
          </div>
          <label className="field-label" htmlFor="join-name">{t("nameLabel")}</label>
          <input
            id="join-name"
            className="text-field"
            autoComplete="nickname"
            maxLength={32}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
          />
          <label className="field-label" htmlFor="room-code">{t("roomCodeLabel")}</label>
          <div className="code-field-wrap">
            <UsersRound size={17} aria-hidden="true" />
            <input
              id="room-code"
              className="code-field"
              autoComplete="off"
              maxLength={8}
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.replace(/[^a-fA-F0-9]/g, "").toUpperCase())}
              placeholder={t("roomCodePlaceholder")}
              spellCheck={false}
            />
          </div>
          <button className="secondary-button" type="submit" disabled={pending !== null}>
            <span>{pending === "join" ? t("loading") : t("joinRoom")}</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        </form>
      </section>

      <div className="home-feedback" role="status" aria-live="polite">{notice ? messageForError(notice, t) : ""}</div>
      <footer className="home-footer">
        <p>{t("privacyLine")}</p>
        <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT} />
      </footer>
    </main>
  );
}
