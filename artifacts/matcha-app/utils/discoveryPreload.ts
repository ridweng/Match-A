import { Image } from "expo-image";

import type { DiscoveryFeedProfileResponse as DiscoverProfile } from "@/services/auth";

export const DISCOVERY_PRELOAD_QUEUE_LENGTH = 3;
export const DISCOVERY_PRELOAD_IMAGE_LIMITS_BY_SLOT = [
  Infinity, // slotA front: all images
  1,        // slotB second: cover only
  1,        // slotC third: nothing
] as const;

const warmedImageUris = new Set<string>();

function getProfileImageSlice(
  profile: DiscoverProfile | null,
  imageCount: number,
  startIndex = 0
) {
  if (!profile || imageCount <= 0) {
    return [] as string[];
  }

  return profile.images
    .slice(
      startIndex,
      Number.isFinite(imageCount) ? startIndex + imageCount : undefined
    )
    .filter(Boolean);
}

async function warmImageUris(uris: string[]) {
  for (const uri of uris) {
    if (!uri || warmedImageUris.has(uri)) {
      continue;
    }

    try {
      const warmed = await Image.prefetch(uri, "memory-disk");
      if (warmed) {
        warmedImageUris.add(uri);
      }
    } catch {}
  }
}

export async function warmDiscoveryDeck(
  deckProfiles: Array<DiscoverProfile | null>
) {
  const visibleSlots = deckProfiles.slice(0, DISCOVERY_PRELOAD_QUEUE_LENGTH);

  for (const [slotIndex, profile] of visibleSlots.entries()) {
    const imageCount = DISCOVERY_PRELOAD_IMAGE_LIMITS_BY_SLOT[slotIndex] ?? 0;
    const uris = getProfileImageSlice(profile, imageCount);
    if (!uris.length) {
      continue;
    }
    await warmImageUris(uris);
  }
}

export async function warmDiscoveryProfileImages(
  profile: DiscoverProfile | null,
  imageCount: number,
  startIndex = 0
) {
  const uris = getProfileImageSlice(profile, imageCount, startIndex);
  if (!uris.length) {
    return;
  }
  await warmImageUris(uris);
}

export async function warmDiscoveryFrontExtras(profile: DiscoverProfile | null) {
  if (!profile || profile.images.length <= 1) {
    return;
  }
  await warmDiscoveryProfileImages(profile, profile.images.length - 1, 1);
}

export function isDiscoveryImageWarm(uri: string | null | undefined) {
  return !!uri && warmedImageUris.has(uri);
}

export function isDiscoveryProfileWarm(
  profile: DiscoverProfile,
  imageCount: number,
  startIndex = 0
) {
  const imagesToCheck = getProfileImageSlice(profile, imageCount, startIndex);
  return imagesToCheck.every((uri) => warmedImageUris.has(uri));
}
