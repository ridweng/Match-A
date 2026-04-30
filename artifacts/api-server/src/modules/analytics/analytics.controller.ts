import {
  Body,
  Controller,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { z, ZodError } from "zod";
import { runtimeConfig } from "../../config/runtime";
import { API_TAGS } from "../../docs/openapi/tags";
import { MATCHA_BEARER_AUTH } from "../../docs/openapi/security";
import {
  RateLimitExceededError,
  assertRouteIpRateLimit,
  logRateLimitHit,
  setRateLimitHeaders,
} from "../../security/rate-limit";
import { AuthService } from "../auth/auth.service";
import { AnalyticsService } from "./analytics.service";
import { ANALYTICS_EVENT_NAMES } from "./analytics.types";

const platformSchema = z.enum(["ios", "android", "web"]);
const contextSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  platform: platformSchema.nullable().optional(),
  appVersion: z.string().trim().max(64).nullable().optional(),
  buildNumber: z.string().trim().max(64).nullable().optional(),
  deviceFamily: z.string().trim().max(120).nullable().optional(),
}).strict();

const eventSchema = contextSchema.extend({
  eventName: z.enum(ANALYTICS_EVENT_NAMES),
  screenName: z.string().trim().max(80).nullable().optional(),
  areaName: z.string().trim().max(80).nullable().optional(),
  occurredAt: z.string().datetime().nullable().optional(),
  durationMs: z.number().int().min(0).max(86_400_000).nullable().optional(),
  targetProfilePublicId: z.string().trim().max(80).nullable().optional(),
  targetProfileKind: z.enum(["user", "dummy", "synthetic", "unknown"]).nullable().optional(),
  targetProfileBatchKey: z.string().trim().max(120).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
}).strict();

const sessionStartSchema = contextSchema.extend({
  startedAt: z.string().datetime().nullable().optional(),
}).strict();

const sessionHeartbeatSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
}).strict();

const sessionEndSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  endReason: z.enum(["foreground_end", "background", "logout", "heartbeat_expired", "crash_or_unknown"]).nullable().optional(),
}).strict();

const batchSchema = z.object({
  events: z.array(eventSchema).max(100),
}).strict();

const screenTimeSchema = contextSchema.extend({
  screenName: z.string().trim().min(1).max(80),
  areaName: z.string().trim().max(80).nullable().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().min(0).max(86_400_000),
  endedBy: z.enum(["blur", "background", "logout", "app_close", "navigation"]).nullable().optional(),
}).strict();

const profileCardSchema = contextSchema.extend({
  targetProfilePublicId: z.string().trim().min(1).max(80),
  targetProfileKind: z.enum(["user", "dummy", "synthetic", "unknown"]).nullable().optional(),
  targetProfileBatchKey: z.string().trim().max(120).nullable().optional(),
  shownAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable().optional(),
  visibleDurationMs: z.number().int().min(0).max(86_400_000).nullable().optional(),
  decision: z.enum(["like", "pass", "none"]).nullable().optional(),
  openedInfo: z.boolean().nullable().optional(),
  photosViewed: z.number().int().min(0).max(99).nullable().optional(),
}).strict();

@ApiTags(API_TAGS.analytics)
@ApiBearerAuth(MATCHA_BEARER_AUTH)
@Controller("analytics")
export class AnalyticsController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService
  ) {}

  private getAuthorizationHeader(req: Request) {
    return typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : undefined;
  }

  private getClientIp(req: Request) {
    return req.ip || req.socket.remoteAddress || "unknown";
  }

  private async authenticate(req: Request) {
    return this.authService.authenticate(this.getAuthorizationHeader(req));
  }

  private async assertRateLimit(req: Request) {
    await assertRouteIpRateLimit({
      route: "analytics",
      ip: this.getClientIp(req),
      method: req.method,
      windowMs: 60_000,
      max: runtimeConfig.rateLimit.generalMax,
    });
  }

  private sendError(req: Request, res: Response, error: unknown, invalidCode: string) {
    if (error instanceof ZodError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: invalidCode,
        issues: error.flatten(),
      });
    }
    if (error instanceof RateLimitExceededError) {
      setRateLimitHeaders(res, error.details.result);
      logRateLimitHit({
        limiterName: error.details.limiterName,
        keyType: error.details.keyType,
        storageKey: error.details.key,
        retryAfterSeconds: error.details.retryAfterSeconds,
        requestPath: req.originalUrl?.split("?")[0] || req.path,
        requestMethod: req.method,
        requestIp: this.getClientIp(req),
      });
      return res.status(429).json({ error: "TOO_MANY_REQUESTS" });
    }
    if (error instanceof UnauthorizedException || (error instanceof Error && error.name === "UnauthorizedException")) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: "UNAUTHORIZED" });
    }
    console.error("[analytics] request failed", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "INTERNAL_SERVER_ERROR" });
  }

  @Post("session/start")
  @ApiOperation({ summary: "Start an app analytics session" })
  async startSession(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      await this.assertRateLimit(req);
      const auth = await this.authenticate(req);
      const input = sessionStartSchema.parse(body);
      return res.json(await this.analyticsService.startSession(auth.user.id, input));
    } catch (error) {
      return this.sendError(req, res, error, "INVALID_ANALYTICS_SESSION_START");
    }
  }

  @Post("session/heartbeat")
  async heartbeat(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      await this.assertRateLimit(req);
      const auth = await this.authenticate(req);
      const input = sessionHeartbeatSchema.parse(body);
      return res.json(await this.analyticsService.heartbeat(auth.user.id, input.sessionId));
    } catch (error) {
      return this.sendError(req, res, error, "INVALID_ANALYTICS_SESSION_HEARTBEAT");
    }
  }

  @Post("session/end")
  async endSession(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      await this.assertRateLimit(req);
      const auth = await this.authenticate(req);
      const input = sessionEndSchema.parse(body);
      return res.json(await this.analyticsService.endSession(auth.user.id, input));
    } catch (error) {
      return this.sendError(req, res, error, "INVALID_ANALYTICS_SESSION_END");
    }
  }

  @Post("event")
  async event(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      await this.assertRateLimit(req);
      const auth = await this.authenticate(req);
      const input = eventSchema.parse(body);
      return res.json(await this.analyticsService.recordEvent(auth.user.id, input));
    } catch (error) {
      return this.sendError(req, res, error, "INVALID_ANALYTICS_EVENT");
    }
  }

  @Post("events/batch")
  async batch(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      await this.assertRateLimit(req);
      const auth = await this.authenticate(req);
      const input = batchSchema.parse(body);
      return res.json(await this.analyticsService.recordEvents(auth.user.id, input.events));
    } catch (error) {
      return this.sendError(req, res, error, "INVALID_ANALYTICS_EVENT_BATCH");
    }
  }

  @Post("screen-time")
  async screenTime(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      await this.assertRateLimit(req);
      const auth = await this.authenticate(req);
      const input = screenTimeSchema.parse(body);
      return res.json(await this.analyticsService.recordScreenTime(auth.user.id, input));
    } catch (error) {
      return this.sendError(req, res, error, "INVALID_ANALYTICS_SCREEN_TIME");
    }
  }

  @Post("profile-card-time")
  async profileCardTime(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      await this.assertRateLimit(req);
      const auth = await this.authenticate(req);
      const input = profileCardSchema.parse(body);
      return res.json(await this.analyticsService.recordProfileCardTime(auth.user.id, input));
    } catch (error) {
      return this.sendError(req, res, error, "INVALID_ANALYTICS_PROFILE_CARD_TIME");
    }
  }
}

