const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      // response wasn't JSON — fall through with empty detail
    }
    throw new ApiError(res.status, detail || `${init?.method ?? "GET"} ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function authRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } });
}

// For endpoints that scope themselves to the caller's role when a token is
// present, but otherwise stay reachable (the public portal, the pre-login
// landing page) or are only ever called from an authenticated dashboard page
// — either way, omitting the token just means "no Authorization header."
function maybeAuthRequest<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  return request<T>(path, token ? { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } } : init);
}

// File uploads need multipart/form-data with a browser-generated boundary —
// request()'s hardcoded "Content-Type: application/json" would break that,
// so this bypasses it with its own fetch call instead of reusing request().
async function uploadRequest<T>(path: string, token: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail || `Upload to ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Same as uploadRequest but with no Authorization header at all — for the
// one genuinely public, unauthenticated multipart endpoint (anonymous
// complaint submission), which has no token to attach in the first place.
async function publicUploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", body: formData });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail || `Upload to ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth (Phase 8)
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  scope_value: string | null;
}

export function login(email: string, password: string) {
  return request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function getMe(token: string) {
  return authRequest<CurrentUser>("/auth/me", token);
}

// ---------------------------------------------------------------------------
// Data quality / risk summary (Phase 2, 6)
// ---------------------------------------------------------------------------

export interface DataQuality {
  latest_ingestion_report_id: string | null;
  latest_ingestion_at: string | null;
  total_projects: number;
  records_processed: number;
  invalid_records: number;
  missing_location: number;
  missing_contractor_text: number;
  missing_contractor_link: number;
  missing_amount: number;
  projects_without_payments: number;
  duplicate_candidates: number;
  entity_matches: number;
  uncertain_matches: number;
  average_entity_match_confidence: number | null;
  language_distribution: Record<string, number>;
}

export function getDataQuality() {
  return request<DataQuality>("/data-quality");
}

export interface RiskSummary {
  total_projects_scored: number;
  band_counts: Record<string, number>;
  total_risk_signals: number;
  open_investigations: number;
}

export function getRiskSummary(token?: string) {
  return maybeAuthRequest<RiskSummary>("/risk-scores/summary", token);
}

export interface ProjectRiskSummary {
  id: string;
  external_project_id: string;
  project_name: string;
  state: string;
  district: string;
  project_type: string;
  status: string;
  risk_score: number | null;
  risk_band: string | null;
}

export function getTopRiskProjects(params: { band?: string; limit?: number } = {}, token?: string) {
  const qs = new URLSearchParams();
  if (params.band) qs.set("band", params.band);
  qs.set("limit", String(params.limit ?? 50));
  return maybeAuthRequest<ProjectRiskSummary[]>(`/risk-scores/top?${qs}`, token);
}

export interface ContributingSignal {
  signal_type: string;
  source: string;
  severity: string;
  score: number;
  confidence: number;
  weighted_contribution: number;
  description: string;
}

export interface RiskExplanation {
  project: ProjectRiskSummary;
  contributing_signals: ContributingSignal[];
  narrative_reasons: string[];
  recommended_verification: string[];
  overall_confidence: number;
}

export function explainRisk(projectId: string, token?: string) {
  return maybeAuthRequest<RiskExplanation>(`/risk-scores/${projectId}/explain`, token);
}

// ---------------------------------------------------------------------------
// Projects (Phase 8)
// ---------------------------------------------------------------------------

export interface ProjectListItem {
  id: string;
  external_project_id: string;
  project_name: string;
  project_type: string;
  state: string;
  district: string;
  constituency?: string | null;
  mp_name?: string | null;
  status: string;
  sanctioned_amount: number;
  physical_progress: number;
  financial_progress: number;
  contractor_name: string | null;
  risk_score: number | null;
  risk_band: string | null;
}

export interface ProjectListResult {
  total: number;
  limit: number;
  offset: number;
  items: ProjectListItem[];
}

export interface ProjectFilters {
  state?: string;
  district?: string;
  project_type?: string;
  status?: string;
  risk_band?: string;
  min_risk_score?: number;
  search?: string;
  sort_by?: "risk_score" | "sanctioned_amount" | "start_date";
  limit?: number;
  offset?: number;
}

export function listProjects(filters: ProjectFilters = {}, token?: string) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  });
  return maybeAuthRequest<ProjectListResult>(`/projects?${qs}`, token);
}

