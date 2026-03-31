import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { EmailService } from "../email/email.service";
import { HealthService } from "./health.service";
import { API_TAGS } from "../../docs/openapi/tags";

@ApiTags(API_TAGS.health)
@Controller("healthz")
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
    @Inject(EmailService) private readonly emailService: EmailService
  ) {}

  @Get()
  @ApiOperation({ summary: "Check API liveness" })
  check() {
    return this.healthService.checkLiveness();
  }

  @Get("ready")
  @ApiOperation({ summary: "Check API readiness and backing dependencies" })
  async readiness() {
    try {
      const status = await this.healthService.getReadinessStatus();
      if (!status.ready) {
        throw new ServiceUnavailableException(status);
      }
      return status;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException({
        dbConnected: false,
        missingRelations: [],
        missingColumns: [],
        seededCategoryCount: 0,
        seededTemplateCount: 0,
        ready: false,
      });
    }
  }

  @Get("email")
  @ApiOperation({ summary: "Check configured email delivery health" })
  emailHealth() {
    return this.emailService.getHealthStatus();
  }
}
