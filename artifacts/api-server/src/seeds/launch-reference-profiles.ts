import { DEFAULT_PREFERENCE_VALUES } from "../modules/goals/default-goals";
import {
  DISCOVERY_POLICY_V1,
  evaluateGenderTherianReason,
  type DiscoveryFilters,
} from "../modules/discovery/discovery.policy";

export const LAUNCH_REFERENCE_BATCH_KEY = "launch_reference_v1";
export const LAUNCH_REFERENCE_GENERATION_VERSION = "famous_reference_synthetic_v1";
export const LAUNCH_REFERENCE_GENERATION_VERSION_NUMBER = 101;

export const LAUNCH_REFERENCE_NEGATIVE_PROMPT =
  "wrong gender, male face on female profile, female face on male profile, beard on female profile, moustache on female profile, child, underage, watermark, text, logo, exact celebrity likeness, clone, deepfake";

type Gender = "female" | "male";
type GoalCategory = "physical" | "personality" | "family" | "expectations" | "language" | "studies";

export type LaunchReferenceImagePrompt = {
  kind: "primary_face_portrait" | "full_body_lifestyle" | "activity_social" | "candid_close_up";
  identitySeed: string;
  genderLock: Gender;
  ageBand: string;
  styleAestheticDirection: string;
  prompt: string;
  negativePrompt: string;
};

export type LaunchReferenceProfile = {
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
  imagePrompts: LaunchReferenceImagePrompt[];
  validationStatus: "ready";
};

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
  "Deepika Padukone",
  "Aishwarya Rai",
  "Lisa from BLACKPINK",
  "Jennie from BLACKPINK",
  "Rose from BLACKPINK",
  "Jisoo from BLACKPINK",
  "Florence Pugh",
  "Sydney Sweeney",
  "Jenna Ortega",
  "Anya Taylor-Joy",
  "Hailee Steinfeld",
  "Bella Hadid",
  "Henry Cavill",
  "Chris Hemsworth",
  "Michael B. Jordan",
  "Ryan Gosling",
  "Timothee Chalamet",
  "Harry Styles",
  "Bad Bunny",
  "Pedro Pascal",
  "Rege-Jean Page",
  "Oscar Isaac",
  "Tom Holland",
  "Zayn Malik",
  "David Beckham",
] as const;

const fictionalNames = [
  "Maya Vale",
  "Nora Lux",
  "Clara Wren",
  "Imani Sol",
  "Elena Hart",
  "Alice Verne",
  "Lina Mar",
  "Noa Sade",
  "Vivian Cove",
  "Sofia Reyes",
  "Arielle Moon",
  "Bianca Saint",
  "Jules Harper",
  "Amelia Stone",
  "Mira Levin",
  "Celine Arden",
  "Paloma Cruz",
  "Valeria Noh",
  "Isla Rivera",
  "Lucia Vega",
  "Anika Rao",
  "Diya Kapoor",
  "Leela Sen",
  "Sumi Park",
  "Hana Choi",
  "Rina Kwon",
  "Jia Han",
  "Freya Quinn",
  "Sienna Brooks",
  "Marina Ortega",
  "Ava Lorne",
  "Kaia Bennett",
  "Bella Noor",
  "Theo Knight",
  "Caleb Storm",
  "Malik Rhodes",
  "Elliot Hayes",
  "Julian Voss",
  "Harry Vale",
  "Benicio Luna",
  "Mateo Cruz",
  "Rafael Page",
  "Oscar Nadir",
  "Tom Mercer",
  "Zain Archer",
  "David Cole",
] as const;

