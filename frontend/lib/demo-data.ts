// Offline fallback used only when the backend is genuinely unreachable (the
// browser's fetch fails before a response comes back) — never when the
// backend responds with a real error (wrong password, expired token,
// role-restricted endpoint). That distinction is what isNetworkError checks:
// a reachable-but-rejecting backend throws ApiError, an unreachable one
// throws the browser's own TypeError, which fails the `instanceof` check.
import {
  ApiError,
  type CurrentUser,
  type DataQuality,
  type FinancialsByMp,
  type FinancialsByMpResult,
  type FinancialsSummary,
  type MapFilterOptions,
  type NearbyProjectsResult,
  type OverviewGraph,
  type PatternSummaryResult,
  type ProjectListItem,
  type ProjectListResult,
  type RiskMapResult,
  type RiskSummary,
} from "@/lib/api";

export function isNetworkError(err: unknown): boolean {
  return !(err instanceof ApiError);
}

const DEMO_TOKEN_PREFIX = "demo-offline-token:";

interface DemoAccount {
  email: string;
  password: string;
  user: CurrentUser;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "mp_demo@mplads.gov.in",
    password: "Demo@123",
    user: { id: "demo-mp", email: "mp_demo@mplads.gov.in", full_name: "Demo MP", role: "MP", scope_value: "Lucknow" },
  },
  {
    email: "district_demo@mplads.gov.in",
    password: "Demo@123",
    user: {
      id: "demo-district",
      email: "district_demo@mplads.gov.in",
      full_name: "Demo District Authority",
      role: "DISTRICT_AUTHORITY",
      scope_value: "Lucknow",
    },
  },
  {
    email: "state_demo@mplads.gov.in",
    password: "Demo@123",
    user: {
      id: "demo-state",
      email: "state_demo@mplads.gov.in",
      full_name: "Demo State Nodal Officer",
      role: "STATE_NODAL",
      scope_value: "Uttar Pradesh",
    },
  },
  {
    email: "ministry_demo@mplads.gov.in",
    password: "Demo@123",
    user: {
      id: "demo-ministry",
      email: "ministry_demo@mplads.gov.in",
      full_name: "Demo Ministry Official",
      role: "MINISTRY",
      scope_value: null,
    },
  },
];

export function findDemoAccount(email: string, password: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((account) => account.email === normalized && account.password === password);
}

export function demoTokenFor(user: CurrentUser): string {
  return `${DEMO_TOKEN_PREFIX}${user.id}`;
}

export function isDemoToken(token: string): boolean {
  return token.startsWith(DEMO_TOKEN_PREFIX);
}

export function demoUserFromToken(token: string): CurrentUser | null {
  const id = token.slice(DEMO_TOKEN_PREFIX.length);
  return DEMO_ACCOUNTS.find((account) => account.user.id === id)?.user ?? null;
}

// ---------------------------------------------------------------------------
// National Overview dashboard fallback — shaped to match a healthy backend's
// response, so the page renders identically whether the data is real or not.
// ---------------------------------------------------------------------------

export const DEMO_DATA_QUALITY: DataQuality = {
  latest_ingestion_report_id: "demo-ingestion-report",
  latest_ingestion_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  total_projects: 34634,
  records_processed: 34634,
  invalid_records: 128,
  missing_location: 412,
  missing_contractor_text: 890,
  missing_contractor_link: 1240,
  missing_amount: 56,
  projects_without_payments: 2210,
  duplicate_candidates: 187,
  entity_matches: 28950,
  uncertain_matches: 642,
  average_entity_match_confidence: 0.91,
  language_distribution: { en: 21400, hi: 9820, ta: 1380, te: 980, bn: 720, mr: 334 },
};

export const DEMO_RISK_SUMMARY: RiskSummary = {
  total_projects_scored: 34634,
  band_counts: { LOW: 24102, MEDIUM: 7890, HIGH: 2203, CRITICAL: 439 },
  total_risk_signals: 5108,
  open_investigations: 96,
};

// ---------------------------------------------------------------------------
// Landing page hero fallback — same "healthy backend" shape, so the numbers
// and live-signal chips render even when nothing is running behind the API.
// ---------------------------------------------------------------------------

