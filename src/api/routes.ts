import type { FastifyInstance } from 'fastify';
import { loadRuleFile } from '../rules/loader';
import { computeUnemploymentDays } from '../engine/unemployment-clock';
import { checkCptEligibilityImpact } from '../engine/cpt-tracker';
import { checkConcurrentEmploymentConflicts } from '../engine/concurrent-employment';
import { checkDsTransitionStatus } from '../engine/ds-transition';
import { computeAlerts } from '../engine/alert-engine';
import { computeDeadlines } from '../engine/deadline-engine';
import { computeActionPlan } from '../engine/action-plan-engine';
import { DOCUMENT_LIST } from '../engine/document-checklist-engine';
import { SCENARIOS, detectScenario } from '../engine/scenario-engine';
import { computeFilingWindows } from '../engine/filing-calculator-engine';
import {
  upsertUserProfile,
  getUserProfile,
  insertEmploymentPeriod,
  getAllEmploymentPeriods,
  updateEmploymentPeriod,
  deleteEmploymentPeriod,
  insertAuthorization,
  getOptWindow,
  getAllAuthorizations,
  getActionStepCompletions,
  toggleActionStep,
  getAllDocumentStatuses,
  upsertDocumentStatus,
} from '../data/queries';
import { askAgent } from '../mcp/agent';
import { generateDsoEmail } from '../mcp/dso-email';
import { TOPIC_TO_FILENAME } from '../rules/topics';
import { fetchImmigrationNews } from '../news/fetcher';
import type { Role } from '../engine/types';

interface FullStatus {
  unemployment: ReturnType<typeof computeUnemploymentDays> | null;
  cptImpact: ReturnType<typeof checkCptEligibilityImpact>;
  conflicts: ReturnType<typeof checkConcurrentEmploymentConflicts>;
  dsStatus: ReturnType<typeof checkDsTransitionStatus>;
}

function computeFullStatus(
  profile: NonNullable<ReturnType<typeof getUserProfile>>,
  roles: Role[],
): FullStatus {
  const optWindow = getOptWindow();

  const optRules = loadRuleFile('opt-unemployment.yaml');
  const cptRules = loadRuleFile('cpt-authorization.yaml');
  const dsRules  = loadRuleFile('d-s-transition-2026.yaml');

  const capRule = profile.isStemEligible
    ? optRules.rules.find(r => r.id === 'stem-opt-unemployment-cap')!
    : optRules.rules.find(r => r.id === 'standard-opt-unemployment-cap')!;

  const unemployment = optWindow
    ? computeUnemploymentDays(
        roles.filter(r => r.authorizationType === 'OPT' || r.authorizationType === 'STEM-OPT')
             .map(r => r.period),
        optWindow,
        capRule.threshold!,
        capRule.id,
        optRules.disclaimer,
      )
    : null;

  const cptCapRule = cptRules.rules.find(r => r.id === 'cpt-opt-eligibility-impact')!;
  const cptImpact = checkCptEligibilityImpact(
    roles.filter(r => r.authorizationType === 'CPT'),
    cptCapRule.threshold!,
    cptCapRule.id,
    cptRules.disclaimer,
  );

  const conflictRule = cptRules.rules.find(r => r.id === 'cpt-per-employer-scoping')!;
  const conflicts = checkConcurrentEmploymentConflicts(roles, conflictRule.id);

  const dsEffectiveRule = dsRules.rules.find(r => r.id === 'fixed-period-admission-effective-date')!;
  const dsGraceRule     = dsRules.rules.find(r => r.id === 'ds-grace-period')!;
  const dsPendingRule   = dsRules.rules.find(r => r.id === 'pending-ds-filing-deadline')!;
  const dsStatus = checkDsTransitionStatus(
    profile.admissionDate,
    profile.programEndDate,
    profile.visaAdmissionType === 'D/S',
    dsRules.effective_date,
    dsPendingRule.deadline!,
    dsGraceRule.threshold!,
    dsEffectiveRule.id,
    dsRules.disclaimer,
  );

  return { unemployment, cptImpact, conflicts, dsStatus };
}

