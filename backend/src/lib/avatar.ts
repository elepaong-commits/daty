import { signedImageUrl, storageEnabled } from "./storage.js";

// Profile photos live in R2 under avatars/{userId}/. `User.profileImageUrl` holds the object key (or, for
// an old row, a full URL); the orphan sweep (orphans.ts) deletes uploads that never got confirmed.

export const AVATAR_MAX_BYTES = 1024 * 1024;

export const avatarKeyPattern = (userId: number) =>
  new RegExp(`^avatars/${userId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`);

export const isAvatarKey = (value: string | null): value is string => value !== null && value.startsWith("avatars/");

/** What the API shows for a stored avatar: a signed URL for a key, an old URL as it is. */
export async function avatarUrl(value: string | null) {
  if (!isAvatarKey(value)) return value;
  return storageEnabled ? signedImageUrl(value) : null;
}

/** Puts signed avatar URLs on a list of users (or one). */
export const withAvatarUrls = <T extends { profileImageUrl: string | null }>(users: T[]) =>
  Promise.all(users.map(async (u) => ({ ...u, profileImageUrl: await avatarUrl(u.profileImageUrl) })));