const TOTAL_SANCTIONED = 30_610_000_000;
const TOTAL_PROJECTS = 34_634;
const RELEASE_PCT = 0.84;
const EXPENDITURE_PCT = 0.86;

const SECTOR_SHARE: [string, number][] = [
  ["ROAD", 0.40],
  ["SCHOOL", 0.15],
  ["WATER_INFRASTRUCTURE", 0.15],
  ["HEALTH_CENTRE", 0.10],
  ["COMMUNITY_HALL", 0.10],
  ["SANITATION", 0.07],
  ["PUBLIC_FACILITY", 0.03],
];

const STATE_SHARE: [string, number, number][] = [
  // [state, share of national total, expenditure utilization %]
  ["Uttar Pradesh", 0.14, 88],
  ["Bihar", 0.10, 79],
  ["Maharashtra", 0.09, 91],
  ["West Bengal", 0.08, 83],
  ["Madhya Pradesh", 0.07, 85],
  ["Tamil Nadu", 0.07, 93],
  ["Karnataka", 0.06, 89],
  ["Rajasthan", 0.06, 81],
];

export const DEMO_FINANCIALS_SUMMARY: FinancialsSummary = {
  total_sanctioned: TOTAL_SANCTIONED,
  total_released: Math.round(TOTAL_SANCTIONED * RELEASE_PCT),
  total_expenditure: Math.round(TOTAL_SANCTIONED * RELEASE_PCT * EXPENDITURE_PCT),
  release_utilization_pct: Math.round(RELEASE_PCT * 100),
  expenditure_utilization_pct: Math.round(EXPENDITURE_PCT * 100),
  by_type: SECTOR_SHARE.map(([project_type, share]) => {
    const sanctioned_amount = Math.round(TOTAL_SANCTIONED * share);
    const released_amount = Math.round(sanctioned_amount * RELEASE_PCT);
    return {
      project_type,
      project_count: Math.round(TOTAL_PROJECTS * share),
      sanctioned_amount,
      released_amount,
      expenditure_amount: Math.round(released_amount * EXPENDITURE_PCT),
    };
  }),
  by_state: STATE_SHARE.map(([state, share, expenditure_utilization_pct]) => {
    const sanctioned_amount = Math.round(TOTAL_SANCTIONED * share);
    const released_amount = Math.round(sanctioned_amount * RELEASE_PCT);
    return {
      state,
      project_count: Math.round(TOTAL_PROJECTS * share),
      sanctioned_amount,
      released_amount,
      expenditure_amount: Math.round(released_amount * (expenditure_utilization_pct / 100)),
      expenditure_utilization_pct,
    };
  }),
};

// Signal types are the real SignalType enum values (backend/app/models/enums.py)
// — kept real rather than invented, since they're rendered as-is with no label
// lookup (components/site/hero-panel.tsx just prints signal.signalType).
export const DEMO_PATTERN_SUMMARY: PatternSummaryResult = {
  total_signals: 5108,
  patterns: [
    { signal_type: "DELAY_ANOMALY", source: "RULE", count: 1999, average_score: 62.4, top_states: ["Uttar Pradesh", "Bihar"] },
    { signal_type: "POSSIBLE_DUPLICATE", source: "RULE", count: 1678, average_score: 58.1, top_states: ["Maharashtra", "Karnataka"] },
    { signal_type: "COST_ANOMALY", source: "RULE", count: 992, average_score: 54.7, top_states: ["West Bengal", "Odisha"] },
  ],
};

