import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { z, ZodError } from "zod";
import type { Request, Response } from "express";
import { AuthService, type Provider } from "./auth.service";

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

const resendVerificationSchema = z.object({
  email: z.string().trim().email(),
});

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email(),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
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

type SupportedProvider = z.infer<typeof providerSchema>;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getAuthorizationHeader(req: Request) {
    return typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : undefined;
  }

  private getClientIp(req: Request) {
    const forwardedFor = req.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
      return forwardedFor.split(",")[0]!.trim();
    }
    if (Array.isArray(forwardedFor) && forwardedFor[0]) {
      return forwardedFor[0].trim();
    }
    return req.ip || "unknown";
  }

  private sendZodError(
    res: Response,
    errorCode: string,
    error: ZodError<unknown>
  ) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      error: errorCode,
      issues: error.flatten(),
    });
  }

  private sendAuthError(res: Response, error: unknown) {
    const message =
      error instanceof Error && error.message ? error.message : "UNAUTHORIZED";
    return res.status(HttpStatus.UNAUTHORIZED).json({ error: message });
  }

  @Get("providers")
  getProviders() {
    return this.authService.providerAvailability();
  }

  @Post("sign-up")
  async signUp(@Body() body: unknown, @Res() res: Response) {
    try {
      const input = signUpSchema.parse(body);
      const result = await this.authService.signUp(input);
      if ("error" in result) {
        const status =
          result.error === "EMAIL_ALREADY_IN_USE"
            ? HttpStatus.CONFLICT
            : HttpStatus.BAD_REQUEST;
        return res.status(status).json({ error: result.error });
      }
      return res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_SIGN_UP_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("sign-in")
  async signIn(@Body() body: unknown, @Res() res: Response) {
    try {
      const input = signInSchema.parse(body);
      const result = await this.authService.signIn(input);
      if ("error" in result) {
        if (result.error === "EMAIL_VERIFICATION_REQUIRED") {
          return res.status(HttpStatus.FORBIDDEN).json({
            error: "EMAIL_VERIFICATION_REQUIRED",
            emailVerificationRequired: true,
          });
        }
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_SIGN_IN_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("refresh")
  async refresh(@Body() body: unknown, @Res() res: Response) {
    try {
      const { refreshToken } = refreshSchema.parse(body);
      const result = await this.authService.refresh(refreshToken);
      if ("error" in result) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_REFRESH_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("sign-out")
  async signOut(@Req() req: Request, @Res() res: Response) {
    try {
      await this.authService.signOut(this.getAuthorizationHeader(req));
      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Post("verify-email")
  async verifyEmail(@Body() body: unknown, @Res() res: Response) {
    try {
      const { token } = verifySchema.parse(body);
      const result = await this.authService.verifyEmailToken(token);
      if ("error" in result) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_VERIFY_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Get("verify-email/confirm")
  async verifyEmailConfirm(@Query("token") token: string | undefined, @Res() res: Response) {
    const target = await this.authService.getVerificationConfirmRedirect(String(token || ""));
    return res.redirect(target);
  }

  @Post("verify-email/resend")
  async resendVerificationEmail(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response
  ) {
    try {
      const input = resendVerificationSchema.parse(body);
      return res.json(
        await this.authService.resendVerificationEmail({
          email: input.email,
          ipAddress: this.getClientIp(req),
        })
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_VERIFY_RESEND_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("password-reset/request")
  async requestPasswordReset(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response
  ) {
    try {
      const input = passwordResetRequestSchema.parse(body);
      return res.json(
        await this.authService.requestPasswordReset({
          email: input.email,
          ipAddress: this.getClientIp(req),
        })
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_PASSWORD_RESET_REQUEST_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("password-reset/confirm")
  async confirmPasswordReset(@Body() body: unknown, @Res() res: Response) {
    try {
      const input = passwordResetConfirmSchema.parse(body);
      const result = await this.authService.confirmPasswordReset(input);
      if ("error" in result) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_PASSWORD_RESET_CONFIRM_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Get("me")
  async getMe(@Req() req: Request, @Res() res: Response) {
    try {
      return res.json(await this.authService.getMe(this.getAuthorizationHeader(req)));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Patch("me")
  async updateMe(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const updates = updateProfileSchema.parse(body);
      const result = await this.authService.updateMe(
        this.getAuthorizationHeader(req),
        updates
      );
      if ("error" in result) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_PROFILE_PAYLOAD", error);
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

  @Post("onboarding/complete")
  async completeOnboarding(@Req() req: Request, @Res() res: Response) {
    try {
      return res.json(
        await this.authService.completeOnboarding(this.getAuthorizationHeader(req))
      );
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Get("settings")
  async getSettings(@Req() req: Request, @Res() res: Response) {
    try {
      return res.json(
        await this.authService.getSettings(this.getAuthorizationHeader(req))
      );
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Patch("settings")
  async updateSettings(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const updates = updateSettingsSchema.parse(body);
      return res.json(
        await this.authService.updateSettings(this.getAuthorizationHeader(req), updates)
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_SETTINGS_PAYLOAD", error);
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

  @Get("social/start/:provider")
  startSocialAuth(
    @Param("provider") providerParam: string,
    @Query("redirectUri") redirectUri: string | undefined,
    @Query("mode") mode: string | undefined,
    @Res() res: Response
  ) {
    const provider = providerSchema.safeParse(providerParam);
    if (!provider.success) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "UNSUPPORTED_PROVIDER" });
    }

    const target = this.authService.startSocialAuth(
      provider.data,
      String(redirectUri || ""),
      String(mode || "signin")
    );
    return res.redirect(target);
  }

  private async handleSocialCallback(
    providerParam: string,
    query: Record<string, unknown>,
    body: Record<string, unknown>,
    res: Response
  ) {
    const provider = providerSchema.safeParse(providerParam);
    const redirectUriFromState = String(
      query.redirectUri || body.redirectUri || ""
    );
    if (!provider.success) {
      return res.redirect(
        this.authService.providerUnavailable("unknown", redirectUriFromState)
      );
    }

    const target = await this.authService.handleSocialCallback({
      provider: provider.data as SupportedProvider,
      state: String(query.state || body.state || ""),
      code: String(query.code || body.code || ""),
      error:
        typeof query.error === "string"
          ? query.error
          : typeof body.error === "string"
            ? body.error
            : null,
      errorDescription:
        typeof query.error_description === "string"
          ? query.error_description
          : typeof body.error_description === "string"
            ? body.error_description
            : null,
      redirectUri:
        typeof redirectUriFromState === "string" ? redirectUriFromState : null,
    });

    return res.redirect(target);
  }

  @Get("social/callback/:provider")
  async socialCallbackGet(
    @Param("provider") provider: string,
    @Query() query: Record<string, unknown>,
    @Res() res: Response
  ) {
    return this.handleSocialCallback(provider, query, {}, res);
  }

  @Post("social/callback/:provider")
  async socialCallbackPost(
    @Param("provider") provider: string,
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
    @Res() res: Response
  ) {
    return this.handleSocialCallback(provider, query, body, res);
  }
}
