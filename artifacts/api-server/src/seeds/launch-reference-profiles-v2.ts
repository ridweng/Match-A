import { DEFAULT_PREFERENCE_VALUES } from "../modules/goals/default-goals";
import {
  DISCOVERY_POLICY_V1,
  evaluateGenderTherianReason,
  type DiscoveryFilters,
} from "../modules/discovery/discovery.policy";

export const LAUNCH_REFERENCE_V2_BATCH_KEY = "launch_reference_v2";
export const LAUNCH_REFERENCE_V2_GENERATION_VERSION = "premium_synthetic_v2";
export const LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER = 201;
export const LAUNCH_REFERENCE_V2_NEGATIVE_PROMPT =
  "wrong gender, male face on female profile, female face on male profile, beard on female profile, moustache on female profile, child, underage, watermark, text, logo, real celebrity, public figure, exact likeness, clone, deepfake";

export type Gender = "female" | "male";
export type GoalCategory =
  | "physical"
  | "personality"
  | "family"
  | "expectations"
  | "language"
  | "studies";

export type LaunchReferenceV2ImagePrompt = {
  kind: "primary_face_portrait" | "full_body_lifestyle" | "activity_social";
  identitySeed: string;
  genderLock: Gender;
  ageBand: string;
  styleAestheticDirection: string;
  prompt: string;
  negativePrompt: string;
  sortOrder: number;
  targetStorageKey: string;
};

export type LaunchReferenceV2Profile = {
  internalReferencePerson: string;
  internalReferenceOnly: true;
  publicId: string;
  email: string;
  displayName: string;
  age: number;
  dateOfBirth: string;
  gender: Gender;
  interestedIn: Gender[];
  city: string;
  country: string;
  occupation: string;
  shortBio: string;
  longBio: string;
  shortBioEs: string;
  longBioEs: string;
  relationshipGoal: string;
  languages: string[];
  interests: string[];
  lifestyle: {
    personality: string;
    education: string;
    childrenPreference: string;
    physicalActivity: string;
    alcoholUse: string;
    tobaccoUse: string;
    politicalInterest: string;
    religionImportance: string;
    religion: string;
    bodyType: string;
    height: string;
    hairColor: string;
    ethnicity: string;
  };
  categoryValues: Record<GoalCategory, string>;
  profileAesthetic: string;
  imageCount: 2 | 3;
  imagePrompts: LaunchReferenceV2ImagePrompt[];
  validationStatus: "ready";
};

export const LAUNCH_REFERENCE_V2_EXTRA_PREFERENCE_VALUES = [
  "empathetic",
  "curious",
  "playful",
  "calm",
  "adventurous",
  "thoughtful",
  "analytical",
  "emotional",
  "introverted",
  "rational",
  "reflective",
].map((valueKey, index) => ({
  categoryCode: "personality" as const,
  valueKey,
  labelEs: valueKey.replace(/_/g, " "),
  labelEn: valueKey.replace(/_/g, " "),
  sortOrder: index,
}));

const internalReferences = [
  "Zendaya",
  "Dua Lipa",
  "Taylor Swift",
  "Rihanna",
  "Margot Robbie",
  "Emma Watson",
  "Ana de Armas",
  "Gal Gadot",
  "Blake Lively",
  "Selena Gomez",
  "Ariana Grande",
  "Beyonce",
  "Jennifer Lawrence",
  "Anne Hathaway",
  "Natalie Portman",
  "Charlize Theron",
  "Penelope Cruz",
  "Salma Hayek",
  "Shakira",
  "Sofia Vergara",
  "Priyanka Chopra",
  "Aishwarya Rai",
  "Jisoo from BLACKPINK",
  "Henry Cavill",
  "Chris Hemsworth",
  "Michael B. Jordan",
  "Ryan Gosling",
  "Timothee Chalamet",
  "Harry Styles",
  "Pedro Pascal",
  "Oscar Isaac",
  "Zayn Malik",
  "David Beckham",
] as const;

