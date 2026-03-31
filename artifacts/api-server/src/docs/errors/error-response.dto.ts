import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ErrorResponseDto {
  @ApiProperty({
    description: "Stable machine-readable error code.",
    example: "UNAUTHORIZED",
  })
  error!: string;

  @ApiPropertyOptional({
    description: "Optional human-readable explanation.",
    example: "The access token is invalid or expired.",
  })
  message?: string;
}

export class ValidationIssueDto {
  @ApiPropertyOptional({
    description: "Validation errors keyed by field when available.",
    example: ["Required"],
    type: [String],
  })
  _errors?: string[];
}

export class ValidationErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: "Flattened validation issues produced by request validation.",
    example: {
      formErrors: [],
      fieldErrors: {
        email: ["Invalid email"],
      },
    },
  })
  issues!: Record<string, unknown>;
}

