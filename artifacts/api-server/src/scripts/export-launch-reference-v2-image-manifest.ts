import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import {
  LAUNCH_REFERENCE_V2_BATCH_KEY,
  LAUNCH_REFERENCE_V2_GENERATION_VERSION,
  LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER,
  launchReferenceV2Profiles,
  validateLaunchReferenceV2Source,
} from "../seeds/launch-reference-profiles-v2";

const outputDir = path.join(process.cwd(), "artifacts", "api-server", "generated");
const resolvedOutputDir =
  path.basename(process.cwd()) === "api-server" ? path.join(process.cwd(), "generated") : outputDir;
const jsonPath = path.join(resolvedOutputDir, "launch-reference-v2-image-manifest.json");
const jsonlPath = path.join(resolvedOutputDir, "launch-reference-v2-image-manifest.jsonl");

function assertNoInternalReferenceLeak() {
  const errors: string[] = [];
  for (const profile of launchReferenceV2Profiles) {
    const internal = profile.internalReferencePerson.toLowerCase();
    for (const prompt of profile.imagePrompts) {
      if (prompt.prompt.toLowerCase().includes(internal)) {
        errors.push(`${profile.publicId} prompt leaks internal reference`);
      }
    }
  }
  if (errors.length) {
    throw new Error(`Manifest validation failed:\n${errors.join("\n")}`);
  }
}

async function main() {
  const validation = validateLaunchReferenceV2Source();
  if (!validation.ok) {
    throw new Error(`Launch reference V2 source validation failed:\n${validation.errors.join("\n")}`);
  }
  assertNoInternalReferenceLeak();

  const items = launchReferenceV2Profiles.flatMap((profile) =>
    profile.imagePrompts.map((prompt) => ({
      batchKey: LAUNCH_REFERENCE_V2_BATCH_KEY,
      generationVersion: LAUNCH_REFERENCE_V2_GENERATION_VERSION,
      generationVersionNumber: LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER,
      publicId: profile.publicId,
      displayName: profile.displayName,
      gender: profile.gender,
      age: profile.age,
      city: profile.city,
      country: profile.country,
      sortOrder: prompt.sortOrder,
      kind: prompt.kind,
      identitySeed: prompt.identitySeed,
      targetStorageKey: prompt.targetStorageKey,
      expectedHostPath: `/srv/matcha/media/${prompt.targetStorageKey}`,
      expectedContainerPath: `/app/artifacts/api-server/storage/media/${prompt.targetStorageKey}`,
      prompt: prompt.prompt,
      negativePrompt: prompt.negativePrompt,
    }))
  );

  fs.mkdirSync(resolvedOutputDir, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(items, null, 2)}\n`);
  fs.writeFileSync(jsonlPath, `${items.map((item) => JSON.stringify(item)).join("\n")}\n`);

  console.log("[api-server] launch reference V2 image manifest exported", {
    profiles: launchReferenceV2Profiles.length,
    female: launchReferenceV2Profiles.filter((profile) => profile.gender === "female").length,
    male: launchReferenceV2Profiles.filter((profile) => profile.gender === "male").length,
    imagePrompts: items.length,
    jsonPath,
    jsonlPath,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
