import crypto from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { pool } from "@workspace/db";
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
  created_at: string | Date;
};

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
const ONBOARDING_ROLLOUT_AT = new Date(runtimeConfig.onboardingRolloutAt).getTime();
const PER_IP_MINUTE_LIMIT = 5;
const PER_IP_HOUR_LIMIT = 20;
const PER_TARGET_QUARTER_HOUR_LIMIT = 3;
const PER_TARGET_DAY_LIMIT = 10;
type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(GoalsService) private readonly goalsService: GoalsService,
    @Inject(EmailService) private readonly emailService: EmailService
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

  private randomToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  private hashToken(value: string) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private hashLookupValue(value: string) {
    return crypto.createHash("sha256").update(String(value || "")).digest("hex");
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
    if (user?.onboardingStatus === "completed" || user?.onboardingStatus === "exempt") {
      return true;
    }
    const createdAtMs = user?.createdAt ? new Date(user.createdAt).getTime() : NaN;
    if (Number.isFinite(createdAtMs) && createdAtMs < ONBOARDING_ROLLOUT_AT) {
      return true;
    }
    return false;
  }

  authPayload(
    user: ReturnType<AuthService["mapUser"]>,
    accessToken: string,
    refreshToken: string
  ) {
    const needsProfileCompletion = !user?.name || !user?.dateOfBirth;
    return {
      status: "authenticated",
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
      needsProfileCompletion,
      hasCompletedOnboarding: this.resolveHasCompletedOnboarding(user),
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
        (user_id, status, started_at, completed_at, exempted_at)
       VALUES ($1, $2, NOW(),
         CASE WHEN $2::onboarding_status = 'completed'::onboarding_status THEN NOW() ELSE NULL END,
         CASE WHEN $2::onboarding_status = 'exempt'::onboarding_status THEN NOW() ELSE NULL END)
       ON CONFLICT (user_id) DO UPDATE SET
         status = EXCLUDED.status,
         completed_at = CASE WHEN EXCLUDED.status = 'completed'::onboarding_status THEN NOW() ELSE core.user_onboarding.completed_at END,
         exempted_at = CASE WHEN EXCLUDED.status = 'exempt'::onboarding_status THEN NOW() ELSE core.user_onboarding.exempted_at END,
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
      `UPDATE core.user_onboarding
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
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
      locale: profile.language === "es" ? "es" : "en",
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
    await pool.query(
      `INSERT INTO auth.auth_sessions
        (user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, NULL)`,
      [
        userId,
        this.hashToken(accessToken),
        this.hashToken(refreshToken),
        accessExpiresAt,
        refreshExpiresAt,
      ]
    );
  }

  async findSessionByAccessToken(accessToken: string) {
    const session = await this.queryOne<SessionRow>(
      `SELECT *
       FROM auth.auth_sessions
       WHERE access_token_hash = $1 AND revoked_at IS NULL
       LIMIT 1`,
      [this.hashToken(accessToken)]
    );
    if (!session) return null;
    if (new Date(session.access_expires_at).getTime() < Date.now()) {
      return null;
    }
    const user = await this.findUserById(session.user_id);
    return user ? { session, user } : null;
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

  async createSessionResponse(user: ReturnType<AuthService["mapUser"]>) {
    const accessToken = this.randomToken();
    const refreshToken = this.randomToken();
    const accessExpiresAt = new Date(Date.now() + accessTtlMs).toISOString();
    const refreshExpiresAt = new Date(Date.now() + refreshTtlMs).toISOString();
    await this.createSession(
      user!.id,
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt
    );
    return this.authPayload(user, accessToken, refreshToken);
  }

  async authenticate(authorizationHeader: string | undefined) {
    const header = authorizationHeader || "";
    if (!header.startsWith("Bearer ")) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    const accessToken = header.slice("Bearer ".length).trim();
    const result = await this.findSessionByAccessToken(accessToken);
    if (!result) {
      throw new UnauthorizedException("INVALID_SESSION");
    }
    return {
      accessToken,
      user: result.user,
      session: result.session,
    };
  }

  async sendVerificationEmail(email: string, url: string) {
    await this.emailService.sendVerificationEmail({
      recipientEmail: email,
      verificationLink: url,
      locale: "en",
    });
    return true;
  }

  createVerificationUrl(token: string) {
    return `${runtimeConfig.baseUrl}/api/auth/verify-email/confirm?token=${encodeURIComponent(
      token
    )}`;
  }

  createPasswordResetUrl(token: string) {
    const target = new URL(
      runtimeConfig.passwordResetUrlBase || `${runtimeConfig.frontendBaseUrl}/reset-password`
    );
    target.searchParams.set("token", token);
    return target.toString();
  }

  async sendPasswordResetEmail(email: string, url: string, recipientName?: string) {
    await this.emailService.sendPasswordResetEmail({
      recipientEmail: email,
      recipientName,
      resetLink: url,
      locale: "en",
    });
  }

  async ensureDefaultAccount() {
    const existing = await this.findUserByEmail("test@gmail.com");
    if (existing) {
      return;
    }
    const passwordHash = await this.hashPassword("test");
    const user = await this.createEmailUser({
      name: "Test User",
      email: "test@gmail.com",
      passwordHash,
      dateOfBirth: "2000-01-01",
      hasCompletedOnboarding: true,
    });
    await this.verifyUserEmail(user!.id);
    console.log("[api-server] seeded default account: test@gmail.com / test");
  }

  providerAvailability() {
    return {
      google: isProviderConfigured("google"),
      facebook: isProviderConfigured("facebook"),
      apple: isProviderConfigured("apple"),
    };
  }

  providerUnavailable(provider: string, redirectUri: string) {
    const target = new URL(redirectUri || runtimeConfig.frontendRedirectUri);
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
      redirectUri,
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
    const verificationUrl = this.createVerificationUrl(rawToken);
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
      payload.verificationPreviewUrl = verificationUrl;
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
        "If the account exists and still needs verification, a new email will be sent."
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
      await this.sendVerificationEmail(user.email!, this.createVerificationUrl(rawToken));
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        return this.genericEmailActionResponse(
          "If the account exists and still needs verification, a new email will be sent."
        );
      }
      throw error;
    }

    return this.genericEmailActionResponse(
      "If the account exists and still needs verification, a new email will be sent."
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
        "If the account exists, a password reset email will be sent."
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
        this.createPasswordResetUrl(rawToken),
        user.name || undefined
      );
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        console.error("[api-server] password reset email failed", error.code);
        return this.genericEmailActionResponse(
          "If the account exists, a password reset email will be sent."
        );
      }
      throw error;
    }

    return this.genericEmailActionResponse(
      "If the account exists, a password reset email will be sent."
    );
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

    return {
      status: "password_reset_complete" as const,
    };
  }

  async signIn(input: { email: string; password: string }) {
    const user = await this.findUserByEmail(input.email);
    if (!user || !user.passwordHash) {
      return { error: "INVALID_CREDENTIALS" };
    }
    const validPassword = await this.verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      return { error: "INVALID_CREDENTIALS" };
    }
    if (!user.emailVerified) {
      return { error: "EMAIL_VERIFICATION_REQUIRED" };
    }
    return this.createSessionResponse(user);
  }

  async refresh(refreshToken: string) {
    const rotated = await this.rotateSession(refreshToken);
    if (!rotated) {
      return { error: "INVALID_REFRESH_TOKEN" };
    }
    return this.authPayload(rotated.user, rotated.accessToken, rotated.refreshToken);
  }

  async verifyEmailToken(token: string) {
    const result = await this.consumeVerificationToken(token);
    if (!result) {
      return { error: "INVALID_VERIFICATION_TOKEN" };
    }
    if ("alreadyVerified" in result) {
      return {
        status: "verified" as const,
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
    const target = new URL(runtimeConfig.frontendRedirectUri);
    if (!token) {
      this.logVerificationRedirectOutcome("invalid");
      target.searchParams.set("status", "error");
      target.searchParams.set("code", "INVALID_VERIFICATION_TOKEN");
      return target.toString();
    }

    const result = await this.consumeVerificationToken(token);
    if (!result) {
      this.logVerificationRedirectOutcome("invalid");
      target.searchParams.set("status", "error");
      target.searchParams.set("code", "INVALID_VERIFICATION_TOKEN");
      return target.toString();
    }

    if ("alreadyVerified" in result) {
      this.logVerificationRedirectOutcome("already_verified", result.user?.email);
      target.searchParams.set("status", "already_verified");
      target.searchParams.set("provider", "email");
      target.searchParams.set("email", result.user?.email || "");
      return target.toString();
    }

    if ("replaced" in result) {
      this.logVerificationRedirectOutcome("replaced", result.user?.email);
      target.searchParams.set("status", "error");
      target.searchParams.set("code", "VERIFICATION_LINK_REPLACED");
      target.searchParams.set("email", result.user?.email || "");
      return target.toString();
    }

    if (result.expired) {
      this.logVerificationRedirectOutcome("expired");
      target.searchParams.set("status", "error");
      target.searchParams.set("code", "EXPIRED_VERIFICATION_TOKEN");
      return target.toString();
    }

    const payload = await this.createSessionResponse(result.user);
    this.logVerificationRedirectOutcome("success", result.user?.email);
    target.searchParams.set("status", "success");
    target.searchParams.set("provider", "email");
    target.searchParams.set("accessToken", payload.accessToken);
    target.searchParams.set("refreshToken", payload.refreshToken);
    target.searchParams.set(
      "needsProfileCompletion",
      payload.needsProfileCompletion ? "true" : "false"
    );
    target.searchParams.set("email", result.user?.email || "");
    return target.toString();
  }

  async getMe(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader);
    return {
      user: this.sanitizeUser(auth.user),
      needsProfileCompletion: !auth.user?.name || !auth.user?.dateOfBirth,
      hasCompletedOnboarding: this.resolveHasCompletedOnboarding(auth.user),
    };
  }

  async updateMe(
    authorizationHeader: string | undefined,
    updates: { name?: string; dateOfBirth?: string; profession?: string }
  ) {
    const auth = await this.authenticate(authorizationHeader);
    if (updates.dateOfBirth) {
      const dobStatus = this.validateDob(updates.dateOfBirth);
      if (!dobStatus.valid) {
        return { error: dobStatus.code };
      }
    }
    const user = await this.updateUserProfile(auth.user.id, updates);
    return {
      user: this.sanitizeUser(user),
      needsProfileCompletion: !user?.name || !user?.dateOfBirth,
      hasCompletedOnboarding: this.resolveHasCompletedOnboarding(user),
    };
  }

  async completeOnboarding(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader);
    const user = await this.completeUserOnboarding(auth.user.id);
    return {
      status: "ok" as const,
      hasCompletedOnboarding: this.resolveHasCompletedOnboarding(user),
    };
  }

  async getSettings(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader);
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
    const auth = await this.authenticate(authorizationHeader);
    const settings = await this.upsertUserSettings(auth.user.id, updates);
    return {
      settings: this.sanitizeSettings(settings),
    };
  }

  async signOut(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader);
    await this.revokeSessionByAccessToken(auth.accessToken);
  }

  async deleteAccount(authorizationHeader: string | undefined) {
    const auth = await this.authenticate(authorizationHeader);
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
    const redirectUriFromState = input.redirectUri || runtimeConfig.frontendRedirectUri;
    const state = this.verifyState(input.state);
    const redirectUri =
      typeof state?.redirectUri === "string" ? state.redirectUri : redirectUriFromState;
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
      target.searchParams.set("status", "success");
      target.searchParams.set("provider", input.provider);
      target.searchParams.set("accessToken", payload.accessToken);
      target.searchParams.set("refreshToken", payload.refreshToken);
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