const cities = [
  ["London", "United Kingdom"],
  ["Barcelona", "Spain"],
  ["Lisbon", "Portugal"],
  ["Paris", "France"],
  ["Berlin", "Germany"],
  ["Milan", "Italy"],
  ["Madrid", "Spain"],
  ["Amsterdam", "Netherlands"],
] as const;
const occupations = [
  "Brand Strategist",
  "Music Producer",
  "Creative Director",
  "Founder",
  "Film Editor",
  "Policy Researcher",
  "Product Designer",
  "Architect",
  "Interior Stylist",
  "Community Manager",
  "Vocal Coach",
  "Gallery Director",
  "Script Consultant",
  "Theatre Producer",
  "Neuroscience Researcher",
  "Human Rights Lawyer",
  "Documentary Photographer",
  "Hospitality Founder",
  "Dance Instructor",
  "TV Producer",
  "Climate Investor",
  "Fashion Buyer",
  "Art Historian",
  "Choreographer",
  "Editorial Stylist",
  "Sound Designer",
  "Cultural Curator",
  "Ceramic Artist",
  "UX Researcher",
  "Set Designer",
  "Game Writer",
  "Radio Host",
  "Wellness Editor",
  "Aviation Engineer",
  "Marine Biologist",
  "Fitness Entrepreneur",
  "Furniture Maker",
  "Menswear Designer",
  "Festival Programmer",
  "Food Critic",
  "Photojournalist",
  "Theatre Actor",
  "Urban Planner",
  "Robotics Student",
  "Tattoo Artist",
  "Sports Analyst",
] as const;
const aesthetics = [
  "polished editorial warmth",
  "modern pop minimalism",
  "soft literary elegance",
  "luxury streetwear confidence",
  "sunlit coastal glamour",
  "clean academic charm",
  "cinematic old-town romance",
  "sleek metropolitan poise",
] as const;
const personalities = ["empathetic", "curious", "playful", "calm", "adventurous", "thoughtful"] as const;
export const LAUNCH_REFERENCE_PERSONALITY_VALUES = personalities.map((valueKey, index) => ({
  categoryCode: "personality" as const,
  valueKey,
  labelEs: valueKey.replace(/_/g, " "),
  labelEn: valueKey.replace(/_/g, " "),
  sortOrder: index,
}));
const bodyTypes = ["slim", "lean", "athletic", "medium_build", "compact_build", "curvy"] as const;
const relationshipGoals = ["stable_relationship", "still_figuring_it_out", "making_friends", "nothing_serious"] as const;
const educationLevels = ["technical_school", "university_student", "bachelors_degree", "masters_degree", "doctorate"] as const;
const family = ["want_children", "have_and_want_more", "have_and_dont_want_more", "not_sure", "dont_want_children"] as const;
const languages = ["en", "es", "fr", "de", "it", "pt", "ca"] as const;
const interests = ["music", "travel", "fitness", "books", "food", "cinema", "hiking", "art", "coffee", "design"] as const;

