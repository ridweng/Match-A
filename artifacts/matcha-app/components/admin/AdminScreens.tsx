import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import Colors from "@/constants/colors";

type ApiState<T> = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  fetchedAt: string | null;
  data: T | null;
};

function resolveAdminDashboardPollMs() {
  const parsed = Number(
    process.env.EXPO_PUBLIC_ADMIN_DASHBOARD_POLL_MS ||
      process.env.ADMIN_DASHBOARD_POLL_MS ||
      30000
  );
  return Number.isFinite(parsed) && parsed >= 5000 ? parsed : 30000;
}

const DEFAULT_ADMIN_DASHBOARD_POLL_MS = resolveAdminDashboardPollMs();

type Overview = {
  selectedTimeframe: string;
  selectedCountry: string;
  availableCountries: { country: string; profile_count: string }[];
  counts: Record<string, string | null>;
  funnel: Record<string, { count: string; pctFromPrevious: string; pctFromSignedUp: string }>;
  thresholds: { bucket: string; count: string }[];
  batches: { dummy_batch_key: string; generation_version: number; profile_count: string }[];
  activeBatch: { dummy_batch_key: string; generation_version: number } | null;
  genderDistribution: {
    gender_identity: string;
    dummy_batch_key: string;
    generation_version: number;
    profile_count: string;
  }[];
  realUserGenderDistribution: { gender_identity: string; profile_count: string }[];
  realUserCountryDistribution: { country: string; profile_count: string }[];
  interactedUsers: {
    profile_id: number;
    display_name: string;
    country: string;
    likes_count: string;
    passes_count: string;
    total_decisions: string;
    last_interaction_at: string | null;
  }[];
};

type UserRow = {
  profile_id: number;
  user_id: number | null;
  public_id: string;
  display_name: string;
  kind: "user" | "dummy";
  gender_identity: string;
  country: string;
  synthetic_group: string | null;
  dummy_batch_key: string | null;
  generation_version: number | null;
  total_likes: number | null;
  total_passes: number | null;
  is_activated: boolean;
  threshold_plus_30: boolean;
  last_decision_at: string | null;
  last_recomputed_at: string | null;
};

type UsersPayload = {
  filters: Record<string, string | number | null>;
  filterOptions: {
    genderIdentities: string[];
    syntheticGroups: string[];
    dummyBatchKeys: string[];
    generationVersions: number[];
  };
  users: UserRow[];
};

type DatabasePayload = {
  schemaStatus: {
    missingRequiredRelations: string[];
    missingRequiredColumns: string[];
    warnings: string[];
  };
  metricGroups: { title: string; metrics: { label: string; value: string; detail?: string }[] }[];
  tableStats: {
    key: string;
    schema: string;
    table: string;
    role: string;
    present: boolean;
    rowCount: number | null;
    freshness: string | null;
  }[];
};

type StudyPayload = {
  analyticsEnabled: boolean;
  analyticsAdminEnabled: boolean;
  selectedTestRunId: string | null;
  compareTestRunId: string | null;
  testRuns: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    starts_at: string;
    ends_at: string | null;
    include_all_real_users: boolean;
    include_dummy_users_as_actors: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }[];
  activeTestRun: {
    id: string;
    name: string;
    status: string;
    starts_at: string;
    ends_at: string | null;
  } | null;
  summary: {
    participants: number;
    activeUsers: number;
    totalSessions: number;
    totalActiveSeconds: number;
    averageSessionSeconds: number;
    medianSessionSeconds: number;
    totalDiscoveryDecisions: number;
    likes: number;
    passes: number;
    likeRatio: number;
    usersReaching30Likes: number;
    usersOpeningGoalsAfterUnlock: number;
    engagedUsers: number;
    notEngagedUsers: number;
    blockedFrustratedUsers: number;
  };
  scorecard: { label: string; status: string }[];
  funnel: Record<string, string | number>;
  screenUsage: { screen_name: string; area_name: string; segments: number; total_ms: number; average_ms: number }[];
  discovery: { event_name: string; count: number; users: number }[];
  goals: { event_name: string; count: number; users: number }[];
  friction: { event_name: string; count: number; users: number }[];
  users: {
    userId: number;
    profileId: number | null;
    publicId: string;
    label: string;
    signupDate: string;
    onboardingStatus: string;
    activationStatus: string;
    engagementStatus: string;
    lastActive: string;
    sessionCount: number;
    totalActiveSeconds: number;
    averageSessionSeconds: number;
    discoverTimeMs: number;
    goalsTimeMs: number;
    likes: number;
    passes: number;
    likeRatio: number;
    cardsViewed: number;
    profileInfoOpens: number;
    filtersUsed: number;
    thresholdReached: boolean;
    goalsOpenedAfterThreshold: boolean;
    reliabilityErrors: number;
  }[];
  comparison: {
    current: Record<string, number>;
    previous: Record<string, number>;
  } | null;
};

type GeneratedBatch = {
  batchKey: string;
  generationVersion: number;
  profileCount: number;
  femaleCount: number;
  maleCount: number;
  otherCount: number;
  readyMediaCount: number;
  latestCreatedAt: string | null;
  latestUpdatedAt: string | null;
};

type GeneratedBatchesPayload = {
  batches: GeneratedBatch[];
};

type GeneratedBatchDeletePreview = {
  batchKey: string;
  generationVersion: number;
  profileCount: number;
  femaleCount: number;
  maleCount: number;
  otherCount: number;
  readyMediaCount: number;
  deletedProfiles: number;
  deletedDummyMetadata: number;
  deletedMediaAssets: number;
  deletedProfileImages: number;
  deletedCategoryValues: number;
  deletedLanguages: number;
  deletedInterests: number;
  deletedLocationHistory: number;
  deletedDecisions: number;
  deletedInteractions: number;
  deletedQueueRows: number;
  deletedActorStateRows: number;
  deletedProjectionRows: number;
  deletedUsers: number;
  latestCreatedAt: string | null;
  latestUpdatedAt: string | null;
};

type ProfileDetail = {
  profile: {
    profile_id: number;
    user_id: number | null;
    public_id: string;
    display_name: string;
    kind: "user" | "dummy";
    profession: string;
    bio: string;
    content_locale: "es" | "en";
    date_of_birth: string | null;
    location: string;
    country: string;
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
    body_type: string;
    height: string;
    hair_color: string;
    ethnicity: string;
    is_discoverable: boolean;
    created_at: string;
    updated_at: string;
    onboarding_status: string | null;
    onboarding_completed_at: string | null;
    synthetic_group: string | null;
    synthetic_variant: string | null;
    dummy_batch_key: string | null;
    generation_version: number | null;
    total_likes: number | null;
    total_passes: number | null;
    threshold_reached: boolean | null;
    likes_until_unlock: number | null;
    threshold_reached_at: string | null;
    last_decision_event_at: string | null;
    last_recomputed_at: string | null;
    rebuild_status: string | null;
    has_ready_media: boolean;
    is_activated: boolean;
    total_decisions: number;
    last_interaction_at: string | null;
  };
  images: {
    profileImageId: number;
    mediaAssetId: number;
    sortOrder: number;
    isPrimary: boolean;
    status: "pending" | "ready" | "deleted";
    publicUrl: string | null;
    mimeType: string;
    width: number | null;
    height: number | null;
    updatedAt: string | null;
  }[];
  languages: { language_code: string; position: number; is_primary: boolean }[];
  interests: { interest_code: string; position: number }[];
  categoryValues: { category_code: string; value_key: string; source: string }[];
  recentDecisions: {
    id: number;
    interaction_type: "like" | "pass";
    target_profile_public_id: string;
    created_at: string;
  }[];
};

