import {
  INTERESTS_LIST,
  normalizeAlcoholUse,
  normalizeBodyType,
  normalizeChildrenPreference,
  normalizeEducation,
  normalizeEthnicity,
  normalizeGenderIdentity,
  normalizeHairColor,
  normalizePersonality,
  normalizePhysicalActivity,
  normalizePoliticalInterest,
  normalizePronouns,
  normalizeReligion,
  normalizeReligionImportance,
  normalizeRelationshipGoal,
  normalizeSpokenLanguages,
  normalizeTobaccoUse,
} from "@/constants/profile-options";
import type { ViewerProfileResponse } from "@/services/auth";
import { normalizeIsoDateString } from "@/utils/dateOfBirth";
import {
  normalizeStoredProfilePhotos,
  type UserProfilePhoto,
} from "@/utils/profilePhotos";

export type CanonicalProfile = {
  name: string;
  age: string;
  dateOfBirth: string;
  location: string;
  profession: string;
  genderIdentity: string;
  pronouns: string;
  personality: string;
  relationshipGoals: string;
  languagesSpoken: string[];
  education: string;
  childrenPreference: string;
  physicalActivity: string;
  alcoholUse: string;
  tobaccoUse: string;
  politicalInterest: string;
  religionImportance: string;
  religion: string;
  bio: string;
  bodyType: string;
  height: string;
  hairColor: string;
  ethnicity: string;
  interests: string[];
  photos: UserProfilePhoto[];
};

export type ProfileEditableField = Exclude<keyof CanonicalProfile, "age" | "photos">;
export type ProfileFieldSaveState = "idle" | "queued" | "saving" | "error";

type EditableScreen = "onboarding" | "profile" | "settings";
type OwnershipEntry = {
  backendField: string;
  source: string;
  editableIn: EditableScreen[];
  normalization: string;
  apiWritePath: string;
  display: string;
};

export const EMPTY_CANONICAL_PROFILE: CanonicalProfile = {
  name: "",
  age: "",
  dateOfBirth: "",
  location: "",
  profession: "",
  genderIdentity: "",
  pronouns: "",
  personality: "",
  relationshipGoals: "",
  languagesSpoken: [],
  education: "",
  childrenPreference: "",
  physicalActivity: "",
  alcoholUse: "",
  tobaccoUse: "",
  politicalInterest: "",
  religionImportance: "",
  religion: "",
  bio: "",
  bodyType: "",
  height: "",
  hairColor: "",
  ethnicity: "",
  interests: [],
  photos: [],
};

