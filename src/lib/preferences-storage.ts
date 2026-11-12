export const preferenceKeys = {
  locale: "pp.locale",
  theme: "pp.theme",
  name: "pp.name",
  avatar: "pp.avatar",
  roomSettings: "pp.roomSettings",
} as const;

type Preference = keyof typeof preferenceKeys;

export function readPreference(key: Preference): string | null {
  return window.localStorage.getItem(preferenceKeys[key])
    ?? window.localStorage.getItem(`dovo.${key}`);
}

export function migratePreferences() {
  for (const key of Object.keys(preferenceKeys) as Preference[]) {
    const oldKey = `dovo.${key}`;
    const oldValue = window.localStorage.getItem(oldKey);
    if (oldValue === null) continue;
    if (window.localStorage.getItem(preferenceKeys[key]) === null) {
      window.localStorage.setItem(preferenceKeys[key], oldValue);
    }
    window.localStorage.removeItem(oldKey);
  }
}
