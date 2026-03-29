import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { z, ZodError } from "zod";
import type { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { DiscoveryService } from "../discovery/discovery.service";
import { GoalsService } from "../goals/goals.service";
import { ViewerService } from "./viewer.service";

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location: z.string().trim().max(255).optional(),
  country: z.string().trim().max(120).optional(),
  profession: z.string().trim().max(120).optional(),
  genderIdentity: z.string().trim().max(64).optional(),
  pronouns: z.string().trim().max(64).optional(),
  personality: z.string().trim().max(64).optional(),
  relationshipGoals: z.string().trim().max(120).optional(),
  languagesSpoken: z.array(z.string().trim().min(1).max(64)).max(7).optional(),
  education: z.string().trim().max(120).optional(),
  childrenPreference: z.string().trim().max(120).optional(),
  physicalActivity: z.string().trim().max(120).optional(),
  alcoholUse: z.string().trim().max(120).optional(),
  tobaccoUse: z.string().trim().max(120).optional(),
  politicalInterest: z.string().trim().max(120).optional(),
  religionImportance: z.string().trim().max(120).optional(),
  religion: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  bodyType: z.string().trim().max(120).optional(),
  height: z.string().trim().max(32).optional(),
  hairColor: z.string().trim().max(120).optional(),
  ethnicity: z.string().trim().max(160).optional(),
  interests: z.array(z.string().trim().min(1).max(64)).max(24).optional(),
});

const settingsUpdateSchema = z.object({
  language: z.enum(["es", "en"]).optional(),
  heightUnit: z.enum(["metric", "imperial"]).optional(),
  genderIdentity: z.string().trim().max(64).optional(),
  pronouns: z.string().trim().max(64).optional(),
  personality: z.string().trim().max(64).optional(),
});

const goalCompletionSchema = z.object({
  completed: z.literal(true).optional().default(true),
});

const goalReorderSchema = z.object({
  category: z.enum([
    "physical",
    "personality",
    "family",
    "expectations",
    "language",
    "studies",
  ]),
  orderedGoalKeys: z.array(z.string().trim().min(1).max(64)).min(1),
});

@Controller()
export class ViewerController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ViewerService) private readonly viewerService: ViewerService,
    @Inject(GoalsService) private readonly goalsService: GoalsService,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService
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

  @Get("viewer/bootstrap")
  async getViewerBootstrap(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.viewerService.getBootstrap(auth.user.id));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Get("me/profile")
  async getProfile(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.viewerService.getProfile(auth.user.id));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Patch("me/profile")
  async updateProfile(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const payload = profileUpdateSchema.parse(body);
      return res.json(await this.viewerService.updateProfile(auth.user.id, payload));
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_PROFILE_PAYLOAD",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "UNDERAGE" || error.message === "INVALID_DATE_OF_BIRTH") {
          return res.status(HttpStatus.BAD_REQUEST).json({ error: error.message });
        }
        return this.sendAuthError(res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Get("me/settings")
  async getSettings(@Req() req: Request, @Res() res: Response) {
    try {
      return res.json(
        await this.authService.getSettings(this.getAuthorizationHeader(req))
      );
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Patch("me/settings")
  async updateSettings(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const payload = settingsUpdateSchema.parse(body);
      return res.json(
        await this.authService.updateSettings(this.getAuthorizationHeader(req), payload)
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_SETTINGS_PAYLOAD",
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

  @Get("me/goals")
  async getGoals(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.goalsService.getUserGoals(auth.user.id));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Patch("me/goals/:goalKey")
  async completeGoal(
    @Req() req: Request,
    @Param("goalKey") goalKey: string,
    @Body() body: unknown,
    @Res() res: Response
  ) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      goalCompletionSchema.parse(body || {});
      return res.json(await this.goalsService.completeGoalTask(auth.user.id, goalKey));
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_GOAL_UPDATE_PAYLOAD",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "GOAL_NOT_FOUND") {
          return res.status(HttpStatus.NOT_FOUND).json({ error: error.message });
        }
        return this.sendAuthError(res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("me/goals/reorder")
  async reorderGoals(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const payload = goalReorderSchema.parse(body);
      return res.json(
        await this.goalsService.reorderGoalTasks(
          auth.user.id,
          payload.category,
          payload.orderedGoalKeys
        )
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_GOAL_REORDER_PAYLOAD",
          issues: error.flatten(),
        });
      }
      if (error instanceof Error && error.message) {
        if (error.message === "INVALID_GOAL_ORDER") {
          return res.status(HttpStatus.BAD_REQUEST).json({ error: error.message });
        }
        return this.sendAuthError(res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("me/goals/unlock/seen")
  async markGoalsUnlockSeen(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.goalsService.markGoalsUnlockSeen(auth.user.id));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Get("me/discovery/preferences")
  async getDiscoveryPreferences(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.discoveryService.getPreferences(auth.user.id));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Patch("me/discovery/preferences")
  async updateDiscoveryPreferences(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response
  ) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const payload = z
        .object({
          filters: z
            .object({
              selectedGenders: z
                .array(z.enum(["male", "female", "non_binary", "fluid"]))
                .max(4),
              therianMode: z.enum(["exclude", "include", "only"]),
              ageMin: z.number().int().min(18).max(100),
              ageMax: z.number().int().min(18).max(100),
            })
            .refine((value) => value.ageMin <= value.ageMax),
        })
        .parse(body);
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
        return this.sendAuthError(res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }
}