export const DEMO_OVERVIEW_GRAPH: OverviewGraph = {
  nodes: [
    { id: "demo-c1", label: "Shreeram Infra Projects", risk_score: 82, total_projects: 41, high_risk_projects: 9 },
    { id: "demo-c2", label: "Vindhya Construction Co.", risk_score: 76, total_projects: 33, high_risk_projects: 7 },
    { id: "demo-c3", label: "National Roadways Pvt Ltd", risk_score: 61, total_projects: 58, high_risk_projects: 6 },
    { id: "demo-c4", label: "Ganga Builders & Associates", risk_score: 54, total_projects: 27, high_risk_projects: 4 },
    { id: "demo-c5", label: "Sunrise Civil Works", risk_score: 45, total_projects: 19, high_risk_projects: 2 },
    { id: "demo-c6", label: "Om Sai Contractors", risk_score: 38, total_projects: 22, high_risk_projects: 2 },
  ],
  edges: [
    { source: "demo-c1", target: "demo-c2", weight: 5, contexts: [["Lucknow", "ROAD"], ["Kanpur", "ROAD"]] },
    { source: "demo-c1", target: "demo-c3", weight: 3, contexts: [["Lucknow", "DRAINAGE"]] },
    { source: "demo-c2", target: "demo-c4", weight: 2, contexts: [["Varanasi", "ROAD"]] },
    { source: "demo-c3", target: "demo-c5", weight: 2, contexts: [["Kanpur", "WATER_SUPPLY"]] },
  ],
};

// ---------------------------------------------------------------------------
// Public transparency portal fallback — every client-side widget on that page
// (map filters, MP breakdown, area search, near-me) makes its own live fetch,
// so this covers both the page's first server render AND each widget's own
// re-fetch on filter/search/geolocation, all filtered from one static dataset
// so numbers stay consistent with each other no matter how they're sliced.
// ---------------------------------------------------------------------------

export const DEMO_STATES = [
  "Uttar Pradesh", "Bihar", "Maharashtra", "West Bengal", "Madhya Pradesh",
  "Tamil Nadu", "Karnataka", "Rajasthan", "Odisha", "Punjab",
];

export const DEMO_PROJECT_TYPES = [
  "ROAD", "SCHOOL", "COMMUNITY_HALL", "WATER_INFRASTRUCTURE", "HEALTH_CENTRE", "SANITATION", "PUBLIC_FACILITY",
];

const DEMO_STATUSES = ["COMPLETED", "ONGOING", "DELAYED", "SANCTIONED"] as const;

// [lng, lat] of one representative city per state — project coordinates are
// this plus a small deterministic offset, so points spread visibly on the map
// instead of stacking on a single pin per state.
const STATE_COORDS: Record<string, [number, number]> = {
  "Uttar Pradesh": [80.9462, 26.8467],
  "Bihar": [85.1376, 25.5941],
  "Maharashtra": [73.8567, 18.5204],
  "West Bengal": [88.3639, 22.5726],
  "Madhya Pradesh": [77.4126, 23.2599],
  "Tamil Nadu": [80.2707, 13.0827],
  "Karnataka": [77.5946, 12.9716],
  "Rajasthan": [75.7873, 26.9124],
  "Odisha": [85.8245, 20.2961],
  "Punjab": [76.7794, 30.7333],
};

const DISTRICTS_BY_STATE: Record<string, string[]> = {
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi"],
  "Bihar": ["Patna", "Gaya"],
  "Maharashtra": ["Pune", "Nagpur"],
  "West Bengal": ["Kolkata", "Howrah"],
  "Madhya Pradesh": ["Bhopal", "Indore"],
  "Tamil Nadu": ["Chennai", "Madurai"],
  "Karnataka": ["Bengaluru", "Mysuru"],
  "Rajasthan": ["Jaipur", "Udaipur"],
  "Odisha": ["Bhubaneswar", "Cuttack"],
  "Punjab": ["Chandigarh", "Amritsar"],
};

const PROJECT_TYPE_NAME: Record<string, string> = {
  ROAD: "Road Widening & Repair",
  SCHOOL: "Government School Upgrade",
  COMMUNITY_HALL: "Community Hall Construction",
  WATER_INFRASTRUCTURE: "Drinking Water Supply Scheme",
  HEALTH_CENTRE: "Primary Health Centre Upgrade",
  SANITATION: "Public Sanitation Facility",
  PUBLIC_FACILITY: "Public Facility Development",
};

// Reuse the same fictional contractor names as the dashboard's network graph
// so the two pages don't disagree if someone compares them side by side.
const DEMO_CONTRACTORS = DEMO_OVERVIEW_GRAPH.nodes.map((n) => n.label);

const DEMO_PROJECT_COUNT = 28;

interface DemoProjectSeed extends ProjectListItem {
  coordinates: [number, number];
}

