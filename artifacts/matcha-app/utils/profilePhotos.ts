import * as FileSystem from "expo-file-system/legacy";

export const PROFILE_PHOTOS_ROOT_DIR = `${FileSystem.documentDirectory ?? ""}matcha-profile-photos/`;

function normalizeOwnerKey(ownerKey?: string | number | null) {
  const raw = String(ownerKey ?? "anonymous").trim() || "anonymous";
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getProfilePhotosDir(ownerKey?: string | number | null) {
  return `${PROFILE_PHOTOS_ROOT_DIR}${normalizeOwnerKey(ownerKey)}/`;
}

export type UserProfilePhoto = {
  localUri: string;
  remoteUrl: string;
  mediaAssetId: number | null;
  profileImageId: number | null;
  sortOrder: number;
  status: "pending" | "ready" | "error";
};

export function isStoredProfilePhoto(uri: string | null | undefined) {
  return Boolean(uri && uri.startsWith(PROFILE_PHOTOS_ROOT_DIR));
}

export function getProfilePhotoDisplayUri(
  photo: UserProfilePhoto | string | null | undefined
) {
  if (!photo) {
    return "";
  }
  if (typeof photo === "string") {
    return photo;
  }
  if (photo.status === "ready" && photo.remoteUrl) {
    return photo.remoteUrl;
  }
  return photo.localUri || photo.remoteUrl || "";
}

export function getProfilePhotoBySortOrder(
  photos: Array<UserProfilePhoto | string> | null | undefined,
  sortOrder: number
) {
  const normalized = normalizeStoredProfilePhotos(photos);
  return normalized.find((photo) => photo.sortOrder === sortOrder);
}

export function normalizeStoredProfilePhotos(
  input: Array<UserProfilePhoto | string> | null | undefined
) {
  if (!Array.isArray(input)) {
    return [] as UserProfilePhoto[];
  }

  return input
    .map((photo, index) => {
      if (typeof photo === "string") {
        const uri = photo.trim();
        if (!uri) {
          return null;
        }
        return {
          localUri: uri,
          remoteUrl: "",
          mediaAssetId: null,
          profileImageId: null,
          sortOrder: index,
          status: "ready" as const,
        };
      }

      const localUri = String(photo?.localUri || "").trim();
      const remoteUrl = String(photo?.remoteUrl || "").trim();
      if (!localUri && !remoteUrl) {
        return null;
      }

      return {
        localUri,
        remoteUrl,
        mediaAssetId:
          typeof photo?.mediaAssetId === "number" ? photo.mediaAssetId : null,
        profileImageId:
          typeof photo?.profileImageId === "number" ? photo.profileImageId : null,
        sortOrder:
          typeof photo?.sortOrder === "number" ? photo.sortOrder : index,
        status:
          photo?.status === "pending"
            ? "pending"
            : photo?.status === "error"
              ? "error"
              : "ready",
      };
    })
    .filter((photo): photo is UserProfilePhoto => Boolean(photo))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveProfilePhotoLocally(
  index: number,
  sourceUri: string,
  ownerKey?: string | number | null
) {
  const extension = sourceUri.split(".").pop()?.split("?")[0] || "jpg";
  const targetDir = getProfilePhotosDir(ownerKey);
  const targetUri = `${targetDir}${Date.now()}-${index}.${extension}`;
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
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

export async function restoreProfilePhotoLocally(
  index: number,
  remoteUrl: string,
  fallbackExtension?: string,
  ownerKey?: string | number | null
) {
  const extension =
    fallbackExtension || remoteUrl.split(".").pop()?.split("?")[0] || "jpg";
  const targetDir = getProfilePhotosDir(ownerKey);
  const targetUri = `${targetDir}${Date.now()}-${index}.${extension}`;
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  await FileSystem.downloadAsync(remoteUrl, targetUri);
  return targetUri;
}

export async function ensureLocalProfilePhoto(
  photo: UserProfilePhoto,
  index: number,
  ownerKey?: string | number | null
) {
  try {
    if (photo.localUri) {
      const info = await FileSystem.getInfoAsync(photo.localUri);
      if (info.exists) {
        return photo;
      }
    }

    if (!photo.remoteUrl) {
      return {
        ...photo,
        localUri: "",
        sortOrder: index,
      };
    }

    const localUri = await restoreProfilePhotoLocally(
      index,
      photo.remoteUrl,
      undefined,
      ownerKey
    );
    return {
      ...photo,
      localUri,
      sortOrder: index,
    };
  } catch {
    return {
      ...photo,
      localUri: "",
      sortOrder: index,
    };
  }
}
