"use client";

import Link from "next/link";
import { Languages, Moon, Sun } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Locale } from "@/lib/room/types";

const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ar: "العربية",
  pt: "Português",
};

export function SiteHeader() {
  const t = useTranslation();
  const { locale, theme, setLocale, setTheme } = usePreferences();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <header className="site-header backdrop-blur-md">
      <Link className="wordmark" href="/" aria-label={`${t("appName")} home`}>
        <span className="wordmark-symbol" aria-hidden="true">D</span>
        <span>{t("appName")}</span>
      </Link>
      <div className="header-controls">
        <label className="locale-select">
          <Languages aria-hidden="true" size={16} />
          <span className="sr-only">{t("language")}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={t("language")}>
            {Object.entries(localeNames).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </label>
        <button
          className="icon-button theme-toggle"
          type="button"
          onClick={() => setTheme(nextTheme)}
          aria-label={`${t("theme")}: ${t(nextTheme)}`}
          title={`${t("theme")}: ${t(nextTheme)}`}
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </div>
    </header>
  );
}
