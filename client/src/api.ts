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
  optUnemployment?: {
    daysUsed: number;
    cap: number;
    status: 'ok' | 'warning' | 'exceeded';
  };
  cptImpact?: {
    totalFullTimeMonths: number;
    optEligibilityAtRisk: boolean;
  };
  conflicts?: Array<{
    type: string;
    description: string;
    severity: 'error' | 'warning';
  }>;
  dsTransition?: {
    regime: string;
    transitionDeadline: string;
    graceperiodEndDate: string;
  };
}

export interface RuleResponse {
  topic: string;
  text: string;
  disclaimer: string;
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