export interface NearbyProjectItem {
  id: string;
  external_project_id: string;
  project_name: string;
  project_type: string;
  state: string;
  district: string;
  constituency: string | null;
  status: string;
  sanctioned_amount: number;
  physical_progress: number;
  distance_km: number;
}

export interface NearbyProjectsResult {
  recommended_state: string | null;
  recommended_district: string | null;
  nearest_distance_km: number | null;
  projects: NearbyProjectItem[];
}

export function getNearbyProjects(lat: number, lng: number, limit = 10, token?: string) {
  const qs = new URLSearchParams({ lat: String(lat), lng: String(lng), limit: String(limit) });
  return maybeAuthRequest<NearbyProjectsResult>(`/projects/nearby?${qs}`, token);
}

export interface ProjectDetail {
  id: string;
  external_project_id: string;
  project_name: string;
  description: string | null;
  language: string | null;
  project_type: string;
  state: string;
  district: string;
  constituency: string | null;
  mp_name: string | null;
  data_source: string;
  latitude: number | null;
  longitude: number | null;
  sanctioned_amount: number;
  estimated_cost: number;
  released_amount: number;
  expenditure_amount: number;
  start_date: string;
  expected_completion_date: string;
  actual_completion_date: string | null;
  physical_progress: number;
  financial_progress: number;
  status: string;
  contractor_id: string | null;
  contractor_name: string | null;
  implementing_agency_id: string | null;
  implementing_agency_name: string | null;
  risk_score: number | null;
  risk_band: string | null;
  signal_count: number;
}

export function getProject(id: string, token?: string) {
  return maybeAuthRequest<ProjectDetail>(`/projects/${id}`, token);
}

export interface ProjectTimeline {
  payments: { id: string; amount: number; payment_date: string; payment_type: string; payment_status: string; recipient: string | null }[];
  milestones: { id: string; name: string; expected_date: string; actual_date: string | null; expected_progress: number; actual_progress: number | null; status: string }[];
  inspections: { id: string; inspection_date: string; inspector: string | null; reported_progress: number; remarks: string | null }[];
  evidence: { id: string; type: string; file_reference: string | null; description: string | null; captured_at: string | null; source: string | null }[];
}

export function getProjectTimeline(id: string, token?: string) {
  return maybeAuthRequest<ProjectTimeline>(`/projects/${id}/timeline`, token);
}

// ---------------------------------------------------------------------------
// Graph (Phase 7)
// ---------------------------------------------------------------------------

export interface ProjectRef {
  id: string;
  external_project_id: string;
  project_name: string;
  state: string;
  district: string;
  project_type: string;
  status: string;
  risk_score: number | null;
  risk_band: string | null;
}

export interface RelatedProject {
  project: ProjectRef;
  relationship_types: string[];
  distance_km: number | null;
}

export function getRelatedProjects(id: string, limit = 10, token?: string) {
  return maybeAuthRequest<RelatedProject[]>(`/graph/projects/${id}/related?limit=${limit}`, token);
}

// ---------------------------------------------------------------------------
// Contractors (Phase 8)
// ---------------------------------------------------------------------------

export interface ContractorListItem {
  id: string;
  name: string;
  state: string | null;
  district: string | null;
  total_projects: number;
  completed_projects: number;
  delayed_projects: number;
  high_risk_projects: number;
  average_cost_overrun: number | null;
  average_delay_days: number | null;
  risk_score: number | null;
}

export interface ContractorListResult {
  total: number;
  limit: number;
  offset: number;
  items: ContractorListItem[];
}

export function listContractors(
  params: { min_total_projects?: number; sort_by?: string; limit?: number; offset?: number } = {},
  token?: string
) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) qs.set(key, String(value));
  });
  return maybeAuthRequest<ContractorListResult>(`/contractors?${qs}`, token);
}

export interface ContractorDetail {
  contractor: ContractorListItem;
  projects: {
    id: string;
    external_project_id: string;
    project_name: string;
    state: string;
    district: string;
    status: string;
    sanctioned_amount: number;
    risk_score: number | null;
    risk_band: string | null;
  }[];
}

export function getContractor(id: string, token?: string) {
  return maybeAuthRequest<ContractorDetail>(`/contractors/${id}`, token);
}

// ---------------------------------------------------------------------------
// Patterns (Phase 8)
// ---------------------------------------------------------------------------

