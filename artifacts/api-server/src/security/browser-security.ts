import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type BrowserSecurityConfig = {
  nodeEnv: string;
  apiBaseUrl: string;
  frontendBaseUrl: string;
  adminBaseUrl: string;
  publicCorsOrigins: string[];
  adminCorsOrigins: string[];
  adminAllowedCidrs: string[];
};

const PUBLIC_CORS_METHODS = ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"];
const ADMIN_CORS_METHODS = ["GET", "HEAD", "OPTIONS"];
const ALLOWED_REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "x-matcha-request-id",
  "x-matcha-location-source",
];

function normalizeOrigin(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function defaultDevelopmentOrigins() {
  return [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
  ];
}

function getRequestOrigin(req: Request) {
  const protocol = req.protocol || "http";
  const host = req.get("host");
  return host ? `${protocol}://${host}` : "";
}

function isAdminPath(path: string) {
  return (
    path === "/" ||
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/api/admin" ||
    path.startsWith("/api/admin/") ||
    path === "/api/docs" ||
    path.startsWith("/api/docs/") ||
    path === "/api/reference" ||
    path === "/api/openapi.json"
  );
}

function isPublicMediaPath(path: string) {
  return path.startsWith("/api/media/public/");
}

function normalizeIp(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("::ffff:")) {
    return raw.slice("::ffff:".length);
  }
  return raw;
}

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function ipMatchesCidr(ip: string, cidr: string) {
  const normalizedIp = normalizeIp(ip);
  const normalizedCidr = String(cidr || "").trim();
  if (!normalizedIp || !normalizedCidr) {
    return false;
  }
  if (!normalizedCidr.includes("/")) {
    return normalizedIp === normalizedCidr;
  }

  const [base, prefixRaw] = normalizedCidr.split("/");
  const prefix = Number(prefixRaw);
  const ipNumber = ipv4ToNumber(normalizedIp);
  const baseNumber = ipv4ToNumber(base || "");
  if (ipNumber === null || baseNumber === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNumber & mask) === (baseNumber & mask);
}

function appendIfPresent(values: Set<string>, value: string | null | undefined) {
  const normalized = normalizeOrigin(value);
  if (normalized) {
    values.add(normalized);
  }
}

export function buildCorsPolicy(config: BrowserSecurityConfig) {
  const publicOrigins = new Set<string>();
  appendIfPresent(publicOrigins, config.frontendBaseUrl);
  appendIfPresent(publicOrigins, config.apiBaseUrl);
  for (const origin of config.publicCorsOrigins) {
    appendIfPresent(publicOrigins, origin);
  }
  if (config.nodeEnv !== "production") {
    for (const origin of defaultDevelopmentOrigins()) {
      appendIfPresent(publicOrigins, origin);
    }
  }

  const adminOrigins = new Set<string>();
  appendIfPresent(adminOrigins, config.adminBaseUrl);
  for (const origin of config.adminCorsOrigins) {
    appendIfPresent(adminOrigins, origin);
  }

  return {
    publicOrigins,
    adminOrigins,
  };
}

function requestedHeadersAreAllowed(req: Request) {
  const raw = req.get("access-control-request-headers");
  if (!raw) {
    return true;
  }

  return raw
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean)
    .every((header) => ALLOWED_REQUEST_HEADERS.includes(header));
}

function applyCorsHeaders(
  req: Request,
  res: Response,
  options: { origin: string; methods: string[] }
) {
  res.setHeader("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
  res.setHeader("Access-Control-Allow-Origin", options.origin);
  res.setHeader("Access-Control-Allow-Methods", options.methods.join(", "));
  res.setHeader(
    "Access-Control-Allow-Headers",
    ALLOWED_REQUEST_HEADERS.map((header) =>
      header
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-")
    ).join(", ")
  );
  res.setHeader("Access-Control-Max-Age", "600");
}

export function createCorsMiddleware(config: BrowserSecurityConfig) {
  const { publicOrigins, adminOrigins } = buildCorsPolicy(config);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = normalizeOrigin(req.get("origin"));
    if (!origin) {
      next();
      return;
    }

    const path = req.path || req.originalUrl || "";
    const adminRequest = isAdminPath(path);
    const requestOrigin = normalizeOrigin(getRequestOrigin(req));
    const allowedOrigins = adminRequest ? adminOrigins : publicOrigins;
    const allowedMethods = adminRequest ? ADMIN_CORS_METHODS : PUBLIC_CORS_METHODS;
    const originAllowed =
      allowedOrigins.has(origin) || (adminRequest && origin === requestOrigin);
    const requestedMethod = String(
      req.get("access-control-request-method") || req.method
    ).toUpperCase();
    const methodAllowed = allowedMethods.includes(requestedMethod);
    const headersAllowed = requestedHeadersAreAllowed(req);

    if (originAllowed && methodAllowed && headersAllowed) {
      applyCorsHeaders(req, res, { origin, methods: allowedMethods });
      if (req.method === "OPTIONS") {
        res.status(204).send();
        return;
      }
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.status(403).json({ error: "CORS_ORIGIN_DENIED" });
      return;
    }

    next();
  };
}

export function createAdminAccessMiddleware(config: BrowserSecurityConfig) {
  const allowedCidrs = config.adminAllowedCidrs.map((entry) => entry.trim()).filter(Boolean);

  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.originalUrl || "";
    if (!isAdminPath(path)) {
      next();
      return;
    }

    if (config.nodeEnv !== "production" && allowedCidrs.length === 0) {
      next();
      return;
    }

    const clientIp = normalizeIp(req.ip || req.socket.remoteAddress);
    if (allowedCidrs.some((cidr) => ipMatchesCidr(clientIp, cidr))) {
      next();
      return;
    }

    res.status(404).send("Not found");
  };
}

function buildCsp(directives: Record<string, string[]>) {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function getApiCsp() {
  return buildCsp({
    "default-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
    "frame-ancestors": ["'none'"],
  });
}

export function getAdminCsp(nonce: string) {
  return buildCsp({
    "default-src": ["'self'"],
    "base-uri": ["'none'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'", "data:"],
    "style-src": ["'self'", "'unsafe-inline'", `'nonce-${nonce}'`, "https://cdn.jsdelivr.net"],
    "script-src": ["'self'", "'unsafe-inline'", `'nonce-${nonce}'`, "https://cdn.jsdelivr.net"],
    "connect-src": ["'self'"],
  });
}

export function getAdminDocsCsp() {
  return buildCsp({
    "default-src": ["'self'"],
    "base-uri": ["'none'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'", "data:"],
    "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    "connect-src": ["'self'"],
  });
}

export function createSecurityHeadersMiddleware(config: BrowserSecurityConfig) {
  const apiCsp = getApiCsp();
  const adminDocsCsp = getAdminDocsCsp();

  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.originalUrl || "";
    const adminRequest = isAdminPath(path);
    const adminDocsRequest =
      path === "/api/docs" ||
      path.startsWith("/api/docs/") ||
      path === "/api/reference";

    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.cspNonce = nonce;

    res.setHeader(
      "Content-Security-Policy",
      adminDocsRequest ? adminDocsCsp : adminRequest ? getAdminCsp(nonce) : apiCsp
    );
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader(
      "Cross-Origin-Resource-Policy",
      isPublicMediaPath(path) ? "cross-origin" : "same-site"
    );
    if (config.nodeEnv === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }

    next();
  };
}
