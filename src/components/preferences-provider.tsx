"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Locale, Theme } from "@/lib/room/types";
import { normalizeAvatarUrl } from "@/lib/room/avatar";

const preferenceKeys = {
  locale: "dovo.locale",
  theme: "dovo.theme",
  name: "dovo.name",
  avatar: "dovo.avatar",
} as const;

export type Preferences = {
  locale: Locale;
  theme: Theme;
  name: string;
  avatar: string;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  setName: (name: string) => void;
  setAvatar: (avatar: string) => void;
};

const PreferencesContext = createContext<Preferences | null>(null);
const preferenceChangedEvent = "dovo-preference-change";

function subscribeToPreferences(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(preferenceChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(preferenceChangedEvent, onChange);
  };
}

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "es" || value === "ar" || value === "pt";
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(
    subscribeToPreferences,
    () => {
      const stored = window.localStorage.getItem(preferenceKeys.locale);
      return isLocale(stored) ? stored : "en";
    },
    () => "en",
  );
  const theme = useSyncExternalStore<Theme>(
    subscribeToPreferences,
    () => {
      const stored = window.localStorage.getItem(preferenceKeys.theme);
      return isTheme(stored) ? stored : "light";
    },
    () => "light",
  );
  const name = useSyncExternalStore(
    subscribeToPreferences,
    () => window.localStorage.getItem(preferenceKeys.name)?.slice(0, 32) ?? "",
    () => "",
  );
  const avatar = useSyncExternalStore(
    subscribeToPreferences,
    () => normalizeAvatarUrl(window.localStorage.getItem(preferenceKeys.avatar) ?? "") ?? "",
    () => "",
  );

  function storePreference(key: string, value: string) {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new Event(preferenceChangedEvent));
  }

  function updateLocale(value: Locale) {
    storePreference(preferenceKeys.locale, value);
  }

  function updateTheme(value: Theme) {
    storePreference(preferenceKeys.theme, value);
  }

  function updateName(value: string) {
    storePreference(preferenceKeys.name, value.slice(0, 32));
  }

  function updateAvatar(value: string) {
    storePreference(preferenceKeys.avatar, normalizeAvatarUrl(value) ?? "");
  }

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);

  return (
    <PreferencesContext.Provider value={{ locale, theme, name, avatar, setLocale: updateLocale, setTheme: updateTheme, setName: updateName, setAvatar: updateAvatar }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error("usePreferences must be used inside PreferencesProvider");
  return preferences;
}
