import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

import { config } from "./config.js";

function nowIso() {
  return new Date().toISOString();
}

function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function ensureDir(fileUrlOrPath) {
  const filepath =
    fileUrlOrPath instanceof URL ? fileUrlOrPath.pathname : fileUrlOrPath;
  await fs.mkdir(path.dirname(filepath), { recursive: true });
}

class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
  }

  async init() {
    await ensureDir(this.filePath);
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.data = JSON.parse(raw);
    } catch {
      this.data = {
        counters: { user: 1, identity: 1, verification: 1, session: 1 },
        users: [],
        userSettings: [],
        identities: [],
        verificationTokens: [],
        sessions: [],
      };
      await this.save();
    }
    this.data.userSettings = Array.isArray(this.data.userSettings)
      ? this.data.userSettings
      : [];
  }

  async save() {
    const target =
      this.filePath instanceof URL ? this.filePath.pathname : this.filePath;
    await fs.writeFile(target, JSON.stringify(this.data, null, 2), "utf8");
  }

  nextId(type) {
    const current = this.data.counters[type];
    this.data.counters[type] += 1;
    return current;
  }

  async findUserByEmail(email) {
    const normalized = normalizeEmail(email);
    return this.data.users.find((user) => user.email === normalized) || null;
  }

  async findUserById(id) {
    return this.data.users.find((user) => user.id === Number(id)) || null;
  }

  async createEmailUser(input) {
    const user = {
      id: this.nextId("user"),
      email: normalizeEmail(input.email),
      name: input.name,
      passwordHash: input.passwordHash,
      dateOfBirth: input.dateOfBirth,
      profession: input.profession || "",
      emailVerified: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.data.users.push(user);
    await this.save();
    return user;
  }

  async updateUserProfile(userId, updates) {
    const user = await this.findUserById(userId);
    if (!user) return null;
    if (typeof updates.name === "string") user.name = updates.name;
    if (typeof updates.dateOfBirth === "string") user.dateOfBirth = updates.dateOfBirth;
    if (typeof updates.profession === "string") user.profession = updates.profession;
    user.updatedAt = nowIso();
    await this.save();
    return user;
  }

  async findUserSettings(userId) {
    return (
      this.data.userSettings.find((item) => item.userId === Number(userId)) || null
    );
  }

  async upsertUserSettings(userId, updates) {
    let settings = await this.findUserSettings(userId);
    if (!settings) {
      settings = {
        userId: Number(userId),
        language: "es",
        heightUnit: "metric",
        genderIdentity: "",
        pronouns: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.data.userSettings.push(settings);
    }

    if (typeof updates.language === "string") settings.language = updates.language;
    if (typeof updates.heightUnit === "string") settings.heightUnit = updates.heightUnit;
    if (typeof updates.genderIdentity === "string") settings.genderIdentity = updates.genderIdentity;
    if (typeof updates.pronouns === "string") settings.pronouns = updates.pronouns;
    settings.updatedAt = nowIso();
    await this.save();
    return settings;
  }

  async verifyUserEmail(userId) {
    const user = await this.findUserById(userId);
    if (!user) return null;
    user.emailVerified = true;
    user.updatedAt = nowIso();
    await this.save();
    return user;
  }

  async createVerificationToken(userId, rawToken, expiresAt) {
    const token = {
      id: this.nextId("verification"),
      userId: Number(userId),
      tokenHash: hashToken(rawToken),
      expiresAt,
      usedAt: null,
      createdAt: nowIso(),
    };
    this.data.verificationTokens.push(token);
    await this.save();
    return token;
  }

  async consumeVerificationToken(rawToken) {
    const tokenHash = hashToken(rawToken);
    const record = this.data.verificationTokens.find(
      (item) => item.tokenHash === tokenHash && !item.usedAt
    );
    if (!record) return null;
    if (new Date(record.expiresAt).getTime() < Date.now()) return { expired: true };
    record.usedAt = nowIso();
    await this.save();
    const user = await this.verifyUserEmail(record.userId);
    return { expired: false, user };
  }

  async findIdentity(provider, providerUserId) {
    return (
      this.data.identities.find(
        (item) =>
          item.provider === provider && item.providerUserId === String(providerUserId)
      ) || null
    );
  }

  async upsertSocialIdentity({
    provider,
    providerUserId,
    email,
    name,
  }) {
    const existingIdentity = await this.findIdentity(provider, providerUserId);
    if (existingIdentity) {
      const user = await this.findUserById(existingIdentity.userId);
      return { user, created: false };
    }

    const normalizedEmail = email ? normalizeEmail(email) : null;
    let user = normalizedEmail ? await this.findUserByEmail(normalizedEmail) : null;
    if (!user) {
      user = {
        id: this.nextId("user"),
        email: normalizedEmail,
        name: name || "",
        passwordHash: null,
        dateOfBirth: null,
        profession: "",
        emailVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.data.users.push(user);
    } else if (!user.emailVerified) {
      user.emailVerified = true;
      user.updatedAt = nowIso();
    }

    this.data.identities.push({
      id: this.nextId("identity"),
      userId: user.id,
      provider,
      providerUserId: String(providerUserId),
      email: normalizedEmail,
      createdAt: nowIso(),
    });

    await this.save();
    return { user, created: true };
  }

  async createSession(userId, accessToken, refreshToken, accessExpiresAt, refreshExpiresAt) {
    const session = {
      id: this.nextId("session"),
      userId: Number(userId),
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      accessExpiresAt,
      refreshExpiresAt,
      revokedAt: null,
      createdAt: nowIso(),
    };
    this.data.sessions.push(session);
    await this.save();
    return session;
  }

  async findSessionByAccessToken(accessToken) {
    const tokenHash = hashToken(accessToken);
    const session = this.data.sessions.find(
      (item) => item.accessTokenHash === tokenHash && !item.revokedAt
    );
    if (!session) return null;
    if (new Date(session.accessExpiresAt).getTime() < Date.now()) return null;
    const user = await this.findUserById(session.userId);
    return user ? { session, user } : null;
  }

  async rotateSession(refreshToken, nextAccessToken, nextRefreshToken, nextAccessExpiresAt, nextRefreshExpiresAt) {
    const tokenHash = hashToken(refreshToken);
    const session = this.data.sessions.find(
      (item) => item.refreshTokenHash === tokenHash && !item.revokedAt
    );
    if (!session) return null;
    if (new Date(session.refreshExpiresAt).getTime() < Date.now()) return null;
    session.accessTokenHash = hashToken(nextAccessToken);
    session.refreshTokenHash = hashToken(nextRefreshToken);
    session.accessExpiresAt = nextAccessExpiresAt;
    session.refreshExpiresAt = nextRefreshExpiresAt;
    await this.save();
    const user = await this.findUserById(session.userId);
    return user ? { session, user } : null;
  }

  async revokeSessionByAccessToken(accessToken) {
    const tokenHash = hashToken(accessToken);
    const session = this.data.sessions.find(
      (item) => item.accessTokenHash === tokenHash && !item.revokedAt
    );
    if (!session) return;
    session.revokedAt = nowIso();
    await this.save();
  }
}

class MysqlStore {
  constructor(connection) {
    this.connection = connection;
  }

  async init() {
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NULL,
        name VARCHAR(255) NOT NULL DEFAULT '',
        password_hash VARCHAR(255) NULL,
        date_of_birth DATE NULL,
        profession VARCHAR(120) NOT NULL DEFAULT '',
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      )
    `);

    await this.connection.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profession VARCHAR(120) NOT NULL DEFAULT ''
    `);

    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS auth_identities (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        provider VARCHAR(32) NOT NULL,
        provider_user_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        created_at DATETIME NOT NULL,
        UNIQUE KEY provider_identity_unique (provider, provider_user_id),
        CONSTRAINT fk_auth_identities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL,
        CONSTRAINT fk_verification_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        access_token_hash VARCHAR(255) NOT NULL UNIQUE,
        refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
        access_expires_at DATETIME NOT NULL,
        refresh_expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        created_at DATETIME NOT NULL,
        CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id BIGINT PRIMARY KEY,
        language VARCHAR(8) NOT NULL DEFAULT 'es',
        height_unit VARCHAR(16) NOT NULL DEFAULT 'metric',
        gender_identity VARCHAR(64) NOT NULL DEFAULT '',
        pronouns VARCHAR(64) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }

  mapUser(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      dateOfBirth: row.date_of_birth
        ? new Date(row.date_of_birth).toISOString().slice(0, 10)
        : null,
      profession: row.profession || "",
      emailVerified: Boolean(row.email_verified),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async findUserByEmail(email) {
    const [rows] = await this.connection.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [normalizeEmail(email)]
    );
    return this.mapUser(rows[0]);
  }

  async findUserById(id) {
    const [rows] = await this.connection.query(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [id]
    );
    return this.mapUser(rows[0]);
  }

  async createEmailUser(input) {
    const now = new Date();
    const [result] = await this.connection.query(
      "INSERT INTO users (email, name, password_hash, date_of_birth, profession, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        normalizeEmail(input.email),
        input.name,
        input.passwordHash,
        input.dateOfBirth,
        input.profession || "",
        false,
        now,
        now,
      ]
    );
    return this.findUserById(result.insertId);
  }

  async updateUserProfile(userId, updates) {
    const assignments = [];
    const values = [];
    if (typeof updates.name === "string") {
      assignments.push("name = ?");
      values.push(updates.name);
    }
    if (typeof updates.dateOfBirth === "string") {
      assignments.push("date_of_birth = ?");
      values.push(updates.dateOfBirth);
    }
    if (typeof updates.profession === "string") {
      assignments.push("profession = ?");
      values.push(updates.profession);
    }
    assignments.push("updated_at = ?");
    values.push(new Date());
    values.push(userId);
    await this.connection.query(
      `UPDATE users SET ${assignments.join(", ")} WHERE id = ?`,
      values
    );
    return this.findUserById(userId);
  }

  async findUserSettings(userId) {
    const [rows] = await this.connection.query(
      "SELECT * FROM user_settings WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: Number(row.user_id),
      language: row.language,
      heightUnit: row.height_unit,
      genderIdentity: row.gender_identity,
      pronouns: row.pronouns,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async upsertUserSettings(userId, updates) {
    const existing = await this.findUserSettings(userId);
    if (!existing) {
      await this.connection.query(
        "INSERT INTO user_settings (user_id, language, height_unit, gender_identity, pronouns, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          userId,
          updates.language || "es",
          updates.heightUnit || "metric",
          updates.genderIdentity || "",
          updates.pronouns || "",
          new Date(),
          new Date(),
        ]
      );
      return this.findUserSettings(userId);
    }

    await this.connection.query(
      "UPDATE user_settings SET language = ?, height_unit = ?, gender_identity = ?, pronouns = ?, updated_at = ? WHERE user_id = ?",
      [
        typeof updates.language === "string" ? updates.language : existing.language,
        typeof updates.heightUnit === "string" ? updates.heightUnit : existing.heightUnit,
        typeof updates.genderIdentity === "string"
          ? updates.genderIdentity
          : existing.genderIdentity,
        typeof updates.pronouns === "string" ? updates.pronouns : existing.pronouns,
        new Date(),
        userId,
      ]
    );
    return this.findUserSettings(userId);
  }

  async verifyUserEmail(userId) {
    await this.connection.query(
      "UPDATE users SET email_verified = ?, updated_at = ? WHERE id = ?",
      [true, new Date(), userId]
    );
    return this.findUserById(userId);
  }

  async createVerificationToken(userId, rawToken, expiresAt) {
    await this.connection.query(
      "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?)",
      [userId, hashToken(rawToken), expiresAt, null, new Date()]
    );
  }

  async consumeVerificationToken(rawToken) {
    const [rows] = await this.connection.query(
      "SELECT * FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL LIMIT 1",
      [hashToken(rawToken)]
    );
    const token = rows[0];
    if (!token) return null;
    if (new Date(token.expires_at).getTime() < Date.now()) return { expired: true };
    await this.connection.query(
      "UPDATE email_verification_tokens SET used_at = ? WHERE id = ?",
      [new Date(), token.id]
    );
    const user = await this.verifyUserEmail(token.user_id);
    return { expired: false, user };
  }

  async findIdentity(provider, providerUserId) {
    const [rows] = await this.connection.query(
      "SELECT * FROM auth_identities WHERE provider = ? AND provider_user_id = ? LIMIT 1",
      [provider, String(providerUserId)]
    );
    return rows[0] || null;
  }

  async upsertSocialIdentity({ provider, providerUserId, email, name }) {
    const existingIdentity = await this.findIdentity(provider, providerUserId);
    if (existingIdentity) {
      return { user: await this.findUserById(existingIdentity.user_id), created: false };
    }
    const normalizedEmail = email ? normalizeEmail(email) : null;
    let user = normalizedEmail ? await this.findUserByEmail(normalizedEmail) : null;
    if (!user) {
      const [result] = await this.connection.query(
        "INSERT INTO users (email, name, password_hash, date_of_birth, profession, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [normalizedEmail, name || "", null, null, "", true, new Date(), new Date()]
      );
      user = await this.findUserById(result.insertId);
    } else if (!user.emailVerified) {
      user = await this.verifyUserEmail(user.id);
    }
    await this.connection.query(
      "INSERT INTO auth_identities (user_id, provider, provider_user_id, email, created_at) VALUES (?, ?, ?, ?, ?)",
      [user.id, provider, String(providerUserId), normalizedEmail, new Date()]
    );
    return { user, created: true };
  }

  async createSession(userId, accessToken, refreshToken, accessExpiresAt, refreshExpiresAt) {
    await this.connection.query(
      "INSERT INTO auth_sessions (user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        userId,
        hashToken(accessToken),
        hashToken(refreshToken),
        accessExpiresAt,
        refreshExpiresAt,
        null,
        new Date(),
      ]
    );
  }

  async findSessionByAccessToken(accessToken) {
    const [rows] = await this.connection.query(
      "SELECT * FROM auth_sessions WHERE access_token_hash = ? AND revoked_at IS NULL LIMIT 1",
      [hashToken(accessToken)]
    );
    const session = rows[0];
    if (!session) return null;
    if (new Date(session.access_expires_at).getTime() < Date.now()) return null;
    const user = await this.findUserById(session.user_id);
    return user ? { session, user } : null;
  }

  async rotateSession(refreshToken, nextAccessToken, nextRefreshToken, nextAccessExpiresAt, nextRefreshExpiresAt) {
    const [rows] = await this.connection.query(
      "SELECT * FROM auth_sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL LIMIT 1",
      [hashToken(refreshToken)]
    );
    const session = rows[0];
    if (!session) return null;
    if (new Date(session.refresh_expires_at).getTime() < Date.now()) return null;
    await this.connection.query(
      "UPDATE auth_sessions SET access_token_hash = ?, refresh_token_hash = ?, access_expires_at = ?, refresh_expires_at = ? WHERE id = ?",
      [
        hashToken(nextAccessToken),
        hashToken(nextRefreshToken),
        nextAccessExpiresAt,
        nextRefreshExpiresAt,
        session.id,
      ]
    );
    const user = await this.findUserById(session.user_id);
    return user ? { session, user } : null;
  }

  async revokeSessionByAccessToken(accessToken) {
    await this.connection.query(
      "UPDATE auth_sessions SET revoked_at = ? WHERE access_token_hash = ? AND revoked_at IS NULL",
      [new Date(), hashToken(accessToken)]
    );
  }
}

function hasMysqlConfig() {
  return Boolean(
    config.mysql.url ||
      (config.mysql.host &&
        config.mysql.user &&
        config.mysql.database)
  );
}

export async function createStore() {
  if (!hasMysqlConfig()) {
    const store = new FileStore(config.fileStorePath);
    await store.init();
    return { store, driver: "file" };
  }

  const connection = await mysql.createConnection(
    config.mysql.url
      ? config.mysql.url
      : {
          host: config.mysql.host,
          port: config.mysql.port,
          user: config.mysql.user,
          password: config.mysql.password,
          database: config.mysql.database,
        }
  );

  const store = new MysqlStore(connection);
  await store.init();
  return { store, driver: "mysql", connection };
}
