import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z, ZodError } from "zod";
import type { Request, Response } from "express";
import { runtimeConfig } from "../../config/runtime";
import { AuthService, type Provider } from "./auth.service";
import { API_TAGS } from "../../docs/openapi/tags";
import {
  RateLimitExceededError,
  assertRouteIpRateLimit,
  assertIdentifierRateLimit,
  logRateLimitHit,
  setRateLimitHeaders,
} from "../../security/rate-limit";
import {
  normalizedEmailSchema,
  passwordSchema,
  tokenSchema,
} from "../../security/request-validation";

const signUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: normalizedEmailSchema,
  password: passwordSchema,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

const signInSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1).max(128),
}).strict();

const refreshSchema = z.object({
  refreshToken: tokenSchema,
}).strict();

const verifySchema = z.object({
  token: tokenSchema,
}).strict();

const resendVerificationSchema = z.object({
  email: normalizedEmailSchema,
}).strict();

const verificationStatusSchema = z.object({
  email: normalizedEmailSchema,
}).strict();

const passwordResetRequestSchema = z.object({
  email: normalizedEmailSchema,
}).strict();

const passwordResetValidateSchema = z.object({
  token: tokenSchema,
}).strict();

const passwordResetConfirmSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
}).strict();

const socialHandoffExchangeSchema = z.object({
  code: tokenSchema,
}).strict();

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  profession: z.string().trim().max(120).optional(),
}).strict();

const updateSettingsSchema = z.object({
  language: z.enum(["es", "en"]).optional(),
  heightUnit: z.enum(["metric", "imperial"]).optional(),
  genderIdentity: z.string().trim().max(64).optional(),
  pronouns: z.string().trim().max(64).optional(),
  personality: z.string().trim().max(64).optional(),
}).strict();

const providerSchema = z.enum(["google", "facebook", "apple"]);

type SupportedProvider = z.infer<typeof providerSchema>;