export const PROFILE_FIELD_OWNERSHIP: Record<ProfileEditableField, OwnershipEntry> = {
  name: {
    backendField: "name",
    source: "auth.users.display_name + core.profiles.display_name",
    editableIn: ["settings"],
    normalization: "trim on patch",
    apiWritePath: "PATCH /api/me/profile",
    display: "plain text",
  },
  dateOfBirth: {
    backendField: "dateOfBirth",
    source: "core.profiles.date_of_birth",
    editableIn: ["settings"],
    normalization: "YYYY-MM-DD",
    apiWritePath: "PATCH /api/me/profile",
    display: "DateOfBirthField",
  },
  location: {
    backendField: "location",
    source: "core.profiles.location",
    editableIn: ["profile"],
    normalization: "trim on patch",
    apiWritePath: "PATCH /api/me/profile",
    display: "plain text",
  },
  profession: {
    backendField: "profession",
    source: "core.profiles.profession",
    editableIn: ["settings"],
    normalization: "trim on patch",
    apiWritePath: "PATCH /api/me/profile",
    display: "plain text",
  },
  genderIdentity: {
    backendField: "genderIdentity",
    source: "core.profiles.gender_identity",
    editableIn: ["onboarding", "settings"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getGenderIdentityLabel",
  },
  pronouns: {
    backendField: "pronouns",
    source: "core.profiles.pronouns",
    editableIn: ["onboarding", "settings"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getPronounLabel",
  },
  personality: {
    backendField: "personality",
    source: "core.profiles.personality",
    editableIn: ["onboarding", "settings"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getPersonalityLabel",
  },
  relationshipGoals: {
    backendField: "relationshipGoals",
    source: "core.profiles.relationship_goals",
    editableIn: ["onboarding", "profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getRelationshipGoalLabel",
  },
  languagesSpoken: {
    backendField: "languagesSpoken",
    source: "core.profile_languages.language_code",
    editableIn: ["onboarding", "profile"],
    normalization: "ordered canonical code array",
    apiWritePath: "PATCH /api/me/profile",
    display: "getSpokenLanguageLabel",
  },
  education: {
    backendField: "education",
    source: "core.profiles.education",
    editableIn: ["onboarding", "profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getEducationLabel",
  },
  childrenPreference: {
    backendField: "childrenPreference",
    source: "core.profiles.children_preference",
    editableIn: ["onboarding", "profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getChildrenPreferenceLabel",
  },
  physicalActivity: {
    backendField: "physicalActivity",
    source: "core.profiles.physical_activity",
    editableIn: ["onboarding", "profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getPhysicalActivityLabel",
  },
  alcoholUse: {
    backendField: "alcoholUse",
    source: "core.profiles.alcohol_use",
    editableIn: ["profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getAlcoholUseLabel",
  },
  tobaccoUse: {
    backendField: "tobaccoUse",
    source: "core.profiles.tobacco_use",
    editableIn: ["profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getTobaccoUseLabel",
  },
  politicalInterest: {
    backendField: "politicalInterest",
    source: "core.profiles.political_interest",
    editableIn: ["profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getPoliticalInterestLabel",
  },
  religionImportance: {
    backendField: "religionImportance",
    source: "core.profiles.religion_importance",
    editableIn: ["profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getReligionImportanceLabel",
  },
  religion: {
    backendField: "religion",
    source: "core.profiles.religion",
    editableIn: ["profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getReligionLabel",
  },
  bio: {
    backendField: "bio",
    source: "core.profiles.bio",
    editableIn: ["profile"],
    normalization: "trim on patch",
    apiWritePath: "PATCH /api/me/profile",
    display: "plain text",
  },
  bodyType: {
    backendField: "bodyType",
    source: "core.profiles.body_type",
    editableIn: ["onboarding", "profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getBodyTypeLabel",
  },
  height: {
    backendField: "height",
    source: "core.profiles.height",
    editableIn: ["profile"],
    normalization: "trim on patch",
    apiWritePath: "PATCH /api/me/profile",
    display: "plain text",
  },
  hairColor: {
    backendField: "hairColor",
    source: "core.profiles.hair_color",
    editableIn: ["profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getHairColorLabel",
  },
  ethnicity: {
    backendField: "ethnicity",
    source: "core.profiles.ethnicity",
    editableIn: ["profile"],
    normalization: "canonical option code",
    apiWritePath: "PATCH /api/me/profile",
    display: "getEthnicityLabel",
  },
  interests: {
    backendField: "interests",
    source: "core.profile_interests.interest_code",
    editableIn: ["profile"],
    normalization: "ordered canonical array",
    apiWritePath: "PATCH /api/me/profile",
    display: "interest chips",
  },
};

export const DEBOUNCED_PROFILE_FIELDS = new Set<ProfileEditableField>([
  "bio",
  "location",
  "profession",
  "height",
]);

export const ATOMIC_PROFILE_FIELD_GROUPS = ["languagesSpoken", "interests"] as const;
export type AtomicProfileFieldGroup = (typeof ATOMIC_PROFILE_FIELD_GROUPS)[number];

const INTEREST_SET = new Set(INTERESTS_LIST.map((value) => value.trim()).filter(Boolean));

function normalizeFreeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function trimPatchString(value: string) {
  return value.trim();
}

export function normalizeInterests(values: string[] | null | undefined) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of values) {
    const value = String(raw || "").trim();
    if (!value || seen.has(value) || !INTEREST_SET.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
    if (normalized.length >= 24) {
      break;
    }
  }

  return normalized;
}

export function normalizeCanonicalProfileField<K extends ProfileEditableField>(
  field: K,
  value: CanonicalProfile[K]
): CanonicalProfile[K] {
  switch (field) {
    case "dateOfBirth":
      return normalizeIsoDateString(value as string) as CanonicalProfile[K];
    case "genderIdentity":
      return normalizeGenderIdentity(value as string) as CanonicalProfile[K];
    case "pronouns":
      return normalizePronouns(value as string) as CanonicalProfile[K];
    case "personality":
      return normalizePersonality(value as string) as CanonicalProfile[K];
    case "relationshipGoals":
      return normalizeRelationshipGoal(value as string) as CanonicalProfile[K];
    case "languagesSpoken":
      return normalizeSpokenLanguages(value as string[]) as CanonicalProfile[K];
    case "education":
      return normalizeEducation(value as string) as CanonicalProfile[K];
    case "childrenPreference":
      return normalizeChildrenPreference(value as string) as CanonicalProfile[K];
    case "physicalActivity":
      return normalizePhysicalActivity(value as string) as CanonicalProfile[K];
    case "alcoholUse":
      return normalizeAlcoholUse(value as string) as CanonicalProfile[K];
    case "tobaccoUse":
      return normalizeTobaccoUse(value as string) as CanonicalProfile[K];
    case "politicalInterest":
      return normalizePoliticalInterest(value as string) as CanonicalProfile[K];
    case "religionImportance":
      return normalizeReligionImportance(value as string) as CanonicalProfile[K];
    case "religion":
      return normalizeReligion(value as string) as CanonicalProfile[K];
    case "bodyType":
      return normalizeBodyType(value as string) as CanonicalProfile[K];
    case "hairColor":
      return normalizeHairColor(value as string) as CanonicalProfile[K];
    case "ethnicity":
      return normalizeEthnicity(value as string) as CanonicalProfile[K];
    case "interests":
      return normalizeInterests(value as string[]) as CanonicalProfile[K];
    default:
      return normalizeFreeText(value) as CanonicalProfile[K];
  }
}

export function mapApiProfileToCanonicalProfile(
  input: Partial<ViewerProfileResponse & CanonicalProfile> | null | undefined
): CanonicalProfile {
  return {
    ...EMPTY_CANONICAL_PROFILE,
    name: normalizeFreeText(input?.name),
    age: normalizeFreeText(input?.age),
    dateOfBirth: normalizeIsoDateString(input?.dateOfBirth),
    location: normalizeFreeText(input?.location),
    profession: normalizeFreeText(input?.profession),
    genderIdentity: normalizeGenderIdentity(input?.genderIdentity),
    pronouns: normalizePronouns(input?.pronouns),
    personality: normalizePersonality(input?.personality),
    relationshipGoals: normalizeRelationshipGoal(input?.relationshipGoals),
    languagesSpoken: normalizeSpokenLanguages(input?.languagesSpoken),
    education: normalizeEducation(input?.education),
    childrenPreference: normalizeChildrenPreference(input?.childrenPreference),
    physicalActivity: normalizePhysicalActivity(input?.physicalActivity),
    alcoholUse: normalizeAlcoholUse(input?.alcoholUse),
    tobaccoUse: normalizeTobaccoUse(input?.tobaccoUse),
    politicalInterest: normalizePoliticalInterest(input?.politicalInterest),
    religionImportance: normalizeReligionImportance(input?.religionImportance),
    religion: normalizeReligion(input?.religion),
    bio: normalizeFreeText(input?.bio),
    bodyType: normalizeBodyType(input?.bodyType),
    height: normalizeFreeText(input?.height),
    hairColor: normalizeHairColor(input?.hairColor),
    ethnicity: normalizeEthnicity(input?.ethnicity),
    interests: normalizeInterests(input?.interests),
    photos: normalizeStoredProfilePhotos(input?.photos),
  };
}

export function mapCanonicalProfileToProfilePatch(
  profile: CanonicalProfile,
  fields: readonly ProfileEditableField[]
) {
  const patch: Partial<Omit<ViewerProfileResponse, "age" | "photos">> = {};

  for (const field of fields) {
    const value = profile[field];
    switch (field) {
      case "languagesSpoken":
        patch.languagesSpoken = normalizeSpokenLanguages(value as string[]);
        break;
      case "interests":
        patch.interests = normalizeInterests(value as string[]);
        break;
      case "dateOfBirth":
        patch.dateOfBirth = normalizeIsoDateString(value as string);
        break;
      case "genderIdentity":
        patch.genderIdentity = normalizeGenderIdentity(value as string);
        break;
      case "pronouns":
        patch.pronouns = normalizePronouns(value as string);
        break;
      case "personality":
        patch.personality = normalizePersonality(value as string);
        break;
      case "relationshipGoals":
        patch.relationshipGoals = normalizeRelationshipGoal(value as string);
        break;
      case "education":
        patch.education = normalizeEducation(value as string);
        break;
      case "childrenPreference":
        patch.childrenPreference = normalizeChildrenPreference(value as string);
        break;
      case "physicalActivity":
        patch.physicalActivity = normalizePhysicalActivity(value as string);
        break;
      case "alcoholUse":
        patch.alcoholUse = normalizeAlcoholUse(value as string);
        break;
      case "tobaccoUse":
        patch.tobaccoUse = normalizeTobaccoUse(value as string);
        break;
      case "politicalInterest":
        patch.politicalInterest = normalizePoliticalInterest(value as string);
        break;
      case "religionImportance":
        patch.religionImportance = normalizeReligionImportance(value as string);
        break;
      case "religion":
        patch.religion = normalizeReligion(value as string);
        break;
      case "bodyType":
        patch.bodyType = normalizeBodyType(value as string);
        break;
      case "hairColor":
        patch.hairColor = normalizeHairColor(value as string);
        break;
      case "ethnicity":
        patch.ethnicity = normalizeEthnicity(value as string);
        break;
      default:
        patch[field] = trimPatchString(value as string) as never;
        break;
    }
  }

  return patch;
}

export function reconcileCanonicalProfileFields(
  current: CanonicalProfile,
  incoming: CanonicalProfile,
  fields: readonly ProfileEditableField[]
) {
  const next = {
    ...current,
  };

  for (const field of fields) {
    next[field] = incoming[field] as never;
  }

  return mapApiProfileToCanonicalProfile(next);
}

export function mapCanonicalProfileToDisplayProfile(profile: CanonicalProfile) {
  return mapApiProfileToCanonicalProfile(profile);
}
