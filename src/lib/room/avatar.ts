export const AVATAR_URL_MAX_LENGTH = 500;

// Returns "" for an empty value, the normalized https URL, or null when invalid.
export function normalizeAvatarUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > AVATAR_URL_MAX_LENGTH) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href.length <= AVATAR_URL_MAX_LENGTH ? url.href : null;
  } catch {
    return null;
  }
}
