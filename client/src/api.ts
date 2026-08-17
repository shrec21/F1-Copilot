const BASE = 'http://localhost:3000';

export interface ProfileInput {
  fullName: string;
  programEndDate: string;
  degreeLevel: string;
  visaAdmissionType: 'D/S' | 'fixed-date';
  admissionDate: string;
  isStemEligible: boolean;
}

export interface EmploymentInput {
  employer: string;
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  cptType?: 'full-time' | 'part-time';
  hoursPerWeek: number;
  startDate: string;
  endDate?: string;
}

export interface AuthInput {
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  startDate: string;
  endDate?: string;
  employer?: string;
}

export interface StatusResponse {
  unemployment: {
    usedDays: number;
    remainingDays: number;
    status: 'ok' | 'warning' | 'exceeded';
    appliedRuleId: string;
    disclaimer: string;
  } | null;
  cptImpact: {
    totalFullTimeDays: number;
    totalFullTimeMonths: number;
    optEligibilityAtRisk: boolean;
    appliedRuleId: string;
    disclaimer: string;
  };
  conflicts: Array<{
    roleIds: [string, string];
    overlapStart: string;
    overlapEnd: string;
    ruleId: string;
    description: string;
  }>;
  dsStatus: {
    regime: 'D/S' | 'fixed-date';
    transitionDeadline: string | null;
    graceperiodEndDate: string | null;
    appliedRuleId: string;
    disclaimer: string;
  };
}

export interface RuleResponse {
  topic: string;
  effective_date: string;
  source_url: string;
  disclaimer: string;
  rules: Array<{
    id: string;
    summary: string;
    threshold?: number;
    unit?: string;
    citation: string;
    deadline?: string;
  }>;
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(err.message || res.statusText), { status: res.status });
  }
  return res.json();
}