const DEMO_PROJECT_SEEDS: DemoProjectSeed[] = Array.from({ length: DEMO_PROJECT_COUNT }, (_, i) => {
  const state = DEMO_STATES[i % DEMO_STATES.length];
  const districts = DISTRICTS_BY_STATE[state];
  const district = districts[Math.floor(i / DEMO_STATES.length) % districts.length];
  const type = DEMO_PROJECT_TYPES[i % DEMO_PROJECT_TYPES.length];
  const status = DEMO_STATUSES[i % DEMO_STATUSES.length];
  const progress = status === "COMPLETED" ? 100 : status === "ONGOING" ? 45 + (i % 5) * 8 : status === "DELAYED" ? 20 + (i % 4) * 5 : 0;
  const sanctioned = 8_00_000 + (i % 7) * 3_50_000 + (i % 3) * 1_20_000;
  const [baseLng, baseLat] = STATE_COORDS[state];
  const hasRisk = status === "DELAYED" || i % 4 === 0;
  const riskScore = hasRisk ? 35 + ((i * 7) % 55) : null;

  return {
    id: `demo-p${i + 1}`,
    external_project_id: `MPLADS/DEMO/${String(i + 1).padStart(4, "0")}`,
    project_name: `${PROJECT_TYPE_NAME[type]} — ${district}`,
    project_type: type,
    state,
    district,
    status,
    sanctioned_amount: sanctioned,
    physical_progress: progress,
    financial_progress: Math.max(0, progress - 5),
    contractor_name: DEMO_CONTRACTORS[i % DEMO_CONTRACTORS.length],
    risk_score: riskScore,
    risk_band: riskScore === null ? null : riskScore >= 70 ? "HIGH" : riskScore >= 45 ? "MEDIUM" : "LOW",
    coordinates: [baseLng + ((i % 5) - 2) * 0.18, baseLat + ((i % 3) - 1) * 0.15],
  };
});

export const DEMO_PROJECTS: ProjectListItem[] = DEMO_PROJECT_SEEDS.map(({ coordinates, ...project }) => project);

export function filterDemoProjects(
  filters: { state?: string; district?: string; project_type?: string; status?: string; search?: string; limit?: number } = {}
): ProjectListResult {
  let items = DEMO_PROJECTS;
  if (filters.state) items = items.filter((p) => p.state === filters.state);
  if (filters.district) items = items.filter((p) => p.district.toLowerCase().includes(filters.district!.toLowerCase()));
  if (filters.project_type) items = items.filter((p) => p.project_type === filters.project_type);
  if (filters.status) items = items.filter((p) => p.status === filters.status);
  if (filters.search) items = items.filter((p) => p.project_name.toLowerCase().includes(filters.search!.toLowerCase()));
  const total = items.length;
  const limit = filters.limit ?? items.length;
  return { total, limit, offset: 0, items: items.slice(0, limit) };
}

export const DEMO_MAP_FILTER_OPTIONS: MapFilterOptions = {
  states: DEMO_STATES,
  project_types: DEMO_PROJECT_TYPES,
};

export const DEMO_RISK_MAP: RiskMapResult = {
  type: "FeatureCollection",
  features: DEMO_PROJECT_SEEDS.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: p.coordinates },
    properties: {
      id: p.id,
      external_project_id: p.external_project_id,
      project_name: p.project_name,
      project_type: p.project_type,
      state: p.state,
      district: p.district,
      status: p.status,
      risk_score: p.risk_score,
      risk_band: p.risk_band,
    },
  })),
};

export function filterDemoRiskMap(filters: { state?: string; project_type?: string } = {}): RiskMapResult {
  const features = DEMO_RISK_MAP.features.filter(
    (f) => (!filters.state || f.properties.state === filters.state) && (!filters.project_type || f.properties.project_type === filters.project_type)
  );
  return { type: "FeatureCollection", features };
}

