import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { pool } from "@workspace/db";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { runtimeConfig } from "../../config/runtime";
import { CacheService } from "../cache/cache.service";
import { CACHE_TTL_SECONDS } from "../cache/cache.constants";
import { cacheKey, cacheKeys } from "../cache/cache.keys";
import { getOrComputeWithCache, invalidateWithCache } from "../cache/cache.utils";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type ProfilePhotoRow = {
  profile_image_id: number;
  media_asset_id: number;
  sort_order: number;
  is_primary: boolean;
  updated_at: string | Date;
  public_url: string | null;
  mime_type: string;
  status: "pending" | "ready" | "deleted";
};

const ALLOWED_IMAGE_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Optional()
    @Inject(CacheService)
    private readonly cacheService?: CacheService
  ) {}

  private readonly mediaRoot = path.join(
    process.cwd(),
    "artifacts",
    "api-server",
    "storage",
    "media"
  );

  private async ensureMediaRoot() {
    await mkdir(this.mediaRoot, { recursive: true });
  }

  private getFileExtension(file: UploadedFile) {
    const extension = ALLOWED_IMAGE_MIME_TYPES.get(file.mimetype);
    if (!extension) {
      throw new Error("UNSUPPORTED_MEDIA_TYPE");
    }
    return extension;
  }

  private buildStorageKey(profileId: number, sortOrder: number, extension: string) {
    return `profile-${profileId}/${sortOrder}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;
  }

  private buildAbsolutePath(storageKey: string) {
    const absolutePath = path.resolve(this.mediaRoot, storageKey);
    const mediaRoot = path.resolve(this.mediaRoot);
    if (absolutePath !== mediaRoot && !absolutePath.startsWith(`${mediaRoot}${path.sep}`)) {
      throw new Error("INVALID_MEDIA_STORAGE_KEY");
    }
    return absolutePath;
  }

  private buildPublicUrl(mediaAssetId: number) {
    return `${runtimeConfig.baseUrl}/api/media/public/${mediaAssetId}`;
  }

  private resolvePublicUrl(mediaAssetId: number, publicUrl: string | null) {
    const trimmed = String(publicUrl || "").trim();
    if (!trimmed) {
      return this.buildPublicUrl(mediaAssetId);
    }

    if (trimmed.startsWith("/api/media/public/")) {
      return this.buildPublicUrl(mediaAssetId);
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith("/api/media/public/")) {
        return this.buildPublicUrl(mediaAssetId);
      }
      return parsed.toString();
    } catch {
      return this.buildPublicUrl(mediaAssetId);
    }
  }

  private async findProfileIdForUser(userId: number) {
    const result = await pool.query<{ id: number }>(
      `SELECT id
       FROM core.profiles
       WHERE user_id = $1 AND kind = 'user'
       LIMIT 1`,
      [userId]
    );
    const profileId = result.rows[0]?.id;
    if (!profileId) {
      throw new Error("PROFILE_NOT_FOUND");
    }
    return profileId;
  }

  async listProfileImages(userId: number) {
    const profileId = await this.findProfileIdForUser(userId);
    return this.listProfileImagesByProfileId(profileId);
  }

  async listProfileImagesByProfileId(profileId: number) {
    return getOrComputeWithCache({
      cacheService: this.cacheService,
      logger: this.logger,
      scope: "media-cache",
      key: cacheKey("media", "profile-images", "profile", profileId),
      ttlSeconds: CACHE_TTL_SECONDS.mediaMetadata,
      loader: () => this.loadProfileImagesByProfileId(profileId),
    });
  }

  private async loadProfileImagesByProfileId(profileId: number) {
    const result = await pool.query<ProfilePhotoRow>(
      `SELECT
         pi.id AS profile_image_id,
         ma.id AS media_asset_id,
         pi.sort_order,
         pi.is_primary,
         ma.updated_at,
         ma.public_url,
         ma.mime_type,
         ma.status
       FROM media.profile_images pi
       JOIN media.media_assets ma ON ma.id = pi.media_asset_id
       WHERE pi.profile_id = $1 AND ma.status <> 'deleted'
       ORDER BY pi.sort_order ASC`,
      [profileId]
    );

    return {
      photos: result.rows.map((row) => ({
        profileImageId: Number(row.profile_image_id),
        mediaAssetId: Number(row.media_asset_id),
        sortOrder: Number(row.sort_order),
        isPrimary: Boolean(row.is_primary),
        updatedAt: new Date(row.updated_at).toISOString(),
        remoteUrl: this.resolvePublicUrl(Number(row.media_asset_id), row.public_url),
        mimeType: row.mime_type,
        status: row.status === "pending" ? "pending" : "ready",
      })),
    };
  }

  async uploadProfileImage(userId: number, sortOrder: number, file: UploadedFile) {
    if (!file?.buffer?.length) {
      throw new Error("MEDIA_FILE_REQUIRED");
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new Error("UNSUPPORTED_MEDIA_TYPE");
    }

    const profileId = await this.findProfileIdForUser(userId);
    await this.ensureMediaRoot();

    const client = await pool.connect();
    let previousStorageKey: string | null = null;

    try {
      await client.query("BEGIN");

      const previous = await client.query<{ storage_key: string | null }>(
        `SELECT ma.storage_key
         FROM media.profile_images pi
         JOIN media.media_assets ma ON ma.id = pi.media_asset_id
         WHERE pi.profile_id = $1 AND pi.sort_order = $2
         LIMIT 1`,
        [profileId, sortOrder]
      );
      previousStorageKey = previous.rows[0]?.storage_key || null;

      const extension = this.getFileExtension(file);
      const storageKey = this.buildStorageKey(profileId, sortOrder, extension);
      const absolutePath = this.buildAbsolutePath(storageKey);

      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.buffer);

      const assetInsert = await client.query<{ id: number }>(
        `INSERT INTO media.media_assets
          (owner_profile_id, storage_provider, storage_key, public_url, mime_type, byte_size, status)
         VALUES ($1, 'local', $2, $3, $4, $5, 'ready')
         RETURNING id`,
        [
          profileId,
          storageKey,
          "",
          file.mimetype || "image/jpeg",
          file.size || file.buffer.length,
        ]
      );

      const mediaAssetId = Number(assetInsert.rows[0].id);
      const publicUrl = this.buildPublicUrl(mediaAssetId);

      await client.query(
        `UPDATE media.media_assets
         SET public_url = $2, updated_at = NOW()
         WHERE id = $1`,
        [mediaAssetId, publicUrl]
      );

      const profileImageInsert = await client.query<{ id: number }>(
        `INSERT INTO media.profile_images
          (profile_id, media_asset_id, sort_order, is_primary)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (profile_id, sort_order)
         DO UPDATE SET
           media_asset_id = EXCLUDED.media_asset_id,
           is_primary = EXCLUDED.is_primary,
           updated_at = NOW()
         RETURNING id`,
        [profileId, mediaAssetId, sortOrder, sortOrder === 0]
      );

      await client.query(
        `UPDATE media.profile_images
         SET is_primary = (sort_order = 0), updated_at = NOW()
         WHERE profile_id = $1`,
        [profileId]
      );

      await client.query(
        `UPDATE media.media_assets
         SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
         WHERE owner_profile_id = $1
           AND id <> $2
           AND id IN (
             SELECT ma.id
             FROM media.profile_images pi
             JOIN media.media_assets ma ON ma.id = pi.media_asset_id
             WHERE pi.profile_id = $1 AND pi.sort_order = $3 AND ma.id <> $2
           )`,
        [profileId, mediaAssetId, sortOrder]
      );

      await client.query("COMMIT");

      if (previousStorageKey) {
        await rm(this.buildAbsolutePath(previousStorageKey), { force: true });
      }

      await this.invalidateProfileImageCaches(userId, profileId);

      return {
        profileImageId: Number(profileImageInsert.rows[0].id),
        mediaAssetId,
        sortOrder,
        isPrimary: sortOrder === 0,
        updatedAt: new Date().toISOString(),
        remoteUrl: publicUrl,
        mimeType: file.mimetype || "image/jpeg",
        status: "ready" as const,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProfileImage(userId: number, profileImageId: number) {
    const profileId = await this.findProfileIdForUser(userId);
    const result = await pool.query<{ storage_key: string | null }>(
      `SELECT ma.storage_key
       FROM media.profile_images pi
       JOIN media.media_assets ma ON ma.id = pi.media_asset_id
       WHERE pi.id = $1 AND pi.profile_id = $2
       LIMIT 1`,
      [profileImageId, profileId]
    );

    if (!result.rows[0]) {
      return;
    }

    await pool.query(
      `UPDATE media.media_assets
       SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
       WHERE id IN (
         SELECT media_asset_id
         FROM media.profile_images
         WHERE id = $1 AND profile_id = $2
       )`,
      [profileImageId, profileId]
    );

    await pool.query(
      `DELETE FROM media.profile_images
       WHERE id = $1 AND profile_id = $2`,
      [profileImageId, profileId]
    );

    const storageKey = result.rows[0].storage_key;
    if (storageKey) {
      await rm(this.buildAbsolutePath(storageKey), { force: true });
    }
    await this.invalidateProfileImageCaches(userId, profileId);
  }

  private async invalidateProfileImageCaches(userId: number, profileId: number) {
    await invalidateWithCache({
      cacheService: this.cacheService,
      logger: this.logger,
      scope: "media-cache",
      description: `user:${userId}:profile:${profileId}`,
      invalidate: async (cacheService) => {
        await Promise.all([
          cacheService.delete(cacheKey("media", "profile-images", "profile", profileId)),
          cacheService.delete(cacheKeys.viewerProfile(userId)),
          cacheService.delete(cacheKeys.viewerBootstrap(userId)),
          cacheService.deleteByPrefix(cacheKeys.adminPrefix()),
        ]);
      },
    });
  }

  async getPublicMediaFile(mediaAssetId: number) {
    const result = await pool.query<{
      storage_key: string;
      mime_type: string;
      status: "pending" | "ready" | "deleted";
    }>(
      `SELECT storage_key, mime_type, status
       FROM media.media_assets
       WHERE id = $1
       LIMIT 1`,
      [mediaAssetId]
    );

    const asset = result.rows[0];
    if (!asset || asset.status === "deleted") {
      return null;
    }

    return {
      absolutePath: this.buildAbsolutePath(asset.storage_key),
      mimeType: asset.mime_type,
    };
  }
}