const names = [
  "Alba Marín",
  "Inés Valera",
  "Camila Rojas",
  "Lucía Serrano",
  "Valentina Cruz",
  "Clara Bennett",
  "Nora Hart",
  "Emilia Laurent",
  "Sofia Duarte",
  "Lara Weiss",
  "Amara Silva",
  "Paloma Reyes",
  "Isabel Costa",
  "Elena Ward",
  "Maya Laurent",
  "Julieta Vega",
  "Carmen Sol",
  "Noa Keller",
  "Bianca Moretti",
  "Marina Alves",
  "Anika Rao",
  "Leila Haddad",
  "Hana Sato",
  "Mateo Vidal",
  "Rafael Stone",
  "Tomás Archer",
  "Diego Morel",
  "Nicolás Vale",
  "Julian Reed",
  "Gabriel Costa",
  "Oscar Bennett",
  "Amir Nasser",
  "Kenji Mori",
] as const;

const locations = [
  ["Santiago", "Chile"],
  ["Valparaíso", "Chile"],
  ["Buenos Aires", "Argentina"],
  ["Bogotá", "Colombia"],
  ["Ciudad de México", "Mexico"],
  ["Lima", "Peru"],
  ["Madrid", "Spain"],
  ["Barcelona", "Spain"],
  ["Lisbon", "Portugal"],
  ["Paris", "France"],
  ["Milan", "Italy"],
  ["London", "United Kingdom"],
  ["Berlin", "Germany"],
  ["Amsterdam", "Netherlands"],
  ["Copenhagen", "Denmark"],
  ["Santiago", "Chile"],
  ["Buenos Aires", "Argentina"],
  ["Madrid", "Spain"],
  ["Lisbon", "Portugal"],
  ["Barcelona", "Spain"],
  ["Mumbai", "India"],
  ["Dubai", "United Arab Emirates"],
  ["Paris", "France"],
  ["Santiago", "Chile"],
  ["Valparaíso", "Chile"],
  ["Buenos Aires", "Argentina"],
  ["Bogotá", "Colombia"],
  ["Ciudad de México", "Mexico"],
  ["London", "United Kingdom"],
  ["Lisbon", "Portugal"],
  ["Berlin", "Germany"],
  ["Madrid", "Spain"],
  ["Tokyo", "Japan"],
] as const;

const occupations = [
  "Brand Strategist",
  "Music Producer",
  "Community Architect",
  "Restaurant Founder",
  "Film Curator",
  "Policy Researcher",
  "Product Designer",
  "Gallery Producer",
  "Editorial Stylist",
  "Climate Consultant",
  "Creative Director",
  "Cultural Researcher",
  "Hospitality Designer",
  "UX Strategist",
  "Urban Planner",
  "Documentary Producer",
  "Art Director",
  "Wellness Founder",
  "Fashion Buyer",
  "Travel Editor",
  "Health Tech Analyst",
  "Interior Architect",
  "Studio Photographer",
  "Wine Entrepreneur",
  "Fitness Founder",
  "Music Supervisor",
  "Restaurant Consultant",
  "Industrial Designer",
  "Menswear Buyer",
  "Marine Engineer",
  "Podcast Producer",
  "Hospitality Investor",
  "Game Designer",
] as const;

const ages = [
  27, 29, 31, 34, 28, 30, 32, 35, 26, 33, 24, 36, 38, 29, 41, 37, 42, 25, 34, 39, 30, 32, 28,
  35, 37, 31, 40, 27, 29, 42, 34, 33, 30,
] as const;

const aesthetics = [
  "Mediterranean-Latin editorial warmth",
  "sleek nocturnal music-scene confidence",
  "sunlit Andean city elegance",
  "soft restaurant-opening energy",
  "cinematic coastal glamour",
  "quiet academic polish",
  "clean modern design minimalism",
  "Parisian gallery sophistication",
  "Iberian editorial ease",
  "alpine city calm and refinement",
  "Afro-Latin luxury creative poise",
  "warm Chilean cultural intelligence",
  "Portuguese coastal elegance",
  "London literary composure",
  "Nordic wellness minimalism",
  "Argentine documentary warmth",
  "Spanish classic cinema mood",
  "Amsterdam cycling lifestyle ease",
  "Italian fashion-week polish",
  "Brazilian-Portuguese travel energy",
  "South Asian contemporary professional glow",
  "Middle Eastern modern architectural elegance",
  "Japanese-French studio softness",
  "Chilean vineyard weekend style",
  "British athletic editorial confidence",
  "Argentine arts-district ease",
  "Colombian creative hospitality charm",
  "Mexican design-forward warmth",
  "London music-culture polish",
  "Portuguese Atlantic outdoors energy",
  "Berlin late-summer creative calm",
  "Madrid rooftop evening refinement",
  "Tokyo premium urban minimalism",
] as const;

