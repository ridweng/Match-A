import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { z, ZodError } from "zod";
import type { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { DiscoveryService } from "./discovery.service";

const likeDiscoverySchema = z.object({
  likedProfileId: z.string().trim().min(1).max(64),
  categoryValues: z.object({
    physical: z.string().trim().max(120).nullable().optional(),
    personality: z.string().trim().max(120).nullable().optional(),
    family: z.string().trim().max(120).nullable().optional(),
    expectations: z.string().trim().max(120).nullable().optional(),
    language: z.string().trim().max(120).nullable().optional(),
    studies: z.string().trim().max(120).nullable().optional(),
  }),
});

@Controller("discovery")
export class DiscoveryController {
  constructor(
    private readonly authService: AuthService,
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

  @Get("preferences")
  async getPreferences(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.discoveryService.getPreferences(auth.user.id));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Post("like")
  async likeProfile(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const payload = likeDiscoverySchema.parse(body);
      return res.json(await this.discoveryService.likeProfile(auth.user.id, payload));
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_DISCOVERY_LIKE_PAYLOAD",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        return this.sendAuthError(res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }
}
