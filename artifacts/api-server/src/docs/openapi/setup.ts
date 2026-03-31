import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MATCHA_BEARER_AUTH } from "./security";

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle("Matcha API")
    .setDescription(
      "Canonical API contract for the Matcha backend. Target OpenAPI 3.1 where the active toolchain remains smooth."
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Bearer access token returned by Matcha authentication endpoints.",
      },
      MATCHA_BEARER_AUTH
    );

  if (typeof (builder as any).setOpenAPIVersion === "function") {
    (builder as any).setOpenAPIVersion("3.1.0");
  }

  return SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, "")}_${methodKey}`,
  });
}

export function setupSwaggerUi(app: INestApplication, document: OpenAPIObject) {
  SwaggerModule.setup("docs", app, document, {
    useGlobalPrefix: true,
    customSiteTitle: "Matcha Internal API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: "none",
      displayRequestDuration: true,
    },
  });
}

export function exportOpenApiDocument(document: OpenAPIObject) {
  const outputDir = join(process.cwd(), "..", "..", "docs", "api");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "openapi.json"), JSON.stringify(document, null, 2));
}

export function renderScalarReferenceHtml(specUrl: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Matcha API Reference</title>
    <style>
      body { margin: 0; background: #0b1110; }
      #app { height: 100vh; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '${specUrl}',
        theme: 'purple',
        layout: 'modern',
        darkMode: true,
        hideDownloadButton: false,
      });
    </script>
  </body>
</html>`;
}