const personalities = [
  "empathetic",
  "curious",
  "playful",
  "calm",
  "adventurous",
  "thoughtful",
  "analytical",
  "emotional",
  "introverted",
  "rational",
  "reflective",
] as const;
const physicalValues = ["slim", "lean", "athletic", "medium_build", "compact_build", "curvy", "toned"] as const;
const relationshipGoals = ["stable_relationship", "still_figuring_it_out", "making_friends", "nothing_serious"] as const;
const educationLevels = ["high_school", "technical_school", "university_student", "bachelors_degree", "masters_degree", "doctorate"] as const;
const familyValues = ["want_children", "have_and_want_more", "have_and_dont_want_more", "not_sure", "dont_want_children"] as const;
const languageCodes = ["en", "es", "fr", "de", "it", "pt", "ca"] as const;
const interestCodes = ["music", "travel", "fitness", "books", "food", "cinema", "hiking", "art", "coffee", "design"] as const;

export const LAUNCH_REFERENCE_V2_PHYSICAL_VALUES = [
  {
    categoryCode: "physical" as const,
    valueKey: "toned",
    labelEs: "Tonificado",
    labelEn: "Toned",
    sortOrder: 11,
    ordinalRank: 11,
  },
];

function pick<T>(values: readonly T[], index: number, offset = 0) {
  return values[(index + offset) % values.length]!;
}