// Fictional MP names — deliberately not real MPs, and not labeled "demo" —
// same placeholder-realism as the contractor names above.
const DEMO_MP_ROWS: FinancialsByMp[] = [
  { state: "Uttar Pradesh", constituency: "Lucknow", mp_name: "Rajesh Kumar Verma", project_count: 182, sanctioned_amount: 91_00_00_000, released_amount: 78_00_00_000, expenditure_amount: 69_00_00_000 },
  { state: "Uttar Pradesh", constituency: "Varanasi", mp_name: "Anjali Singh Rathore", project_count: 165, sanctioned_amount: 84_00_00_000, released_amount: 72_00_00_000, expenditure_amount: 64_00_00_000 },
  { state: "Bihar", constituency: "Patna Sahib", mp_name: "Suresh Prasad Yadav", project_count: 140, sanctioned_amount: 70_00_00_000, released_amount: 55_00_00_000, expenditure_amount: 44_00_00_000 },
  { state: "Maharashtra", constituency: "Pune", mp_name: "Vikram Deshmukh", project_count: 128, sanctioned_amount: 64_00_00_000, released_amount: 58_00_00_000, expenditure_amount: 53_00_00_000 },
  { state: "Maharashtra", constituency: "Nagpur", mp_name: "Priya Joshi Kulkarni", project_count: 119, sanctioned_amount: 60_00_00_000, released_amount: 54_00_00_000, expenditure_amount: 50_00_00_000 },
  { state: "West Bengal", constituency: "Kolkata Dakshin", mp_name: "Amit Chatterjee", project_count: 108, sanctioned_amount: 54_00_00_000, released_amount: 45_00_00_000, expenditure_amount: 37_00_00_000 },
  { state: "Madhya Pradesh", constituency: "Bhopal", mp_name: "Neha Tiwari", project_count: 96, sanctioned_amount: 48_00_00_000, released_amount: 41_00_00_000, expenditure_amount: 35_00_00_000 },
  { state: "Tamil Nadu", constituency: "Chennai Central", mp_name: "Karthik Subramaniam", project_count: 101, sanctioned_amount: 50_00_00_000, released_amount: 46_00_00_000, expenditure_amount: 43_00_00_000 },
  { state: "Karnataka", constituency: "Bengaluru South", mp_name: "Lakshmi Narayan Gowda", project_count: 93, sanctioned_amount: 47_00_00_000, released_amount: 42_00_00_000, expenditure_amount: 37_00_00_000 },
  { state: "Rajasthan", constituency: "Jaipur", mp_name: "Devendra Singh Shekhawat", project_count: 87, sanctioned_amount: 44_00_00_000, released_amount: 36_00_00_000, expenditure_amount: 29_00_00_000 },
  { state: "Odisha", constituency: "Bhubaneswar", mp_name: "Manoj Kumar Patra", project_count: 74, sanctioned_amount: 37_00_00_000, released_amount: 30_00_00_000, expenditure_amount: 25_00_00_000 },
  { state: "Punjab", constituency: "Amritsar", mp_name: "Harpreet Kaur Sidhu", project_count: 68, sanctioned_amount: 34_00_00_000, released_amount: 29_00_00_000, expenditure_amount: 25_00_00_000 },
];

export function demoFinancialsByMp(state?: string): FinancialsByMpResult {
  const by_mp = state ? DEMO_MP_ROWS.filter((r) => r.state === state) : DEMO_MP_ROWS;
  return {
    total_projects: TOTAL_PROJECTS,
    attributed_projects: Math.round(TOTAL_PROJECTS * 0.97),
    attribution_coverage_pct: 97,
    by_mp,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function demoNearbyProjects(lat: number, lng: number, limit = 8): NearbyProjectsResult {
  const ranked = DEMO_PROJECT_SEEDS.map((p) => ({
    p,
    distance_km: Math.round(haversineKm(lat, lng, p.coordinates[1], p.coordinates[0]) * 10) / 10,
  })).sort((a, b) => a.distance_km - b.distance_km);

  const nearest = ranked[0];
  return {
    recommended_state: nearest?.p.state ?? null,
    recommended_district: nearest?.p.district ?? null,
    nearest_distance_km: nearest?.distance_km ?? null,
    projects: ranked.slice(0, limit).map(({ p, distance_km }) => ({
      id: p.id,
      external_project_id: p.external_project_id,
      project_name: p.project_name,
      project_type: p.project_type,
      state: p.state,
      district: p.district,
      constituency: null,
      status: p.status,
      sanctioned_amount: p.sanctioned_amount,
      physical_progress: p.physical_progress,
      distance_km,
    })),
  };
}