export async function getProfile(): Promise<ProfileInput | null> {
  const res = await fetch(`${BASE}/profile`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function postProfile(data: ProfileInput): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export interface EmploymentRecord {
  id: string;
  employer: string;
  authorizationType: 'CPT' | 'OPT' | 'STEM-OPT';
  cptType?: 'full-time' | 'part-time';
  hoursPerWeek: number;
  period: { start: string; end?: string };
}

export async function getEmployment(): Promise<EmploymentRecord[]> {
  const res = await fetch(`${BASE}/employment`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function putEmployment(id: string, data: EmploymentInput): Promise<void> {
  const res = await fetch(`${BASE}/employment/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
}

export async function deleteEmployment(id: string): Promise<void> {
  const res = await fetch(`${BASE}/employment/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
}

export async function postEmployment(data: EmploymentInput): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/employment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function postAuthorization(data: AuthInput): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/authorization`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function getRules(topic: string): Promise<RuleResponse> {
  const res = await fetch(`${BASE}/rules/${encodeURIComponent(topic)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function ask(question: string): Promise<{ answer: string }> {
  const res = await fetch(`${BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  pubDate: string;
  source: string;
}

export interface NewsFetchResult {
  items: NewsItem[];
  fetchedAt: string;
  error?: string;
}

export async function getNews(): Promise<NewsFetchResult> {
  const res = await fetch(`${BASE}/news`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// --- New types & functions for wow features ---

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  deadline?: string;
  daysUntil?: number;
  ruleId: string;
  action: string;
}

export interface Deadline {
  id: string;
  title: string;
  description: string;
  date: string;
  daysUntil: number;
  severity: 'critical' | 'warning' | 'info' | 'past';
  ruleId: string;
  citation: string;
}

export interface AuthorizationRecord {
  id: string;
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  employer?: string;
  startDate: string;
  endDate: string;
}

export type DsoEmailType = 'cpt-request' | 'opt-question' | 'stem-extension' | 'general-inquiry';

export interface DsoEmailInput {
  emailType: DsoEmailType;
  additionalContext?: string;
}

export interface SimulateInput {
  roles: Array<{
    employer: string;
    authType: 'CPT' | 'OPT' | 'STEM-OPT';
    cptType?: 'full-time' | 'part-time';
    hoursPerWeek: number;
    startDate: string;
    endDate?: string;
  }>;
  optWindow?: { start: string; end?: string };
}

export async function getAlerts(): Promise<Alert[]> {
  const res = await fetch(`${BASE}/alerts`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function getDeadlines(): Promise<Deadline[]> {
  const res = await fetch(`${BASE}/deadlines`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function getAuthorizations(): Promise<AuthorizationRecord[]> {
  const res = await fetch(`${BASE}/authorizations`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function postSimulate(data: SimulateInput): Promise<StatusResponse> {
  const res = await fetch(`${BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || res.statusText);
  }
  return res.json();
}

// --- Risk Model ---

export type ConsequenceSeverity = 'caution' | 'serious' | 'severe' | 'critical';

export interface ConsequenceTier {
  trigger: string;
  date: string;
  daysFromNow: number;
  title: string;
  detail: string;
  severity: ConsequenceSeverity;
  alreadyActive: boolean;
}

export interface RiskEntry {
  id: string;
  deadlineTitle: string;
  deadlineDate: string;
  daysUntilDeadline: number;
  deadlineMissed: boolean;
  summary: string;
  consequences: ConsequenceTier[];
  citations: string[];
  disclaimer: string;
}

export async function getRiskModel(): Promise<RiskEntry[]> {
  const res = await fetch(`${BASE}/risk-model`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// --- Filing Deadline Calculator ---

export type FilingStatus = 'upcoming' | 'open' | 'expiring' | 'closed' | 'not-applicable';

export interface FilingWindow {
  id: string;
  order: number;
  title: string;
  description: string;
  windowOpens: string;
  hardDeadline: string;
  daysUntilDeadline: number;
  daysUntilOpen: number;
  status: FilingStatus;
  form?: string;
  filingEntity: 'USCIS' | 'DSO' | 'CBP' | 'N/A';
  keySteps: string[];
  citation: string;
  note?: string;
}

export async function getFilingWindows(): Promise<FilingWindow[]> {
  const res = await fetch(`${BASE}/filing-windows`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// --- Scenario Explainer ---

export type ScenarioId =
  | 'new-admission-post-sept15'
  | 'fixed-date-pre-transition'
  | 'ds-staying'
  | 'ds-travel-before-sept15'
  | 'ds-travel-after-sept15'
  | 'ds-deadline-passed';

export type OutcomeSeverity = 'safe' | 'action-required' | 'critical' | 'info';

export interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  outcome: string;
  outcomeSeverity: OutcomeSeverity;
  keyFacts: string[];
  risks: { title: string; detail: string }[];
  actions: { order: number; text: string; deadline?: string }[];
  citations: string[];
  appliesWhen: string;
}

export interface ScenariosResponse {
  scenarios: Scenario[];
  detectedId: ScenarioId | null;
}

export async function getScenarios(): Promise<ScenariosResponse> {
  const res = await fetch(`${BASE}/scenarios`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export type DocumentStatus = 'not-started' | 'located' | 'scanned' | 'submitted';

export interface DocumentItem {
  id: string;
  order: number;
  category: 'identity' | 'immigration' | 'academic' | 'employment' | 'financial';
  name: string;
  description: string;
  whyNeeded: string;
  requiredForDsTransition: boolean;
  conditional?: string;
  resource?: { label: string; url: string };
  // merged from DB
  status: DocumentStatus;
  notes: string | null;
  updatedAt: string | null;
}

export async function getDocuments(): Promise<DocumentItem[]> {
  const res = await fetch(`${BASE}/documents`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function updateDocument(id: string, patch: { status?: DocumentStatus; notes?: string }): Promise<void> {
  const res = await fetch(`${BASE}/documents/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || res.statusText);
  }
}

export interface ActionStep {
  id: string;
  order: number;
  category: 'verify' | 'contact' | 'document' | 'file' | 'track' | 'plan';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  deadline?: string;
  daysUntil?: number;
  citation?: string;
  resources: { label: string; url: string }[];
  completed: boolean;
}

export async function getActionPlan(): Promise<ActionStep[]> {
  const res = await fetch(`${BASE}/action-plan`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function toggleActionStep(id: string, completed: boolean): Promise<void> {
  const res = await fetch(`${BASE}/action-plan/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || res.statusText);
  }
}

export async function postDsoEmail(data: DsoEmailInput): Promise<{ email: string }> {
  const res = await fetch(`${BASE}/dso-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || res.statusText);
  }
  return res.json();
}

// --- Synthetic Cohort ---

export interface CohortRuleResult {
  rule: {
    id: string;
    version: number;
    title: string;
    sourceCitation: string;
    effectiveDate: string;
    supersedes: string | null;
  };
  studentId: string;
  status: 'pass' | 'warning' | 'violation' | 'not-applicable';
  computedAt: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  message: string;
}

export interface CohortStudent {
  student: {
    id: string;
    fullName: string;
    sevisId: string;
    programLevel: string;
    major: string;
    isStemDesignated: boolean;
    programStartDate: string;
    programEndDate: string;
    admissionType: string;
    i94AdmissionDate: string;
    i94ExpiryDate: string | null;
  };
  ruleResults: CohortRuleResult[];
  summary: {
    violations: number;
    warnings: number;
    highestSeverity: 'pass' | 'warning' | 'violation';
  };
}

export interface AuditTrailEntry {
  id: string;
  studentId: string;
  eventId: string;
  ruleId: string;
  ruleVersion: number;
  status: string;
  inputsJson: string;
  outputsJson: string;
  sourceCitation: string;
  message: string;
  createdAt: string;
  eventType: string;
  occurredAt: string;
}

export async function getCohort(): Promise<CohortStudent[]> {
  const res = await fetch(`${BASE}/students`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function getStudentAudit(
  studentId: string,
): Promise<{ student: CohortStudent['student']; trail: AuditTrailEntry[] }> {
  const res = await fetch(`${BASE}/students/${encodeURIComponent(studentId)}/audit`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// --- Regulation-change watcher ---

export interface WatcherCheckLog {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  sourcesChecked: number;
  changesFound: number;
  ticketsCreated: number;
  error: string | null;
}

export type ReviewStatus =
  | 'pending'
  | 'reviewed-no-change'
  | 'reviewed-rule-updated'
  | 'reviewed-false-positive';

export interface ReviewTicket {
  id: string;
  sourceId: string;
  sourceUrl: string;
  diffSummary: string;
  affectedRuleIds: string[];
  createdAt: string;
  status: ReviewStatus;
  reviewedAt: string | null;
  reviewerNote: string | null;
}

export async function getWatcherLog(): Promise<WatcherCheckLog[]> {
  const res = await fetch(`${BASE}/admin/watcher/log`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function triggerWatcherRun(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${BASE}/admin/watcher/run`, { method: 'POST' });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function getReviewQueue(status?: ReviewStatus): Promise<ReviewTicket[]> {
  const url = status
    ? `${BASE}/admin/review-queue?status=${encodeURIComponent(status)}`
    : `${BASE}/admin/review-queue`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function resolveReviewTicket(
  id: string,
  status: Exclude<ReviewStatus, 'pending'>,
  reviewerNote: string,
): Promise<void> {
  const res = await fetch(`${BASE}/admin/review-queue/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reviewerNote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
}

// --- Observability metrics ---

export interface LatencyStat {
  p50Ms: number | null;
  p95Ms: number | null;
  count: number;
}

export interface MetricsResponse {
  ruleEval: LatencyStat;
  askAgent: LatencyStat;
  dsoEmail: LatencyStat;
  outbox: {
    pendingCount: number;
    avgLagMs: number | null;
    p95LagMs: number | null;
    dispatchedCount: number;
  };
  watcher: {
    totalRuns: number;
    avgDurationMs: number | null;
    p95DurationMs: number | null;
    errorRate: number;
    lastRunAt: string | null;
  };
}

export async function getMetrics(): Promise<MetricsResponse> {
  const res = await fetch(`${BASE}/admin/metrics`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}
