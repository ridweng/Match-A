import "reflect-metadata";
import type { OpenAPIObject } from "@nestjs/swagger";
import { loadApiEnv } from "../config/env";

async function main() {
  loadApiEnv();

  const [{ NestFactory }, { AppModule }, { createOpenApiDocument, exportOpenApiDocument }] =
    await Promise.all([
      import("@nestjs/core"),
      import("../app.module"),
      import("../docs/openapi/setup"),
    ]);

  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  app.setGlobalPrefix("api");
  const document: OpenAPIObject = createOpenApiDocument(app);
  exportOpenApiDocument(document);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