export interface PatternSummary {
  signal_type: string;
  source: string;
  count: number;
  average_score: number;
  top_states: string[];
}

export interface PatternSummaryResult {
  total_signals: number;
  patterns: PatternSummary[];
}

export function getPatternSummary(token?: string) {
  return maybeAuthRequest<PatternSummaryResult>("/patterns/summary", token);
}

export interface RiskSignalListItem {
  id: string;
  project_id: string;
  signal_type: string;
  source: string;
  severity: string;
  score: number;
  confidence: number;
  description: string;
  evidence: Record<string, unknown>;
  created_at: string;
  project: ProjectRef;
}

export function getRiskSignals(
  params: { signal_type?: string; source?: string; severity?: string; limit?: number } = {},
  token?: string
) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  });
  return maybeAuthRequest<RiskSignalListItem[]>(`/risk-signals?${qs}`, token);
}

// ---------------------------------------------------------------------------
// Map (Phase 8)
// ---------------------------------------------------------------------------

export interface RiskMapFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    external_project_id: string;
    project_name: string;
    project_type: string;
    state: string;
    district: string;
    status: string;
    risk_score: number | null;
    risk_band: string | null;
  };
}

export interface RiskMapResult {
  type: "FeatureCollection";
  features: RiskMapFeature[];
}

export function getRiskMap(
  params: { risk_band?: string; state?: string; project_type?: string; limit?: number } = {},
  token?: string
) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  });
  return maybeAuthRequest<RiskMapResult>(`/map/risk?${qs}`, token);
}

export interface MapFilterOptions {
  states: string[];
  project_types: string[];
}

export function getMapFilterOptions(token?: string) {
  return maybeAuthRequest<MapFilterOptions>("/map/filters", token);
}

// ---------------------------------------------------------------------------
// Trigger endpoints (Phase 4-6, ADMIN/ANALYST only)
// ---------------------------------------------------------------------------

export function runRuleEngine(token: string) {
  return authRequest<{ projects_scanned: number; signals_created: number; by_type: Record<string, number> }>(
    "/risk-signals/run",
    token,
    { method: "POST" }
  );
}

export function runMlDetection(token: string) {
  return authRequest<{ projects_scored: number; anomalies_flagged: number; feature_names: string[] }>(
    "/ml/run",
    token,
    { method: "POST" }
  );
}

// ---------------------------------------------------------------------------
// Financials (Phase 9)
// ---------------------------------------------------------------------------

export interface FinancialsByType {
  project_type: string;
  project_count: number;
  sanctioned_amount: number;
  released_amount: number;
  expenditure_amount: number;
}

export interface FinancialsByState {
  state: string;
  project_count: number;
  sanctioned_amount: number;
  released_amount: number;
  expenditure_amount: number;
  expenditure_utilization_pct: number;
}

export interface FinancialsSummary {
  total_sanctioned: number;
  total_released: number;
  total_expenditure: number;
  release_utilization_pct: number;
  expenditure_utilization_pct: number;
  by_type: FinancialsByType[];
  by_state: FinancialsByState[];
}

export function getFinancialsSummary(token?: string) {
  return maybeAuthRequest<FinancialsSummary>("/financials/summary", token);
}

export interface FinancialsByMp {
  state: string;
  constituency: string | null;
  mp_name: string;
  project_count: number;
  sanctioned_amount: number;
  released_amount: number;
  expenditure_amount: number;
}

export interface FinancialsByMpResult {
  total_projects: number;
  attributed_projects: number;
  attribution_coverage_pct: number;
  by_mp: FinancialsByMp[];
}

export function getFinancialsByMp(state?: string, token?: string) {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  return maybeAuthRequest<FinancialsByMpResult>(`/financials/by-mp${query}`, token);
}

// ---------------------------------------------------------------------------
// Investigations (Phase 11)
// ---------------------------------------------------------------------------

export interface Investigation {
  id: string;
  project_id: string;
  project_name: string;
  project_external_id: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  notes: string | null;
  resolution: string | null;
  current_level: string;
  overdue_for_escalation: boolean;
  created_at: string;
  updated_at: string;
}

export function listInvestigations(params: { status?: string; project_id?: string } = {}, token?: string) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  return maybeAuthRequest<Investigation[]>(`/investigations?${qs}`, token);
}