@ApiTags(API_TAGS.auth)
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  private getAuthorizationHeader(req: Request) {
    return typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : undefined;
  }

  private getClientIp(req: Request) {
    return req.ip || req.socket.remoteAddress || "unknown";
  }

  private getRequestId(req: Request) {
    const header = req.headers["x-matcha-request-id"];
    if (typeof header === "string" && header.trim()) {
      return header.trim();
    }
    if (Array.isArray(header) && header[0]?.trim()) {
      return header[0].trim();
    }
    return undefined;
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
    if (error instanceof UnauthorizedException) {
      const message =
        error.message || error.getResponse?.()?.toString?.() || "UNAUTHORIZED";
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: message });
    }
    if (error instanceof Error && error.name === "UnauthorizedException") {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        error: error.message || "UNAUTHORIZED",
      });
    }
    console.error(error);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: "INTERNAL_SERVER_ERROR" });
  }

  private async assertAuthIdentifierLimit(
    route: string,
    identifier: string,
    max: number
  ) {
    await assertIdentifierRateLimit({
      route,
      identifier,
      windowMs: 15 * 60 * 1000,
      max,
    });
  }

  private async assertAuthRouteIpLimit(req: Request, route: string, max: number) {
    await assertRouteIpRateLimit({
      route,
      ip: this.getClientIp(req),
      method: req.method,
      windowMs: 15 * 60 * 1000,
      max,
    });
  }

  private sendRateLimitError(
    req: Request,
    res: Response,
    error: RateLimitExceededError
  ) {
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
    return res.status(429).json({
      error: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again later.",
    });
  }

  @Get("providers")
  @ApiOperation({ summary: "List enabled authentication providers" })
  getProviders() {
    return this.authService.providerAvailability();
  }

  @Post("sign-up")
  @ApiOperation({ summary: "Create a new email and password account" })
  async signUp(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const input = signUpSchema.parse(body);
      await this.assertAuthRouteIpLimit(req, "sign-up", runtimeConfig.rateLimit.auth.signUp.ipMax);
      await this.assertAuthIdentifierLimit(
        "sign-up",
        input.email,
        runtimeConfig.rateLimit.auth.signUp.identifierMax
      );
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
      if (error instanceof RateLimitExceededError) {
        return this.sendRateLimitError(req, res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("sign-in")
  @ApiOperation({ summary: "Sign in with email and password" })
  async signIn(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const input = signInSchema.parse(body);
      await this.assertAuthRouteIpLimit(req, "sign-in", runtimeConfig.rateLimit.auth.signIn.ipMax);
      await this.assertAuthIdentifierLimit(
        "sign-in",
        input.email,
        runtimeConfig.rateLimit.auth.signIn.identifierMax
      );
      const result = await this.authService.signIn(input, {
        requestId: this.getRequestId(req),
      });
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
      if (error instanceof RateLimitExceededError) {
        return this.sendRateLimitError(req, res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("refresh")
  @ApiOperation({ summary: "Exchange a refresh token for a new session" })
  async refresh(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const { refreshToken } = refreshSchema.parse(body);
      await this.assertAuthRouteIpLimit(req, "refresh", runtimeConfig.rateLimit.auth.refresh.ipMax);
      await this.assertAuthIdentifierLimit(
        "refresh",
        refreshToken,
        runtimeConfig.rateLimit.auth.refresh.identifierMax
      );
      const result = await this.authService.refresh(refreshToken, {
        requestId: this.getRequestId(req),
      });
      if ("error" in result) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_REFRESH_PAYLOAD", error);
      }
      if (error instanceof RateLimitExceededError) {
        return this.sendRateLimitError(req, res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("sign-out")
  @ApiOperation({ summary: "Invalidate the current access token" })
  async signOut(@Req() req: Request, @Res() res: Response) {
    try {
      await this.authService.signOut(this.getAuthorizationHeader(req));
      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Post("verify-email")
  @ApiOperation({ summary: "Confirm an email verification token" })
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
  @ApiOperation({ summary: "Resolve the verification confirmation redirect" })
  async verifyEmailConfirm(@Query("token") token: string | undefined, @Res() res: Response) {
    const target = await this.authService.getVerificationConfirmRedirect(String(token || ""));
    return res.redirect(target);
  }

  @Post("verify-email/resend")
  @ApiOperation({ summary: "Resend the verification email for an account" })
  async resendVerificationEmail(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response
  ) {
    try {
      const input = resendVerificationSchema.parse(body);
      await this.assertAuthRouteIpLimit(
        req,
        "verify-email/resend",
        runtimeConfig.rateLimit.auth.verifyEmailResend.ipMax
      );
      await this.assertAuthIdentifierLimit(
        "verify-email/resend",
        input.email,
        runtimeConfig.rateLimit.auth.verifyEmailResend.identifierMax
      );
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
      if (error instanceof RateLimitExceededError) {
        return this.sendRateLimitError(req, res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("verification-status")
  @ApiOperation({ summary: "Check whether an email address is verified" })
  async getVerificationStatus(@Body() body: unknown, @Res() res: Response) {
    try {
      const input = verificationStatusSchema.parse(body);
      return res.json(
        await this.authService.getVerificationStatus({ email: input.email })
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_VERIFICATION_STATUS_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("password-reset/request")
  @ApiOperation({ summary: "Start the password reset flow" })
  async requestPasswordReset(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response
  ) {
    try {
      const input = passwordResetRequestSchema.parse(body);
      await this.assertAuthRouteIpLimit(
        req,
        "password-reset/request",
        runtimeConfig.rateLimit.auth.passwordResetRequest.ipMax
      );
      await this.assertAuthIdentifierLimit(
        "password-reset/request",
        input.email,
        runtimeConfig.rateLimit.auth.passwordResetRequest.identifierMax
      );
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
      if (error instanceof RateLimitExceededError) {
        return this.sendRateLimitError(req, res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("password-reset/validate")
  @ApiOperation({ summary: "Validate a password reset token without consuming it" })
  async validatePasswordReset(@Body() body: unknown, @Res() res: Response) {
    try {
      const input = passwordResetValidateSchema.parse(body);
      const result = await this.authService.validatePasswordResetToken(input.token);
      if ("error" in result) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_PASSWORD_RESET_VALIDATE_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Post("password-reset/confirm")
  @ApiOperation({ summary: "Finish the password reset flow with a new password" })
  async confirmPasswordReset(@Req() req: Request, @Body() body: unknown, @Res() res: Response) {
    try {
      const input = passwordResetConfirmSchema.parse(body);
      await this.assertAuthRouteIpLimit(
        req,
        "password-reset/confirm",
        runtimeConfig.rateLimit.auth.passwordResetConfirm.ipMax
      );
      await this.assertAuthIdentifierLimit(
        "password-reset/confirm",
        input.token,
        runtimeConfig.rateLimit.auth.passwordResetConfirm.identifierMax
      );
      const result = await this.authService.confirmPasswordReset(input);
      if ("error" in result) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_PASSWORD_RESET_CONFIRM_PAYLOAD", error);
      }
      if (error instanceof RateLimitExceededError) {
        return this.sendRateLimitError(req, res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Get("me")
  @ApiOperation({ summary: "Get the current authenticated account" })
  async getMe(@Req() req: Request, @Res() res: Response) {
    try {
      return res.json(await this.authService.getMe(this.getAuthorizationHeader(req)));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Patch("me")
  @ApiOperation({ summary: "Update the current authenticated account profile basics" })
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
  @ApiOperation({ summary: "Mark onboarding as completed for the current account" })
  async completeOnboarding(@Req() req: Request, @Res() res: Response) {
    try {
      return res.json(
        await this.authService.completeOnboarding(this.getAuthorizationHeader(req), {
          requestId: this.getRequestId(req),
        })
      );
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Get("settings")
  @ApiOperation({ summary: "Get the current authenticated account settings" })
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
  @ApiOperation({ summary: "Update the current authenticated account settings" })
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

  @Delete("me")
  @ApiOperation({ summary: "Delete the current authenticated account" })
  async deleteMe(@Req() req: Request, @Res() res: Response) {
    try {
      return res.json(
        await this.authService.deleteAccount(this.getAuthorizationHeader(req))
      );
    } catch (error) {
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
  @ApiOperation({ summary: "Start the social authentication redirect flow" })
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
  @ApiOperation({ summary: "Handle a social authentication callback via GET" })
  async socialCallbackGet(
    @Param("provider") provider: string,
    @Query() query: Record<string, unknown>,
    @Res() res: Response
  ) {
    return this.handleSocialCallback(provider, query, {}, res);
  }

  @Post("social/callback/:provider")
  @ApiOperation({ summary: "Handle a social authentication callback via POST" })
  async socialCallbackPost(
    @Param("provider") provider: string,
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
    @Res() res: Response
  ) {
    return this.handleSocialCallback(provider, query, body, res);
  }

  @Post("social/exchange")
  @ApiOperation({ summary: "Exchange a short-lived social auth handoff code" })
  async exchangeSocialHandoff(@Body() body: unknown, @Res() res: Response) {
    try {
      const input = socialHandoffExchangeSchema.parse(body);
      const result = await this.authService.exchangeSocialHandoffCode(input.code);
      if ("error" in result) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.sendZodError(res, "INVALID_SOCIAL_HANDOFF_PAYLOAD", error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }
}
