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