function dateFromAge(age: number, index: number) {
  const year = 2026 - age;
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String(((index * 5) % 27) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ageBand(age: number) {
  if (age < 30) return "late twenties";
  if (age < 35) return "early thirties";
  if (age < 40) return "late thirties";
  return "early forties";
}

function identitySeed(index: number) {
  return `launch_v2_${String(index + 1).padStart(3, "0")}_original`;
}

function storageKey(publicId: string, sortOrder: number) {
  return `synthetic/${LAUNCH_REFERENCE_V2_BATCH_KEY}/${publicId}/${sortOrder}.jpg`;
}

function buildPrompts(
  profile: Pick<LaunchReferenceV2Profile, "publicId" | "displayName" | "gender" | "age" | "profileAesthetic" | "imageCount">,
  index: number
): LaunchReferenceV2ImagePrompt[] {
  const seed = identitySeed(index);
  const base =
    `Synthetic fictional ${profile.gender} dating profile subject, identity seed ${seed}, ${ageBand(profile.age)}, ` +
    `${profile.profileAesthetic}, original face, not a real person, not a public figure, not a celebrity likeness, ` +
    `not a clone, natural proportions, realistic premium dating app photography`;
  const promptDetails = [
    ["primary_face_portrait", "primary face portrait, direct but relaxed eye contact, clean background, modern styling, warm natural light"],
    ["full_body_lifestyle", "full-body lifestyle image, polished city or travel setting, confident natural posture, believable candid motion"],
    ["activity_social", "activity/social image, tasteful premium lifestyle context, warm candid moment, friends implied but not prominent"],
  ] as const;

  return promptDetails.slice(0, profile.imageCount).map(([kind, detail], sortOrder) => ({
    kind,
    identitySeed: seed,
    genderLock: profile.gender,
    ageBand: ageBand(profile.age),
    styleAestheticDirection: profile.profileAesthetic,
    prompt: `${base}, ${detail}.`,
    negativePrompt: LAUNCH_REFERENCE_V2_NEGATIVE_PROMPT,
    sortOrder,
    targetStorageKey: storageKey(profile.publicId, sortOrder),
  }));
}

function buildProfile(index: number): LaunchReferenceV2Profile {
  const publicId = `dummy_launch_v2_${String(index + 1).padStart(3, "0")}`;
  const gender: Gender = index < 23 ? "female" : "male";
  const [city, country] = locations[index]!;
  const age = ages[index]!;
  const displayName = names[index]!;
  const firstName = displayName.split(" ")[0]!;
  const languagePrimary = index < 8 || [15, 16, 23, 24, 25, 26, 27, 31].includes(index) ? "es" : pick(languageCodes, index);
  const languages = Array.from(new Set([languagePrimary, "en", pick(languageCodes, index, 3)]));
  const interests = Array.from(new Set([pick(interestCodes, index), pick(interestCodes, index, 3), pick(interestCodes, index, 6)]));
  const imageCount: 2 | 3 = index < 10 ? 3 : 2;
  const relationshipGoal = pick(relationshipGoals, index);
  const personality = pick(personalities, index);
  const education = pick(educationLevels, index);
  const childrenPreference = pick(familyValues, index);
  const bodyType = pick(physicalValues, index);
  const interestedIn: Gender[] =
    index === 5 || index === 17
      ? ["female"]
      : index === 28 || index === 31
        ? ["female", "male"]
        : [gender === "female" ? "male" : "female"];

  const partial = {
    publicId,
    displayName,
    gender,
    age,
    profileAesthetic: aesthetics[index]!,
    imageCount,
  };

  return {
    internalReferencePerson: internalReferences[index]!,
    internalReferenceOnly: true,
    publicId,
    email: `dummy+${LAUNCH_REFERENCE_V2_BATCH_KEY}-${String(index + 1).padStart(3, "0")}@matcha.local`,
    displayName,
    age,
    dateOfBirth: dateFromAge(age, index),
    gender,
    interestedIn,
    city,
    country,
    occupation: occupations[index]!,
    shortBio: `${firstName} likes intentional plans, playful conversation, and weekends that mix good food with a little movement.`,
    longBio: `${firstName} keeps a grounded rhythm between work, friends, movement, and creative curiosity. They appreciate direct communication, emotional steadiness, and dates that feel thoughtful without becoming too formal.`,
    shortBioEs: `${firstName} disfruta los planes con intención, las conversaciones con humor y los fines de semana con buena comida y algo de movimiento.`,
    longBioEs: `${firstName} mantiene un ritmo equilibrado entre trabajo, amistades, movimiento y curiosidad creativa. Valora la comunicación directa, la estabilidad emocional y las citas cuidadas sin sentirse demasiado formales.`,
    relationshipGoal,
    languages,
    interests,
    lifestyle: {
      personality,
      education,
      childrenPreference,
      physicalActivity: pick(["active", "moderate", "weekend_only"] as const, index),
      alcoholUse: pick(["socially", "rarely", "never"] as const, index),
      tobaccoUse: pick(["never", "occasionally"] as const, index),
      politicalInterest: pick(["low", "moderate", "high"] as const, index),
      religionImportance: pick(["not_important", "somewhat_important", "important"] as const, index),
      religion: pick(["none", "christian", "muslim", "spiritual"] as const, index),
      bodyType,
      height: String((gender === "female" ? 160 : 174) + ((index * 3) % 18)),
      hairColor: pick(["brown", "black", "blonde", "red"] as const, index),
      ethnicity: pick(["latinx", "white", "mixed", "asian", "black", "middle_eastern"] as const, index),
    },
    categoryValues: {
      physical: bodyType,
      personality,
      family: childrenPreference,
      expectations: relationshipGoal,
      language: languages[0]!,
      studies: education,
    },
    profileAesthetic: aesthetics[index]!,
    imageCount,
    imagePrompts: buildPrompts(partial, index),
    validationStatus: "ready",
  };
}

export const launchReferenceV2Profiles: LaunchReferenceV2Profile[] = Array.from(
  { length: 33 },
  (_, index) => buildProfile(index)
);

export type LaunchReferenceV2SourceValidation = {
  ok: boolean;
  errors: string[];
};

const celebrityTerms = internalReferences.flatMap((name) => {
  const lower = name.toLowerCase();
  return [lower, ...lower.split(/\s+/).filter((part) => part.length > 3)];
});

export function validateLaunchReferenceV2Source(): LaunchReferenceV2SourceValidation {
  const errors: string[] = [];
  const profiles = launchReferenceV2Profiles;
  const publicIds = new Set<string>();
  const namesSeen = new Set<string>();
  const validPreferenceValues = new Set(
    [
      ...DEFAULT_PREFERENCE_VALUES,
      ...LAUNCH_REFERENCE_V2_EXTRA_PREFERENCE_VALUES,
      ...LAUNCH_REFERENCE_V2_PHYSICAL_VALUES,
    ].map((value) => `${value.categoryCode}:${value.valueKey}`)
  );

  if (profiles.length !== 33) errors.push(`Expected 33 profiles, found ${profiles.length}`);
  if (profiles.filter((profile) => profile.gender === "female").length !== 23) {
    errors.push("Expected 23 female profiles");
  }
  if (profiles.filter((profile) => profile.gender === "male").length !== 10) {
    errors.push("Expected 10 male profiles");
  }
  const asiaMiddleEast = profiles.filter((profile) =>
    ["India", "United Arab Emirates", "Japan"].includes(profile.country)
  );
  if (asiaMiddleEast.length !== 3) errors.push(`Expected 3 Asia/Middle East profiles, found ${asiaMiddleEast.length}`);
  const totalPrompts = profiles.reduce((sum, profile) => sum + profile.imagePrompts.length, 0);
  if (totalPrompts !== 76) errors.push(`Expected 76 image prompts, found ${totalPrompts}`);

  for (const [index, profile] of profiles.entries()) {
    const expectedPublicId = `dummy_launch_v2_${String(index + 1).padStart(3, "0")}`;
    if (profile.publicId !== expectedPublicId) errors.push(`${profile.publicId} should be ${expectedPublicId}`);
    if (index < 23 && profile.gender !== "female") errors.push(`${profile.publicId} should be female`);
    if (index >= 23 && profile.gender !== "male") errors.push(`${profile.publicId} should be male`);
    if (profile.age < 24 || profile.age > 42) errors.push(`${profile.publicId} age out of range`);
    if (publicIds.has(profile.publicId)) errors.push(`Duplicate publicId ${profile.publicId}`);
    publicIds.add(profile.publicId);
    if (namesSeen.has(profile.displayName)) errors.push(`Duplicate displayName ${profile.displayName}`);
    namesSeen.add(profile.displayName);
    if (!profile.interestedIn.length) errors.push(`${profile.publicId} has no interestedIn`);
    if (!profile.languages.length) errors.push(`${profile.publicId} has no languages`);
    if (profile.interests.length < 3) errors.push(`${profile.publicId} has fewer than 3 interests`);
    if (![2, 3].includes(profile.imagePrompts.length)) errors.push(`${profile.publicId} has invalid image prompt count`);

    const internal = profile.internalReferencePerson.toLowerCase();
    const publicText = [
      profile.publicId,
      profile.email,
      profile.displayName,
      profile.city,
      profile.country,
      profile.occupation,
      profile.shortBio,
      profile.longBio,
      profile.shortBioEs,
      profile.longBioEs,
      profile.profileAesthetic,
    ].join(" ").toLowerCase();
    if (publicText.includes(internal)) errors.push(`${profile.publicId} public fields leak internal reference`);

    for (const [category, value] of Object.entries(profile.categoryValues)) {
      if (!validPreferenceValues.has(`${category}:${value}`)) {
        errors.push(`${profile.publicId} invalid category value ${category}:${value}`);
      }
    }

    for (const prompt of profile.imagePrompts) {
      if (prompt.genderLock !== profile.gender) errors.push(`${profile.publicId} prompt gender lock mismatch`);
      if (prompt.targetStorageKey !== storageKey(profile.publicId, prompt.sortOrder)) {
        errors.push(`${profile.publicId} sort ${prompt.sortOrder} storage key mismatch`);
      }
      const promptText = prompt.prompt.toLowerCase();
      if (promptText.includes(internal)) errors.push(`${profile.publicId} prompt leaks internal reference`);
      for (const term of celebrityTerms) {
        if (promptText.includes(term)) errors.push(`${profile.publicId} prompt contains celebrity term ${term}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function publicDiscoveryV2ProjectionForTest(profile: LaunchReferenceV2Profile) {
  return {
    publicId: profile.publicId,
    name: profile.displayName,
    age: profile.age,
    genderIdentity: profile.gender,
    location: `${profile.city}, ${profile.country}`,
    occupation: { es: profile.occupation, en: profile.occupation },
    about: { bio: { es: profile.shortBioEs, en: profile.shortBio } },
    lifestyle: profile.lifestyle,
    images: profile.imagePrompts.map(
      (_prompt, index) => `https://api.matcha.xylo-solutions.com/api/media/public/${profile.publicId}-${index}`
    ),
  };
}

export function passesDiscoveryV2PolicyForTest(profile: LaunchReferenceV2Profile, filters: DiscoveryFilters) {
  const ageOk = profile.age >= filters.ageMin && profile.age <= filters.ageMax;
  return ageOk && !evaluateGenderTherianReason(profile.gender, filters);
}

export const launchReferenceV2DiscoveryPolicyVersion = DISCOVERY_POLICY_V1.policyVersion;
