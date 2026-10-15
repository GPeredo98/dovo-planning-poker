"use client";

import { useCallback } from "react";
import { messages, type MessageKey } from "@/lib/i18n/messages";
import { usePreferences } from "@/components/preferences-provider";

export function useTranslation() {
  const { locale } = usePreferences();
  return useCallback((key: MessageKey) => messages[locale][key], [locale]);
}
