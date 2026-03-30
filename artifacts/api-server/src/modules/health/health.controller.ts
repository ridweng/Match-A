import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { EmailService } from "../email/email.service";
import { HealthService } from "./health.service";

@Controller("healthz")
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
    @Inject(EmailService) private readonly emailService: EmailService
  ) {}

  @Get()
  check() {
    return this.healthService.checkLiveness();
  }

  @Get("ready")
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
  emailHealth() {
    return this.emailService.getHealthStatus();
  }
}
