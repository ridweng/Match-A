import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { runtimeConfig } from "../../config/runtime";
import { AdminService } from "./admin.service";

@ApiExcludeController()
@Controller("admin")
export class AdminOpsController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  private authorize(req: Request, res: Response) {
    if (!runtimeConfig.admin.enabled) {
      res.status(404).send("Not found");
      return false;
    }

    const header = String(req.headers.authorization || "");
    if (!header.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Matcha Admin"');
      res.status(401).send("Unauthorized");
      return false;
    }

    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const [username, password] = decoded.split(":");
    const provided = Buffer.from(`${username || ""}:${password || ""}`);
    const expected = Buffer.from(
      `${runtimeConfig.admin.username}:${runtimeConfig.admin.password}`
    );
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Matcha Admin"');
      res.status(401).send("Unauthorized");
      return false;
    }

    return true;
  }

  private sendJson(res: Response, payload: unknown) {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      fetchedAt: new Date().toISOString(),
      data: payload,
    });
  }

  @Get("generated-batches")
  async generatedBatches(@Req() req: Request, @Res() res: Response) {
    if (!this.authorize(req, res)) return;
    const batches = await this.adminService.getGeneratedBatches({
      bypassCache: req.query.refresh === "1" || req.query.refresh === "true",
    });
    this.sendJson(res, { batches });
  }

  @Post("generated-batches/:batchKey/:generationVersion/delete-preview")
  async generatedBatchDeletePreview(
    @Req() req: Request,
    @Res() res: Response,
    @Param("batchKey") batchKey: string,
    @Param("generationVersion") generationVersionRaw: string
  ) {
    if (!this.authorize(req, res)) return;
    const generationVersion = Number(generationVersionRaw);
    if (!Number.isFinite(generationVersion)) {
      res.status(400).json({ error: "INVALID_GENERATION_VERSION" });
      return;
    }
    const preview = await this.adminService.previewGeneratedBatchDelete(
      batchKey,
      generationVersion
    );
    this.sendJson(res, preview);
  }

  @Delete("generated-batches/:batchKey/:generationVersion")
  async deleteGeneratedBatch(
    @Req() req: Request,
    @Res() res: Response,
    @Param("batchKey") batchKey: string,
    @Param("generationVersion") generationVersionRaw: string,
    @Body()
    body: {
      confirmBatchKey?: string;
      confirmGenerationVersion?: number;
    }
  ) {
    if (!this.authorize(req, res)) return;
    const generationVersion = Number(generationVersionRaw);
    if (!Number.isFinite(generationVersion)) {
      res.status(400).json({ error: "INVALID_GENERATION_VERSION" });
      return;
    }

    try {
      const summary = await this.adminService.deleteGeneratedBatch(batchKey, generationVersion, {
        confirmBatchKey: String(body?.confirmBatchKey || ""),
        confirmGenerationVersion: Number(body?.confirmGenerationVersion),
      });
      this.sendJson(res, summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      res.status(400).json({ error: message });
    }
  }

  @Get("profiles/:publicId")
  async profileDetail(
    @Req() req: Request,
    @Res() res: Response,
    @Param("publicId") publicId: string
  ) {
    if (!this.authorize(req, res)) return;
    const detail = await this.adminService.getProfileDetail(publicId);
    if (!detail) {
      res.status(404).json({ error: "PROFILE_NOT_FOUND" });
      return;
    }
    this.sendJson(res, detail);
  }
}