function dateFromAge(age: number, index: number) {
  const year = 2026 - age;
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String(((index * 3) % 27) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function identitySeed(index: number, name: string) {
  return `launch_ref_${String(index + 1).padStart(3, "0")}_${name.split(" ")[0]!.toLowerCase()}`;
}

function buildPrompts(index: number, name: string, gender: Gender, age: number, aesthetic: string) {
  const seed = identitySeed(index, name);
  const ageBand = age < 25 ? "early twenties" : age < 30 ? "late twenties" : "early thirties";
  const base =
    `Synthetic fictional ${gender} dating profile subject, identity seed ${seed}, ${ageBand}, ${aesthetic}, natural proportions, original face, premium editorial dating app photography`;
  return [
    ["primary_face_portrait", "primary face portrait, direct but relaxed eye contact, clean background"],
    ["full_body_lifestyle", "full-body lifestyle image, city street or studio movement, confident posture"],
    ["activity_social", "activity/social image, warm candid moment with friends implied but not prominent"],
    ["candid_close_up", "candid close-up, soft available light, genuine expression"],
  ].map(([kind, detail]) => ({
    kind,
    identitySeed: seed,
    genderLock: gender,
    ageBand,
    styleAestheticDirection: aesthetic,
    prompt: `${base}, ${detail}. Do not reference any real celebrity, public figure, exact likeness, clone, or deepfake.`,
    negativePrompt: LAUNCH_REFERENCE_NEGATIVE_PROMPT,
  })) as LaunchReferenceImagePrompt[];
}

function pick<T>(values: readonly T[], index: number, offset = 0) {
  return values[(index + offset) % values.length]!;
}

export const launchReferenceProfiles: LaunchReferenceProfile[] = internalReferences.map(
  (internalReferencePerson, index) => {
    const gender: Gender = index < 33 ? "female" : "male";
    const name = fictionalNames[index]!;
    const age = 23 + ((index * 7) % 12);
    const [city, country] = pick(cities, index);
    const languagePair = [pick(languages, index), pick(languages, index, 2)];
    const selectedInterests = [pick(interests, index), pick(interests, index, 3), pick(interests, index, 6)];
    const aesthetic = pick(aesthetics, index);
    const relationshipGoal = pick(relationshipGoals, index);
    const bodyType = pick(bodyTypes, index);
    const personality = pick(personalities, index);
    const education = pick(educationLevels, index);
    const childrenPreference = pick(family, index);

    return {
      internalReferencePerson,
      internalReferenceOnly: true,
      publicId: `dummy_launch_ref_${String(index + 1).padStart(3, "0")}`,
      email: `dummy+${LAUNCH_REFERENCE_BATCH_KEY}-${String(index + 1).padStart(3, "0")}@matcha.local`,
      displayName: name,
      age,
      dateOfBirth: dateFromAge(age, index),
      gender,
      interestedIn: [gender === "female" ? "male" : "female"],
      city,
      country,
      occupation: occupations[index]!,
      shortBio: `${name.split(" ")[0]} is drawn to thoughtful plans, sharp humor, and weekends that leave room for a little spontaneity.`,
      longBio: `${name.split(" ")[0]} keeps a full calendar but protects time for good food, close friends, movement, and creative side projects. They prefer direct communication, emotional steadiness, and dates that feel considered without being overproduced.`,
      relationshipGoal,
      languages: Array.from(new Set(languagePair)),
      interests: selectedInterests,
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
        language: languagePair[0]!,
        studies: education,
      },
      profileAesthetic: aesthetic,
      imagePrompts: buildPrompts(index, name, gender, age, aesthetic),
      validationStatus: "ready",
    };
  }
);

export type LaunchReferenceSourceValidation = {
  ok: boolean;
  errors: string[];
};

export function validateLaunchReferenceSource(): LaunchReferenceSourceValidation {
  const errors: string[] = [];
  const profiles = launchReferenceProfiles;
  const publicIds = new Set<string>();
  const names = new Set<string>();
  const validPreferenceValues = new Set(
    [...DEFAULT_PREFERENCE_VALUES, ...LAUNCH_REFERENCE_PERSONALITY_VALUES].map(
      (value) => `${value.categoryCode}:${value.valueKey}`
    )
  );

  if (profiles.length !== 46) errors.push(`Expected 46 profiles, found ${profiles.length}`);
  if (profiles.filter((profile) => profile.gender === "female").length !== 33) {
    errors.push("Expected 33 female profiles");
  }
  if (profiles.filter((profile) => profile.gender === "male").length !== 13) {
    errors.push("Expected 13 male profiles");
  }

  for (const profile of profiles) {
    if (publicIds.has(profile.publicId)) errors.push(`Duplicate publicId ${profile.publicId}`);
    publicIds.add(profile.publicId);
    if (names.has(profile.displayName)) errors.push(`Duplicate displayName ${profile.displayName}`);
    names.add(profile.displayName);
    if (!profile.interestedIn.length) errors.push(`${profile.publicId} has no interestedIn`);
    if (profile.imagePrompts.length < 4) errors.push(`${profile.publicId} has fewer than 4 image prompts`);
    for (const prompt of profile.imagePrompts) {
      if (prompt.genderLock !== profile.gender) errors.push(`${profile.publicId} prompt gender lock mismatch`);
      if (prompt.prompt.toLowerCase().includes(profile.internalReferencePerson.toLowerCase())) {
        errors.push(`${profile.publicId} prompt leaks internal reference`);
      }
    }
    const publicText = [
      profile.publicId,
      profile.displayName,
      profile.city,
      profile.country,
      profile.occupation,
      profile.shortBio,
      profile.longBio,
      profile.profileAesthetic,
    ].join(" ").toLowerCase();
    if (publicText.includes(profile.internalReferencePerson.toLowerCase())) {
      errors.push(`${profile.publicId} public fields leak internal reference`);
    }
    for (const [category, value] of Object.entries(profile.categoryValues)) {
      if (!validPreferenceValues.has(`${category}:${value}`)) {
        errors.push(`${profile.publicId} invalid category value ${category}:${value}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function publicDiscoveryProjectionForTest(profile: LaunchReferenceProfile) {
  return {
    publicId: profile.publicId,
    name: profile.displayName,
    age: profile.age,
    genderIdentity: profile.gender,
    location: `${profile.city}, ${profile.country}`,
    occupation: { es: profile.occupation, en: profile.occupation },
    about: { bio: { es: profile.shortBio, en: profile.shortBio } },
    lifestyle: profile.lifestyle,
    images: profile.imagePrompts.map((prompt, index) =>
      `https://static.matcha.local/synthetic/${LAUNCH_REFERENCE_BATCH_KEY}/${profile.publicId}/${index}.jpg`
    ),
  };
}

export function passesDiscoveryPolicyForTest(profile: LaunchReferenceProfile, filters: DiscoveryFilters) {
  const ageOk = profile.age >= filters.ageMin && profile.age <= filters.ageMax;
  return ageOk && !evaluateGenderTherianReason(profile.gender, filters);
}

export const launchReferenceDiscoveryPolicyVersion = DISCOVERY_POLICY_V1.policyVersion;
