import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import nodemailer from "nodemailer";
import { z } from "zod";

import { config, getProviderRedirectUri, isProviderConfigured } from "./config.js";
import { createStore } from "./db.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const accessTtlMs = 1000 * 60 * 15;
const refreshTtlMs = 1000 * 60 * 60 * 24 * 30;
const verificationTtlMs = 1000 * 60 * 60 * 24;

const signUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const verifySchema = z.object({
  token: z.string().min(20),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  profession: z.string().trim().max(120).optional(),
});

const updateSettingsSchema = z.object({
  language: z.enum(["es", "en"]).optional(),
  heightUnit: z.enum(["metric", "imperial"]).optional(),
  genderIdentity: z.string().trim().max(64).optional(),
  pronouns: z.string().trim().max(64).optional(),
  personality: z.string().trim().max(64).optional(),
});

const providerSchema = z.enum(["google", "facebook", "apple"]);

const { store, driver } = await createStore();
console.log(`[auth-backend] using ${driver} store`);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function encodeJsonBase64url(value) {
  return base64url(JSON.stringify(value));
}

function signState(payload) {
  const encoded = encodeJsonBase64url(payload);
  const signature = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(encoded)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${encoded}.${signature}`;
}

function verifyState(token) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return null;
  const expected = crypto
    .createHmac("sha256", config.sessionSecret)
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

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, result) => {
      if (error) reject(error);
      else resolve(result.toString("hex"));
    });
  });
  return `${salt}:${derived}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, derived] = String(storedHash || "").split(":");
  if (!salt || !derived) return false;
  const candidate = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, result) => {
      if (error) reject(error);
      else resolve(result.toString("hex"));
    });
  });
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(candidate));
}

async function ensureDefaultAccount() {
  const existing = await store.findUserByEmail("test@gmail.com");
  if (existing) return;

  const passwordHash = await hashPassword("test");
  const user = await store.createEmailUser({
    name: "Test User",
    email: "test@gmail.com",
    passwordHash,
    dateOfBirth: "2000-01-01",
  });
  await store.verifyUserEmail(user.id);
  console.log("[auth-backend] seeded default account: test@gmail.com / test");
}

await ensureDefaultAccount();

function getAge(dateOfBirth) {
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

function validateDob(dateOfBirth) {
  const parsed = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, code: "INVALID_DATE_OF_BIRTH" };
  }
  if (getAge(dateOfBirth) < config.minimumAge) {
    return { valid: false, code: "UNDERAGE" };
  }
  return { valid: true };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    dateOfBirth: user.dateOfBirth,
    profession: user.profession || "",
    emailVerified: Boolean(user.emailVerified),
  };
}

function sanitizeSettings(settings) {
  return {
    language: settings?.language === "en" ? "en" : "es",
    heightUnit: settings?.heightUnit === "imperial" ? "imperial" : "metric",
    genderIdentity: settings?.genderIdentity || "",
    pronouns: settings?.pronouns || "",
    personality: settings?.personality || "",
  };
}

function authPayload(user, accessToken, refreshToken) {
  const needsProfileCompletion = !user.name || !user.dateOfBirth;
  return {
    status: "authenticated",
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
    needsProfileCompletion,
  };
}

async function createSessionResponse(user) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const accessExpiresAt = new Date(Date.now() + accessTtlMs).toISOString();
  const refreshExpiresAt = new Date(Date.now() + refreshTtlMs).toISOString();
  await store.createSession(
    user.id,
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt
  );
  return authPayload(user, accessToken, refreshToken);
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function createVerificationUrl(token) {
  return `${config.baseUrl}/api/auth/verify-email/confirm?token=${encodeURIComponent(token)}`;
}

function hasSmtpConfig() {
  const { host, user, password } = config.smtp;
  return Boolean(host && user && password);
}

async function sendVerificationEmail(email, url) {
  if (!hasSmtpConfig()) {
    console.log(`[auth-backend] verification email for ${email}: ${url}`);
    return false;
  }

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password,
    },
  });

  await transport.sendMail({
    from: config.smtp.from,
    to: email,
    subject: "Verify your MatchA account",
    text: `Verify your account by opening: ${url}`,
    html: `<p>Verify your MatchA account by opening this link:</p><p><a href="${url}">${url}</a></p>`,
  });

  return true;
}

