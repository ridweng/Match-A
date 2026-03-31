import * as FileSystem from "expo-file-system/legacy";

const DISCOVERY_FRONT_CARD_CACHE_ROOT =
  `${FileSystem.documentDirectory ?? ""}matcha-discovery-front-card/`;

function normalizeOwnerKey(ownerKey: string | number) {
  return String(ownerKey).trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "anonymous";
}

function getFrontCardCacheDir(ownerKey: string | number) {
  return `${DISCOVERY_FRONT_CARD_CACHE_ROOT}${normalizeOwnerKey(ownerKey)}/`;
}

export async function clearDiscoveryFrontCardCache(ownerKey: string | number) {
  const targetDir = getFrontCardCacheDir(ownerKey);
  await FileSystem.deleteAsync(targetDir, { idempotent: true });
}

export async function cacheDiscoveryFrontCardImages(
  ownerKey: string | number,
  profileId: number,
  imageUris: string[]
) {
  const targetDir = getFrontCardCacheDir(ownerKey);
  await FileSystem.deleteAsync(targetDir, { idempotent: true });
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });

  const cachedUris: string[] = [];

  for (const [index, sourceUri] of imageUris.entries()) {
    const uri = String(sourceUri || "").trim();
    if (!uri) {
      continue;
    }

    const extension = uri.split(".").pop()?.split("?")[0] || "jpg";
    const localUri = `${targetDir}${profileId}-${index}.${extension}`;

    try {
      await FileSystem.downloadAsync(uri, localUri);
      cachedUris.push(localUri);
    } catch {
      cachedUris.push(uri);
    }
  }

  return cachedUris;
}