export function createInvestigation(
  token: string,
  payload: { project_id: string; priority: string; notes?: string }
) {
  return authRequest<Investigation>("/investigations", token, { method: "POST", body: JSON.stringify(payload) });
}

export function updateInvestigation(
  token: string,
  id: string,
  payload: { status?: string; resolution?: string; notes?: string }
) {
  return authRequest<Investigation>(`/investigations/${id}`, token, { method: "PATCH", body: JSON.stringify(payload) });
}

export function escalateInvestigation(token: string, id: string) {
  return authRequest<Investigation>(`/investigations/${id}/escalate`, token, { method: "POST" });
}

// ---------------------------------------------------------------------------
// AI Assistant (Phase 10)
// ---------------------------------------------------------------------------

export interface AssistantResponse {
  llm_configured: boolean;
  answer: string | null;
  context_summary: string;
  grounded_on: Record<string, unknown>;
  error: string | null;
}

export function queryAssistant(question: string, projectId?: string) {
  return request<AssistantResponse>("/assistant/query", {
    method: "POST",
    body: JSON.stringify({ question, project_id: projectId ?? null }),
  });
}

export function getAssistantStatus() {
  return request<{ configured: boolean; provider: string }>("/assistant/status");
}

// ---------------------------------------------------------------------------
// AI Assistant — conversations, history, documents
// ---------------------------------------------------------------------------

export interface AssistantConversationSummary {
  id: string;
  title: string;
  project_id: string | null;
  document_filename: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantMessageOut {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  grounded_on: Record<string, unknown> | null;
  created_at: string;
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
  messages: AssistantMessageOut[];
}

export function listConversations(token: string) {
  return authRequest<AssistantConversationSummary[]>("/assistant/conversations", token);
}

export function createConversation(token: string, projectId?: string) {
  return authRequest<AssistantConversationSummary>("/assistant/conversations", token, {
    method: "POST",
    body: JSON.stringify({ project_id: projectId ?? null }),
  });
}

export function getConversation(token: string, id: string) {
  return authRequest<AssistantConversationDetail>(`/assistant/conversations/${id}`, token);
}

export function deleteConversation(token: string, id: string) {
  return authRequest<void>(`/assistant/conversations/${id}`, token, { method: "DELETE" });
}

export interface SendMessageResult {
  user_message: AssistantMessageOut;
  assistant_message: AssistantMessageOut;
  llm_configured: boolean;
  error: string | null;
}

export function sendConversationMessage(token: string, conversationId: string, content: string) {
  return authRequest<SendMessageResult>(`/assistant/conversations/${conversationId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function uploadConversationDocument(token: string, conversationId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return uploadRequest<{ filename: string; characters_extracted: number }>(
    `/assistant/conversations/${conversationId}/document`,
    token,
    formData
  );
}

export function runRiskScoring(token: string) {
  return authRequest<{ projects_scored: number; band_counts: Record<string, number> }>("/risk-scores/run", token, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// CSV upload (Phase 2's ingestion endpoint, ADMIN/ANALYST only)
// ---------------------------------------------------------------------------

export interface IngestionReport {
  id: string;
  source_filename: string;
  created_at: string;
  records_received: number;
  valid: number;
  invalid: number;
  missing_location: number;
  missing_contractor: number;
  missing_amount: number;
  duplicate_candidates: number;
  entity_matches: number;
  uncertain_matches: number;
  language_distribution: Record<string, number>;
  validation_errors: { row: number; external_project_id: string | null; errors: string[] }[];
}

export function uploadProjectsCsv(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return uploadRequest<IngestionReport>("/ingestion/upload", token, formData);
}

// ---------------------------------------------------------------------------
// User management (ADMIN only)
// ---------------------------------------------------------------------------

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  scope_value: string | null;
  is_active: boolean;
  created_at: string;
}

export function listUsers(token: string) {
  return authRequest<ManagedUser[]>("/users", token);
}

export function createUser(
  token: string,
  payload: { email: string; full_name: string; password: string; role: string; scope_value?: string | null }
) {
  return authRequest<ManagedUser>("/users", token, { method: "POST", body: JSON.stringify(payload) });
}

export function updateUser(
  token: string,
  id: string,
  payload: { role?: string; scope_value?: string; is_active?: boolean }
) {
  return authRequest<ManagedUser>(`/users/${id}`, token, { method: "PATCH", body: JSON.stringify(payload) });
}

// ---------------------------------------------------------------------------
// Reports / CSV export
// ---------------------------------------------------------------------------

// Report exports now require auth (scoped to the caller's jurisdiction), so a
// plain <a href> can't carry the Bearer token — fetch as a blob and trigger
// the save client-side instead.
export async function downloadReportCsv(token: string, report: "projects" | "risk-signals" | "investigations") {
  const res = await fetch(`${API_URL}/reports/${report}.csv`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(res.status, `Download of ${report}.csv failed with ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Network graph (Overview page)
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  label: string;
  risk_score: number | null;
  total_projects: number;
  high_risk_projects: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  contexts: string[][];
}

export interface OverviewGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function getOverviewGraph(limit = 15, token?: string) {
  return maybeAuthRequest<OverviewGraph>(`/graph/overview?limit=${limit}`, token);
}

// ---------------------------------------------------------------------------
// Citizen complaints — anonymous submission, geo-verified against the
// project's own location; no login required to submit or check status.
// ---------------------------------------------------------------------------

export interface ComplaintSubmitResult {
  token: string;
  status: string;
  is_location_verified: boolean;
  distance_to_project_m: number | null;
  message: string;
}

export function submitComplaint(payload: {
  project_id: string;
  description: string;
  latitude: number;
  longitude: number;
  photo: File;
}) {
  const formData = new FormData();
  formData.append("project_id", payload.project_id);
  formData.append("description", payload.description);
  formData.append("latitude", String(payload.latitude));
  formData.append("longitude", String(payload.longitude));
  formData.append("photo", payload.photo);
  return publicUploadRequest<ComplaintSubmitResult>("/complaints", formData);
}

export interface ComplaintStatusResult {
  token: string;
  status: string;
  is_location_verified: boolean;
  distance_to_project_m: number | null;
  project_name: string;
  created_at: string;
}

export function getComplaintStatus(token: string) {
  return request<ComplaintStatusResult>(`/complaints/status/${encodeURIComponent(token)}`);
}

export interface ComplaintListItem {
  id: string;
  project_id: string;
  project_name: string;
  project_external_id: string;
  description: string;
  is_location_verified: boolean;
  distance_to_project_m: number | null;
  status: string;
  created_at: string;
}

export interface ComplaintDetail extends ComplaintListItem {
  submitted_latitude: number;
  submitted_longitude: number;
  resolution_notes: string | null;
  updated_at: string;
}

export function listComplaints(
  params: { project_id?: string; status?: string; verified_only?: boolean } = {},
  token: string
) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  });
  return authRequest<ComplaintListItem[]>(`/complaints?${qs}`, token);
}