async function authenticate(req, res, next) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  const result = await store.findSessionByAccessToken(accessToken);
  if (!result) {
    return res.status(401).json({ error: "INVALID_SESSION" });
  }
  req.auth = { accessToken, user: result.user, session: result.session };
  return next();
}

function providerUnavailable(provider, redirectUri) {
  const target = new URL(redirectUri || config.frontendRedirectUri);
  target.searchParams.set("status", "error");
  target.searchParams.set("provider", provider);
  target.searchParams.set("code", "PROVIDER_UNAVAILABLE");
  target.searchParams.set("message", "Provider is not configured");
  return target.toString();
}

async function exchangeGoogleCode(code) {
  const redirectUri = getProviderRedirectUri("google");
  const params = new URLSearchParams({
    code,
    client_id: config.providers.google.clientId,
    client_secret: config.providers.google.clientSecret,
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
  const tokenData = await tokenResponse.json();
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  if (!profileResponse.ok) {
    throw new Error("GOOGLE_PROFILE_FETCH_FAILED");
  }
  const profile = await profileResponse.json();
  return {
    provider: "google",
    providerUserId: profile.sub,
    email: profile.email || null,
    name: profile.name || "",
  };
}

async function exchangeFacebookCode(code) {
  const redirectUri = getProviderRedirectUri("facebook");
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", config.providers.facebook.clientId);
  tokenUrl.searchParams.set("client_secret", config.providers.facebook.clientSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenResponse = await fetch(tokenUrl);
  if (!tokenResponse.ok) {
    throw new Error("FACEBOOK_TOKEN_EXCHANGE_FAILED");
  }
  const tokenData = await tokenResponse.json();
  const profileUrl = new URL("https://graph.facebook.com/me");
  profileUrl.searchParams.set("fields", "id,name,email");
  profileUrl.searchParams.set("access_token", tokenData.access_token);
  const profileResponse = await fetch(profileUrl);
  if (!profileResponse.ok) {
    throw new Error("FACEBOOK_PROFILE_FETCH_FAILED");
  }
  const profile = await profileResponse.json();
  return {
    provider: "facebook",
    providerUserId: profile.id,
    email: profile.email || null,
    name: profile.name || "",
  };
}

function createAppleClientSecret() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeJsonBase64url({
    alg: "ES256",
    kid: config.providers.apple.keyId,
  });
  const payload = encodeJsonBase64url({
    iss: config.providers.apple.teamId,
    iat: issuedAt,
    exp: issuedAt + 60 * 60,
    aud: "https://appleid.apple.com",
    sub: config.providers.apple.serviceId,
  });
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .sign("sha256", Buffer.from(unsigned), config.providers.apple.privateKey)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${unsigned}.${signature}`;
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function exchangeAppleCode(code) {
  const params = new URLSearchParams({
    client_id: config.providers.apple.serviceId,
    client_secret: createAppleClientSecret(),
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
  const tokenData = await tokenResponse.json();
  const claims = decodeJwtPayload(tokenData.id_token);
  if (!claims?.sub) {
    throw new Error("APPLE_PROFILE_FETCH_FAILED");
  }
  return {
    provider: "apple",
    providerUserId: claims.sub,
    email: claims.email || null,
    name: "",
  };
}

async function fetchSocialProfile(provider, code) {
  if (provider === "google") return exchangeGoogleCode(code);
  if (provider === "facebook") return exchangeFacebookCode(code);
  if (provider === "apple") return exchangeAppleCode(code);
  throw new Error("UNSUPPORTED_PROVIDER");
}

function buildProviderAuthUrl(provider, state) {
  if (provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.providers.google.clientId);
    url.searchParams.set("redirect_uri", getProviderRedirectUri(provider));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.providers.google.scopes.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "facebook") {
    const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    url.searchParams.set("client_id", config.providers.facebook.clientId);
    url.searchParams.set("redirect_uri", getProviderRedirectUri(provider));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.providers.facebook.scopes.join(","));
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "apple") {
    const url = new URL("https://appleid.apple.com/auth/authorize");
    url.searchParams.set("client_id", config.providers.apple.serviceId);
    url.searchParams.set("redirect_uri", getProviderRedirectUri(provider));
    url.searchParams.set("response_type", "code id_token");
    url.searchParams.set("response_mode", "form_post");
    url.searchParams.set("scope", config.providers.apple.scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  throw new Error("UNSUPPORTED_PROVIDER");
}

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", store: driver });
});

app.get("/api/auth/providers", (_req, res) => {
  res.json({
    google: isProviderConfigured("google"),
    facebook: isProviderConfigured("facebook"),
    apple: isProviderConfigured("apple"),
  });
});

app.post("/api/auth/sign-up", async (req, res) => {
  try {
    const input = signUpSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(input.email);
    const dobStatus = validateDob(input.dateOfBirth);
    if (!dobStatus.valid) {
      return res.status(400).json({ error: dobStatus.code });
    }
    const existing = await store.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: "EMAIL_ALREADY_IN_USE" });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await store.createEmailUser({
      ...input,
      email: normalizedEmail,
      passwordHash,
    });

    const rawToken = randomToken();
    const verificationUrl = createVerificationUrl(rawToken);
    await store.createVerificationToken(
      user.id,
      rawToken,
      new Date(Date.now() + verificationTtlMs).toISOString()
    );
    await sendVerificationEmail(user.email, verificationUrl);

    const payload = {
      status: "verification_pending",
      email: user.email,
      message: "Verification email sent",
    };

    if (config.nodeEnv !== "production" && !hasSmtpConfig()) {
      payload.verificationPreviewUrl = verificationUrl;
    }

    return res.status(201).json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "INVALID_SIGN_UP_PAYLOAD", issues: error.flatten() });
    }
    console.error(error);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

app.post("/api/auth/sign-in", async (req, res) => {
  try {
    const input = signInSchema.parse(req.body);
    const user = await store.findUserByEmail(input.email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }
    const validPassword = await verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }
    if (!user.emailVerified) {
      return res.status(403).json({
        error: "EMAIL_VERIFICATION_REQUIRED",
        emailVerificationRequired: true,
      });
    }
    return res.json(await createSessionResponse(user));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "INVALID_SIGN_IN_PAYLOAD", issues: error.flatten() });
    }
    console.error(error);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const nextAccessToken = randomToken();
    const nextRefreshToken = randomToken();
    const nextAccessExpiresAt = new Date(Date.now() + accessTtlMs).toISOString();
    const nextRefreshExpiresAt = new Date(Date.now() + refreshTtlMs).toISOString();
    const rotated = await store.rotateSession(
      refreshToken,
      nextAccessToken,
      nextRefreshToken,
      nextAccessExpiresAt,
      nextRefreshExpiresAt
    );
    if (!rotated) {
      return res.status(401).json({ error: "INVALID_REFRESH_TOKEN" });
    }
    return res.json(authPayload(rotated.user, nextAccessToken, nextRefreshToken));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "INVALID_REFRESH_PAYLOAD", issues: error.flatten() });
    }
    console.error(error);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

app.post("/api/auth/sign-out", authenticate, async (req, res) => {
  await store.revokeSessionByAccessToken(req.auth.accessToken);
  return res.status(204).send();
});

app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const { token } = verifySchema.parse(req.body);
    const result = await store.consumeVerificationToken(token);
    if (!result) {
      return res.status(400).json({ error: "INVALID_VERIFICATION_TOKEN" });
    }
    if (result.expired) {
      return res.status(400).json({ error: "EXPIRED_VERIFICATION_TOKEN" });
    }
    return res.json({
      status: "verified",
      user: sanitizeUser(result.user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "INVALID_VERIFY_PAYLOAD", issues: error.flatten() });
    }
    console.error(error);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

app.get("/api/auth/verify-email/confirm", async (req, res) => {
  const token = String(req.query.token || "");
  const redirectUri = config.frontendRedirectUri;
  const target = new URL(redirectUri);
  if (!token) {
    target.searchParams.set("status", "error");
    target.searchParams.set("code", "INVALID_VERIFICATION_TOKEN");
    return res.redirect(target.toString());
  }

  const result = await store.consumeVerificationToken(token);
  if (!result || result.expired) {
    target.searchParams.set("status", "error");
    target.searchParams.set(
      "code",
      result?.expired ? "EXPIRED_VERIFICATION_TOKEN" : "INVALID_VERIFICATION_TOKEN"
    );
    return res.redirect(target.toString());
  }

  target.searchParams.set("status", "verified");
  target.searchParams.set("email", result.user.email || "");
  return res.redirect(target.toString());
});

app.get("/api/auth/me", authenticate, async (req, res) => {
  return res.json({
    user: sanitizeUser(req.auth.user),
    needsProfileCompletion: !req.auth.user.name || !req.auth.user.dateOfBirth,
  });
});

app.patch("/api/auth/me", authenticate, async (req, res) => {
  try {
    const updates = updateProfileSchema.parse(req.body);
    if (updates.dateOfBirth) {
      const dobStatus = validateDob(updates.dateOfBirth);
      if (!dobStatus.valid) {
        return res.status(400).json({ error: dobStatus.code });
      }
    }
    const user = await store.updateUserProfile(req.auth.user.id, updates);
    return res.json({
      user: sanitizeUser(user),
      needsProfileCompletion: !user.name || !user.dateOfBirth,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "INVALID_PROFILE_PAYLOAD", issues: error.flatten() });
    }
    console.error(error);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

app.get("/api/auth/settings", authenticate, async (req, res) => {
  const settings = await store.findUserSettings(req.auth.user.id);
  return res.json({
    settings: sanitizeSettings(settings),
  });
});

app.patch("/api/auth/settings", authenticate, async (req, res) => {
  try {
    const updates = updateSettingsSchema.parse(req.body);
    const settings = await store.upsertUserSettings(req.auth.user.id, updates);
    return res.json({
      settings: sanitizeSettings(settings),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "INVALID_SETTINGS_PAYLOAD", issues: error.flatten() });
    }
    console.error(error);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

app.get("/api/auth/social/start/:provider", (req, res) => {
  const provider = providerSchema.safeParse(req.params.provider);
  if (!provider.success) {
    return res.status(400).json({ error: "UNSUPPORTED_PROVIDER" });
  }

  const redirectUri = String(req.query.redirectUri || config.frontendRedirectUri);
  if (!isProviderConfigured(provider.data)) {
    return res.redirect(providerUnavailable(provider.data, redirectUri));
  }

  const state = signState({
    provider: provider.data,
    redirectUri,
    mode: String(req.query.mode || "signin"),
    expiresAt: Date.now() + 1000 * 60 * 10,
  });

  return res.redirect(buildProviderAuthUrl(provider.data, state));
});

async function handleSocialCallback(req, res) {
  const provider = providerSchema.safeParse(req.params.provider);
  const redirectUriFromState = String(req.query.redirectUri || config.frontendRedirectUri);
  if (!provider.success) {
    return res.redirect(providerUnavailable("unknown", redirectUriFromState));
  }

  const state = verifyState(String(req.query.state || ""));
  const redirectUri = state?.redirectUri || redirectUriFromState;
  const target = new URL(redirectUri);
  if (!state || state.provider !== provider.data) {
    target.searchParams.set("status", "error");
    target.searchParams.set("code", "INVALID_STATE");
    return res.redirect(target.toString());
  }

  if (req.query.error) {
    target.searchParams.set("status", "error");
    target.searchParams.set("provider", provider.data);
    target.searchParams.set("code", String(req.query.error));
    target.searchParams.set("message", String(req.query.error_description || req.query.error));
    return res.redirect(target.toString());
  }

  try {
    const socialProfile = await fetchSocialProfile(provider.data, String(req.query.code || ""));
    const { user } = await store.upsertSocialIdentity(socialProfile);
    const payload = await createSessionResponse(user);
    target.searchParams.set("status", "success");
    target.searchParams.set("provider", provider.data);
    target.searchParams.set("accessToken", payload.accessToken);
    target.searchParams.set("refreshToken", payload.refreshToken);
    target.searchParams.set(
      "needsProfileCompletion",
      payload.needsProfileCompletion ? "true" : "false"
    );
    return res.redirect(target.toString());
  } catch (error) {
    console.error(error);
    target.searchParams.set("status", "error");
    target.searchParams.set("provider", provider.data);
    target.searchParams.set("code", error instanceof Error ? error.message : "SOCIAL_AUTH_FAILED");
    return res.redirect(target.toString());
  }
}

app.get("/api/auth/social/callback/:provider", handleSocialCallback);
app.post("/api/auth/social/callback/:provider", handleSocialCallback);

app.listen(config.port, () => {
  console.log(`[auth-backend] listening on ${config.port}`);
});