const timeframes = [
  ["now", "24h"],
  ["1w", "1w"],
  ["1m", "1m"],
  ["3m", "3m"],
  ["6m", "6m"],
  ["1y", "1y"],
  ["all", "All"],
] as const;

const adminColors = {
  ink: "#17211b",
  panel: "#fbfaf4",
  panelAlt: "#eef4ea",
  border: "#dbe5d9",
  muted: "#637268",
  danger: "#b42318",
  dangerSoft: "#fff1f0",
  warning: "#b7791f",
  warningSoft: "#fff8e8",
  success: "#0e7a4a",
  successSoft: "#edf9f1",
};

function formatNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : String(value ?? "0");
}

function formatDate(value: unknown) {
  if (!value) return "No activity yet";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "No activity yet" : date.toLocaleString();
}

function formatTimestamp(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value).trim()) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function normalizeRouteParam(input: string | string[] | undefined, fallback = "") {
  if (Array.isArray(input)) {
    return String(input[0] || fallback);
  }
  return String(input || fallback);
}

function calculateAge(dateOfBirth: string | null | undefined) {
  if (!dateOfBirth) return null;
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDelta = now.getMonth() - date.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

async function fetchAdminJson<T>(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let detail = `Admin API returned ${response.status}.`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        detail = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }

  return (await response.json()) as { fetchedAt: string; data: T };
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }
    const previous = document.body.style.overflow;
    if (locked) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

function useAdminApi<T>(path: string | null, pollMs?: number) {
  const inFlightPathRef = useRef<string | null>(null);
  const [state, setState] = useState<ApiState<T>>({
    loading: true,
    refreshing: false,
    error: null,
    fetchedAt: null,
    data: null,
  });

  const load = useCallback(async (refresh = false) => {
    if (!path) {
      setState({
        loading: false,
        refreshing: false,
        error: null,
        fetchedAt: null,
        data: null,
      });
      return;
    }

    const requestPath = refresh
      ? `${path}${path.includes("?") ? "&" : "?"}refresh=1`
      : path;
    if (!refresh && inFlightPathRef.current === requestPath) {
      return;
    }
    inFlightPathRef.current = requestPath;

    setState((current) => ({
      ...current,
      loading: current.data ? false : true,
      refreshing: refresh,
      error: null,
    }));

    try {
      const payload = await fetchAdminJson<T>(requestPath);
      setState({
        loading: false,
        refreshing: false,
        error: null,
        fetchedAt: payload.fetchedAt,
        data: payload.data,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : "Admin API request failed.",
      }));
    } finally {
      if (inFlightPathRef.current === requestPath) {
        inFlightPathRef.current = null;
      }
    }
  }, [path]);

  useEffect(() => {
    void load(false);
    if (!path || !pollMs || Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      void load(false);
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [load, path, pollMs]);

  return { ...state, refresh: () => load(true) };
}

function StateBlock({
  loading,
  error,
  empty,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: string;
}) {
  if (loading) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color={Colors.primaryLight} />
        <Text style={styles.stateText}>Loading protected admin data...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.stateCard, styles.errorCard]}>
        <Feather name="shield-off" size={22} color={adminColors.danger} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.stateCard}>
        <Feather name="inbox" size={22} color={adminColors.muted} />
        <Text style={styles.stateText}>{empty}</Text>
      </View>
    );
  }
  return null;
}

