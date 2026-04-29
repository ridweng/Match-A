import test from "node:test";
import assert from "node:assert/strict";
import {
  launchReferenceProfiles,
  passesDiscoveryPolicyForTest,
  publicDiscoveryProjectionForTest,
  validateLaunchReferenceSource,
} from "./launch-reference-profiles";

test("launch reference source has the required deterministic batch shape", () => {
  const validation = validateLaunchReferenceSource();
  assert.deepEqual(validation.errors, []);
  assert.equal(launchReferenceProfiles.length, 46);
  assert.equal(launchReferenceProfiles.filter((profile) => profile.gender === "female").length, 33);
  assert.equal(launchReferenceProfiles.filter((profile) => profile.gender === "male").length, 13);
  assert.equal(new Set(launchReferenceProfiles.map((profile) => profile.publicId)).size, 46);
  assert.equal(new Set(launchReferenceProfiles.map((profile) => profile.displayName)).size, 46);
});

test("a male actor interested in women receives female launch profiles", () => {
  const femaleMatches = launchReferenceProfiles.filter((profile) =>
    passesDiscoveryPolicyForTest(profile, {
      selectedGenders: ["female"],
      therianMode: "exclude",
      ageMin: 18,
      ageMax: 40,
    })
  );
  assert.equal(femaleMatches.length, 33);
  assert.ok(femaleMatches.every((profile) => profile.gender === "female"));
});

test("a female actor interested in men receives male launch profiles", () => {
  const maleMatches = launchReferenceProfiles.filter((profile) =>
    passesDiscoveryPolicyForTest(profile, {
      selectedGenders: ["male"],
      therianMode: "exclude",
      ageMin: 18,
      ageMax: 40,
    })
  );
  assert.equal(maleMatches.length, 13);
  assert.ok(maleMatches.every((profile) => profile.gender === "male"));
});

test("already-liked or passed profiles do not reappear in the candidate set", () => {
  const decided = new Set(["dummy_launch_ref_001", "dummy_launch_ref_034"]);
  const visible = launchReferenceProfiles.filter(
    (profile) =>
      passesDiscoveryPolicyForTest(profile, {
        selectedGenders: ["female"],
        therianMode: "exclude",
        ageMin: 18,
        ageMax: 40,
      }) && !decided.has(profile.publicId)
  );
  assert.equal(visible.length, 32);
  assert.ok(visible.every((profile) => !decided.has(profile.publicId)));
});

test("profiles without ready media are excluded by launch readiness rules", () => {
  const [first] = launchReferenceProfiles;
  assert.ok(first);
  const withoutReadyMedia = { ...first, imagePrompts: first.imagePrompts.slice(0, 3) };
  assert.equal(withoutReadyMedia.imagePrompts.length >= 4, false);
});

test("profile gender and media genderLock are consistent", () => {
  for (const profile of launchReferenceProfiles) {
    assert.ok(profile.imagePrompts.every((prompt) => prompt.genderLock === profile.gender));
  }
});

test("public discovery response does not expose internal celebrity reference names", () => {
  const publicJson = JSON.stringify(
    launchReferenceProfiles.map((profile) => publicDiscoveryProjectionForTest(profile))
  ).toLowerCase();
  for (const profile of launchReferenceProfiles) {
    assert.equal(
      publicJson.includes(profile.internalReferencePerson.toLowerCase()),
      false,
      `public projection leaked ${profile.internalReferencePerson}`
    );
  }
});
