import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { z, ZodError } from "zod";
import type { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { DiscoveryService } from "./discovery.service";

const discoveryDecisionSchema = z.object({
  targetProfileId: z.coerce.number().int().positive(),
  categoryValues: z.object({
    physical: z.string().trim().max(120).nullable().optional(),
    personality: z.string().trim().max(120).nullable().optional(),
    family: z.string().trim().max(120).nullable().optional(),
    expectations: z.string().trim().max(120).nullable().optional(),
    language: z.string().trim().max(120).nullable().optional(),
    studies: z.string().trim().max(120).nullable().optional(),
  }),
  requestId: z.string().trim().max(128).optional(),
  cursor: z.string().trim().max(512).optional(),
  visibleProfileIds: z.array(z.coerce.number().int().positive()).max(3).optional(),
  queueVersion: z.coerce.number().int().positive().optional(),
  presentedPosition: z.coerce.number().int().positive().optional(),
});

const discoveryQueuedDecisionSchema = discoveryDecisionSchema.extend({
  action: z.enum(["like", "pass"]),
});

const discoveryFiltersSchema = z.object({
  selectedGenders: z
    .array(z.enum(["male", "female", "non_binary", "fluid"]))
    .max(4),
  therianMode: z.enum(["exclude", "include", "only"]),
  ageMin: z.number().int().min(18).max(100),
  ageMax: z.number().int().min(18).max(100),
});

const updateDiscoveryPreferencesSchema = z.object({
  filters: discoveryFiltersSchema.refine((value) => value.ageMin <= value.ageMax, {
    message: "INVALID_DISCOVERY_FILTER_RANGE",
  }),
});

const discoveryFeedQuerySchema = z.object({
  cursor: z.string().trim().max(128).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
});

const discoveryWindowQuerySchema = z.object({
  size: z.coerce.number().int().min(1).max(3).optional(),
  cursor: z.string().trim().max(512).optional(),
});

@Controller("discovery")
export class DiscoveryController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(DiscoveryService)
    private readonly discoveryService: DiscoveryService
  ) {}

  private getAuthorizationHeader(req: Request) {
    return typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : undefined;
  }

  private sendAuthError(res: Response, error: unknown) {
    const message =
      error instanceof Error && error.message ? error.message : "UNAUTHORIZED";
    return res.status(HttpStatus.UNAUTHORIZED).json({ error: message });
  }

  private sendServerError(res: Response, error: unknown) {
    if (error instanceof Error && error.message) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
    console.error(error);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: "INTERNAL_SERVER_ERROR" });
  }

  @Get("preferences")
  async getPreferences(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.discoveryService.getPreferences(auth.user.id));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Get("feed")
  async getFeed(
    @Req() req: Request,
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response
  ) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const parsed = discoveryFeedQuerySchema.parse(query || {});
      return res.json(
        await this.discoveryService.getFeed(auth.user.id, {
          cursor: parsed.cursor || null,
          limit: parsed.limit,
        })
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_DISCOVERY_FEED_QUERY",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "DISCOVERY_CURSOR_STALE") {
          return res.status(HttpStatus.CONFLICT).json({
            error: error.message,
            queueInvalidationReason:
              (error as Error & { queueInvalidationReason?: string }).queueInvalidationReason ||
              "cursor_stale",
          });
        }
        if (
          error.message === "UNAUTHORIZED" ||
          error.message === "SESSION_NOT_FOUND" ||
          error.message === "ACCESS_TOKEN_EXPIRED" ||
          error.message === "INVALID_ACCESS_TOKEN"
        ) {
          return this.sendAuthError(res, error);
        }
        return this.sendServerError(res, error);
      }
      return this.sendServerError(res, error);
    }
  }

  @Get("window")
  async getWindow(
    @Req() req: Request,
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response
  ) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const parsed = discoveryWindowQuerySchema.parse(query || {});
      return res.json(
        await this.discoveryService.getWindow(auth.user.id, {
          size: parsed.size,
          cursor: parsed.cursor || null,
        })
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_DISCOVERY_WINDOW_QUERY",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "DISCOVERY_CURSOR_STALE") {
          return res.status(HttpStatus.CONFLICT).json({
            error: error.message,
            queueInvalidationReason:
              (error as Error & { queueInvalidationReason?: string }).queueInvalidationReason ||
              "cursor_stale",
          });
        }
        if (
          error.message === "UNAUTHORIZED" ||
          error.message === "SESSION_NOT_FOUND" ||
          error.message === "ACCESS_TOKEN_EXPIRED" ||
          error.message === "INVALID_ACCESS_TOKEN"
        ) {
          return this.sendAuthError(res, error);
        }
        return this.sendServerError(res, error);
      }
      return this.sendServerError(res, error);
    }
  }

  @Patch("preferences")
  async updatePreferences(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const payload = updateDiscoveryPreferencesSchema.parse(body);
      return res.json(
        await this.discoveryService.updatePreferences(auth.user.id, payload.filters)
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_DISCOVERY_PREFERENCES_PAYLOAD",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "DISCOVERY_CURSOR_STALE") {
          return res.status(HttpStatus.CONFLICT).json({
            error: error.message,
            queueInvalidationReason:
              (error as Error & { queueInvalidationReason?: string }).queueInvalidationReason ||
              "cursor_stale",
          });
        }
        if (
          error.message === "UNAUTHORIZED" ||
          error.message === "SESSION_NOT_FOUND" ||
          error.message === "ACCESS_TOKEN_EXPIRED" ||
          error.message === "INVALID_ACCESS_TOKEN"
        ) {
          return this.sendAuthError(res, error);
        }
        return this.sendServerError(res, error);
      }
      return this.sendServerError(res, error);
    }
  }

  @Post("reset")
  async resetDecisions(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.discoveryService.resetDecisions(auth.user.id));
    } catch (error) {
      if (error instanceof Error && error.message) {
        if (error.message === "DISCOVERY_CURSOR_STALE") {
          return res.status(HttpStatus.CONFLICT).json({
            error: error.message,
            queueInvalidationReason:
              (error as Error & { queueInvalidationReason?: string }).queueInvalidationReason ||
              "cursor_stale",
          });
        }
        if (
          error.message === "UNAUTHORIZED" ||
          error.message === "SESSION_NOT_FOUND" ||
          error.message === "ACCESS_TOKEN_EXPIRED" ||
          error.message === "INVALID_ACCESS_TOKEN"
        ) {
          return this.sendAuthError(res, error);
        }
        return this.sendServerError(res, error);
      }
      return this.sendServerError(res, error);
    }
  }

  @Post("like")
  async likeProfile(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const payload = discoveryDecisionSchema.parse(body);
      return res.json(await this.discoveryService.likeProfile(auth.user.id, payload));
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_DISCOVERY_LIKE_PAYLOAD",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "DISCOVERY_CURSOR_STALE") {
          return res.status(HttpStatus.CONFLICT).json({
            error: error.message,
            queueInvalidationReason:
              (error as Error & { queueInvalidationReason?: string }).queueInvalidationReason ||
              "cursor_stale",
          });
        }
        if (
          error.message === "UNAUTHORIZED" ||
          error.message === "SESSION_NOT_FOUND" ||
          error.message === "ACCESS_TOKEN_EXPIRED" ||
          error.message === "INVALID_ACCESS_TOKEN"
        ) {
          return this.sendAuthError(res, error);
        }
        return this.sendServerError(res, error);
      }
      return this.sendServerError(res, error);
    }
  }

  @Post("decision")
  async decideProfile(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const payload = discoveryQueuedDecisionSchema.parse(body);
      return res.json(await this.discoveryService.decideProfile(auth.user.id, payload));
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_DISCOVERY_DECISION_PAYLOAD",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "DISCOVERY_CURSOR_STALE") {
          return res.status(HttpStatus.CONFLICT).json({
            error: error.message,
            queueInvalidationReason:
              (error as Error & { queueInvalidationReason?: string }).queueInvalidationReason ||
              "cursor_stale",
          });
        }
        if (
          error.message === "UNAUTHORIZED" ||
          error.message === "SESSION_NOT_FOUND" ||
          error.message === "ACCESS_TOKEN_EXPIRED" ||
          error.message === "INVALID_ACCESS_TOKEN"
        ) {
          return this.sendAuthError(res, error);
        }
        return this.sendServerError(res, error);
      }
      return this.sendServerError(res, error);
    }
  }

  @Post("pass")
  async passProfile(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const payload = discoveryDecisionSchema.parse(body);
      return res.json(await this.discoveryService.passProfile(auth.user.id, payload));
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_DISCOVERY_PASS_PAYLOAD",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "DISCOVERY_CURSOR_STALE") {
          return res.status(HttpStatus.CONFLICT).json({
            error: error.message,
            queueInvalidationReason:
              (error as Error & { queueInvalidationReason?: string }).queueInvalidationReason ||
              "cursor_stale",
          });
        }
        if (
          error.message === "UNAUTHORIZED" ||
          error.message === "SESSION_NOT_FOUND" ||
          error.message === "ACCESS_TOKEN_EXPIRED" ||
          error.message === "INVALID_ACCESS_TOKEN"
        ) {
          return this.sendAuthError(res, error);
        }
        return this.sendServerError(res, error);
      }
      return this.sendServerError(res, error);
    }
  }
}