export function registerRoutes(fastify: FastifyInstance): void {

  // POST /profile — create or update user profile
  fastify.post('/profile', async (request, reply) => {
    const body = request.body as {
      fullName?: unknown;
      programEndDate?: unknown;
      degreeLevel?: unknown;
      visaAdmissionType?: unknown;
      admissionDate?: unknown;
      isStemEligible?: unknown;
    };

    if (
      typeof body.fullName !== 'string' ||
      typeof body.programEndDate !== 'string' ||
      typeof body.degreeLevel !== 'string' ||
      (body.visaAdmissionType !== 'D/S' && body.visaAdmissionType !== 'fixed-date') ||
      typeof body.admissionDate !== 'string' ||
      typeof body.isStemEligible !== 'boolean'
    ) {
      return reply.status(400).send({
        error: 'Missing or invalid required fields: fullName, programEndDate, degreeLevel, visaAdmissionType (D/S|fixed-date), admissionDate, isStemEligible',
      });
    }

    upsertUserProfile({
      fullName: body.fullName,
      programEndDate: body.programEndDate,
      degreeLevel: body.degreeLevel,
      visaAdmissionType: body.visaAdmissionType as 'D/S' | 'fixed-date',
      admissionDate: body.admissionDate,
      isStemEligible: body.isStemEligible,
    });

    return reply.status(201).send({ ok: true });
  });

  // GET /profile — return current profile
  fastify.get('/profile', async (_request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'No profile set' });
    return reply.send(profile);
  });

  // POST /employment — log a new employment period
  fastify.post('/employment', async (request, reply) => {
    const body = request.body as {
      employer?: unknown;
      authType?: unknown;
      cptType?: unknown;
      hoursPerWeek?: unknown;
      startDate?: unknown;
      endDate?: unknown;
    };

    if (
      typeof body.employer !== 'string' ||
      (body.authType !== 'CPT' && body.authType !== 'OPT' && body.authType !== 'STEM-OPT') ||
      typeof body.hoursPerWeek !== 'number' ||
      typeof body.startDate !== 'string'
    ) {
      return reply.status(400).send({
        error: 'Missing or invalid required fields: employer, authType (CPT|OPT|STEM-OPT), hoursPerWeek, startDate',
      });
    }

    // Validate cptType if authType is CPT
    if (body.authType === 'CPT' && body.cptType !== 'full-time' && body.cptType !== 'part-time') {
      return reply.status(400).send({
        error: 'cptType is required for CPT authType: must be "full-time" or "part-time"',
      });
    }

    const id = insertEmploymentPeriod({
      employer: body.employer,
      authType: body.authType as 'CPT' | 'OPT' | 'STEM-OPT',
      cptType: body.cptType as 'full-time' | 'part-time' | undefined,
      hoursPerWeek: body.hoursPerWeek,
      startDate: body.startDate,
      endDate: typeof body.endDate === 'string' ? body.endDate : undefined,
    });

    return reply.status(201).send({ id });
  });

  // GET /employment — list all logged employment periods
  fastify.get('/employment', async (_request, reply) => {
    const periods = getAllEmploymentPeriods();
    return reply.send(periods);
  });

  // PUT /employment/:id — update an employment period
  fastify.put<{ Params: { id: string } }>('/employment/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: 'Invalid id' });
    }
    const body = request.body as {
      employer?: unknown;
      authType?: unknown;
      cptType?: unknown;
      hoursPerWeek?: unknown;
      startDate?: unknown;
      endDate?: unknown;
    };
    if (
      typeof body.employer !== 'string' ||
      (body.authType !== 'CPT' && body.authType !== 'OPT' && body.authType !== 'STEM-OPT') ||
      typeof body.hoursPerWeek !== 'number' ||
      typeof body.startDate !== 'string'
    ) {
      return reply.status(400).send({
        error: 'Missing or invalid fields: employer, authType, hoursPerWeek, startDate',
      });
    }
    if (body.authType === 'CPT' && body.cptType !== 'full-time' && body.cptType !== 'part-time') {
      return reply.status(400).send({ error: 'cptType required for CPT: full-time or part-time' });
    }
    const updated = updateEmploymentPeriod(id, {
      employer: body.employer,
      authType: body.authType as 'CPT' | 'OPT' | 'STEM-OPT',
      cptType: body.cptType as 'full-time' | 'part-time' | undefined,
      hoursPerWeek: body.hoursPerWeek,
      startDate: body.startDate,
      endDate: typeof body.endDate === 'string' ? body.endDate : undefined,
    });
    if (!updated) return reply.status(404).send({ error: 'Employment record not found' });
    return reply.send({ ok: true });
  });

  // DELETE /employment/:id — remove an employment period
  fastify.delete<{ Params: { id: string } }>('/employment/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: 'Invalid id' });
    }
    const deleted = deleteEmploymentPeriod(id);
    if (!deleted) return reply.status(404).send({ error: 'Employment record not found' });
    return reply.send({ ok: true });
  });

  // POST /authorization — log a CPT/OPT/STEM-OPT authorization
  fastify.post('/authorization', async (request, reply) => {
    const body = request.body as {
      authType?: unknown;
      employer?: unknown;
      startDate?: unknown;
      endDate?: unknown;
    };

    if (
      (body.authType !== 'CPT' && body.authType !== 'OPT' && body.authType !== 'STEM-OPT') ||
      typeof body.startDate !== 'string' ||
      typeof body.endDate !== 'string'
    ) {
      return reply.status(400).send({
        error: 'Missing or invalid required fields: authType (CPT|OPT|STEM-OPT), startDate, endDate',
      });
    }

    const id = insertAuthorization({
      authType: body.authType as 'CPT' | 'OPT' | 'STEM-OPT',
      employer: typeof body.employer === 'string' ? body.employer : undefined,
      startDate: body.startDate,
      endDate: body.endDate,
    });

    return reply.status(201).send({ id });
  });

  // GET /status — compute and return all compliance flags
  fastify.get('/status', async (_request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'Profile not set. POST /profile first.' });

    const roles = getAllEmploymentPeriods();
    const { unemployment, cptImpact, conflicts, dsStatus } = computeFullStatus(profile, roles);
    return reply.send({ unemployment, cptImpact, conflicts, dsStatus });
  });

  // GET /alerts — proactive risk alerts
  fastify.get('/alerts', async (_request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'Profile not set. POST /profile first.' });

    const roles = getAllEmploymentPeriods();
    const { unemployment, cptImpact, conflicts, dsStatus } = computeFullStatus(profile, roles);
    const todayIso = new Date().toISOString().slice(0, 10);
    const alerts = computeAlerts(unemployment, cptImpact, conflicts, dsStatus, todayIso);
    return reply.send(alerts);
  });

  // GET /deadlines — urgency-sorted deadline cards
  fastify.get('/deadlines', async (_request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'Profile not set. POST /profile first.' });

    const roles = getAllEmploymentPeriods();
    const { unemployment, dsStatus } = computeFullStatus(profile, roles);
    const todayIso = new Date().toISOString().slice(0, 10);
    const deadlines = computeDeadlines(unemployment, dsStatus, profile.programEndDate, todayIso);
    return reply.send(deadlines);
  });

  // POST /simulate — run engine with hypothetical roles (no DB write)
  fastify.post('/simulate', async (request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'Profile not set. POST /profile first.' });

    const body = request.body as {
      roles?: unknown;
      optWindow?: unknown;
    };

    if (!Array.isArray(body.roles)) {
      return reply.status(400).send({ error: 'roles must be an array' });
    }

    // Build hypothetical roles (merge existing DB roles + simulated roles)
    const existingRoles = getAllEmploymentPeriods();
    const simulatedRoles: Role[] = (body.roles as Array<{
      id?: string;
      employer?: unknown;
      authType?: unknown;
      cptType?: unknown;
      hoursPerWeek?: unknown;
      startDate?: unknown;
      endDate?: unknown;
    }>).map((r, idx) => ({
      id: `sim-${idx}`,
      employer: typeof r.employer === 'string' ? r.employer : 'Simulated Employer',
      authorizationType: (r.authType as 'CPT' | 'OPT' | 'STEM-OPT') ?? 'OPT',
      hoursPerWeek: typeof r.hoursPerWeek === 'number' ? r.hoursPerWeek : 40,
      period: {
        start: typeof r.startDate === 'string' ? r.startDate : new Date().toISOString().slice(0, 10),
        end: typeof r.endDate === 'string' ? r.endDate : undefined,
      },
      cptType: (r.cptType as 'full-time' | 'part-time' | undefined),
    }));

    const allRoles = [...existingRoles, ...simulatedRoles];
    const { unemployment, cptImpact, conflicts, dsStatus } = computeFullStatus(profile, allRoles);
    return reply.send({ unemployment, cptImpact, conflicts, dsStatus });
  });

  // POST /dso-email — generate a professional email to DSO
  fastify.post('/dso-email', async (request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'Profile not set. POST /profile first.' });

    const body = request.body as {
      emailType?: unknown;
      additionalContext?: unknown;
    };

    const validTypes = ['cpt-request', 'opt-question', 'stem-extension', 'general-inquiry'];
    if (!validTypes.includes(body.emailType as string)) {
      return reply.status(400).send({ error: `emailType must be one of: ${validTypes.join(', ')}` });
    }

    const email = await generateDsoEmail(
      body.emailType as 'cpt-request' | 'opt-question' | 'stem-extension' | 'general-inquiry',
      profile,
      typeof body.additionalContext === 'string' ? body.additionalContext : undefined,
    );
    return reply.send({ email });
  });

  // GET /authorizations — list all authorization records
  fastify.get('/authorizations', async (_request, reply) => {
    const records = getAllAuthorizations();
    return reply.send(records);
  });

  // GET /action-plan — personalized D/S transition action plan with completion state
  fastify.get('/action-plan', async (_request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'Profile not set. POST /profile first.' });

    const roles = getAllEmploymentPeriods();
    const { dsStatus } = computeFullStatus(profile, roles);
    const todayIso = new Date().toISOString().slice(0, 10);
    const steps = computeActionPlan(profile, dsStatus, todayIso);
    const completions = getActionStepCompletions();

    const stepsWithCompletion = steps.map(step => ({
      ...step,
      completed: completions[step.id] ?? false,
    }));

    return reply.send(stepsWithCompletion);
  });

  // GET /documents — canonical document list merged with user's tracked status
  fastify.get('/documents', async (_request, reply) => {
    const statuses = getAllDocumentStatuses();
    const result = DOCUMENT_LIST.map(doc => ({
      ...doc,
      status: statuses[doc.id]?.status ?? 'not-started',
      notes: statuses[doc.id]?.notes ?? null,
      updatedAt: statuses[doc.id]?.updatedAt ?? null,
    }));
    return reply.send(result);
  });

  // POST /documents/:id — update status and/or notes for a document
  fastify.post<{ Params: { id: string } }>('/documents/:id', async (request, reply) => {
    const { id } = request.params;

    const validDoc = DOCUMENT_LIST.find(d => d.id === id);
    if (!validDoc) return reply.status(404).send({ error: `Unknown document id: ${id}` });

    const body = request.body as { status?: unknown; notes?: unknown };
    const validStatuses = ['not-started', 'located', 'scanned', 'submitted'];

    if (body.status !== undefined && !validStatuses.includes(body.status as string)) {
      return reply.status(400).send({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const currentStatuses = getAllDocumentStatuses();
    const current = currentStatuses[id];
    const newStatus = (body.status as 'not-started' | 'located' | 'scanned' | 'submitted') ?? current?.status ?? 'not-started';
    const newNotes = typeof body.notes === 'string' ? body.notes : (current?.notes ?? null);
    const updatedAt = new Date().toISOString();

    upsertDocumentStatus(id, newStatus, newNotes, updatedAt);
    return reply.send({ ok: true });
  });

  // POST /action-plan/:id/toggle — mark a step complete or incomplete
  fastify.post<{ Params: { id: string } }>('/action-plan/:id/toggle', async (request, reply) => {
    const { id } = request.params;
    if (!id) return reply.status(400).send({ error: 'Step id is required' });

    const body = request.body as { completed?: unknown };
    if (typeof body.completed !== 'boolean') {
      return reply.status(400).send({ error: 'completed (boolean) is required' });
    }

    const completedAt = body.completed ? new Date().toISOString().slice(0, 10) : null;
    toggleActionStep(id, body.completed, completedAt);
    return reply.send({ ok: true });
  });

  // GET /filing-windows — computed filing deadlines for the student's situation
  fastify.get('/filing-windows', async (_request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'Profile not set. POST /profile first.' });

    const optWindow = getOptWindow();
    const todayIso  = new Date().toISOString().slice(0, 10);
    const windows   = computeFilingWindows(profile, optWindow, todayIso);
    return reply.send(windows);
  });

  // GET /scenarios — D/S transition scenario matrix + detected scenario for user
  fastify.get('/scenarios', async (_request, reply) => {
    const profile = getUserProfile();
    const todayIso = new Date().toISOString().slice(0, 10);

    const detectedId = profile
      ? detectScenario(profile.admissionDate, profile.visaAdmissionType, todayIso)
      : null;

    return reply.send({ scenarios: SCENARIOS, detectedId });
  });

  // GET /rules/:topic — return rule text for a topic
  fastify.get<{ Params: { topic: string } }>('/rules/:topic', async (request, reply) => {
    const { topic } = request.params;
    const filename = TOPIC_TO_FILENAME[topic];
    if (!filename) return reply.status(404).send({ error: `Unknown topic: ${topic}` });
    const rules = loadRuleFile(filename);
    return reply.send(rules);
  });

  // POST /ask — ask the compliance agent a question
  fastify.post('/ask', async (request, reply) => {
    const { question } = request.body as { question: string };
    if (!question || typeof question !== 'string') {
      return reply.status(400).send({ error: 'question is required' });
    }
    const answer = await askAgent(question);
    return reply.send({ answer });
  });

  // GET /news — fetch recent immigration news headlines (informational only)
  fastify.get('/news', async (_request, reply) => {
    const result = await fetchImmigrationNews(10);
    return reply.send(result);
  });
}
