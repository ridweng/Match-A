import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { MediaService } from "./media.service";

@Controller("media")
export class MediaController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(MediaService) private readonly mediaService: MediaService
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

  @Get("profile-images")
  async listProfileImages(@Req() req: Request, @Res() res: Response) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      return res.json(await this.mediaService.listProfileImages(auth.user.id));
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Post("profile-images")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async uploadProfileImage(
    @Req() req: Request,
    @UploadedFile() file: any,
    @Res() res: Response
  ) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      const sortOrder = Number((req.body as Record<string, unknown>)?.sortOrder ?? 0);
      if (!Number.isFinite(sortOrder) || sortOrder < 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: "INVALID_PROFILE_IMAGE_SORT_ORDER",
        });
      }

      return res.json(
        await this.mediaService.uploadProfileImage(auth.user.id, sortOrder, file)
      );
    } catch (error) {
      if (error instanceof Error && error.message) {
        if (error.message === "MEDIA_FILE_REQUIRED") {
          return res
            .status(HttpStatus.BAD_REQUEST)
            .json({ error: "MEDIA_FILE_REQUIRED" });
        }
        return this.sendAuthError(res, error);
      }
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: "INTERNAL_SERVER_ERROR" });
    }
  }

  @Delete("profile-images/:profileImageId")
  async deleteProfileImage(
    @Req() req: Request,
    @Param("profileImageId", ParseIntPipe) profileImageId: number,
    @Res() res: Response
  ) {
    try {
      const auth = await this.authService.authenticate(this.getAuthorizationHeader(req));
      await this.mediaService.deleteProfileImage(auth.user.id, profileImageId);
      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      return this.sendAuthError(res, error);
    }
  }

  @Get("public/:mediaAssetId")
  async getPublicMedia(
    @Param("mediaAssetId", ParseIntPipe) mediaAssetId: number,
    @Res() res: Response
  ) {
    const asset = await this.mediaService.getPublicMediaFile(mediaAssetId);
    if (!asset) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: "MEDIA_NOT_FOUND" });
    }
    res.type(asset.mimeType);
    return res.sendFile(asset.absolutePath);
  }
}
