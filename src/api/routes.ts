import type { FastifyInstance } from 'fastify';
import { loadRuleFile } from '../rules/loader';
import { computeUnemploymentDays } from '../engine/unemployment-clock';
import { checkCptEligibilityImpact } from '../engine/cpt-tracker';
import { checkConcurrentEmploymentConflicts } from '../engine/concurrent-employment';
import { checkDsTransitionStatus } from '../engine/ds-transition';
import {
  upsertUserProfile,
  getUserProfile,
  insertEmploymentPeriod,
  getAllEmploymentPeriods,
  insertAuthorization,
  getOptWindow,
} from '../data/queries';
import { askAgent } from '../mcp/agent';

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
  fastify.get('/status', async (request, reply) => {
    const profile = getUserProfile();
    if (!profile) return reply.status(404).send({ error: 'Profile not set. POST /profile first.' });

    const roles = getAllEmploymentPeriods();
    const optWindow = getOptWindow();

    // Load rule files
    const optRules = loadRuleFile('opt-unemployment.yaml');
    const cptRules = loadRuleFile('cpt-authorization.yaml');
    const dsRules  = loadRuleFile('d-s-transition-2026.yaml');

    // Pick the right unemployment cap rule (STEM vs standard)
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

    return reply.send({ unemployment, cptImpact, conflicts, dsStatus });
  });

  // GET /rules/:topic — return rule text for a topic
  fastify.get<{ Params: { topic: string } }>('/rules/:topic', async (request, reply) => {
    const { topic } = request.params;
    const fileMap: Record<string, string> = {
      'opt-unemployment':    'opt-unemployment.yaml',
      'cpt-authorization':   'cpt-authorization.yaml',
      'd-s-transition-2026': 'd-s-transition-2026.yaml',
    };
    const filename = fileMap[topic];
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
}
