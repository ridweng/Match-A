import crypto from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Inject, Injectable, Logger, Optional, UnauthorizedException } from "@nestjs/common";
import { pool } from "@workspace/db";
import { CacheService } from "../cache/cache.service";
import { cacheKeys } from "../cache/cache.keys";
import { invalidateWithCache } from "../cache/cache.utils";
import { EmailDeliveryError } from "../email/email.types";
import { EmailService } from "../email/email.service";
import { GoalsService } from "../goals/goals.service";
import {
  getProviderRedirectUri,
  isProviderConfigured,
  runtimeConfig,
} from "../../config/runtime";

export type Provider = "google" | "facebook" | "apple";

type UserRow = {
  id: number;
  email: string | null;
  password_hash: string | null;
  email_verified: boolean;
  welcome_email_sent_at?: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  name: string | null;
  date_of_birth: string | null;
  profession: string | null;
  onboarding_status: string | null;
};

type SettingsRow = {
  language: string;
  height_unit: string;
  gender_identity: string | null;
  pronouns: string | null;
  personality: string | null;
};

type SessionRow = {
  id: number;
  user_id: number;
  access_token_hash: string;
  refresh_token_hash: string;
  access_expires_at: string | Date;
  refresh_expires_at: string | Date;
  revoked_at: string | Date | null;
  last_used_at?: string | Date | null;
  updated_at?: string | Date;
  created_at: string | Date;
};

type AuthUserSessionSnapshot = {
  userId: number;
  email: string | null;
  emailVerified: boolean;
  userCreatedAt: string | null;
  sessionId: number | null;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  profileId: number | null;
  displayName: string | null;
  dateOfBirth: string | null;
  onboardingStatus: string | null;
  onboardingStartedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingUpdatedAt: string | null;
  profileImageCount: number;
};

type AuthSessionPayload = Awaited<ReturnType<AuthService["createSessionResponse"]>>;

type VerificationTokenRow = UserRow & {
  token_id: number;
  user_id: number;
  token_expires_at: string | Date;
  token_used_at: string | Date | null;
};

