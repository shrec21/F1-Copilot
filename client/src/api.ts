const BASE = 'http://localhost:3000';

export interface ProfileInput {
  studentId: string;
  programStart: string;
  programEnd: string;
  degreeLevel: 'bachelors' | 'masters' | 'doctorate';
  dsoCampus: string;
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
