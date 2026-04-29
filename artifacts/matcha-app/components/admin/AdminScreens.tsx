import { Feather } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/colors";

type ApiState<T> = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  fetchedAt: string | null;
  data: T | null;
};

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

const timeframes = [
  ["now", "24h"],
  ["1w", "1w"],
  ["1m", "1m"],
  ["3m", "3m"],
  ["6m", "6m"],
  ["1y", "1y"],
  ["all", "All"],
] as const;

function formatNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : String(value ?? "0");
}

function formatDate(value: unknown) {
  if (!value) return "No activity yet";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "No activity yet" : date.toLocaleString();
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

function useAdminApi<T>(path: string, pollMs?: number) {
  const [state, setState] = useState<ApiState<T>>({
    loading: true,
    refreshing: false,
    error: null,
    fetchedAt: null,
    data: null,
  });

  const load = async (refresh = false) => {
    setState((current) => ({
      ...current,
      loading: current.data ? false : true,
      refreshing: refresh,
      error: null,
    }));
    try {
      const separator = path.includes("?") ? "&" : "?";
      const response = await fetch(refresh ? `${path}${separator}refresh=1` : path, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const message =
          response.status === 401
            ? "Admin authentication is required. Refresh after completing the Basic Auth prompt."
            : response.status === 404
              ? "Admin access is unavailable from this network or the dashboard is disabled."
              : `Admin API returned ${response.status}.`;
        throw new Error(message);
      }
      const payload = (await response.json()) as { fetchedAt: string; data: T };
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
    }
  };

  useEffect(() => {
    void load(false);
    if (!pollMs) return undefined;
    const timer = window.setInterval(() => {
      void load(false);
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [path, pollMs]);

  return { ...state, refresh: () => load(true) };
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
  const active = pathname === "/" ? "/admin" : pathname;

  const navItems = [
    { label: "Overview", path: "/admin", icon: "bar-chart-2" },
    { label: "Users", path: "/admin/users", icon: "users" },
    { label: "Database", path: "/admin/database", icon: "database" },
  ] as const;

  return (
    <View style={styles.shell}>
      <View style={styles.sidebarScroll}>
        <View style={styles.sidebarInner}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>M</Text>
        </View>
        <Text style={styles.brandTitle}>MatchA Admin</Text>
        <Text style={styles.brandSubtitle}>Internal operations</Text>
        <View style={styles.nav}>
          {navItems.map((item) => (
            <Pressable
              key={item.path}
              onPress={() => router.push(item.path as never)}
              style={[styles.navItem, active === item.path && styles.navItemActive]}
            >
              <Feather
                name={item.icon}
                size={17}
                color={active === item.path ? Colors.ivory : adminColors.muted}
              />
              <Text style={[styles.navLabel, active === item.path && styles.navLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.contentInner}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.kicker}>Protected dashboard</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.topbarActions}>
            <Text style={styles.freshness}>Fresh: {fetchedAt ? formatDate(fetchedAt) : "loading"}</Text>
            {onRefresh ? (
              <Pressable style={styles.refreshButton} onPress={onRefresh} disabled={refreshing}>
                <Feather name="refresh-cw" size={16} color={adminColors.ink} />
                <Text style={styles.refreshText}>{refreshing ? "Refreshing" : "Refresh"}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {children}
        </View>
      </View>
    </View>
  );
}

function StateBlock({ loading, error, empty }: { loading?: boolean; error?: string | null; empty?: string }) {
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

function MetricCard({ label, value, detail }: { label: string; value: unknown; detail?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{formatNumber(value)}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
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

export function AdminOverviewScreen() {
  const [timeframe, setTimeframe] = useState("1m");
  const [country, setCountry] = useState("all");
  const apiPath = `/api/admin/stats/overview.json${buildQuery({ timeframe, country })}`;
  const { data, loading, error, fetchedAt, refreshing, refresh } = useAdminApi<Overview>(
    apiPath,
    30000
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
                <View key={String(label)} style={styles.funnelCard}>
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
              <AdminTable
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
              <AdminTable
                headers={["Bucket", "Profiles"]}
                rows={data.thresholds.map((row) => [row.bucket, row.count])}
                empty="No threshold data."
              />
            </Section>
          </View>
          <View style={styles.twoColumn}>
            <Section title="Real Users By Country">
              <AdminTable
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
              <AdminTable
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
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [activation, setActivation] = useState("all");
  const apiPath = `/api/admin/stats/users.json${buildQuery({
    q: search,
    kind,
    activation,
  })}`;
  const { data, loading, error, fetchedAt, refreshing, refresh } = useAdminApi<UsersPayload>(apiPath);
  const users = data?.users ?? [];

  return (
    <AdminLayout
      title="Users"
      subtitle="Search real and dummy profiles with activation, threshold, and projection status."
      fetchedAt={fetchedAt}
      refreshing={refreshing}
      onRefresh={refresh}
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
      <StateBlock loading={loading} error={error} empty={!loading && users.length === 0 ? "No users match these filters." : undefined} />
      {users.length ? (
        <Section title={`${users.length.toLocaleString()} Profiles`}>
          <AdminTable
            headers={["Profile", "Kind", "Country", "Likes", "Passes", "Activated", "Threshold", "Batch", "Last decision"]}
            rows={users.slice(0, 150).map((row) => [
              `${row.display_name || row.public_id}\n${row.public_id}`,
              row.kind,
              row.country || "Unknown",
              row.total_likes ?? 0,
              row.total_passes ?? 0,
              row.is_activated ? "Yes" : "No",
              row.threshold_plus_30 ? "Reached" : "Pending",
              row.dummy_batch_key || "—",
              formatDate(row.last_decision_at),
            ])}
            empty="No users match these filters."
          />
          {users.length > 150 ? (
            <Text style={styles.tableFootnote}>Showing first 150 rows. Narrow the filters for a smaller operational view.</Text>
          ) : null}
        </Section>
      ) : null}
    </AdminLayout>
  );
}

export function AdminDatabaseScreen() {
  const { data, loading, error, fetchedAt, refreshing, refresh } =
    useAdminApi<DatabasePayload>("/api/admin/stats/database.json");
  const schemaWarnings = [
    ...(data?.schemaStatus.missingRequiredRelations ?? []),
    ...(data?.schemaStatus.missingRequiredColumns ?? []),
    ...(data?.schemaStatus.warnings ?? []),
  ];

  return (
    <AdminLayout
      title="Database"
      subtitle="Schema presence, table freshness, and approved source/projection monitoring."
      fetchedAt={fetchedAt}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <StateBlock loading={loading} error={error} />
      {data ? (
        <>
          <View style={styles.metricGrid}>
            <MetricCard label="Tracked tables" value={data.tableStats.length} />
            <MetricCard
              label="Present"
              value={data.tableStats.filter((table) => table.present).length}
              detail="Required and optional"
            />
            <MetricCard label="Schema warnings" value={schemaWarnings.length} detail="Drift checks" />
          </View>
          {schemaWarnings.length ? (
            <View style={[styles.stateCard, styles.warningCard]}>
              <Feather name="alert-triangle" size={22} color={adminColors.warning} />
              <Text style={styles.warningText}>{schemaWarnings.join(" · ")}</Text>
            </View>
          ) : (
            <View style={styles.healthyCard}>
              <Feather name="check-circle" size={22} color={Colors.primaryLight} />
              <Text style={styles.healthyText}>Approved schema checks are passing.</Text>
            </View>
          )}
          {data.metricGroups.map((group) => (
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
            <AdminTable
              headers={["Relation", "Role", "Present", "Rows", "Freshness"]}
              rows={data.tableStats.map((table) => [
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
    </AdminLayout>
  );
}

function AdminTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: unknown[][];
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

const adminColors = {
  ink: "#17211b",
  panel: "#fbfaf4",
  panelAlt: "#eef4ea",
  border: "#dbe5d9",
  muted: "#637268",
  danger: "#b42318",
  warning: "#b7791f",
};

const styles = StyleSheet.create({
  shell: {
    minHeight: "100vh" as never,
    backgroundColor: "#edf2e9",
    flexDirection: "row",
    alignItems: "flex-start",
    ...(Platform.OS === "web"
      ? ({
          overflowX: "clip",
          overflowY: "visible",
        } as never)
      : {}),
  },
  sidebarScroll: {
    width: 270,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sidebarInner: {
    padding: 24,
    paddingBottom: 36,
    gap: 0,
    ...(Platform.OS === "web"
      ? ({
          position: "sticky",
          top: 0,
          minHeight: "100vh",
        } as never)
      : {}),
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    marginBottom: 14,
  },
  brandMarkText: {
    color: Colors.ivory,
    fontSize: 22,
    fontWeight: "800",
  },
  brandTitle: {
    color: Colors.ivory,
    fontSize: 22,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 26,
  },
  nav: {
    gap: 10,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  navItemActive: {
    backgroundColor: Colors.surface,
  },
  navLabel: {
    color: adminColors.muted,
    fontWeight: "700",
  },
  navLabelActive: {
    color: Colors.ivory,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  contentInner: {
    padding: 28,
    paddingBottom: 48,
    gap: 20,
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
    fontSize: 38,
    fontWeight: "900",
    marginTop: 4,
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
  },
  errorCard: {
    borderColor: "#efb7b7",
    backgroundColor: "#fff5f5",
  },
  errorText: {
    color: adminColors.danger,
    fontWeight: "800",
  },
  warningCard: {
    borderColor: "#f3d19c",
    backgroundColor: "#fff8e8",
  },
  warningText: {
    color: adminColors.warning,
    fontWeight: "800",
  },
  healthyCard: {
    backgroundColor: "#edf9f1",
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
});
