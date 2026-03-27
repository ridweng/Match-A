import { Inject, Injectable } from "@nestjs/common";
import { pool } from "@workspace/db";
import { AuthService } from "../auth/auth.service";
import { DiscoveryService } from "../discovery/discovery.service";
import { GoalsService } from "../goals/goals.service";
import { MediaService } from "../media/media.service";

type ProfileRow = {
  id: number;
  display_name: string;
  date_of_birth: string | null;
  location: string;
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

@Injectable()
export class ViewerService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(GoalsService) private readonly goalsService: GoalsService,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
    @Inject(MediaService) private readonly mediaService: MediaService
  ) {}

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

  private mapProfile(row: ProfileRow, input: { languagesSpoken: string[]; interests: string[] }) {
    return {
      name: row.display_name || "",
      age: "",
      dateOfBirth: row.date_of_birth || "",
      location: row.location || "",
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
    const [profileResult, languagesSpoken, interests] = await Promise.all([
      pool.query<ProfileRow>(
        `SELECT
           id,
           display_name,
           date_of_birth,
           location,
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
    }
  ) {
    if (typeof updates.dateOfBirth === "string" && updates.dateOfBirth) {
      const validation = this.authService.validateDob(updates.dateOfBirth);
      if (!validation.valid) {
        throw new Error(validation.code);
      }
    }

    const profileId = await this.findProfileId(userId);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

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

      await client.query(
        `UPDATE core.user_sync_state
         SET last_profile_sync_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      await client.query("COMMIT");
      return this.getProfile(userId);
    } catch (error) {
      await client.query("ROLLBACK");
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

    const directSettings = await this.authService.findUserSettings(userId);
    const [profile, settings, photos, goals, discovery] = await Promise.all([
      this.getProfile(userId),
      Promise.resolve({
        settings: this.authService.sanitizeSettings(directSettings),
      }),
      this.mediaService.listProfileImages(userId),
      this.goalsService.getUserGoals(userId),
      this.discoveryService.getPreferences(userId).catch(() =>
        this.discoveryService.getEmptyPreferences()
      ),
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
      syncedAt: new Date().toISOString(),
    };
  }
}