const accessTtlMs = runtimeConfig.accessTtlMinutes * 60 * 1000;
const refreshTtlMs = runtimeConfig.refreshTtlDays * 24 * 60 * 60 * 1000;
const verificationTtlMs = runtimeConfig.emailVerificationTtlMinutes * 60 * 1000;
const passwordResetTtlMs = runtimeConfig.passwordResetTtlMinutes * 60 * 1000;
const PER_IP_MINUTE_LIMIT = 5;
const PER_IP_HOUR_LIMIT = 20;
const PER_TARGET_QUARTER_HOUR_LIMIT = 3;
const PER_TARGET_DAY_LIMIT = 10;
type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(GoalsService) private readonly goalsService: GoalsService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Optional() @Inject(CacheService) private readonly cacheService?: CacheService
  ) {}

  private normalizeEmail(email: string) {
    return String(email || "").trim().toLowerCase();
  }

  private readonly mediaRoot = path.join(
    process.cwd(),
    "artifacts",
    "api-server",
    "storage",
    "media"
  );

  private buildMediaAbsolutePath(storageKey: string) {
    return path.join(this.mediaRoot, storageKey);
  }

  private async invalidateUserStateCaches(userId: number) {
    await invalidateWithCache({
      cacheService: this.cacheService,
      logger: this.logger,
      scope: "auth-cache",
      description: `user:${userId}`,
      invalidate: async (cacheService) => {
        await Promise.all([
          cacheService.delete(cacheKeys.viewerBootstrap(userId)),
          cacheService.delete(cacheKeys.viewerProfile(userId)),
          cacheService.delete(cacheKeys.goals(userId)),
          cacheService.delete(cacheKeys.discoveryPreferences(userId)),
          cacheService.deleteByPrefix(cacheKeys.adminPrefix()),
        ]);
      },
    });
  }

  private randomToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  private hashToken(value: string) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private hashLookupValue(value: string) {
    return crypto.createHash("sha256").update(String(value || "")).digest("hex");
  }

  private handoffEncryptionKey() {
    return crypto
      .createHash("sha256")
      .update(runtimeConfig.sessionSecret)
      .digest();
  }

  private encryptHandoffPayload(payload: AuthSessionPayload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.handoffEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(payload), "utf8"),
      cipher.final(),
    ]);
    return {
      encryptedPayload: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    };
  }

  private decryptHandoffPayload(row: {
    encrypted_payload: string;
    iv: string;
    auth_tag: string;
  }): AuthSessionPayload {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.handoffEncryptionKey(),
      Buffer.from(row.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(row.encrypted_payload, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as AuthSessionPayload;
  }

  private genericEmailActionResponse(message: string) {
    return {
      status: "ok" as const,
      message,
    };
  }

  private base64url(input: string) {
    return Buffer.from(input)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  private encodeJsonBase64url(value: unknown) {
    return this.base64url(JSON.stringify(value));
  }

  private signState(payload: Record<string, unknown>) {
    const encoded = this.encodeJsonBase64url(payload);
    const signature = crypto
      .createHmac("sha256", runtimeConfig.sessionSecret)
      .update(encoded)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    return `${encoded}.${signature}`;
  }

  verifyState(token: string) {
    const [encoded, signature] = String(token || "").split(".");
    if (!encoded || !signature) return null;
    const expected = crypto
      .createHmac("sha256", runtimeConfig.sessionSecret)
      .update(encoded)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }
    try {
      const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
      if (payload.expiresAt < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private async hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = await new Promise<string>((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (error, result) => {
        if (error) reject(error);
        else resolve(result.toString("hex"));
      });
    });
    return `${salt}:${derived}`;
  }

  private async verifyPassword(password: string, storedHash: string | null) {
    const [salt, derived] = String(storedHash || "").split(":");
    if (!salt || !derived) return false;
    const candidate = await new Promise<string>((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (error, result) => {
        if (error) reject(error);
        else resolve(result.toString("hex"));
      });
    });
    return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(candidate));
  }

  private getAge(dateOfBirth: string) {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    const monthDelta = today.getUTCMonth() - birth.getUTCMonth();
    const dayDelta = today.getUTCDate() - birth.getUTCDate();
    if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
      age -= 1;
    }
    return age;
  }

  validateDob(dateOfBirth: string) {
    const parsed = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { valid: false, code: "INVALID_DATE_OF_BIRTH" };
    }
    if (this.getAge(dateOfBirth) < runtimeConfig.minimumAge) {
      return { valid: false, code: "UNDERAGE" };
    }
    return { valid: true };
  }

  private mapUser(row: UserRow | undefined | null) {
    if (!row) return null;
    return {
      id: Number(row.id),
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name || "",
      dateOfBirth: row.date_of_birth,
      profession: row.profession || "",
      onboardingStatus: row.onboarding_status,
      emailVerified: Boolean(row.email_verified),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  sanitizeUser(user: ReturnType<AuthService["mapUser"]>) {
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      dateOfBirth: user.dateOfBirth,
      profession: user.profession || "",
      emailVerified: Boolean(user.emailVerified),
    };
  }

  sanitizeSettings(settings: SettingsRow | null) {
    return {
      language: settings?.language === "en" ? "en" : "es",
      heightUnit: settings?.height_unit === "imperial" ? "imperial" : "metric",
      genderIdentity: settings?.gender_identity || "",
      pronouns: settings?.pronouns || "",
      personality: settings?.personality || "",
    };
  }

  resolveHasCompletedOnboarding(
    user: ReturnType<AuthService["mapUser"]> | null | undefined
  ) {
    return this.resolveCanonicalOnboardingState(user) === "complete";
  }

  private resolveCanonicalOnboardingState(
    user: ReturnType<AuthService["mapUser"]> | null | undefined,
  ): "incomplete" | "complete" {
    if (user?.onboardingStatus === "completed" || user?.onboardingStatus === "exempt") {
      return "complete";
    }
    return "incomplete";
  }

  private resolveCanonicalOnboardingStateFromSnapshot(
    user: ReturnType<AuthService["mapUser"]> | null | undefined,
    snapshot?: AuthUserSessionSnapshot | null
  ): "incomplete" | "complete" {
    if (snapshot?.onboardingStatus === "completed" || snapshot?.onboardingStatus === "exempt") {
      return "complete";
    }
    if (snapshot?.onboardingStatus === "pending") {
      return "incomplete";
    }
    return this.resolveCanonicalOnboardingState(user);
  }

  private async repairLegacyCompletedOnboardingForUser(userId: number) {
    await pool.query(
      `WITH eligible_repair AS (
         SELECT DISTINCT p.user_id
         FROM core.profiles p
         WHERE p.kind = 'user'
           AND p.user_id = $1
           AND COALESCE(TRIM(p.gender_identity), '') <> ''
           AND COALESCE(TRIM(p.pronouns), '') <> ''
           AND COALESCE(TRIM(p.personality), '') <> ''
           AND COALESCE(TRIM(p.relationship_goals), '') <> ''
           AND COALESCE(TRIM(p.children_preference), '') <> ''
           AND COALESCE(TRIM(p.education), '') <> ''
           AND COALESCE(TRIM(p.physical_activity), '') <> ''
           AND COALESCE(TRIM(p.body_type), '') <> ''
           AND EXISTS (
             SELECT 1
             FROM core.profile_languages pl
             WHERE pl.profile_id = p.id
           )
           AND EXISTS (
             SELECT 1
             FROM media.profile_images pi
             JOIN media.media_assets ma ON ma.id = pi.media_asset_id
             WHERE pi.profile_id = p.id
               AND ma.status = 'ready'
           )
       )
       INSERT INTO core.user_onboarding
         (user_id, status, required_version, started_at, completed_at, exempted_at, completion_origin, created_at, updated_at)
       SELECT
         er.user_id,
         'completed'::onboarding_status,
         1,
         NOW(),
         NOW(),
         NULL,
         'legacy_backfill',
         NOW(),
         NOW()
       FROM eligible_repair er
       ON CONFLICT (user_id) DO UPDATE SET
         status = 'completed'::onboarding_status,
         completed_at = COALESCE(core.user_onboarding.completed_at, EXCLUDED.completed_at),
         completion_origin = CASE
           WHEN core.user_onboarding.status = 'completed'::onboarding_status
             THEN core.user_onboarding.completion_origin
           ELSE 'legacy_backfill'
         END,
         updated_at = NOW()
       WHERE core.user_onboarding.status <> 'completed'::onboarding_status`,
      [userId]
    );
  }

  async ensureCanonicalOnboardingState(
    user: ReturnType<AuthService["mapUser"]> | null | undefined
  ) {
    if (!user?.id) {
      return user;
    }
    if (user.onboardingStatus === "completed" || user.onboardingStatus === "exempt") {
      return user;
    }
    await this.repairLegacyCompletedOnboardingForUser(user.id);
    return this.findUserById(user.id);
  }

  async authPayload(
    user: ReturnType<AuthService["mapUser"]>,
    accessToken: string,
    refreshToken: string,
    options?: { snapshot?: AuthUserSessionSnapshot | null }
  ) {
    const canonicalUser = (await this.ensureCanonicalOnboardingState(user)) || user;
    const needsProfileCompletion = !canonicalUser?.name || !canonicalUser?.dateOfBirth;
    const onboardingState = this.resolveCanonicalOnboardingStateFromSnapshot(
      canonicalUser,
      options?.snapshot
    );
    const hasCompletedOnboarding = onboardingState === "complete";
    return {
      status: "authenticated",
      accessToken,
      refreshToken,
      user: this.sanitizeUser(canonicalUser),
      needsProfileCompletion,
      onboardingState,
      hasCompletedOnboarding,
    };
  }

  private async queryOne<T>(query: string, values: unknown[] = []) {
    const result = await pool.query(query, values);
    return result.rows[0] as T | undefined;
  }

  private maskEmail(email: string | null | undefined) {
    if (!email) return null;
    const [localPart, domain] = String(email).split("@");
    if (!localPart || !domain) return email;
    const visible = localPart.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(0, localPart.length - 2))}@${domain}`;
  }

  private hashPrefix(value: string) {
    const hashed = this.hashToken(value);
    return hashed.slice(0, 12);
  }

  private toIso(value: string | Date | null | undefined) {
    if (!value) {
      return null;
    }
    return new Date(value).toISOString();
  }

  private logAuthEvent(
    level: "log" | "warn" | "error",
    event: string,
    payload: Record<string, unknown>
  ) {
    this.logger[level](`[auth] ${event} ${JSON.stringify(payload)}`);
  }

  private async touchSessionLastUsed(sessionId: number) {
    await pool.query(
      `UPDATE auth.auth_sessions
       SET last_used_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );
  }

  private async getAuthUserSessionSnapshot(
    userId: number,
    sessionId?: number | null
  ): Promise<AuthUserSessionSnapshot | null> {
    const snapshot = await this.queryOne<{
      user_id: number;
      email: string | null;
      email_verified: boolean;
      user_created_at: string | Date | null;
      session_id: number | null;
      access_expires_at: string | Date | null;
      refresh_expires_at: string | Date | null;
      revoked_at: string | Date | null;
      last_used_at: string | Date | null;
      profile_id: number | null;
      display_name: string | null;
      date_of_birth: string | null;
      onboarding_status: string | null;
      onboarding_started_at: string | Date | null;
      onboarding_completed_at: string | Date | null;
      onboarding_updated_at: string | Date | null;
      profile_image_count: string | number | null;
    }>(
      `SELECT
         u.id AS user_id,
         u.email,
         u.email_verified,
         u.created_at AS user_created_at,
         s.id AS session_id,
         s.access_expires_at,
         s.refresh_expires_at,
         s.revoked_at,
         s.last_used_at,
         p.id AS profile_id,
         p.display_name,
         p.date_of_birth,
         o.status AS onboarding_status,
         o.started_at AS onboarding_started_at,
         o.completed_at AS onboarding_completed_at,
         o.updated_at AS onboarding_updated_at,
         COUNT(ma.id) AS profile_image_count
       FROM auth.users u
       LEFT JOIN auth.auth_sessions s
         ON s.user_id = u.id
        AND ($2::bigint IS NULL OR s.id = $2)
       LEFT JOIN core.profiles p
         ON p.user_id = u.id
       AND p.kind = 'user'
       LEFT JOIN core.user_onboarding o
         ON o.user_id = u.id
       LEFT JOIN media.profile_images pi
         ON pi.profile_id = p.id
       LEFT JOIN media.media_assets ma
         ON ma.id = pi.media_asset_id
        AND ma.status <> 'deleted'
       WHERE u.id = $1
       GROUP BY
         u.id,
         u.email,
         u.email_verified,
         u.created_at,
         s.id,
         s.access_expires_at,
         s.refresh_expires_at,
         s.revoked_at,
         s.last_used_at,
         p.id,
         p.display_name,
         p.date_of_birth,
         o.status,
         o.started_at,
         o.completed_at,
         o.updated_at
       LIMIT 1`,
      [userId, sessionId ?? null]
    );

    if (!snapshot) {
      return null;
    }

    return {
      userId: Number(snapshot.user_id),
      email: this.maskEmail(snapshot.email),
      emailVerified: Boolean(snapshot.email_verified),
      userCreatedAt: this.toIso(snapshot.user_created_at),
      sessionId: snapshot.session_id ? Number(snapshot.session_id) : null,
      accessExpiresAt: this.toIso(snapshot.access_expires_at),
      refreshExpiresAt: this.toIso(snapshot.refresh_expires_at),
      revokedAt: this.toIso(snapshot.revoked_at),
      lastUsedAt: this.toIso(snapshot.last_used_at),
      profileId: snapshot.profile_id ? Number(snapshot.profile_id) : null,
      displayName: snapshot.display_name,
      dateOfBirth: snapshot.date_of_birth,
      onboardingStatus: snapshot.onboarding_status,
      onboardingStartedAt: this.toIso(snapshot.onboarding_started_at),
      onboardingCompletedAt: this.toIso(snapshot.onboarding_completed_at),
      onboardingUpdatedAt: this.toIso(snapshot.onboarding_updated_at),
      profileImageCount: Number(snapshot.profile_image_count || 0),
    };
  }

  private logVerificationRedirectOutcome(
    outcome: "success" | "already_verified" | "replaced" | "expired" | "invalid",
    email?: string | null
  ) {
    if (runtimeConfig.nodeEnv === "production") {
      return;
    }

    console.log("[api-server] verification redirect", {
      outcome,
      email: this.maskEmail(email),
    });
  }

  private async initializeUserState(
    client: DbClient,
    input: {
      userId: number;
      displayName?: string;
      dateOfBirth?: string | null;
      profession?: string;
      onboardingStatus: "pending" | "completed" | "exempt";
      syncStatus: "pending" | "completed";
    }
  ) {
    await client.query(
      `INSERT INTO core.profiles
        (public_id, user_id, kind, display_name, date_of_birth, profession, content_locale)
       VALUES ($1, $2, 'user', $3, $4, $5, 'es')
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         date_of_birth = COALESCE(EXCLUDED.date_of_birth, core.profiles.date_of_birth),
         profession = EXCLUDED.profession,
         updated_at = NOW()`,
      [
        `u_${input.userId}`,
        input.userId,
        input.displayName || "",
        input.dateOfBirth || null,
        input.profession || "",
      ]
    );

    await client.query(
      `INSERT INTO core.user_settings (user_id, language, height_unit)
       VALUES ($1, 'es', 'metric')
       ON CONFLICT (user_id) DO NOTHING`,
      [input.userId]
    );

    await client.query(
      `INSERT INTO core.user_onboarding
        (user_id, status, started_at, completed_at, exempted_at, completion_origin)
       VALUES ($1, $2, NOW(),
         CASE WHEN $2::onboarding_status = 'completed'::onboarding_status THEN NOW() ELSE NULL END,
         CASE WHEN $2::onboarding_status = 'exempt'::onboarding_status THEN NOW() ELSE NULL END,
         CASE
           WHEN $2::onboarding_status = 'completed'::onboarding_status THEN 'user_flow'
           ELSE NULL
         END)
       ON CONFLICT (user_id) DO UPDATE SET
         status = EXCLUDED.status,
         completed_at = CASE WHEN EXCLUDED.status = 'completed'::onboarding_status THEN NOW() ELSE core.user_onboarding.completed_at END,
         exempted_at = CASE WHEN EXCLUDED.status = 'exempt'::onboarding_status THEN NOW() ELSE core.user_onboarding.exempted_at END,
         completion_origin = CASE
           WHEN EXCLUDED.status = 'completed'::onboarding_status THEN 'user_flow'
           ELSE core.user_onboarding.completion_origin
         END,
         updated_at = NOW()`,
      [input.userId, input.onboardingStatus]
    );

    await client.query(
      `INSERT INTO core.user_sync_state
        (user_id, initial_data_migration_status, initial_data_migration_completed_at)
       VALUES ($1, $2,
         CASE WHEN $2::sync_status = 'completed'::sync_status THEN NOW() ELSE NULL END)
       ON CONFLICT (user_id) DO UPDATE SET
         initial_data_migration_status = EXCLUDED.initial_data_migration_status,
         initial_data_migration_completed_at = COALESCE(
           core.user_sync_state.initial_data_migration_completed_at,
           EXCLUDED.initial_data_migration_completed_at
         ),
         updated_at = NOW()`,
      [input.userId, input.syncStatus]
    );

    await this.goalsService.seedUserGoalTasks(input.userId, client);
  }

  async findUserByEmail(email: string) {
    const row = await this.queryOne<UserRow>(
      `SELECT
         u.id,
         u.email,
         u.password_hash,
         u.email_verified,
         u.created_at,
         u.updated_at,
         p.display_name AS name,
         p.date_of_birth,
         p.profession,
         o.status AS onboarding_status
       FROM auth.users u
       LEFT JOIN core.profiles p ON p.user_id = u.id AND p.kind = 'user'
       LEFT JOIN core.user_onboarding o ON o.user_id = u.id
       WHERE u.email = $1
       LIMIT 1`,
      [this.normalizeEmail(email)]
    );
    return this.mapUser(row);
  }

  async findUserById(id: number) {
    const row = await this.queryOne<UserRow>(
      `SELECT
         u.id,
         u.email,
         u.password_hash,
         u.email_verified,
         u.created_at,
         u.updated_at,
         p.display_name AS name,
         p.date_of_birth,
         p.profession,
         o.status AS onboarding_status
       FROM auth.users u
       LEFT JOIN core.profiles p ON p.user_id = u.id AND p.kind = 'user'
       LEFT JOIN core.user_onboarding o ON o.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [id]
    );
    return this.mapUser(row);
  }

  async createEmailUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    dateOfBirth: string;
    profession?: string;
    hasCompletedOnboarding?: boolean;
  }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{
        id: number;
        email: string | null;
        password_hash: string | null;
        email_verified: boolean;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `INSERT INTO auth.users
          (email, password_hash, created_provider, email_verified)
         VALUES ($1, $2, 'local', false)
         RETURNING id, email, password_hash, email_verified, created_at, updated_at`,
        [this.normalizeEmail(input.email), input.passwordHash]
      );

      const userId = inserted.rows[0]!.id;
      await this.initializeUserState(client, {
        userId,
        displayName: input.name,
        dateOfBirth: input.dateOfBirth,
        profession: input.profession || "",
        onboardingStatus: input.hasCompletedOnboarding ? "completed" : "pending",
        syncStatus: "completed",
      });

      await client.query("COMMIT");
      return this.findUserById(userId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateUserProfile(
    userId: number,
    updates: { name?: string; dateOfBirth?: string; profession?: string }
  ) {
    const assignments: string[] = [];
    const values: unknown[] = [];

    if (typeof updates.name === "string") {
      assignments.push(`display_name = $${values.length + 1}`);
      values.push(updates.name);
    }
    if (typeof updates.dateOfBirth === "string") {
      assignments.push(`date_of_birth = $${values.length + 1}`);
      values.push(updates.dateOfBirth);
    }
    if (typeof updates.profession === "string") {
      assignments.push(`profession = $${values.length + 1}`);
      values.push(updates.profession);
    }

    if (!assignments.length) {
      return this.findUserById(userId);
    }

    assignments.push(`updated_at = NOW()`);
    values.push(userId);

    await pool.query(
      `UPDATE core.profiles
       SET ${assignments.join(", ")}
       WHERE user_id = $${values.length}`,
      values
    );
    return this.findUserById(userId);
  }

  async completeUserOnboarding(userId: number) {
    await pool.query(
      `INSERT INTO core.user_onboarding
        (user_id, status, required_version, started_at, completed_at, exempted_at, completion_origin, created_at, updated_at)
       VALUES ($1, 'completed'::onboarding_status, 1, NOW(), NOW(), NULL, 'user_flow', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         status = 'completed'::onboarding_status,
         completed_at = COALESCE(core.user_onboarding.completed_at, NOW()),
         completion_origin = 'user_flow',
         updated_at = NOW()`,
      [userId]
    );
    return this.findUserById(userId);
  }

  async verifyUserEmail(userId: number) {
    await pool.query(
      `UPDATE auth.users
       SET email_verified = true, email_verified_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    return this.findUserById(userId);
  }

  async sendWelcomeEmailOnce(userId: number) {
    const profile = await this.findUserDeliveryProfile(userId);
    if (!profile?.email || profile.welcome_email_sent_at) {
      return false;
    }

    await this.emailService.sendWelcomeEmail({
      recipientEmail: profile.email,
      recipientName: profile.display_name || undefined,
      locale: "es",
      appLink: this.buildLoginUrl(),
    });

    const update = await pool.query<{ id: number }>(
      `UPDATE auth.users
       SET welcome_email_sent_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND welcome_email_sent_at IS NULL
       RETURNING id`,
      [userId]
    );

    return Boolean(update.rows[0]);
  }

  async createVerificationToken(userId: number, rawToken: string, expiresAt: string) {
    await pool.query(
      `INSERT INTO auth.email_verification_tokens
        (user_id, token_hash, expires_at, used_at)
       VALUES ($1, $2, $3, NULL)`,
      [userId, this.hashToken(rawToken), expiresAt]
    );
  }

  async invalidatePendingVerificationTokens(userId: number) {
    await pool.query(
      `UPDATE auth.email_verification_tokens
       SET used_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
  }

  async createPasswordResetToken(
    userId: number,
    rawToken: string,
    expiresAt: string,
    client?: DbClient
  ) {
    const dbClient = client || pool;
    await dbClient.query(
      `UPDATE auth.password_reset_tokens
       SET superseded_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL AND superseded_at IS NULL`,
      [userId]
    );
    await dbClient.query(
      `INSERT INTO auth.password_reset_tokens
        (user_id, token_hash, expires_at, used_at, superseded_at)
       VALUES ($1, $2, $3, NULL, NULL)`,
      [userId, this.hashToken(rawToken), expiresAt]
    );
  }

  async consumePasswordResetToken(rawToken: string) {
    const token = await this.queryOne<{
      id: number;
      user_id: number;
      expires_at: string | Date;
      used_at: string | Date | null;
      superseded_at: string | Date | null;
    }>(
      `SELECT *
       FROM auth.password_reset_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [this.hashToken(rawToken)]
    );

    if (!token) return { error: "INVALID_PASSWORD_RESET_TOKEN" as const };
    if (token.used_at) return { error: "USED_PASSWORD_RESET_TOKEN" as const };
    if (token.superseded_at) return { error: "SUPERSEDED_PASSWORD_RESET_TOKEN" as const };
    if (new Date(token.expires_at).getTime() < Date.now()) {
      return { error: "EXPIRED_PASSWORD_RESET_TOKEN" as const };
    }

    await pool.query(
      `UPDATE auth.password_reset_tokens
       SET used_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [token.id]
    );

    return {
      status: "ok" as const,
      userId: token.user_id,
    };
  }

  async recordEmailActionAttempt(input: {
    actionType: "verify_resend" | "password_reset_request";
    ipAddress: string;
    email: string;
    userId?: number | null;
  }) {
    await pool.query(
      `INSERT INTO auth.email_action_attempts
        (action_type, ip_hash, email_hash, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        input.actionType,
        this.hashLookupValue(input.ipAddress),
        input.email ? this.hashLookupValue(input.email) : null,
        input.userId ?? null,
      ]
    );
  }

  async isEmailActionRateLimited(input: {
    actionType: "verify_resend" | "password_reset_request";
    ipAddress: string;
    email: string;
    userId?: number | null;
  }) {
    const ipHash = this.hashLookupValue(input.ipAddress);
    const emailHash = input.email ? this.hashLookupValue(input.email) : null;

    const ipCounts = await this.queryOne<{
      minute_count: string;
      hour_count: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 minute')::text AS minute_count,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::text AS hour_count
       FROM auth.email_action_attempts
       WHERE action_type = $1 AND ip_hash = $2`,
      [input.actionType, ipHash]
    );

    const targetCounts = await this.queryOne<{
      quarter_hour_count: string;
      day_count: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '15 minute')::text AS quarter_hour_count,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::text AS day_count
       FROM auth.email_action_attempts
       WHERE action_type = $1
         AND (
           ($2::bigint IS NOT NULL AND user_id = $2)
           OR ($3::varchar IS NOT NULL AND email_hash = $3)
         )`,
      [input.actionType, input.userId ?? null, emailHash]
    );

    return (
      Number(ipCounts?.minute_count || 0) >= PER_IP_MINUTE_LIMIT ||
      Number(ipCounts?.hour_count || 0) >= PER_IP_HOUR_LIMIT ||
      Number(targetCounts?.quarter_hour_count || 0) >= PER_TARGET_QUARTER_HOUR_LIMIT ||
      Number(targetCounts?.day_count || 0) >= PER_TARGET_DAY_LIMIT
    );
  }

  async findUserDeliveryProfile(userId: number, client?: DbClient) {
    const dbClient = client || pool;
    const result = await dbClient.query<{
      email: string | null;
      display_name: string | null;
      language: string | null;
      welcome_email_sent_at: string | Date | null;
    }>(
      `SELECT
         u.email,
         u.welcome_email_sent_at,
         p.display_name,
         s.language
       FROM auth.users u
       LEFT JOIN core.profiles p ON p.user_id = u.id AND p.kind = 'user'
       LEFT JOIN core.user_settings s ON s.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  async findVerificationToken(rawToken: string) {
    const row = await this.queryOne<VerificationTokenRow>(
      `SELECT
         evt.id AS token_id,
         evt.user_id,
         evt.expires_at AS token_expires_at,
         evt.used_at AS token_used_at,
         u.id,
         u.email,
         u.password_hash,
         u.email_verified,
         u.welcome_email_sent_at,
         u.created_at,
         u.updated_at,
         p.display_name AS name,
         p.date_of_birth,
         p.profession,
         o.status AS onboarding_status
       FROM auth.email_verification_tokens evt
       JOIN auth.users u ON u.id = evt.user_id
       LEFT JOIN core.profiles p ON p.user_id = u.id AND p.kind = 'user'
       LEFT JOIN core.user_onboarding o ON o.user_id = u.id
       WHERE evt.token_hash = $1
       LIMIT 1`,
      [this.hashToken(rawToken)]
    );

    if (!row) {
      return null;
    }

    return {
      tokenId: Number(row.token_id),
      userId: Number(row.user_id),
      expiresAt: row.token_expires_at,
      usedAt: row.token_used_at,
      user: this.mapUser(row),
    };
  }

  async consumeVerificationToken(rawToken: string) {
    const token = await this.findVerificationToken(rawToken);
    if (!token) return null;
    if (token.usedAt) {
      return token.user?.emailVerified
        ? { alreadyVerified: true as const, user: token.user }
        : { replaced: true as const, user: token.user };
    }
    if (new Date(token.expiresAt).getTime() < Date.now()) {
      return { expired: true as const };
    }

    const claim = await pool.query<{ id: number }>(
      `UPDATE auth.email_verification_tokens
       SET used_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND used_at IS NULL
       RETURNING id`,
      [token.tokenId]
    );

    if (!claim.rows[0]) {
      const refreshed = await this.findVerificationToken(rawToken);
      if (!refreshed) {
        return null;
      }
      return refreshed.user?.emailVerified
        ? { alreadyVerified: true as const, user: refreshed.user }
        : { replaced: true as const, user: refreshed.user };
    }

    const user = token.user?.emailVerified
      ? token.user
      : await this.verifyUserEmail(token.userId);
    try {
      await this.sendWelcomeEmailOnce(token.userId);
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        console.error("[api-server] welcome email failed", error.code);
      } else {
        console.error(error);
      }
    }
    return { expired: false as const, user };
  }

  async createSession(
    userId: number,
    accessToken: string,
    refreshToken: string,
    accessExpiresAt: string,
    refreshExpiresAt: string
  ) {
    return this.queryOne<SessionRow>(
      `INSERT INTO auth.auth_sessions
        (user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, NULL)
       RETURNING *`,
      [
        userId,
        this.hashToken(accessToken),
        this.hashToken(refreshToken),
        accessExpiresAt,
        refreshExpiresAt,
      ]
    );
  }

  async findSessionRecordByAccessToken(accessToken: string) {
    return this.queryOne<SessionRow>(
      `SELECT *
       FROM auth.auth_sessions
       WHERE access_token_hash = $1
       LIMIT 1`,
      [this.hashToken(accessToken)]
    );
  }

  async rotateSession(refreshToken: string) {
    const session = await this.queryOne<SessionRow>(
      `SELECT *
       FROM auth.auth_sessions
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL
       LIMIT 1`,
      [this.hashToken(refreshToken)]
    );
    if (!session) return null;
    if (new Date(session.refresh_expires_at).getTime() < Date.now()) {
      return null;
    }

    const nextAccessToken = this.randomToken();
    const nextRefreshToken = this.randomToken();
    const nextAccessExpiresAt = new Date(Date.now() + accessTtlMs).toISOString();
    const nextRefreshExpiresAt = new Date(Date.now() + refreshTtlMs).toISOString();

    await pool.query(
      `UPDATE auth.auth_sessions
       SET access_token_hash = $1,
           refresh_token_hash = $2,
           access_expires_at = $3,
           refresh_expires_at = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [
        this.hashToken(nextAccessToken),
        this.hashToken(nextRefreshToken),
        nextAccessExpiresAt,
        nextRefreshExpiresAt,
        session.id,
      ]
    );

    const user = await this.findUserById(session.user_id);
    return user
      ? {
          user,
          sessionId: session.id,
          accessExpiresAt: nextAccessExpiresAt,
          refreshExpiresAt: nextRefreshExpiresAt,
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
        }
      : null;
  }

  async revokeSessionByAccessToken(accessToken: string) {
    await pool.query(
      `UPDATE auth.auth_sessions
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE access_token_hash = $1 AND revoked_at IS NULL`,
      [this.hashToken(accessToken)]
    );
  }

  async revokeAllSessionsForUser(userId: number) {
    await pool.query(
      `UPDATE auth.auth_sessions
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  async findUserSettings(userId: number) {
    return (
      (await this.queryOne<SettingsRow>(
        `SELECT
           s.language,
           s.height_unit,
           p.gender_identity,
           p.pronouns,
           p.personality
         FROM core.user_settings s
         JOIN core.profiles p ON p.user_id = s.user_id AND p.kind = 'user'
         WHERE s.user_id = $1
         LIMIT 1`,
        [userId]
      )) || null
    );
  }

  async upsertUserSettings(
    userId: number,
    updates: {
      language?: string;
      heightUnit?: string;
      genderIdentity?: string;
      pronouns?: string;
      personality?: string;
    }
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingSettings = await client.query<{
        language: string;
        height_unit: string;
      }>(
        `SELECT language, height_unit
         FROM core.user_settings
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      );
      const existingProfile = await client.query<{
        gender_identity: string;
        pronouns: string;
        personality: string;
      }>(
        `SELECT gender_identity, pronouns, personality
         FROM core.profiles
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      );

      const settings = existingSettings.rows[0];
      const profile = existingProfile.rows[0];

      await client.query(
        `INSERT INTO core.user_settings (user_id, language, height_unit)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           language = EXCLUDED.language,
           height_unit = EXCLUDED.height_unit,
           updated_at = NOW()`,
        [
          userId,
          typeof updates.language === "string" ? updates.language : settings?.language || "es",
          typeof updates.heightUnit === "string"
            ? updates.heightUnit
            : settings?.height_unit || "metric",
        ]
      );

      await client.query(
        `UPDATE core.profiles
         SET gender_identity = $1,
             pronouns = $2,
             personality = $3,
             updated_at = NOW()
         WHERE user_id = $4`,
        [
          typeof updates.genderIdentity === "string"
            ? updates.genderIdentity
            : profile?.gender_identity || "",
          typeof updates.pronouns === "string"
            ? updates.pronouns
            : profile?.pronouns || "",
          typeof updates.personality === "string"
            ? updates.personality
            : profile?.personality || "",
          userId,
        ]
      );

      await this.goalsService.rebuildUserGoalTargets(userId, client, {
        refreshPreferences: false,
      });

      await client.query("COMMIT");
      return (await this.findUserSettings(userId))!;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findIdentity(provider: Provider, providerUserId: string) {
    return (
      (await this.queryOne<{
        user_id: number;
      }>(
        `SELECT user_id
         FROM auth.auth_identities
         WHERE provider = $1 AND provider_user_id = $2
         LIMIT 1`,
        [provider, String(providerUserId)]
      )) || null
    );
  }

  async upsertSocialIdentity(input: {
    provider: Provider;
    providerUserId: string;
    email: string | null;
    name: string;
  }) {
    const existingIdentity = await this.findIdentity(
      input.provider,
      input.providerUserId
    );
    if (existingIdentity) {
      return { user: await this.findUserById(existingIdentity.user_id), created: false };
    }

    const normalizedEmail = input.email ? this.normalizeEmail(input.email) : null;
    let user = normalizedEmail ? await this.findUserByEmail(normalizedEmail) : null;
    if (!user) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO auth.users
            (email, password_hash, created_provider, email_verified, email_verified_at)
           VALUES ($1, NULL, $2, true, NOW())
           RETURNING id`,
          [normalizedEmail, input.provider]
        );
        const userId = inserted.rows[0]!.id;
        await this.initializeUserState(client, {
          userId,
          displayName: input.name || "",
          dateOfBirth: null,
          profession: "",
          onboardingStatus: "pending",
          syncStatus: "completed",
        });
        await client.query("COMMIT");
        user = await this.findUserById(userId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else if (!user.emailVerified) {
      user = await this.verifyUserEmail(user.id);
    }

    await pool.query(
      `INSERT INTO auth.auth_identities
        (user_id, provider, provider_user_id, email)
       VALUES ($1, $2, $3, $4)`,
      [user!.id, input.provider, String(input.providerUserId), normalizedEmail]
    );
    return { user, created: true };
  }

  async createSessionResponse(
    user: ReturnType<AuthService["mapUser"]>,
    options?: { requestId?: string; event?: string }
  ) {
    const accessToken = this.randomToken();
    const refreshToken = this.randomToken();
    const accessExpiresAt = new Date(Date.now() + accessTtlMs).toISOString();
    const refreshExpiresAt = new Date(Date.now() + refreshTtlMs).toISOString();
    const session = await this.createSession(
      user!.id,
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt
    );
    if (options?.event) {
      this.logAuthEvent("log", options.event, {
        requestId: options.requestId || null,
        userId: user?.id ?? null,
        email: this.maskEmail(user?.email),
        sessionId: session?.id ?? null,
        accessTokenHashPrefix: this.hashPrefix(accessToken),
        accessExpiresAt,
        refreshExpiresAt,
      });
    }
    const snapshot = await this.getAuthUserSessionSnapshot(user!.id, session?.id ?? null);
    return this.authPayload(user, accessToken, refreshToken, { snapshot });
  }

  private async createSocialHandoffCode(provider: Provider, payload: AuthSessionPayload) {
    const code = this.randomToken();
    const encrypted = this.encryptHandoffPayload(payload);
    await pool.query(
      `INSERT INTO auth.social_handoff_codes
        (code_hash, provider, encrypted_payload, iv, auth_tag, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        this.hashToken(code),
        provider,
        encrypted.encryptedPayload,
        encrypted.iv,
        encrypted.authTag,
        new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      ]
    );
    return code;
  }

  async exchangeSocialHandoffCode(code: string) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        id: number;
        encrypted_payload: string;
        iv: string;
        auth_tag: string;
        expires_at: string | Date;
        consumed_at: string | Date | null;
      }>(
        `SELECT id, encrypted_payload, iv, auth_tag, expires_at, consumed_at
         FROM auth.social_handoff_codes
         WHERE code_hash = $1
         FOR UPDATE`,
        [this.hashToken(code)]
      );
      const row = result.rows[0];
      if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) {
        await client.query("ROLLBACK");
        return { error: "INVALID_SOCIAL_HANDOFF_CODE" as const };
      }

      await client.query(
        `UPDATE auth.social_handoff_codes
         SET consumed_at = NOW()
         WHERE id = $1`,
        [row.id]
      );
      await client.query("COMMIT");
      return this.decryptHandoffPayload(row);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async authenticate(
    authorizationHeader: string | undefined,
    options?: {
      requestId?: string;
      source?: string;
    }
  ) {
    const header = authorizationHeader || "";
    if (!header.startsWith("Bearer ")) {
      this.logAuthEvent("warn", "lookup_failure", {
        requestId: options?.requestId || null,
        source: options?.source || null,
        reason: "missing_authorization_header",
      });
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    const accessToken = header.slice("Bearer ".length).trim();
    const session = await this.findSessionRecordByAccessToken(accessToken);
    if (!session) {
      this.logAuthEvent("warn", "lookup_failure", {
        requestId: options?.requestId || null,
        source: options?.source || null,
        reason: "session_not_found",
        accessTokenHashPrefix: this.hashPrefix(accessToken),
      });
      throw new UnauthorizedException("INVALID_SESSION");
    }
    if (session.revoked_at) {
      const snapshot = await this.getAuthUserSessionSnapshot(session.user_id, session.id);
      this.logAuthEvent("warn", "lookup_failure", {
        requestId: options?.requestId || null,
        source: options?.source || null,
        reason: "session_revoked",
        accessTokenHashPrefix: this.hashPrefix(accessToken),
        sessionId: session.id,
        snapshot,
      });
      throw new UnauthorizedException("INVALID_SESSION");
    }
    if (new Date(session.access_expires_at).getTime() < Date.now()) {
      const snapshot = await this.getAuthUserSessionSnapshot(session.user_id, session.id);
      this.logAuthEvent("warn", "lookup_failure", {
        requestId: options?.requestId || null,
        source: options?.source || null,
        reason: "session_expired",
        accessTokenHashPrefix: this.hashPrefix(accessToken),
        sessionId: session.id,
        snapshot,
      });
      throw new UnauthorizedException("INVALID_SESSION");
    }
    const user = await this.findUserById(session.user_id);
    if (!user) {
      const snapshot = await this.getAuthUserSessionSnapshot(session.user_id, session.id);
      this.logAuthEvent("warn", "lookup_failure", {
        requestId: options?.requestId || null,
        source: options?.source || null,
        reason: "user_not_found",
        accessTokenHashPrefix: this.hashPrefix(accessToken),
        sessionId: session.id,
        snapshot,
      });
      throw new UnauthorizedException("INVALID_SESSION");
    }
    await this.touchSessionLastUsed(session.id);
    return {
      accessToken,
      user,
      session,
    };
  }

  async sendVerificationEmail(email: string, url: string) {
    await this.emailService.sendVerificationEmail({
      recipientEmail: email,
      verificationLink: url,
      locale: "es",
    });
    return true;
  }

  private buildFrontendUrl(pathname: string) {
    return new URL(pathname, `${runtimeConfig.frontendBaseUrl.replace(/\/+$/, "")}/`);
  }

  private resolveSafeAuthRedirectUri(redirectUri: string | null | undefined) {
    const fallback = runtimeConfig.frontendRedirectUri;
    const candidate = String(redirectUri || fallback).trim();

    try {
      const parsed = new URL(candidate);
      const fallbackUrl = new URL(fallback);
      if (parsed.protocol === fallbackUrl.protocol) {
        return parsed.toString();
      }

      const frontendBaseUrl = new URL(runtimeConfig.frontendBaseUrl);
      if (parsed.origin === frontendBaseUrl.origin) {
        return parsed.toString();
      }
    } catch {
      return fallback;
    }

    return fallback;
  }

  buildLoginUrl() {
    return this.buildFrontendUrl("/login").toString();
  }

  buildVerifyEmailUrl(token: string) {
    const target = this.buildFrontendUrl("/verify-email-result");
    target.searchParams.set("token", token);
    return target.toString();
  }

  buildPasswordResetUrl(token: string) {
    const target = new URL(
      runtimeConfig.passwordResetUrlBase ||
        this.buildFrontendUrl("/reset-password").toString()
    );
    target.searchParams.set("token", token);
    return target.toString();
  }

  private buildLegacyVerifyEmailConfirmUrl(token: string) {
    return `${runtimeConfig.baseUrl}/api/auth/verify-email/confirm?token=${encodeURIComponent(
      token
    )}`;
  }

  async sendPasswordResetEmail(email: string, url: string, recipientName?: string) {
    await this.emailService.sendPasswordResetEmail({
      recipientEmail: email,
      recipientName,
      resetLink: url,
      locale: "es",
    });
  }

  async ensureDefaultAccount(input: { email: string; password: string }) {
    const email = this.normalizeEmail(input.email);
    if (!email || input.password.length < 8) {
      throw new Error("INVALID_DEFAULT_ACCOUNT_SEED");
    }

    const existing = await this.findUserByEmail(email);
    if (existing) {
      return;
    }
    const passwordHash = await this.hashPassword(input.password);
    const user = await this.createEmailUser({
      name: "Development User",
      email,
      passwordHash,
      dateOfBirth: "2000-01-01",
      hasCompletedOnboarding: true,
    });
    await this.verifyUserEmail(user!.id);
    this.logger.log("[api-server] seeded configured development account");
  }

  providerAvailability() {
    return {
      google: isProviderConfigured("google"),
      facebook: isProviderConfigured("facebook"),
      apple: isProviderConfigured("apple"),
    };
  }

  providerUnavailable(provider: string, redirectUri: string) {
    const target = new URL(this.resolveSafeAuthRedirectUri(redirectUri));
    target.searchParams.set("status", "error");
    target.searchParams.set("provider", provider);
    target.searchParams.set("code", "PROVIDER_UNAVAILABLE");
    target.searchParams.set("message", "Provider is not configured");
    return target.toString();
  }

  async exchangeGoogleCode(code: string) {
    const redirectUri = getProviderRedirectUri("google");
    const params = new URLSearchParams({
      code,
      client_id: runtimeConfig.providers.google.clientId,
      client_secret: runtimeConfig.providers.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!tokenResponse.ok) {
      throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
    }
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token || ""}` },
      }
    );
    if (!profileResponse.ok) {
      throw new Error("GOOGLE_PROFILE_FETCH_FAILED");
    }
    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string | null;
      name?: string;
    };
    if (!profile.sub) {
      throw new Error("GOOGLE_PROFILE_FETCH_FAILED");
    }
    return {
      provider: "google" as const,
      providerUserId: profile.sub,
      email: profile.email || null,
      name: profile.name || "",
    };
  }

  async exchangeFacebookCode(code: string) {
    const redirectUri = getProviderRedirectUri("facebook");
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", runtimeConfig.providers.facebook.clientId);
    tokenUrl.searchParams.set(
      "client_secret",
      runtimeConfig.providers.facebook.clientSecret
    );
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok) {
      throw new Error("FACEBOOK_TOKEN_EXCHANGE_FAILED");
    }
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    const profileUrl = new URL("https://graph.facebook.com/me");
    profileUrl.searchParams.set("fields", "id,name,email");
    profileUrl.searchParams.set("access_token", tokenData.access_token || "");
    const profileResponse = await fetch(profileUrl);
    if (!profileResponse.ok) {
      throw new Error("FACEBOOK_PROFILE_FETCH_FAILED");
    }
    const profile = (await profileResponse.json()) as {
      id?: string;
      email?: string | null;
      name?: string;
    };
    if (!profile.id) {
      throw new Error("FACEBOOK_PROFILE_FETCH_FAILED");
    }
    return {
      provider: "facebook" as const,
      providerUserId: profile.id,
      email: profile.email || null,
      name: profile.name || "",
    };
  }

  createAppleClientSecret() {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = this.encodeJsonBase64url({
      alg: "ES256",
      kid: runtimeConfig.providers.apple.keyId,
    });
    const payload = this.encodeJsonBase64url({
      iss: runtimeConfig.providers.apple.teamId,
      iat: issuedAt,
      exp: issuedAt + 60 * 60,
      aud: "https://appleid.apple.com",
      sub: runtimeConfig.providers.apple.serviceId,
    });
    const unsigned = `${header}.${payload}`;
    const signature = crypto
      .sign("sha256", Buffer.from(unsigned), runtimeConfig.providers.apple.privateKey)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    return `${unsigned}.${signature}`;
  }

  decodeJwtPayload(token: string) {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    try {
      const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }

  async exchangeAppleCode(code: string) {
    const params = new URLSearchParams({
      client_id: runtimeConfig.providers.apple.serviceId,
      client_secret: this.createAppleClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: getProviderRedirectUri("apple"),
    });
    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!tokenResponse.ok) {
      throw new Error("APPLE_TOKEN_EXCHANGE_FAILED");
    }
    const tokenData = (await tokenResponse.json()) as { id_token?: string };
    const claims = this.decodeJwtPayload(tokenData.id_token || "");
    if (!claims?.sub) {
      throw new Error("APPLE_PROFILE_FETCH_FAILED");
    }
    return {
      provider: "apple" as const,
      providerUserId: claims.sub,
      email: claims.email || null,
      name: "",
    };
  }

  async fetchSocialProfile(provider: Provider, code: string) {
    if (provider === "google") return this.exchangeGoogleCode(code);
    if (provider === "facebook") return this.exchangeFacebookCode(code);
    return this.exchangeAppleCode(code);
  }

  buildProviderAuthUrl(provider: Provider, state: string) {
    if (provider === "google") {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", runtimeConfig.providers.google.clientId);
      url.searchParams.set("redirect_uri", getProviderRedirectUri(provider));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", runtimeConfig.providers.google.scopes.join(" "));
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", state);
      return url.toString();
    }

    if (provider === "facebook") {
      const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
      url.searchParams.set("client_id", runtimeConfig.providers.facebook.clientId);
      url.searchParams.set("redirect_uri", getProviderRedirectUri(provider));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", runtimeConfig.providers.facebook.scopes.join(","));
      url.searchParams.set("state", state);
      return url.toString();
    }

    const url = new URL("https://appleid.apple.com/auth/authorize");
    url.searchParams.set("client_id", runtimeConfig.providers.apple.serviceId);
    url.searchParams.set("redirect_uri", getProviderRedirectUri(provider));
    url.searchParams.set("response_type", "code id_token");
    url.searchParams.set("response_mode", "form_post");
    url.searchParams.set("scope", runtimeConfig.providers.apple.scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  buildSocialState(provider: Provider, redirectUri: string, mode: string) {
    return this.signState({
      provider,
      redirectUri: this.resolveSafeAuthRedirectUri(redirectUri),
      mode,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  }

  async signUp(input: {
    name: string;
    email: string;
    password: string;
    dateOfBirth: string;
  }) {
    const existing = await this.findUserByEmail(input.email);
    if (existing) {
      return { error: "EMAIL_ALREADY_IN_USE" };
    }

    const dobStatus = this.validateDob(input.dateOfBirth);
    if (!dobStatus.valid) {
      return { error: dobStatus.code };
    }

    const passwordHash = await this.hashPassword(input.password);
    const user = await this.createEmailUser({
      ...input,
      passwordHash,
    });

    const rawToken = this.randomToken();
    const verificationUrl = this.buildVerifyEmailUrl(rawToken);
    const verificationCompatibilityUrl = this.buildLegacyVerifyEmailConfirmUrl(rawToken);
    await this.createVerificationToken(
      user!.id,
      rawToken,
      new Date(Date.now() + verificationTtlMs).toISOString()
    );
    try {
      await this.sendVerificationEmail(user!.email!, verificationUrl);
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        return { error: "EMAIL_DELIVERY_FAILED" as const };
      }
      throw error;
    }

    const payload: {
      status: "verification_pending";
      email: string;
      message: string;
      verificationPreviewUrl?: string;
    } = {
      status: "verification_pending",
      email: user!.email!,
      message: "Verification email sent",
    };

    if (
      runtimeConfig.nodeEnv !== "production" &&
      (!runtimeConfig.email.enabled || runtimeConfig.email.logOnly)
    ) {
      payload.verificationPreviewUrl = verificationCompatibilityUrl;
    }

    return payload;
  }

  async resendVerificationEmail(input: { email: string; ipAddress: string }) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const user = await this.findUserByEmail(normalizedEmail);
    const limited = await this.isEmailActionRateLimited({
      actionType: "verify_resend",
      ipAddress: input.ipAddress,
      email: normalizedEmail,
      userId: user?.id ?? null,
    });

    await this.recordEmailActionAttempt({
      actionType: "verify_resend",
      ipAddress: input.ipAddress,
      email: normalizedEmail,
      userId: user?.id ?? null,
    });

    if (!user || user.emailVerified || limited) {
      return this.genericEmailActionResponse(
        "Si la cuenta existe y todavía necesita verificación, enviaremos un nuevo correo."
      );
    }

    const rawToken = this.randomToken();
    await this.invalidatePendingVerificationTokens(user.id);
    await this.createVerificationToken(
      user.id,
      rawToken,
      new Date(Date.now() + verificationTtlMs).toISOString()
    );

    try {
      await this.sendVerificationEmail(user.email!, this.buildVerifyEmailUrl(rawToken));
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        return this.genericEmailActionResponse(
          "Si la cuenta existe y todavía necesita verificación, enviaremos un nuevo correo."
        );
      }
      throw error;
    }

    return this.genericEmailActionResponse(
      "Si la cuenta existe y todavía necesita verificación, enviaremos un nuevo correo."
    );
  }

  async getVerificationStatus(input: { email: string }) {
    const user = await this.findUserByEmail(this.normalizeEmail(input.email));
    return {
      status: user?.emailVerified ? ("verified" as const) : ("pending" as const),
    };
  }

  async requestPasswordReset(input: { email: string; ipAddress: string }) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const user = await this.findUserByEmail(normalizedEmail);
    const limited = await this.isEmailActionRateLimited({
      actionType: "password_reset_request",
      ipAddress: input.ipAddress,
      email: normalizedEmail,
      userId: user?.id ?? null,
    });

    await this.recordEmailActionAttempt({
      actionType: "password_reset_request",
      ipAddress: input.ipAddress,
      email: normalizedEmail,
      userId: user?.id ?? null,
    });

    if (!user || limited) {
      return this.genericEmailActionResponse(
        "Si el correo existe en MatchA, enviaremos un enlace para restablecer la contraseña."
      );
    }

    const rawToken = this.randomToken();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await this.createPasswordResetToken(
        user.id,
        rawToken,
        new Date(Date.now() + passwordResetTtlMs).toISOString(),
        client
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    try {
      await this.sendPasswordResetEmail(
        user.email!,
        this.buildPasswordResetUrl(rawToken),
        user.name || undefined
      );
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        console.error("[api-server] password reset email failed", error.code);
        return this.genericEmailActionResponse(
          "Si el correo existe en MatchA, enviaremos un enlace para restablecer la contraseña."
        );
      }
      throw error;
    }

    return this.genericEmailActionResponse(
      "Si el correo existe en MatchA, enviaremos un enlace para restablecer la contraseña."
    );
  }

  async validatePasswordResetToken(token: string) {
    const existing = await this.queryOne<{
      id: number;
      expires_at: string | Date;
      used_at: string | Date | null;
      superseded_at: string | Date | null;
    }>(
      `SELECT *
       FROM auth.password_reset_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [this.hashToken(token)]
    );

    if (!existing) {
      return { error: "INVALID_PASSWORD_RESET_TOKEN" as const };
    }
    if (existing.used_at) {
      return { error: "USED_PASSWORD_RESET_TOKEN" as const };
    }
    if (existing.superseded_at) {
      return { error: "SUPERSEDED_PASSWORD_RESET_TOKEN" as const };
    }
    if (new Date(existing.expires_at).getTime() < Date.now()) {
      return { error: "EXPIRED_PASSWORD_RESET_TOKEN" as const };
    }

    return {
      status: "valid" as const,
    };
  }

  async confirmPasswordReset(input: { token: string; password: string }) {
    const consumed = await this.consumePasswordResetToken(input.token);
    if ("error" in consumed) {
      return consumed;
    }

    const passwordHash = await this.hashPassword(input.password);
    await pool.query(
      `UPDATE auth.users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, consumed.userId]
    );
    await this.revokeAllSessionsForUser(consumed.userId);

    return {
      status: "password_reset_complete" as const,
    };
  }

  async signIn(
    input: { email: string; password: string },
    options?: { requestId?: string }
  ) {
    const user = await this.findUserByEmail(input.email);
    if (!user || !user.passwordHash) {
      this.logAuthEvent("warn", "sign_in_failed", {
        requestId: options?.requestId || null,
        email: this.maskEmail(input.email),
        reason: "INVALID_CREDENTIALS",
      });
      return { error: "INVALID_CREDENTIALS" };
    }
    const validPassword = await this.verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      this.logAuthEvent("warn", "sign_in_failed", {
        requestId: options?.requestId || null,
        email: this.maskEmail(input.email),
        userId: user.id,
        reason: "INVALID_CREDENTIALS",
      });
      return { error: "INVALID_CREDENTIALS" };
    }
    if (!user.emailVerified) {
      this.logAuthEvent("warn", "sign_in_failed", {
        requestId: options?.requestId || null,
        email: this.maskEmail(input.email),
        userId: user.id,
        reason: "EMAIL_VERIFICATION_REQUIRED",
      });
      return { error: "EMAIL_VERIFICATION_REQUIRED" };
    }
    return this.createSessionResponse(user, {
      requestId: options?.requestId,
      event: "sign_in_succeeded",
    });
  }

  async refresh(refreshToken: string, options?: { requestId?: string }) {
    const rotated = await this.rotateSession(refreshToken);
    if (!rotated) {
      this.logAuthEvent("warn", "refresh_failed", {
        requestId: options?.requestId || null,
        refreshTokenHashPrefix: this.hashPrefix(refreshToken),
        reason: "INVALID_REFRESH_TOKEN",
      });
      return { error: "INVALID_REFRESH_TOKEN" };
    }
    this.logAuthEvent("log", "refresh_succeeded", {
      requestId: options?.requestId || null,
      userId: rotated.user.id,
      email: this.maskEmail(rotated.user.email),
      sessionId: rotated.sessionId,
      accessTokenHashPrefix: this.hashPrefix(rotated.accessToken),
      refreshTokenHashPrefix: this.hashPrefix(refreshToken),
      accessExpiresAt: rotated.accessExpiresAt,
      refreshExpiresAt: rotated.refreshExpiresAt,
    });
    const snapshot = await this.getAuthUserSessionSnapshot(
      rotated.user.id,
      rotated.sessionId
    );
    return this.authPayload(rotated.user, rotated.accessToken, rotated.refreshToken, {
      snapshot,
    });
  }

  async verifyEmailToken(token: string) {
    const result = await this.consumeVerificationToken(token);
    if (!result) {
      return { error: "INVALID_VERIFICATION_TOKEN" };
    }
    if ("alreadyVerified" in result) {
      return {
        status: "already_verified" as const,
        user: this.sanitizeUser(result.user || null),
      };
    }
    if ("replaced" in result) {
      return { error: "VERIFICATION_LINK_REPLACED" as const };
    }
    if (result.expired) {
      return { error: "EXPIRED_VERIFICATION_TOKEN" };
    }
    return {
      status: "verified" as const,
      user: this.sanitizeUser(result.user || null),
    };
  }

  async getVerificationConfirmRedirect(token: string) {
    if (!token) {
      this.logVerificationRedirectOutcome("invalid");
      return this.buildFrontendUrl("/verify-email-result").toString();
    }

    return this.buildVerifyEmailUrl(token);
  }

  async getMe(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader, {
      source: "get_me",
    });
    const canonicalUser = (await this.ensureCanonicalOnboardingState(auth.user)) || auth.user;
    const snapshot = await this.getAuthUserSessionSnapshot(auth.user.id, auth.session.id);
    const onboardingState = this.resolveCanonicalOnboardingStateFromSnapshot(
      canonicalUser,
      snapshot
    );
    return {
      user: this.sanitizeUser(canonicalUser),
      needsProfileCompletion: !canonicalUser?.name || !canonicalUser?.dateOfBirth,
      onboardingState,
      hasCompletedOnboarding: onboardingState === "complete",
    };
  }

  async updateMe(
    authorizationHeader: string | undefined,
    updates: { name?: string; dateOfBirth?: string; profession?: string }
  ) {
    const auth = await this.authenticate(authorizationHeader, {
      source: "update_me",
    });
    if (updates.dateOfBirth) {
      const dobStatus = this.validateDob(updates.dateOfBirth);
      if (!dobStatus.valid) {
        return { error: dobStatus.code };
      }
    }
    const updatedUser = await this.updateUserProfile(auth.user.id, updates);
    await this.invalidateUserStateCaches(auth.user.id);
    const user = (await this.ensureCanonicalOnboardingState(updatedUser)) || updatedUser;
    const snapshot = await this.getAuthUserSessionSnapshot(auth.user.id, auth.session.id);
    const onboardingState = this.resolveCanonicalOnboardingStateFromSnapshot(
      user,
      snapshot
    );
    return {
      user: this.sanitizeUser(user),
      needsProfileCompletion: !user?.name || !user?.dateOfBirth,
      onboardingState,
      hasCompletedOnboarding: onboardingState === "complete",
    };
  }

  async completeOnboarding(
    authorizationHeader: string | undefined,
    options?: { requestId?: string }
  ) {
    const auth = await this.authenticate(authorizationHeader, {
      requestId: options?.requestId,
      source: "complete_onboarding",
    });
    const beforeSnapshot = await this.getAuthUserSessionSnapshot(auth.user.id, auth.session.id);
    const user = await this.completeUserOnboarding(auth.user.id);
    await this.invalidateUserStateCaches(auth.user.id);
    const afterSnapshot = await this.getAuthUserSessionSnapshot(auth.user.id, auth.session.id);
    this.logAuthEvent("log", "onboarding_complete", {
      requestId: options?.requestId || null,
      userId: auth.user.id,
      email: this.maskEmail(auth.user.email),
      sessionId: auth.session.id,
      accessTokenHashPrefix: this.hashPrefix(auth.accessToken),
      beforeSnapshot,
      afterSnapshot,
    });
    return {
      status: "ok" as const,
      onboardingState: "complete" as const,
      hasCompletedOnboarding: this.resolveHasCompletedOnboarding(user),
    };
  }

  async getSettings(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader, {
      source: "get_settings",
    });
    const settings = await this.findUserSettings(auth.user.id);
    return {
      settings: this.sanitizeSettings(settings),
    };
  }

  async updateSettings(
    authorizationHeader: string | undefined,
    updates: {
      language?: string;
      heightUnit?: string;
      genderIdentity?: string;
      pronouns?: string;
      personality?: string;
    }
  ) {
    const auth = await this.authenticate(authorizationHeader, {
      source: "update_settings",
    });
    const settings = await this.upsertUserSettings(auth.user.id, updates);
    await this.invalidateUserStateCaches(auth.user.id);
    return {
      settings: this.sanitizeSettings(settings),
    };
  }

  async signOut(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader, {
      source: "sign_out",
    });
    await this.revokeSessionByAccessToken(auth.accessToken);
  }

  async deleteAccount(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader, {
      source: "delete_account",
    });
    const mediaAssets = await pool.query<{ storage_key: string | null }>(
      `SELECT DISTINCT ma.storage_key
       FROM media.media_assets ma
       JOIN core.profiles p ON p.id = ma.owner_profile_id
       WHERE p.user_id = $1
         AND ma.storage_key IS NOT NULL`,
      [auth.user.id]
    );

    await pool.query(`DELETE FROM auth.users WHERE id = $1`, [auth.user.id]);

    await Promise.all(
      mediaAssets.rows
        .map((row) => row.storage_key)
        .filter((storageKey): storageKey is string => Boolean(storageKey))
        .map((storageKey) =>
          rm(this.buildMediaAbsolutePath(storageKey), { force: true }).catch(() => {})
        )
    );

    return { status: "deleted" as const };
  }

  startSocialAuth(provider: Provider, redirectUri: string, mode: string) {
    if (!isProviderConfigured(provider)) {
      return this.providerUnavailable(provider, redirectUri);
    }

    const state = this.buildSocialState(provider, redirectUri, mode);
    return this.buildProviderAuthUrl(provider, state);
  }

  async handleSocialCallback(input: {
    provider: Provider;
    state: string;
    code?: string | null;
    error?: string | null;
    errorDescription?: string | null;
    redirectUri?: string | null;
  }) {
    const redirectUriFromState = this.resolveSafeAuthRedirectUri(input.redirectUri);
    const state = this.verifyState(input.state);
    const redirectUri = this.resolveSafeAuthRedirectUri(
      typeof state?.redirectUri === "string" ? state.redirectUri : redirectUriFromState
    );
    const target = new URL(redirectUri);

    if (!state || state.provider !== input.provider) {
      target.searchParams.set("status", "error");
      target.searchParams.set("code", "INVALID_STATE");
      return target.toString();
    }

    if (input.error) {
      target.searchParams.set("status", "error");
      target.searchParams.set("provider", input.provider);
      target.searchParams.set("code", input.error);
      target.searchParams.set("message", input.errorDescription || input.error);
      return target.toString();
    }

    try {
      const socialProfile = await this.fetchSocialProfile(
        input.provider,
        String(input.code || "")
      );
      const { user } = await this.upsertSocialIdentity(socialProfile);
      const payload = await this.createSessionResponse(user);
      const handoffCode = await this.createSocialHandoffCode(input.provider, payload);
      target.searchParams.set("status", "success");
      target.searchParams.set("provider", input.provider);
      target.searchParams.set("handoffCode", handoffCode);
      target.searchParams.set(
        "needsProfileCompletion",
        payload.needsProfileCompletion ? "true" : "false"
      );
      return target.toString();
    } catch (error) {
      console.error(error);
      target.searchParams.set("status", "error");
      target.searchParams.set("provider", input.provider);
      target.searchParams.set(
        "code",
        error instanceof Error ? error.message : "SOCIAL_AUTH_FAILED"
      );
      return target.toString();
    }
  }
}