export function getComplaint(token: string, id: string) {
  return authRequest<ComplaintDetail>(`/complaints/${id}`, token);
}

export function updateComplaint(token: string, id: string, payload: { status?: string; resolution_notes?: string }) {
  return authRequest<ComplaintDetail>(`/complaints/${id}`, token, { method: "PATCH", body: JSON.stringify(payload) });
}

// Photo bytes aren't JSON, so this bypasses request() and hands back an
// object URL the caller can drop into an <img src> or window.open — and
// must revoke (URL.revokeObjectURL) once it's no longer displayed.
export async function getComplaintPhotoUrl(token: string, id: string): Promise<string> {
  const res = await fetch(`${API_URL}/complaints/${id}/photo`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(res.status, `Fetching photo for complaint ${id} failed with ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------------
// Pre-Sanction AI Gatekeeper & Dossier Intelligence
// ---------------------------------------------------------------------------

export interface PreSanctionPayload {
  project_name: string;
  description?: string;
  project_type: string;
  state: string;
  district: string;
  estimated_cost: number;
  latitude?: number;
  longitude?: number;
  target_beneficiary?: string;
  implementing_agency?: string;
}

export interface PreSanctionResult {
  clearance_status: "APPROVED_FOR_SANCTION" | "CONDITIONAL_REVIEW_REQUIRED" | "REJECT_PROHIBITED";
  clearance_color: "green" | "amber" | "red";
  clearance_token: string;
  recommendation: string;
  guideline_checks: Array<{
    check: string;
    status: "PASS" | "FAIL" | "WARN";
    details: string;
  }>;
  violations: Array<{
    rule: string;
    clause: string;
    matched_terms?: string[];
    conflicts?: any[];
    severity: string;
    explanation: string;
  }>;
  warnings: Array<{
    type: string;
    message: string;
    variance?: number;
    distance_meters?: number;
  }>;
  proximity_conflicts: Array<{
    existing_project_id: string;
    existing_project_name: string;
    status: string;
    sanctioned_amount: number;
    distance_km?: number;
    similarity_score: number;
    reason: string;
  }>;
  cost_analysis: {
    proposed_cost: number;
    district_historical_avg: number;
    sector_standard_range: { min: number; max: number };
    cost_variance_ratio: number;
    status: string;
  };
  target_beneficiary: string;
  summary: {
    project_name: string;
    district: string;
    state: string;
    estimated_cost: number;
    total_flags: number;
  };
}

export function validatePreSanctionProposal(payload: PreSanctionPayload, token?: string) {
  return maybeAuthRequest<PreSanctionResult>("/pre-sanction/validate", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPreSanctionGuidelines(token?: string) {
  return maybeAuthRequest<any>("/pre-sanction/guidelines", token);
}

export interface ProjectDossier {
  dossier_id: string;
  generated_at: string;
  project: {
    id: string;
    external_id: string;
    name: string;
    state: string;
    district: string;
    mp_name?: string;
    sector: string;
    sanctioned_amount: number;
    total_disbursed: number;
    physical_progress: number;
    financial_progress: number;
    progress_disparity: number;
    risk_score: number;
    risk_band: string;
  };
  contractor?: {
    name: string;
    pan: string;
    gstin: string;
    total_assigned_projects: number;
    delayed_projects_count: number;
    risk_score: number;
    cartel_warning: boolean;
  };
  statutory_findings: Array<{
    statutory_reference: string;
    observation: string;
    severity: string;
    risk_type: string;
  }>;
  recommended_actions: string[];
  audit_classification: string;
}

export function getProjectDossier(projectId: string, token?: string) {
  return maybeAuthRequest<ProjectDossier>(`/projects/${projectId}/dossier`, token);
}

export interface ProjectSummaryForMatch {
  id: string;
  external_project_id: string;
  project_name: string;
  description?: string | null;
  project_type: string;
  state: string;
  district: string;
  constituency?: string | null;
  mp_name?: string | null;
  sanctioned_amount: number;
  released_amount: number;
  expenditure_amount: number;
  start_date: string;
  expected_completion_date: string;
  actual_completion_date?: string | null;
  physical_progress: number;
  financial_progress: number;
  status: string;
  contractor_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  risk_score?: number | null;
  risk_band?: string | null;
}

export interface MatchDifferenceMetrics {
  amount_diff_inr: number;
  amount_diff_pct: number;
  days_between_sanction: number;
  same_contractor: boolean;
  same_mp: boolean;
  distance_km?: number | null;
}

export interface EntityMatchEnriched {
  id: string;
  source_project_id: string;
  matched_project_id: string;
  match_confidence: number;
  verdict: string;
  matching_features: {
    text_similarity?: number;
    phonetic_similarity?: number;
    location_similarity?: number;
    type_similarity?: number;
    contractor_similarity?: number;
    date_similarity?: number;
    amount_similarity?: number;
    [key: string]: any;
  };
  created_at: string;
  source_project: ProjectSummaryForMatch;
  matched_project: ProjectSummaryForMatch;
  diff_metrics: MatchDifferenceMetrics;
}

export function getEnrichedEntityMatches(params?: { verdict?: string; limit?: number; offset?: number }, token?: string) {
  const query = new URLSearchParams();
  if (params?.verdict) query.set("verdict", params.verdict);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return maybeAuthRequest<EntityMatchEnriched[]>(`/entity-resolution/matches/enriched${qs ? `?${qs}` : ""}`, token);
}

export function getEnrichedEntityMatch(matchId: string, token?: string) {
  return maybeAuthRequest<EntityMatchEnriched>(`/entity-resolution/matches/${matchId}/enriched`, token);
}

// --- Investigation Audit Log ---

export interface AuditLogEntry {
  id: string;
  action: string;
  timestamp: string;
  user_name: string;
  user_role: string | null;
  metadata: Record<string, unknown>;
}

export function getInvestigationAuditLog(investigationId: string, token: string) {
  return authRequest<AuditLogEntry[]>(`/investigations/${investigationId}/audit-log`, token);
}
