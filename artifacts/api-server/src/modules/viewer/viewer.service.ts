import { Inject, Injectable, Logger } from "@nestjs/common";
import { pool } from "@workspace/db";
import { AuthService } from "../auth/auth.service";
import { DiscoveryService } from "../discovery/discovery.service";
import { GoalsService } from "../goals/goals.service";
import { MediaService } from "../media/media.service";

type ProfileRow = {
  id: number;
  updated_at: string | Date | null;
  display_name: string;
  date_of_birth: string | null;
  location: string;
  country: string;
  profession: string;
  gender_identity: string;
  pronouns: string;
  personality: string;
  relationship_goals: string;
  education: string;
  children_preference: string;
  physical_activity: string;
  alcohol_use: string;
  tobacco_use: string;
  political_interest: string;
  religion_importance: string;
  religion: string;
  bio: string;
  body_type: string;
  height: string;
  hair_color: string;
  ethnicity: string;
};

type FreshnessRow = {
  updated_at: string | Date | null;
};

@Injectable()
export class ViewerService {
  private readonly logger = new Logger(ViewerService.name);

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(GoalsService) private readonly goalsService: GoalsService,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
    @Inject(MediaService) private readonly mediaService: MediaService
  ) {}

  private async hasProfileCountryColumn() {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'core'
           AND table_name = 'profiles'
           AND column_name = 'country'
       ) AS exists`
    );
    return Boolean(result.rows[0]?.exists);
  }

  private async findProfileId(userId: number) {
    const result = await pool.query<{ id: number }>(
      `SELECT id
       FROM core.profiles
       WHERE user_id = $1 AND kind = 'user'
       LIMIT 1`,
      [userId]
    );

    const profileId = result.rows[0]?.id;
    if (!profileId) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    return profileId;
  }

  private async getProfileLanguages(profileId: number) {
    const result = await pool.query<{ language_code: string }>(
      `SELECT language_code
       FROM core.profile_languages
       WHERE profile_id = $1
       ORDER BY position ASC, language_code ASC`,
      [profileId]
    );
    return result.rows.map((row) => row.language_code).filter(Boolean);
  }

  private async getProfileInterests(profileId: number) {
    const result = await pool.query<{ interest_code: string }>(
      `SELECT interest_code
       FROM core.profile_interests
       WHERE profile_id = $1
       ORDER BY position ASC, interest_code ASC`,
      [profileId]
    );
    return result.rows.map((row) => row.interest_code).filter(Boolean);
  }

  private toIsoTimestamp(input: string | Date | null | undefined) {
    if (!input) {
      return null;
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) {
      return null;
    }
    return parsed.toISOString();
  }

  private async getBootstrapFreshness(userId: number, profileId: number) {
    const epochExpression = "TIMESTAMP WITH TIME ZONE 'epoch'";
    const [userRow, profileRow, settingsRow, onboardingRow, mediaRow, goalsRow, discoveryRow] =
      await Promise.all([
        pool.query<FreshnessRow>(
          `SELECT updated_at
           FROM auth.users
           WHERE id = $1
           LIMIT 1`,
          [userId]
        ),
        pool.query<FreshnessRow>(
          `SELECT GREATEST(
             COALESCE((SELECT p.updated_at FROM core.profiles p WHERE p.id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(pcv.updated_at) FROM core.profile_category_values pcv WHERE pcv.profile_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(pl.updated_at) FROM core.profile_languages pl WHERE pl.profile_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(pi.updated_at) FROM core.profile_interests pi WHERE pi.profile_id = $1), ${epochExpression})
           ) AS updated_at`,
          [profileId]
        ),
        pool.query<FreshnessRow>(
          `SELECT GREATEST(
             COALESCE((SELECT us.updated_at FROM core.user_settings us WHERE us.user_id = $1), ${epochExpression}),
             COALESCE((SELECT sync.updated_at FROM core.user_sync_state sync WHERE sync.user_id = $1), ${epochExpression})
           ) AS updated_at`,
          [userId]
        ),
        pool.query<FreshnessRow>(
          `SELECT updated_at
           FROM core.user_onboarding
           WHERE user_id = $1
           LIMIT 1`,
          [userId]
        ),
        pool.query<FreshnessRow>(
          `SELECT GREATEST(
             COALESCE((SELECT MAX(pi.updated_at) FROM media.profile_images pi WHERE pi.profile_id = $1), ${epochExpression}),
             COALESCE((
               SELECT MAX(ma.updated_at)
               FROM media.media_assets ma
               WHERE ma.owner_profile_id = $1
             ), ${epochExpression})
           ) AS updated_at`,
          [profileId]
        ),
        pool.query<FreshnessRow>(
          `SELECT GREATEST(
             COALESCE((SELECT MAX(ugt.updated_at) FROM goals.user_goal_tasks ugt WHERE ugt.user_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(ucp.updated_at) FROM goals.user_category_progress ucp WHERE ucp.user_id = $1), ${epochExpression}),
             COALESCE((SELECT ugp.updated_at FROM goals.user_global_progress ugp WHERE ugp.user_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(uct.computed_at) FROM goals.user_category_targets uct WHERE uct.user_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(uctp.computed_at) FROM goals.user_category_target_progress uctp WHERE uctp.user_id = $1), ${epochExpression}),
             COALESCE((SELECT ugpm.last_recomputed_at FROM goals.user_goal_projection_meta ugpm WHERE ugpm.user_id = $1), ${epochExpression})
           ) AS updated_at`,
          [userId]
        ),
        pool.query<FreshnessRow>(
          `SELECT GREATEST(
             COALESCE((SELECT fp.updated_at FROM discovery.filter_preferences fp WHERE fp.actor_profile_id = $1), ${epochExpression}),
             COALESCE((SELECT ast.updated_at FROM discovery.actor_state ast WHERE ast.actor_profile_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(aq.updated_at) FROM discovery.actor_queue aq WHERE aq.actor_profile_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(pm.updated_at) FROM discovery.popular_attribute_modes pm WHERE pm.actor_profile_id = $1), ${epochExpression}),
             COALESCE((SELECT pth.computed_at FROM discovery.profile_preference_thresholds pth WHERE pth.actor_profile_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(dcm.created_at) FROM discovery.discovery_change_messages dcm WHERE dcm.actor_profile_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(pi.created_at) FROM discovery.profile_interactions pi WHERE pi.actor_profile_id = $1), ${epochExpression}),
             COALESCE((SELECT MAX(pd.updated_at) FROM discovery.profile_decisions pd WHERE pd.actor_profile_id = $1), ${epochExpression})
           ) AS updated_at`,
          [profileId]
        ),
      ]);

    const bootstrapGeneratedAt = new Date().toISOString();

    return {
      bootstrapGeneratedAt,
      viewerVersion: "viewer-bootstrap-v1",
      updatedAtByDomain: {
        user: this.toIsoTimestamp(userRow.rows[0]?.updated_at),
        profile: this.toIsoTimestamp(profileRow.rows[0]?.updated_at),
        settings: this.toIsoTimestamp(settingsRow.rows[0]?.updated_at),
        onboarding: this.toIsoTimestamp(onboardingRow.rows[0]?.updated_at),
        media: this.toIsoTimestamp(mediaRow.rows[0]?.updated_at),
        goals: this.toIsoTimestamp(goalsRow.rows[0]?.updated_at),
        discovery: this.toIsoTimestamp(discoveryRow.rows[0]?.updated_at),
      },
    };
  }

  private mapProfile(row: ProfileRow, input: { languagesSpoken: string[]; interests: string[] }) {
    return {
      name: row.display_name || "",
      age: "",
      dateOfBirth: row.date_of_birth || "",
      updatedAt: this.toIsoTimestamp(row.updated_at),
      location: row.location || "",
      country: row.country || "",
      profession: row.profession || "",
      genderIdentity: row.gender_identity || "",
      pronouns: row.pronouns || "",
      personality: row.personality || "",
      relationshipGoals: row.relationship_goals || "",
      languagesSpoken: input.languagesSpoken,
      education: row.education || "",
      childrenPreference: row.children_preference || "",
      physicalActivity: row.physical_activity || "",
      alcoholUse: row.alcohol_use || "",
      tobaccoUse: row.tobacco_use || "",
      politicalInterest: row.political_interest || "",
      religionImportance: row.religion_importance || "",
      religion: row.religion || "",
      bio: row.bio || "",
      bodyType: row.body_type || "",
      height: row.height || "",
      hairColor: row.hair_color || "",
      ethnicity: row.ethnicity || "",
      interests: input.interests,
      photos: [],
    };
  }

  async getProfile(userId: number) {
    const profileId = await this.findProfileId(userId);
    const hasProfileCountryColumn = await this.hasProfileCountryColumn();
    const [profileResult, languagesSpoken, interests] = await Promise.all([
      pool.query<ProfileRow>(
        `SELECT
           id,
           updated_at,
           display_name,
           date_of_birth,
           location,
           ${hasProfileCountryColumn ? "country," : "'' AS country,"}
           profession,
           gender_identity,
           pronouns,
           personality,
           relationship_goals,
           education,
           children_preference,
           physical_activity,
           alcohol_use,
           tobacco_use,
           political_interest,
           religion_importance,
           religion,
           bio,
           body_type,
           height,
           hair_color,
           ethnicity
         FROM core.profiles
         WHERE id = $1
         LIMIT 1`,
        [profileId]
      ),
      this.getProfileLanguages(profileId),
      this.getProfileInterests(profileId),
    ]);

    const profile = profileResult.rows[0];
    if (!profile) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    return {
      profile: this.mapProfile(profile, {
        languagesSpoken,
        interests,
      }),
    };
  }

  async updateProfile(
    userId: number,
    updates: {
      name?: string;
      dateOfBirth?: string;
      location?: string;
      country?: string;
      profession?: string;
      genderIdentity?: string;
      pronouns?: string;
      personality?: string;
      relationshipGoals?: string;
      languagesSpoken?: string[];
      education?: string;
      childrenPreference?: string;
      physicalActivity?: string;
      alcoholUse?: string;
      tobaccoUse?: string;
      politicalInterest?: string;
      religionImportance?: string;
      religion?: string;
      bio?: string;
      bodyType?: string;
      height?: string;
      hairColor?: string;
      ethnicity?: string;
      interests?: string[];
      latitude?: number;
      longitude?: number;
    },
    options?: {
      requestId?: string;
      locationSource?: string;
    }
  ) {
    if (typeof updates.dateOfBirth === "string" && updates.dateOfBirth) {
      const validation = this.authService.validateDob(updates.dateOfBirth);
      if (!validation.valid) {
        throw new Error(validation.code);
      }
    }

    const profileId = await this.findProfileId(userId);
    const hasProfileCountryColumn = await this.hasProfileCountryColumn();
    const client = await pool.connect();
    const attemptedFields = Object.keys(updates || {});
    const locationOnlyFields = new Set(["location", "country", "latitude", "longitude"]);
    const isLocationSyncOnly =
      attemptedFields.length > 0 &&
      attemptedFields.every((field) => locationOnlyFields.has(field));

    try {
      await client.query("BEGIN");

      const currentProfileResult = await client.query<{
        location: string;
        country: string;
      }>(
        `SELECT location, ${hasProfileCountryColumn ? "country" : "'' AS country"}
         FROM core.profiles
         WHERE id = $1
         LIMIT 1`,
        [profileId]
      );
      const currentProfileRow = currentProfileResult.rows[0] || {
        location: "",
        country: "",
      };

      const assignments: string[] = [];
      const values: unknown[] = [];
      const pushAssignment = (column: string, value: unknown) => {
        assignments.push(`${column} = $${values.length + 1}`);
        values.push(value);
      };

      if (typeof updates.name === "string") pushAssignment("display_name", updates.name);
      if (typeof updates.dateOfBirth === "string") {
        pushAssignment("date_of_birth", updates.dateOfBirth || null);
      }
      if (typeof updates.location === "string") pushAssignment("location", updates.location);
      if (hasProfileCountryColumn && typeof updates.country === "string") {
        pushAssignment("country", updates.country);
      }
      if (typeof updates.profession === "string") {
        pushAssignment("profession", updates.profession);
      }
      if (typeof updates.genderIdentity === "string") {
        pushAssignment("gender_identity", updates.genderIdentity);
      }
      if (typeof updates.pronouns === "string") pushAssignment("pronouns", updates.pronouns);
      if (typeof updates.personality === "string") {
        pushAssignment("personality", updates.personality);
      }
      if (typeof updates.relationshipGoals === "string") {
        pushAssignment("relationship_goals", updates.relationshipGoals);
      }
      if (typeof updates.education === "string") pushAssignment("education", updates.education);
      if (typeof updates.childrenPreference === "string") {
        pushAssignment("children_preference", updates.childrenPreference);
      }
      if (typeof updates.physicalActivity === "string") {
        pushAssignment("physical_activity", updates.physicalActivity);
      }
      if (typeof updates.alcoholUse === "string") pushAssignment("alcohol_use", updates.alcoholUse);
      if (typeof updates.tobaccoUse === "string") pushAssignment("tobacco_use", updates.tobaccoUse);
      if (typeof updates.politicalInterest === "string") {
        pushAssignment("political_interest", updates.politicalInterest);
      }
      if (typeof updates.religionImportance === "string") {
        pushAssignment("religion_importance", updates.religionImportance);
      }
      if (typeof updates.religion === "string") pushAssignment("religion", updates.religion);
      if (typeof updates.bio === "string") pushAssignment("bio", updates.bio);
      if (typeof updates.bodyType === "string") pushAssignment("body_type", updates.bodyType);
      if (typeof updates.height === "string") pushAssignment("height", updates.height);
      if (typeof updates.hairColor === "string") pushAssignment("hair_color", updates.hairColor);
      if (typeof updates.ethnicity === "string") pushAssignment("ethnicity", updates.ethnicity);

      if (assignments.length) {
        values.push(profileId);
        await client.query(
          `UPDATE core.profiles
           SET ${assignments.join(", ")}, updated_at = NOW()
           WHERE id = $${values.length}`,
          values
        );
      }

      if (Array.isArray(updates.languagesSpoken)) {
        const languages = updates.languagesSpoken
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        await client.query(`DELETE FROM core.profile_languages WHERE profile_id = $1`, [
          profileId,
        ]);
        for (const [index, languageCode] of languages.entries()) {
          await client.query(
            `INSERT INTO core.profile_languages
              (profile_id, language_code, position, is_primary)
             VALUES ($1, $2, $3, $4)`,
            [profileId, languageCode, index, index === 0]
          );
        }
      }

      if (Array.isArray(updates.interests)) {
        const interests = updates.interests
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        await client.query(`DELETE FROM core.profile_interests WHERE profile_id = $1`, [
          profileId,
        ]);
        for (const [index, interestCode] of interests.entries()) {
          await client.query(
            `INSERT INTO core.profile_interests
              (profile_id, interest_code, position)
             VALUES ($1, $2, $3)`,
            [profileId, interestCode, index]
          );
        }
      }

      const nextLocation =
        typeof updates.location === "string" ? updates.location : currentProfileRow.location || "";
      const nextCountry =
        typeof updates.country === "string" ? updates.country : currentProfileRow.country || "";
      const locationChanged =
        nextLocation !== (currentProfileRow.location || "") ||
        nextCountry !== (currentProfileRow.country || "");
      const shouldInsertLocationHistory =
        Boolean(nextLocation || nextCountry) &&
        (options?.locationSource === "discover_entry" || locationChanged);

      if (shouldInsertLocationHistory) {
        await client.query(
          `INSERT INTO core.profile_location_history
            (
              user_id,
              profile_id,
              location,
              country,
              latitude_e6,
              longitude_e6,
              source,
              created_at
            )
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            userId,
            profileId,
            nextLocation,
            nextCountry,
            typeof updates.latitude === "number" ? Math.round(updates.latitude * 1_000_000) : null,
            typeof updates.longitude === "number" ? Math.round(updates.longitude * 1_000_000) : null,
            options?.locationSource || "profile_update",
          ]
        );
        this.logger.log(
          `[profile-location-history] ${JSON.stringify({
            requestId: options?.requestId || null,
            userId,
            profileId,
            previousLocation: currentProfileRow.location || "",
            nextLocation,
            previousCountry: currentProfileRow.country || "",
            nextCountry,
            insertedForUnchangedLocation:
              !locationChanged && options?.locationSource === "discover_entry",
            source: options?.locationSource || "profile_update",
          })}`
        );
      }

      await client.query(
        `UPDATE core.user_sync_state
         SET last_profile_sync_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      if (!isLocationSyncOnly) {
        await this.goalsService.rebuildUserGoalTargets(userId, client, {
          refreshPreferences: false,
        });
      }

      await client.query("COMMIT");
      if (isLocationSyncOnly) {
        this.logger.log(
          `[viewer-location-sync-committed] ${JSON.stringify({
            requestId: options?.requestId || null,
            userId,
            profileId,
            locationSource: options?.locationSource || null,
            nextLocation,
            nextCountry,
            insertedHistory: shouldInsertLocationHistory,
          })}`
        );
      }
      this.logger.log(
        `[viewer-profile-update-committed] ${JSON.stringify({
          requestId: options?.requestId || null,
          userId,
          profileId,
          fields: attemptedFields,
        })}`
      );
      return this.getProfile(userId);
    } catch (error: any) {
      await client.query("ROLLBACK");
      this.logger.error(
        `[viewer-profile-update-rolled-back] ${JSON.stringify({
          requestId: options?.requestId || null,
          userId,
          profileId,
          fields: attemptedFields,
          locationSource: options?.locationSource || null,
          isLocationSyncOnly,
          code: error?.code || null,
          message: error?.message || "UNKNOWN_ERROR",
        })}`
      );
      throw error;
    } finally {
      client.release();
    }
  }

  async getBootstrap(userId: number) {
    const user = await this.authService.findUserById(userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const profileId = await this.findProfileId(userId);
    const directSettings = await this.authService.findUserSettings(userId);
    const [profile, settings, photos, goals, discovery, freshness] = await Promise.all([
      this.getProfile(userId),
      Promise.resolve({
        settings: this.authService.sanitizeSettings(directSettings),
      }),
      this.mediaService.listProfileImages(userId),
      this.goalsService.getUserGoals(userId),
      this.discoveryService.getBootstrapState(userId).catch(() => ({
        ...this.discoveryService.getEmptyPreferences(),
        feed: {
          profiles: [],
          nextCursor: null,
          hasMore: false,
          supply: {
            eligibleCount: 0,
            unseenCount: 0,
            decidedCount: 0,
            exhausted: false,
            fetchedAt: new Date().toISOString(),
          },
        },
      })),
      this.getBootstrapFreshness(userId, profileId),
    ]);

    return {
      user: this.authService.sanitizeUser(user),
      needsProfileCompletion: !user?.name || !user?.dateOfBirth,
      hasCompletedOnboarding: this.authService.resolveHasCompletedOnboarding(user),
      profile: profile.profile,
      settings: settings.settings,
      photos: photos.photos,
      goals: goals.goals,
      discovery,
      syncedAt: freshness.bootstrapGeneratedAt,
      bootstrapGeneratedAt: freshness.bootstrapGeneratedAt,
      viewerVersion: freshness.viewerVersion,
      updatedAtByDomain: freshness.updatedAtByDomain,
    };
  }
}
