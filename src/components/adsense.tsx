"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useTranslation } from "@/lib/i18n/use-translation";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type AdSlotProps = {
  slot: string | undefined;
};

export function AdSlot({ slot }: AdSlotProps) {
  const t = useTranslation();
  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;

  useEffect(() => {
    if (!publisherId || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense may not be available when consent is pending or the request is blocked.
    }
  }, [publisherId, slot]);

  if (!publisherId || !slot) return null;

  return (
    <aside className="ad-slot" aria-label={t("adsLabel")}>
      <span className="ad-label">{t("adsLabel")}</span>
      <Script
        id="dovo-adsense"
        async
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`}
      />
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
