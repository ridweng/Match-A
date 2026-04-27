BEGIN;

CREATE INDEX IF NOT EXISTS core_profiles_kind_discoverable_idx
ON core.profiles(kind, is_discoverable, id);

CREATE INDEX IF NOT EXISTS core_profile_dummy_metadata_batch_generation_idx
ON core.profile_dummy_metadata(dummy_batch_key, generation_version);

CREATE INDEX IF NOT EXISTS core_profile_dummy_metadata_group_idx
ON core.profile_dummy_metadata(synthetic_group);

CREATE INDEX IF NOT EXISTS discovery_profile_interactions_created_type_actor_idx
ON discovery.profile_interactions(created_at, interaction_type, actor_profile_id);

CREATE INDEX IF NOT EXISTS goals_user_goal_projection_meta_status_recomputed_idx
ON goals.user_goal_projection_meta(rebuild_status, last_recomputed_at);

CREATE INDEX IF NOT EXISTS media_assets_owner_status_updated_idx
ON media.media_assets(owner_profile_id, status, updated_at);

COMMIT;
