import * as FileSystem from "expo-file-system/legacy";

export const PROFILE_PHOTOS_DIR = `${FileSystem.documentDirectory ?? ""}matcha-profile-photos/`;

export function isStoredProfilePhoto(uri: string | null | undefined) {
  return Boolean(uri && uri.startsWith(PROFILE_PHOTOS_DIR));
}

export async function saveProfilePhotoLocally(index: number, sourceUri: string) {
  const extension = sourceUri.split(".").pop()?.split("?")[0] || "jpg";
  const targetUri = `${PROFILE_PHOTOS_DIR}${Date.now()}-${index}.${extension}`;
  await FileSystem.makeDirectoryAsync(PROFILE_PHOTOS_DIR, { intermediates: true });
  await FileSystem.copyAsync({
    from: sourceUri,
    to: targetUri,
  });
  return targetUri;
}

export async function deleteStoredProfilePhoto(uri: string | null | undefined) {
  if (!isStoredProfilePhoto(uri)) {
    return;
  }
  await FileSystem.deleteAsync(uri!, { idempotent: true });
}