function Banner({
  tone,
  message,
}: {
  tone: "success" | "error" | "warning";
  message: string;
}) {
  const icon = tone === "success" ? "check-circle" : tone === "warning" ? "alert-triangle" : "x-circle";
  const containerStyle =
    tone === "success"
      ? styles.successCard
      : tone === "warning"
        ? styles.warningCard
        : styles.errorCard;
  const textStyle =
    tone === "success"
      ? styles.successText
      : tone === "warning"
        ? styles.warningText
        : styles.errorText;
  const color =
    tone === "success"
      ? adminColors.success
      : tone === "warning"
        ? adminColors.warning
        : adminColors.danger;

  return (
    <View style={[styles.stateCard, containerStyle]}>
      <Feather name={icon} size={20} color={color} />
      <Text style={textStyle}>{message}</Text>
    </View>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: unknown; detail?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{formatNumber(value)}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

function Section({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <View style={[styles.section, tone === "danger" && styles.sectionDanger]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function KeyValueList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <View style={styles.detailGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.detailCard}>
          <Text style={styles.detailLabel}>{item.label}</Text>
          <View style={styles.detailValueWrap}>
            {typeof item.value === "string" || typeof item.value === "number" ? (
              <Text style={styles.detailValue}>{String(item.value || "—")}</Text>
            ) : (
              item.value
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function BatchSelect({
  batches,
  selectedKey,
  onSelect,
}: {
  batches: GeneratedBatch[];
  selectedKey: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedBatch = batches.find(
    (batch) => `${batch.batchKey}:${batch.generationVersion}` === selectedKey
  );

  return (
    <View style={styles.selectWrap}>
      <Text style={styles.metricLabel}>Generated batch</Text>
      <Pressable
        style={styles.selectButton}
        onPress={() => setOpen((current) => !current)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.selectButtonText}>
            {selectedBatch
              ? `${selectedBatch.batchKey} / gen ${selectedBatch.generationVersion}`
              : "Select a batch"}
          </Text>
          {selectedBatch ? (
            <Text style={styles.selectButtonDetail}>
              {selectedBatch.profileCount} profiles · {selectedBatch.readyMediaCount} ready media
            </Text>
          ) : null}
        </View>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={adminColors.ink}
        />
      </Pressable>
      {open ? (
        <View style={styles.selectList}>
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
            {batches.map((batch) => {
              const value = `${batch.batchKey}:${batch.generationVersion}`;
              const active = value === selectedKey;
              return (
                <Pressable
                  key={value}
                  style={[styles.selectOption, active && styles.selectOptionActive]}
                  onPress={() => {
                    onSelect(value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.selectOptionTitle}>
                    {batch.batchKey} / gen {batch.generationVersion}
                  </Text>
                  <Text style={styles.selectOptionDetail}>
                    {batch.profileCount} profiles · {batch.femaleCount} female · {batch.maleCount} male · {batch.otherCount} other
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function AdminLayout({
  title,
  subtitle,
  fetchedAt,
  refreshing,
  onRefresh,
  children,
}: {
  title: string;
  subtitle: string;
  fetchedAt?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;
  const isCompactSidebar = width >= 760 && width < 1180;
  const active = pathname === "/" ? "/admin" : pathname;

  const navItems = [
    { label: "Overview", path: "/admin", icon: "bar-chart-2" },
    { label: "Users", path: "/admin/users", icon: "users" },
    { label: "Database", path: "/admin/database", icon: "database" },
    { label: "Study", path: "/admin/study", icon: "activity" },
  ] as const;

  const sidebarContent = (
    <>
      <View style={[styles.brandHeader, isMobile && styles.brandHeaderMobile]}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>M</Text>
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandTitle}>MatchA</Text>
          <Text style={styles.brandSubtitle}>Admin</Text>
        </View>
      </View>

      <View style={[styles.nav, isMobile && styles.navMobile]}>
        {navItems.map((item) => (
          <Pressable
            key={item.path}
            onPress={() => router.push(item.path as never)}
            style={({ pressed, hovered }) => [
              styles.navItem,
              isCompactSidebar && styles.navItemCompact,
              isMobile && styles.navItemMobile,
              hovered && active !== item.path && styles.navItemHover,
              pressed && styles.navItemPressed,
              active === item.path && styles.navItemActive,
            ]}
          >
            <Feather
              name={item.icon}
              size={14}
              color={active === item.path ? Colors.ivory : adminColors.muted}
            />
            <Text style={[styles.navLabel, active === item.path && styles.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  return (
    <View style={[styles.shell, isMobile && styles.shellMobile]}>
      {isMobile ? (
        <ScrollView
          horizontal
          style={styles.sidebarScrollMobile}
          contentContainerStyle={styles.sidebarInnerMobile}
          showsHorizontalScrollIndicator={false}
        >
          {sidebarContent}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.sidebarDesktop,
            isCompactSidebar && styles.sidebarDesktopCompact,
          ]}
        >
          {sidebarContent}
        </View>
      )}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          isCompactSidebar && styles.contentInnerCompact,
          isMobile && styles.contentInnerMobile,
        ]}
        showsVerticalScrollIndicator
      >
        <View style={styles.topbar}>
          <View style={{ flex: 1, minWidth: 240 }}>
            <Text style={styles.kicker}>Protected dashboard</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.topbarActions}>
            <Text style={styles.freshness}>
              Fresh: {fetchedAt ? formatDate(fetchedAt) : "loading"}
            </Text>
            {onRefresh ? (
              <Pressable style={styles.refreshButton} onPress={onRefresh} disabled={refreshing}>
                <Feather name="refresh-cw" size={16} color={adminColors.ink} />
                <Text style={styles.refreshText}>{refreshing ? "Refreshing" : "Refresh"}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

function UsersTable({
  rows,
  onSelect,
}: {
  rows: UserRow[];
  onSelect: (publicId: string) => void;
}) {
  if (!rows.length) {
    return <StateBlock empty="No users match these filters." />;
  }

  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {[
            "Profile",
            "Kind",
            "Country",
            "Likes",
            "Passes",
            "Activated",
            "Threshold",
            "Batch",
            "Last decision",
          ].map((header) => (
            <Text key={header} style={[styles.tableCell, styles.tableHeaderCell]}>
              {header}
            </Text>
          ))}
        </View>
        {rows.map((row) => (
          <Pressable
            key={row.public_id}
            style={({ pressed }) => [
              styles.tableRow,
              styles.tableRowInteractive,
              pressed && styles.tableRowPressed,
            ]}
            onPress={() => onSelect(row.public_id)}
          >
            <Text style={[styles.tableCell, styles.tableCellPrimary]}>
              {row.display_name || row.public_id}
              {"\n"}
              {row.public_id}
            </Text>
            <Text style={styles.tableCell}>{row.kind}</Text>
            <Text style={styles.tableCell}>{row.country || "Unknown"}</Text>
            <Text style={styles.tableCell}>{String(row.total_likes ?? 0)}</Text>
            <Text style={styles.tableCell}>{String(row.total_passes ?? 0)}</Text>
            <Text style={styles.tableCell}>{row.is_activated ? "Yes" : "No"}</Text>
            <Text style={styles.tableCell}>{row.threshold_plus_30 ? "Reached" : "Pending"}</Text>
            <Text style={styles.tableCell}>
              {row.dummy_batch_key ? `${row.dummy_batch_key}\nGen ${row.generation_version ?? "—"}` : "—"}
            </Text>
            <Text style={styles.tableCell}>{formatDate(row.last_decision_at)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function ProfileDetailDrawer({
  publicId,
  detailState,
  onClose,
}: {
  publicId: string;
  detailState: ApiState<ProfileDetail> & { refresh: () => void };
  onClose: () => void;
}) {
  const visible = Boolean(publicId);
  useBodyScrollLock(visible);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissLayer} onPress={onClose} />
        <View style={styles.drawerPanel}>
          <View style={styles.drawerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Profile detail</Text>
              <Text style={styles.metricDetail}>{publicId}</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={detailState.refresh}>
              <Feather name="refresh-cw" size={18} color={adminColors.ink} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <Feather name="x" size={20} color={adminColors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator>
            <StateBlock
              loading={detailState.loading}
              error={detailState.error}
              empty={!detailState.loading && !detailState.data ? "Profile not found." : undefined}
            />
            {detailState.data ? (
              <>
                <KeyValueList
                  items={[
                    { label: "Public id", value: detailState.data.profile.public_id },
                    { label: "Profile id", value: detailState.data.profile.profile_id },
                    { label: "Kind", value: detailState.data.profile.kind },
                    { label: "Name", value: detailState.data.profile.display_name || "—" },
                    { label: "Location", value: detailState.data.profile.location || "—" },
                    {
                      label: "Age / DOB",
                      value: `${calculateAge(detailState.data.profile.date_of_birth) ?? "—"} / ${
                        detailState.data.profile.date_of_birth || "—"
                      }`,
                    },
                    {
                      label: "Gender / pronouns",
                      value: `${detailState.data.profile.gender_identity || "—"} / ${
                        detailState.data.profile.pronouns || "—"
                      }`,
                    },
                    {
                      label: "Activation",
                      value: detailState.data.profile.is_activated ? "Activated" : "Not activated",
                    },
                    {
                      label: "Onboarding",
                      value: detailState.data.profile.onboarding_status || "—",
                    },
                    {
                      label: "Threshold",
                      value: detailState.data.profile.threshold_reached ? "Reached" : "Pending",
                    },
                    {
                      label: "Discoverable / ready media",
                      value: `${detailState.data.profile.is_discoverable ? "Discoverable" : "Hidden"} / ${
                        detailState.data.profile.has_ready_media ? "Ready" : "Missing"
                      }`,
                    },
                    {
                      label: "Likes / passes / decisions",
                      value: `${detailState.data.profile.total_likes ?? 0} / ${
                        detailState.data.profile.total_passes ?? 0
                      } / ${detailState.data.profile.total_decisions}`,
                    },
                    {
                      label: "Latest interaction",
                      value: formatTimestamp(detailState.data.profile.last_interaction_at),
                    },
                    {
                      label: "Dummy batch",
                      value: detailState.data.profile.dummy_batch_key
                        ? `${detailState.data.profile.dummy_batch_key} / gen ${
                            detailState.data.profile.generation_version ?? "—"
                          }`
                        : "—",
                    },
                    {
                      label: "Projection",
                      value: `${detailState.data.profile.rebuild_status || "—"} / ${
                        detailState.data.profile.last_recomputed_at
                          ? formatTimestamp(detailState.data.profile.last_recomputed_at)
                          : "—"
                      }`,
                    },
                  ]}
                />
                <Section title="Profile images">
                  <View style={styles.galleryGrid}>
                    {detailState.data.images.length ? (
                      detailState.data.images.map((image) => (
                        <View key={image.mediaAssetId} style={styles.galleryCard}>
                          {image.publicUrl ? (
                            <Image
                              source={{ uri: image.publicUrl }}
                              style={styles.galleryImage}
                              resizeMode="cover"
                              onError={(event) => {
                                if (Platform.OS === "web") {
                                  console.warn("[admin-image] failed", {
                                    mediaAssetId: image.mediaAssetId,
                                    publicUrl: image.publicUrl,
                                    error: event.nativeEvent,
                                  });
                                }
                              }}
                            />
                          ) : (
                            <View style={[styles.galleryImage, styles.galleryImagePlaceholder]}>
                              <Feather name="image" size={24} color={adminColors.muted} />
                            </View>
                          )}
                          <Text style={styles.galleryTitle}>
                            #{image.sortOrder} {image.isPrimary ? "Primary" : ""}
                          </Text>
                          <Text style={styles.galleryMeta}>
                            {image.status} · {image.mimeType}
                          </Text>
                          <Text style={styles.galleryMeta} numberOfLines={2}>
                            {image.publicUrl || "No public URL"}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.metricDetail}>No images attached.</Text>
                    )}
                  </View>
                </Section>
                <View style={styles.twoColumn}>
                  <Section title="About and attributes">
                    <KeyValueList
                      items={[
                        { label: "Occupation", value: detailState.data.profile.profession || "—" },
                        { label: "Bio", value: detailState.data.profile.bio || "—" },
                        {
                          label: "Relationship goal",
                          value: detailState.data.profile.relationship_goals || "—",
                        },
                        { label: "Personality", value: detailState.data.profile.personality || "—" },
                        { label: "Education", value: detailState.data.profile.education || "—" },
                        {
                          label: "Children preference",
                          value: detailState.data.profile.children_preference || "—",
                        },
                        { label: "Body type", value: detailState.data.profile.body_type || "—" },
                        { label: "Height", value: detailState.data.profile.height || "—" },
                        { label: "Hair color", value: detailState.data.profile.hair_color || "—" },
                        { label: "Ethnicity", value: detailState.data.profile.ethnicity || "—" },
                      ]}
                    />
                  </Section>
                  <Section title="Languages, interests, categories">
                    <KeyValueList
                      items={[
                        {
                          label: "Languages",
                          value:
                            detailState.data.languages
                              .map((language) =>
                                language.is_primary
                                  ? `${language.language_code} (primary)`
                                  : language.language_code
                              )
                              .join(", ") || "—",
                        },
                        {
                          label: "Interests",
                          value:
                            detailState.data.interests
                              .map((interest) => interest.interest_code)
                              .join(", ") || "—",
                        },
                        {
                          label: "Categories",
                          value:
                            detailState.data.categoryValues
                              .map((item) => `${item.category_code}: ${item.value_key}`)
                              .join("\n") || "—",
                        },
                      ]}
                    />
                  </Section>
                </View>
                <Section title="Recent decisions">
                  <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
                    <View style={styles.table}>
                      <View style={[styles.tableRow, styles.tableHeaderRow]}>
                        {["Event", "Type", "Target", "Created"].map((header) => (
                          <Text key={header} style={[styles.tableCell, styles.tableHeaderCell]}>
                            {header}
                          </Text>
                        ))}
                      </View>
                      {detailState.data.recentDecisions.map((row) => (
                        <View key={row.id} style={styles.tableRow}>
                          <Text style={styles.tableCell}>{row.id}</Text>
                          <Text style={styles.tableCell}>{row.interaction_type}</Text>
                          <Text style={styles.tableCell}>{row.target_profile_public_id}</Text>
                          <Text style={styles.tableCell}>{formatTimestamp(row.created_at)}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </Section>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DeleteBatchConfirmationModal({
  preview,
  confirmBatchKey,
  setConfirmBatchKey,
  deleting,
  onCancel,
  onConfirm,
}: {
  preview: GeneratedBatchDeletePreview | null;
  confirmBatchKey: string;
  setConfirmBatchKey: (value: string) => void;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const visible = Boolean(preview);
  useBodyScrollLock(visible);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissLayer} onPress={onCancel} />
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Delete selected batch</Text>
          {preview ? (
            <>
              <Text style={styles.confirmBody}>
                This will permanently delete only dummy profiles in{" "}
                <Text style={styles.confirmStrong}>{preview.batchKey}</Text> generation{" "}
                <Text style={styles.confirmStrong}>{preview.generationVersion}</Text>.
              </Text>
              <KeyValueList
                items={[
                  { label: "Profiles", value: preview.profileCount },
                  { label: "Female / male / other", value: `${preview.femaleCount} / ${preview.maleCount} / ${preview.otherCount}` },
                  { label: "Ready media", value: preview.readyMediaCount },
                  { label: "Decisions", value: preview.deletedDecisions },
                  { label: "Interactions", value: preview.deletedInteractions },
                  { label: "Queue rows", value: preview.deletedQueueRows },
                  { label: "Media assets", value: preview.deletedMediaAssets },
                  { label: "Dummy users", value: preview.deletedUsers },
                ]}
              />
              <Text style={styles.metricDetail}>
                Type the batch key to confirm: {preview.batchKey}
              </Text>
              <TextInput
                value={confirmBatchKey}
                onChangeText={setConfirmBatchKey}
                placeholder="Type batch key"
                placeholderTextColor={adminColors.muted}
                style={styles.searchInput}
              />
            </>
          ) : null}
          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={onCancel} disabled={deleting}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.dangerButton,
                (!preview ||
                  deleting ||
                  confirmBatchKey.trim() !== preview.batchKey ||
                  preview.profileCount === 0) &&
                  styles.buttonDisabled,
              ]}
              onPress={onConfirm}
              disabled={
                !preview ||
                deleting ||
                confirmBatchKey.trim() !== preview.batchKey ||
                preview.profileCount === 0
              }
            >
              <Text style={styles.dangerButtonText}>
                {deleting ? "Deleting..." : "Delete selected batch"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function AdminOverviewScreen() {
  const [timeframe, setTimeframe] = useState("1m");
  const [country, setCountry] = useState("all");
  const apiPath = `/api/admin/stats/overview.json${buildQuery({ timeframe, country })}`;
  const { data, loading, error, fetchedAt, refreshing, refresh } = useAdminApi<Overview>(
    apiPath,
    DEFAULT_ADMIN_DASHBOARD_POLL_MS
  );

  return (
    <AdminLayout
      title="Overview"
      subtitle="Activation, discovery, and dummy-population health from the backend metrics service."
      fetchedAt={fetchedAt}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <StateBlock loading={loading} error={error} />
      {data ? (
        <>
          <View style={styles.filters}>
            <View style={styles.chipRow}>
              {timeframes.map(([value, label]) => (
                <FilterChip
                  key={value}
                  label={label}
                  active={timeframe === value}
                  onPress={() => setTimeframe(value)}
                />
              ))}
            </View>
            <View style={styles.countryRow}>
              <FilterChip label="All countries" active={country === "all"} onPress={() => setCountry("all")} />
              {data.availableCountries.slice(0, 8).map((row) => (
                <FilterChip
                  key={row.country}
                  label={`${row.country || "Unknown"} (${row.profile_count})`}
                  active={country === row.country}
                  onPress={() => setCountry(row.country || "Unknown")}
                />
              ))}
            </View>
          </View>
          <View style={styles.metricGrid}>
            <MetricCard label="Real users" value={data.counts.real_users} />
            <MetricCard label="Dummy profiles" value={data.counts.dummy_profiles} />
            <MetricCard label="Decisions" value={data.counts.total_decisions} detail={timeframe} />
            <MetricCard label="Likes" value={data.counts.total_likes} detail="Discovery activity" />
            <MetricCard label="Passes" value={data.counts.total_passes} detail="Discovery activity" />
            <MetricCard label="Active users" value={data.counts.active_interacting_users} detail={timeframe} />
            <MetricCard label="Activated" value={data.counts.users_activated} />
            <MetricCard label="Not activated" value={data.counts.users_not_activated} />
          </View>
          <Section title="Activation Funnel">
            <View style={styles.funnel}>
              {(
                [
                  ["Signed up", data.funnel.signedUp],
                  ["Onboarded", data.funnel.onboarded],
                  ["Activated", data.funnel.activated],
                  ["Reached threshold", data.funnel.reachedThreshold],
                ] as [string, { count: string; pctFromPrevious: string; pctFromSignedUp: string }][]
              ).map(([label, stage], index) => (
                <View key={label} style={styles.funnelCard}>
                  <Text style={styles.funnelStep}>0{index + 1}</Text>
                  <Text style={styles.funnelValue}>{formatNumber(stage.count)}</Text>
                  <Text style={styles.funnelLabel}>{label}</Text>
                  <Text style={styles.metricDetail}>
                    {stage.pctFromPrevious} from previous · {stage.pctFromSignedUp} total
                  </Text>
                </View>
              ))}
            </View>
          </Section>
          <View style={styles.twoColumn}>
            <Section title="Discovery Leaders">
              <AdminSimpleTable
                headers={["User", "Country", "Likes", "Passes", "Last"]}
                rows={data.interactedUsers.slice(0, 8).map((row) => [
                  row.display_name,
                  row.country || "Unknown",
                  row.likes_count,
                  row.passes_count,
                  formatDate(row.last_interaction_at),
                ])}
                empty="No interacting users for this filter."
              />
            </Section>
            <Section title="Threshold Buckets">
              <AdminSimpleTable
                headers={["Bucket", "Profiles"]}
                rows={data.thresholds.map((row) => [row.bucket, row.count])}
                empty="No threshold data."
              />
            </Section>
          </View>
          <View style={styles.twoColumn}>
            <Section title="Real Users By Country">
              <AdminSimpleTable
                headers={["Country", "Profiles"]}
                rows={data.realUserCountryDistribution.slice(0, 10).map((row) => [
                  row.country || "Unknown",
                  row.profile_count,
                ])}
                empty="No country rows."
              />
            </Section>
            <Section title="Active Dummy Batch">
              <View style={styles.batchHero}>
                <Text style={styles.batchKey}>{data.activeBatch?.dummy_batch_key || "No active batch"}</Text>
                <Text style={styles.metricDetail}>
                  Generation {data.activeBatch?.generation_version ?? "n/a"}
                </Text>
              </View>
              <AdminSimpleTable
                headers={["Gender", "Profiles"]}
                rows={data.genderDistribution.map((row) => [
                  row.gender_identity || "Unknown",
                  row.profile_count,
                ])}
                empty="No active batch distribution."
              />
            </Section>
          </View>
        </>
      ) : null}
    </AdminLayout>
  );
}

export function AdminUsersScreen() {
  const params = useLocalSearchParams<{
    q?: string;
    kind?: string;
    activation?: string;
    selectedPublicId?: string;
  }>();
  const [search, setSearch] = useState(normalizeRouteParam(params.q));
  const [kind, setKind] = useState(normalizeRouteParam(params.kind, "all") || "all");
  const [activation, setActivation] = useState(
    normalizeRouteParam(params.activation, "all") || "all"
  );
  const selectedPublicId = normalizeRouteParam(params.selectedPublicId);

  useEffect(() => {
    setSearch(normalizeRouteParam(params.q));
    setKind(normalizeRouteParam(params.kind, "all") || "all");
    setActivation(normalizeRouteParam(params.activation, "all") || "all");
  }, [params.q, params.kind, params.activation]);

  const apiPath = `/api/admin/stats/users.json${buildQuery({
    q: search,
    kind,
    activation,
  })}`;
  const usersState = useAdminApi<UsersPayload>(apiPath, DEFAULT_ADMIN_DASHBOARD_POLL_MS);
  const detailState = useAdminApi<ProfileDetail>(
    selectedPublicId ? `/api/admin/profiles/${encodeURIComponent(selectedPublicId)}` : null
  );
  const users = usersState.data?.users ?? [];

  const openProfile = (publicId: string) => {
    router.push({
      pathname: "/admin/users",
      params: {
        q: search || undefined,
        kind: kind !== "all" ? kind : undefined,
        activation: activation !== "all" ? activation : undefined,
        selectedPublicId: publicId,
      },
    });
  };

  const closeProfile = () => {
    router.replace({
      pathname: "/admin/users",
      params: {
        q: search || undefined,
        kind: kind !== "all" ? kind : undefined,
        activation: activation !== "all" ? activation : undefined,
      },
    });
  };

  return (
    <AdminLayout
      title="Users"
      subtitle="Search real and dummy profiles with activation, threshold, projection, and media detail."
      fetchedAt={usersState.fetchedAt}
      refreshing={usersState.refreshing}
      onRefresh={usersState.refresh}
    >
      <View style={styles.filters}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, public id, or batch"
          placeholderTextColor={adminColors.muted}
          style={styles.searchInput}
        />
        <View style={styles.chipRow}>
          {["all", "user", "dummy"].map((value) => (
            <FilterChip
              key={value}
              label={value === "all" ? "All kinds" : value === "user" ? "Real users" : "Dummy"}
              active={kind === value}
              onPress={() => setKind(value)}
            />
          ))}
          {["all", "activated", "not_activated"].map((value) => (
            <FilterChip
              key={value}
              label={
                value === "all" ? "Any activation" : value === "activated" ? "Activated" : "Not activated"
              }
              active={activation === value}
              onPress={() => setActivation(value)}
            />
          ))}
        </View>
      </View>
      <StateBlock
        loading={usersState.loading}
        error={usersState.error}
        empty={!usersState.loading && users.length === 0 ? "No users match these filters." : undefined}
      />
      {users.length ? (
        <Section title={`${users.length.toLocaleString()} Profiles`}>
          <UsersTable rows={users.slice(0, 150)} onSelect={openProfile} />
          {users.length > 150 ? (
            <Text style={styles.tableFootnote}>
              Showing first 150 rows. Narrow the filters for a smaller operational view.
            </Text>
          ) : null}
        </Section>
      ) : null}
      <ProfileDetailDrawer
        publicId={selectedPublicId}
        detailState={detailState}
        onClose={closeProfile}
      />
    </AdminLayout>
  );
}

export function AdminDatabaseScreen() {
  const databaseState = useAdminApi<DatabasePayload>(
    "/api/admin/stats/database.json",
    DEFAULT_ADMIN_DASHBOARD_POLL_MS
  );
  const generatedBatchesState = useAdminApi<GeneratedBatchesPayload>(
    "/api/admin/generated-batches",
    DEFAULT_ADMIN_DASHBOARD_POLL_MS
  );
  const schemaWarnings = [
    ...(databaseState.data?.schemaStatus.missingRequiredRelations ?? []),
    ...(databaseState.data?.schemaStatus.missingRequiredColumns ?? []),
    ...(databaseState.data?.schemaStatus.warnings ?? []),
  ];
  const batches = generatedBatchesState.data?.batches ?? [];
  const [selectedBatchKey, setSelectedBatchKey] = useState("");
  const [preview, setPreview] = useState<GeneratedBatchDeletePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmBatchKey, setConfirmBatchKey] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!batches.length) {
      setSelectedBatchKey("");
      return;
    }
    const exists = batches.some(
      (batch) => `${batch.batchKey}:${batch.generationVersion}` === selectedBatchKey
    );
    if (!exists) {
      setSelectedBatchKey(`${batches[0]!.batchKey}:${batches[0]!.generationVersion}`);
    }
  }, [batches, selectedBatchKey]);

  const selectedBatch = batches.find(
    (batch) => `${batch.batchKey}:${batch.generationVersion}` === selectedBatchKey
  );

  const previewDelete = async () => {
    if (!selectedBatch) return;
    setPreviewLoading(true);
    setFeedback(null);
    try {
      const payload = await fetchAdminJson<GeneratedBatchDeletePreview>(
        `/api/admin/generated-batches/${encodeURIComponent(
          selectedBatch.batchKey
        )}/${selectedBatch.generationVersion}/delete-preview`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setPreview(payload.data);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Delete preview failed.",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!preview) return;
    setDeleteLoading(true);
    setFeedback(null);
    try {
      const payload = await fetchAdminJson<GeneratedBatchDeletePreview & { deletedBatchKey: string }>(
        `/api/admin/generated-batches/${encodeURIComponent(
          preview.batchKey
        )}/${preview.generationVersion}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            confirmBatchKey,
            confirmGenerationVersion: preview.generationVersion,
          }),
        }
      );
      setFeedback({
        tone: "success",
        message: `Deleted ${payload.data.deletedProfiles} profiles from ${payload.data.deletedBatchKey} generation ${payload.data.generationVersion}.`,
      });
      setPreview(null);
      setConfirmBatchKey("");
      setDeleteModalOpen(false);
      await Promise.all([databaseState.refresh(), generatedBatchesState.refresh()]);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Batch deletion failed.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Database"
      subtitle="Schema presence, table freshness, generated-batch controls, and approved source/projection monitoring."
      fetchedAt={databaseState.fetchedAt}
      refreshing={databaseState.refreshing || generatedBatchesState.refreshing}
      onRefresh={() => {
        void Promise.all([databaseState.refresh(), generatedBatchesState.refresh()]);
      }}
    >
      <StateBlock loading={databaseState.loading} error={databaseState.error} />
      {generatedBatchesState.error ? <Banner tone="error" message={generatedBatchesState.error} /> : null}
      {feedback ? <Banner tone={feedback.tone} message={feedback.message} /> : null}
      {databaseState.data ? (
        <>
          <View style={styles.metricGrid}>
            <MetricCard label="Tracked tables" value={databaseState.data.tableStats.length} />
            <MetricCard
              label="Present"
              value={databaseState.data.tableStats.filter((table) => table.present).length}
              detail="Required and optional"
            />
            <MetricCard label="Schema warnings" value={schemaWarnings.length} detail="Drift checks" />
          </View>
          {schemaWarnings.length ? (
            <Banner tone="warning" message={schemaWarnings.join(" · ")} />
          ) : (
            <View style={styles.healthyCard}>
              <Feather name="check-circle" size={22} color={Colors.primaryLight} />
              <Text style={styles.healthyText}>Approved schema checks are passing.</Text>
            </View>
          )}
          <Section title="Generated batches" tone="danger">
            <Text style={styles.metricDetail}>
              Protected destructive control. This flow only deletes the selected dummy batch after preview and typed confirmation.
            </Text>
            <BatchSelect
              batches={batches}
              selectedKey={selectedBatchKey}
              onSelect={(value) => {
                setSelectedBatchKey(value);
                setPreview(null);
                setConfirmBatchKey("");
                setFeedback(null);
              }}
            />
            {selectedBatch ? (
              <KeyValueList
                items={[
                  { label: "Profiles", value: selectedBatch.profileCount },
                  {
                    label: "Female / male / other",
                    value: `${selectedBatch.femaleCount} / ${selectedBatch.maleCount} / ${selectedBatch.otherCount}`,
                  },
                  { label: "Ready media", value: selectedBatch.readyMediaCount },
                  { label: "Latest created", value: formatTimestamp(selectedBatch.latestCreatedAt) },
                  { label: "Latest updated", value: formatTimestamp(selectedBatch.latestUpdatedAt) },
                ]}
              />
            ) : (
              <Text style={styles.metricDetail}>No generated dummy batches found.</Text>
            )}
            {preview ? (
              <KeyValueList
                items={[
                  { label: "Delete preview: profiles", value: preview.deletedProfiles },
                  { label: "Dummy metadata", value: preview.deletedDummyMetadata },
                  { label: "Media assets", value: preview.deletedMediaAssets },
                  { label: "Profile images", value: preview.deletedProfileImages },
                  { label: "Decisions", value: preview.deletedDecisions },
                  { label: "Interactions", value: preview.deletedInteractions },
                  { label: "Queue rows", value: preview.deletedQueueRows },
                  { label: "Users", value: preview.deletedUsers },
                ]}
              />
            ) : null}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.secondaryButton, (!selectedBatch || previewLoading) && styles.buttonDisabled]}
                onPress={previewDelete}
                disabled={!selectedBatch || previewLoading}
              >
                <Text style={styles.secondaryButtonText}>
                  {previewLoading ? "Loading preview..." : "Preview deletion"}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.dangerButton,
                  (!preview || preview.profileCount === 0) && styles.buttonDisabled,
                ]}
                onPress={() => {
                  if (!preview || preview.profileCount === 0) return;
                  setConfirmBatchKey("");
                  setDeleteModalOpen(true);
                }}
                disabled={!preview || preview.profileCount === 0}
              >
                <Text style={styles.dangerButtonText}>Delete selected batch</Text>
              </Pressable>
            </View>
          </Section>
          {databaseState.data.metricGroups.map((group) => (
            <Section key={group.title} title={group.title}>
              <View style={styles.metricGrid}>
                {group.metrics.map((metric) => (
                  <MetricCard
                    key={`${group.title}-${metric.label}`}
                    label={metric.label}
                    value={metric.value}
                    detail={metric.detail}
                  />
                ))}
              </View>
            </Section>
          ))}
          <Section title="Table Freshness">
            <AdminSimpleTable
              headers={["Relation", "Role", "Present", "Rows", "Freshness"]}
              rows={databaseState.data.tableStats.map((table) => [
                `${table.schema}.${table.table}`,
                table.role,
                table.present ? "Yes" : "No",
                table.present ? table.rowCount ?? 0 : "—",
                table.freshness ? formatDate(table.freshness) : "—",
              ])}
              empty="No table stats available."
            />
          </Section>
        </>
      ) : null}
      <DeleteBatchConfirmationModal
        preview={deleteModalOpen ? preview : null}
        confirmBatchKey={confirmBatchKey}
        setConfirmBatchKey={setConfirmBatchKey}
        deleting={deleteLoading}
        onCancel={() => {
          setConfirmBatchKey("");
          if (deleteLoading) return;
          setDeleteModalOpen(false);
        }}
        onConfirm={confirmDelete}
      />
    </AdminLayout>
  );
}

export function AdminStudyScreen() {
  const params = useLocalSearchParams<{
    testRunId?: string;
    compareTestRunId?: string;
  }>();
  const [testRunId, setTestRunId] = useState(normalizeRouteParam(params.testRunId));
  const [compareTestRunId, setCompareTestRunId] = useState(normalizeRouteParam(params.compareTestRunId));

  useEffect(() => {
    setTestRunId(normalizeRouteParam(params.testRunId));
    setCompareTestRunId(normalizeRouteParam(params.compareTestRunId));
  }, [params.testRunId, params.compareTestRunId]);

  const apiPath = `/api/admin/stats/study.json${buildQuery({
    testRunId: testRunId || null,
    compareTestRunId: compareTestRunId || null,
  })}`;
  const studyState = useAdminApi<StudyPayload>(apiPath, DEFAULT_ADMIN_DASHBOARD_POLL_MS);
  const data = studyState.data;

  const userRows = (data?.users ?? []).map((user) => [
    user.label,
    user.engagementStatus.replace(/_/g, " "),
    user.onboardingStatus,
    user.activationStatus,
    formatDate(user.lastActive),
    user.sessionCount,
    `${Math.round(user.totalActiveSeconds / 60)}m`,
    user.likes,
    user.passes,
    user.cardsViewed,
    user.reliabilityErrors,
  ]);

  const scorecardRows = (data?.scorecard ?? []).map((row) => [row.label, row.status]);
  const funnelRows = data ? Object.entries(data.funnel).map(([key, value]) => [key.replace(/_/g, " "), value]) : [];
  const screenRows = (data?.screenUsage ?? []).map((row) => [
    row.screen_name,
    row.area_name || "—",
    row.segments,
    `${Math.round(row.total_ms / 60000)}m`,
    `${Math.round(row.average_ms / 1000)}s`,
  ]);

  return (
    <AdminLayout
      title="Study"
      subtitle="Test runs, screen time, discovery behavior, goals behavior, and engagement by real users."
      fetchedAt={studyState.fetchedAt}
      refreshing={studyState.refreshing}
      onRefresh={studyState.refresh}
    >
      <StateBlock loading={studyState.loading} error={studyState.error} />
      {data ? (
        <>
          <View style={styles.metricGrid}>
            <MetricCard label="Participants" value={data.summary.participants} />
            <MetricCard label="Active users" value={data.summary.activeUsers} />
            <MetricCard label="Sessions" value={data.summary.totalSessions} />
            <MetricCard label="Total app time" value={`${Math.round(data.summary.totalActiveSeconds / 60)}m`} />
            <MetricCard label="Avg session" value={`${Math.round(data.summary.averageSessionSeconds / 60)}m`} />
            <MetricCard label="Decisions" value={data.summary.totalDiscoveryDecisions} />
          </View>

          <Section title="Test Management">
            <View style={styles.chipRow}>
              {data.testRuns.slice(0, 8).map((run) => (
                <FilterChip
                  key={run.id}
                  label={`${run.name} (${run.status})`}
                  active={testRunId === run.id}
                  onPress={() => setTestRunId(run.id)}
                />
              ))}
            </View>
            <KeyValueList
              items={[
                { label: "Selected run", value: data.selectedTestRunId || "Auto" },
                { label: "Compare run", value: data.compareTestRunId || "None" },
                { label: "Active run", value: data.activeTestRun?.name || "None" },
                { label: "Analytics enabled", value: data.analyticsEnabled ? "Yes" : "No" },
              ]}
            />
          </Section>

          <View style={styles.twoColumn}>
            <Section title="Scorecard">
              <AdminSimpleTable headers={["Signal", "Status"]} rows={scorecardRows} empty="No scorecard data." />
            </Section>
            <Section title="Funnel">
              <AdminSimpleTable headers={["Stage", "Count"]} rows={funnelRows} empty="No funnel data." />
            </Section>
          </View>

          <Section title="Time and Screen Usage">
            <AdminSimpleTable
              headers={["Screen", "Area", "Segments", "Total", "Average"]}
              rows={screenRows}
              empty="No screen time data."
            />
          </Section>

          <View style={styles.twoColumn}>
            <Section title="Discovery Behaviour">
              <AdminSimpleTable
                headers={["Event", "Count", "Users"]}
                rows={(data.discovery ?? []).map((row) => [row.event_name, row.count, row.users])}
                empty="No discovery data."
              />
            </Section>
            <Section title="Goals Behaviour">
              <AdminSimpleTable
                headers={["Event", "Count", "Users"]}
                rows={(data.goals ?? []).map((row) => [row.event_name, row.count, row.users])}
                empty="No goals data."
              />
            </Section>
          </View>

          <Section title="Reliability / Friction">
            <AdminSimpleTable
              headers={["Event", "Count", "Users"]}
              rows={(data.friction ?? []).map((row) => [row.event_name, row.count, row.users])}
              empty="No friction data."
            />
          </Section>

          <Section title="User Table">
            <AdminSimpleTable
              headers={["User", "Engagement", "Onboarding", "Activation", "Last active", "Sessions", "Time", "Likes", "Passes", "Cards", "Errors"]}
              rows={userRows.map((row) => row as Array<string | number>)}
              empty="No users in this study run."
            />
            <Text style={styles.tableFootnote}>
              Open a user in the backend Study page for the readable activity timeline.
            </Text>
          </Section>
        </>
      ) : null}
    </AdminLayout>
  );
}

function AdminSimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
  empty: string;
}) {
  if (!rows.length) {
    return <StateBlock empty={empty} />;
  }

  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {headers.map((header) => (
            <Text key={header} style={[styles.tableCell, styles.tableHeaderCell]}>
              {header}
            </Text>
          ))}
        </View>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tableRow}>
            {row.map((cell, cellIndex) => (
              <Text key={`${rowIndex}-${cellIndex}`} style={styles.tableCell}>
                {String(cell ?? "—")}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: "100vh" as never,
    backgroundColor: "#edf2e9",
    flexDirection: "row",
  },
  shellMobile: {
    flexDirection: "column",
  },
  sidebarScroll: {
    width: 168,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sidebarScrollCompact: {
    width: 152,
  },
  sidebarScrollMobile: {
    width: "100%" as never,
    flexGrow: 0,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sidebarInner: {
    padding: 10,
    paddingBottom: 14,
    gap: 10,
  },
  sidebarInnerCompact: {
    paddingHorizontal: 8,
  },
  sidebarInnerMobile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 12,
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,243,238,0.08)",
  },
  brandHeaderMobile: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  brandCopy: {
    minWidth: 72,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  brandMarkText: {
    color: Colors.ivory,
    fontSize: 14,
    fontWeight: "800",
  },
  brandTitle: {
    color: Colors.ivory,
    fontSize: 14,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: Colors.textSecondary,
    marginTop: 0,
    fontSize: 10,
    fontWeight: "700",
  },
  nav: {
    gap: 4,
  },
  navMobile: {
    flexDirection: "row",
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 9,
  },
  navItemCompact: {
    paddingHorizontal: 7,
  },
  navItemMobile: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  navItemHover: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  navItemPressed: {
    opacity: 0.82,
  },
  navItemActive: {
    backgroundColor: Colors.primary,
  },
  navLabel: {
    color: adminColors.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  navLabelActive: {
    color: Colors.ivory,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 56,
    gap: 18,
  },
  contentInnerCompact: {
    paddingHorizontal: 18,
  },
  contentInnerMobile: {
    padding: 16,
    paddingBottom: 40,
  },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
  },
  topbarActions: {
    alignItems: "flex-end",
    gap: 10,
  },
  kicker: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: adminColors.ink,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 3,
  },
  subtitle: {
    color: adminColors.muted,
    fontSize: 15,
    marginTop: 6,
    maxWidth: 760,
  },
  freshness: {
    color: adminColors.muted,
    fontSize: 12,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.ivory,
    borderWidth: 1,
    borderColor: adminColors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  refreshText: {
    color: adminColors.ink,
    fontWeight: "800",
  },
  filters: {
    backgroundColor: adminColors.panel,
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  countryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: adminColors.border,
    backgroundColor: "#ffffff",
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  chipText: {
    color: adminColors.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  chipTextActive: {
    color: Colors.ivory,
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 16,
    color: adminColors.ink,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  metricCard: {
    minWidth: 210,
    flexGrow: 1,
    flexBasis: 210,
    backgroundColor: adminColors.panel,
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 24,
    padding: 18,
  },
  metricLabel: {
    color: adminColors.muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  metricValue: {
    color: adminColors.ink,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 8,
  },
  metricDetail: {
    color: adminColors.muted,
    marginTop: 7,
    fontSize: 12,
  },
  section: {
    backgroundColor: adminColors.panel,
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionDanger: {
    borderColor: "#e6b6b1",
    backgroundColor: adminColors.dangerSoft,
  },
  sectionTitle: {
    color: adminColors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  funnel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  funnelCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 16,
  },
  funnelStep: {
    color: Colors.primary,
    fontWeight: "900",
  },
  funnelValue: {
    color: adminColors.ink,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
  },
  funnelLabel: {
    color: adminColors.ink,
    fontWeight: "900",
    marginTop: 2,
  },
  twoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  table: {
    minWidth: 760,
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 18,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  tableRowInteractive: {
    cursor: "pointer" as never,
  },
  tableRowPressed: {
    backgroundColor: "#f6fbf7",
  },
  tableHeaderRow: {
    backgroundColor: adminColors.panelAlt,
  },
  tableCell: {
    width: 150,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: adminColors.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  tableCellPrimary: {
    fontWeight: "700",
  },
  tableHeaderCell: {
    color: Colors.primaryDark,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  tableFootnote: {
    color: adminColors.muted,
    fontSize: 12,
  },
  batchHero: {
    backgroundColor: Colors.background,
    borderRadius: 18,
    padding: 16,
  },
  batchKey: {
    color: Colors.ivory,
    fontSize: 22,
    fontWeight: "900",
  },
  stateCard: {
    backgroundColor: adminColors.panel,
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  stateText: {
    color: adminColors.muted,
    fontWeight: "700",
    flex: 1,
  },
  errorCard: {
    borderColor: "#efb7b7",
    backgroundColor: "#fff5f5",
  },
  errorText: {
    color: adminColors.danger,
    fontWeight: "800",
    flex: 1,
  },
  warningCard: {
    borderColor: "#f3d19c",
    backgroundColor: "#fff8e8",
  },
  warningText: {
    color: adminColors.warning,
    fontWeight: "800",
    flex: 1,
  },
  successCard: {
    borderColor: "#b6e0c2",
    backgroundColor: adminColors.successSoft,
  },
  successText: {
    color: adminColors.success,
    fontWeight: "800",
    flex: 1,
  },
  healthyCard: {
    backgroundColor: adminColors.successSoft,
    borderWidth: 1,
    borderColor: "#b6e0c2",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  healthyText: {
    color: Colors.primaryDark,
    fontWeight: "900",
  },
  selectWrap: {
    gap: 8,
  },
  selectButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectButtonText: {
    color: adminColors.ink,
    fontWeight: "800",
    fontSize: 14,
  },
  selectButtonDetail: {
    color: adminColors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  selectList: {
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  selectOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  selectOptionActive: {
    backgroundColor: "#f3f8f3",
  },
  selectOptionTitle: {
    color: adminColors.ink,
    fontWeight: "800",
  },
  selectOptionDetail: {
    color: adminColors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: adminColors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  secondaryButtonText: {
    color: adminColors.ink,
    fontWeight: "800",
  },
  dangerButton: {
    backgroundColor: adminColors.danger,
    borderWidth: 1,
    borderColor: adminColors.danger,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  dangerButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.48,
  },
  inlineDangerLink: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  inlineDangerLinkText: {
    color: adminColors.danger,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 18, 14, 0.36)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    flexDirection: "row",
  },
  modalDismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerPanel: {
    width: "100%" as never,
    maxWidth: 1040,
    maxHeight: "92%" as never,
    backgroundColor: adminColors.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: adminColors.border,
    overflow: "hidden",
  },
  drawerHeader: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  drawerContent: {
    padding: 20,
    gap: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: adminColors.border,
  },
  confirmPanel: {
    width: "100%" as never,
    maxWidth: 680,
    backgroundColor: adminColors.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 22,
    gap: 16,
  },
  confirmTitle: {
    color: adminColors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  confirmBody: {
    color: adminColors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmStrong: {
    fontWeight: "900",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 12,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailCard: {
    minWidth: 180,
    flexGrow: 1,
    flexBasis: 180,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  detailLabel: {
    color: adminColors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  detailValueWrap: {
    minHeight: 24,
  },
  detailValue: {
    color: adminColors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  galleryCard: {
    width: 190,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: adminColors.border,
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  galleryImage: {
    width: "100%" as never,
    height: 244,
    borderRadius: 12,
    backgroundColor: "#e8eee9",
  },
  galleryImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  galleryTitle: {
    color: adminColors.ink,
    fontWeight: "800",
  },
  galleryMeta: {
    color: adminColors.muted,
    fontSize: 12,
  },
  sidebarDesktop: {
    width: 156,
    minWidth: 156,
    maxWidth: 156,
    flexBasis: 156,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    padding: 10,
    paddingBottom: 14,
    gap: 10,
  },

  sidebarDesktopCompact: {
    width: 148,
    minWidth: 148,
    maxWidth: 148,
    flexBasis: 148,
    paddingHorizontal: 8,
  },
});
