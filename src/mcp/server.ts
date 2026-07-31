import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { initDb } from '../data/schema';
import {
  getStudentById,
  getRuleContextForStudent,
  getAuditTrailForStudent,
} from '../data/queries';
import {
  checkCptFullTimeOptBar,
  checkOptUnemployment90,
  checkOptUnemployment150Stem,
  addDays,
} from '@f1/rule-engine';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Handles a tool call by name with the given arguments.
 * Exported for direct unit testing without spinning up the MCP transport.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {

  // --- Tool 1: check_cpt_eligibility ---
  if (name === 'check_cpt_eligibility') {
    const studentId = args['studentId'] as string | undefined;
    if (!studentId) {
      return { content: [{ type: 'text', text: 'Error: studentId is required' }], isError: true };
    }
    const student = getStudentById(studentId);
    if (!student) {
      return { content: [{ type: 'text', text: `Error: student ${studentId} not found` }], isError: true };
    }
    const context = getRuleContextForStudent(studentId);
    const result = checkCptFullTimeOptBar(student, context, todayIso());
    const out = result.outputs as {
      fullTimeCptMonths: number;
      optBarReached: boolean;
      monthsRemainingBeforeBar: number;
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          student: { id: student.id, name: student.fullName },
          rule: result.rule.id,
          citation: result.rule.sourceCitation,
          status: result.status,
          eligible: !out.optBarReached,
          fullTimeCptMonths: out.fullTimeCptMonths,
          monthsRemainingBeforeBar: out.monthsRemainingBeforeBar,
          message: result.message,
          disclaimer: 'FOR INFORMATIONAL USE ONLY. Not legal advice. Verify with your DSO.',
        }, null, 2),
      }],
    };
  }

  // --- Tool 2: calculate_unemployment_days ---
  if (name === 'calculate_unemployment_days') {
    const studentId = args['studentId'] as string | undefined;
    if (!studentId) {
      return { content: [{ type: 'text', text: 'Error: studentId is required' }], isError: true };
    }
    const asOfDate = (args['asOfDate'] as string | undefined) ?? todayIso();
    const student = getStudentById(studentId);
    if (!student) {
      return { content: [{ type: 'text', text: `Error: student ${studentId} not found` }], isError: true };
    }
    const context = getRuleContextForStudent(studentId);
    const opt90 = checkOptUnemployment90(student, context, asOfDate);
    const stem150 = checkOptUnemployment150Stem(student, context, asOfDate);

    const opt90Out = opt90.outputs as {
      unemploymentDaysUsed?: number;
      daysRemainingBeforeCap?: number;
      cap?: number;
      projectedViolationDate?: string | null;
    };
    const stem150Out = stem150.outputs as {
      totalUnemploymentDays?: number;
      unemploymentDaysInOpt?: number;
      unemploymentDaysInStem?: number;
      daysRemainingBeforeCap?: number;
      cap?: number;
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          student: { id: student.id, name: student.fullName, isStemDesignated: student.isStemDesignated },
          asOfDate,
          opt90DayCap: {
            rule: opt90.rule.id,
            citation: opt90.rule.sourceCitation,
            status: opt90.status,
            unemploymentDaysUsed: opt90Out.unemploymentDaysUsed ?? null,
            daysRemainingBeforeCap: opt90Out.daysRemainingBeforeCap ?? null,
            cap: opt90Out.cap ?? 90,
            projectedViolationDate: opt90Out.projectedViolationDate ?? null,
            message: opt90.message,
          },
          stem150DayCap: {
            rule: stem150.rule.id,
            citation: stem150.rule.sourceCitation,
            status: stem150.status,
            totalUnemploymentDays: stem150Out.totalUnemploymentDays ?? null,
            daysRemainingBeforeCap: stem150Out.daysRemainingBeforeCap ?? null,
            cap: stem150Out.cap ?? 150,
            message: stem150.message,
          },
          disclaimer: 'FOR INFORMATIONAL USE ONLY. Not legal advice. Verify with your DSO.',
        }, null, 2),
      }],
    };
  }

  // --- Tool 3: simulate_opt_timeline ---
  if (name === 'simulate_opt_timeline') {
    const studentId = args['studentId'] as string | undefined;
    const proposedStartDate = args['proposedStartDate'] as string | undefined;
    if (!studentId || !proposedStartDate) {
      return {
        content: [{ type: 'text', text: 'Error: studentId and proposedStartDate are required' }],
        isError: true,
      };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedStartDate)) {
      return {
        content: [{ type: 'text', text: 'Error: proposedStartDate must be YYYY-MM-DD' }],
        isError: true,
      };
    }
    const student = getStudentById(studentId);
    if (!student) {
      return { content: [{ type: 'text', text: `Error: student ${studentId} not found` }], isError: true };
    }

    // OPT EAD: 365 days from proposed start
    const optEnd = addDays(proposedStartDate, 364);
    // Worst-case: no employment at all → cap hit after 90 unemployed days
    const optCapDate = addDays(proposedStartDate, 89);

    const timeline: Record<string, unknown> = {
      student: { id: student.id, name: student.fullName, isStemDesignated: student.isStemDesignated },
      proposedOptStart: proposedStartDate,
      optWindow: {
        start: proposedStartDate,
        end: optEnd,
        durationDays: 365,
      },
      unemploymentCaps: {
        optCap90: {
          cap: 90,
          worstCaseCapHitDate: optCapDate,
          note: 'If you remain unemployed from day 1, the 90-day cap is hit on this date.',
          citation: '8 CFR § 214.2(f)(10)(ii)(A)',
        },
      },
    };

    if (student.isStemDesignated) {
      // STEM extension: 24 months (730 days) after OPT EAD ends
      const stemStart = addDays(optEnd, 1);
      const stemEnd = addDays(stemStart, 729);
      // 150-day cumulative cap: 90 from OPT + 60 more from STEM = hits 150 on day 61 of STEM
      const stemCapDate = addDays(stemStart, 59);

      (timeline['unemploymentCaps'] as Record<string, unknown>)['stemCumulativeCap150'] = {
        cap: 150,
        stemWindowStart: stemStart,
        stemWindowEnd: stemEnd,
        worstCaseCapHitDate: stemCapDate,
        note: 'If unemployed all 90 OPT days and then continue unemployed into STEM, the 150-day cumulative cap is hit on this date.',
        citation: '8 CFR § 214.2(f)(11)(ii)',
      };
      timeline['stemWindow'] = { start: stemStart, end: stemEnd, durationDays: 730 };
    }

    timeline['disclaimer'] = 'FOR INFORMATIONAL USE ONLY. Not legal advice. Dates shown are worst-case (zero employment). Actual caps depend on your employment record. Verify with your DSO.';

    return {
      content: [{ type: 'text', text: JSON.stringify(timeline, null, 2) }],
    };
  }

  // --- Tool 4: get_compliance_audit_trail ---
  if (name === 'get_compliance_audit_trail') {
    const studentId = args['studentId'] as string | undefined;
    if (!studentId) {
      return { content: [{ type: 'text', text: 'Error: studentId is required' }], isError: true };
    }
    const student = getStudentById(studentId);
    if (!student) {
      return { content: [{ type: 'text', text: `Error: student ${studentId} not found` }], isError: true };
    }
    const entries = getAuditTrailForStudent(studentId);
    const formatted = entries.map(e => ({
      id: e.id,
      ruleId: e.ruleId,
      ruleVersion: e.ruleVersion,
      citation: e.sourceCitation,
      status: e.status,
      message: e.message,
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      evaluatedAt: e.createdAt,
      inputs: JSON.parse(e.inputsJson) as unknown,
      outputs: JSON.parse(e.outputsJson) as unknown,
    }));
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          student: { id: student.id, name: student.fullName },
          totalEntries: formatted.length,
          entries: formatted,
          disclaimer: 'FOR INFORMATIONAL USE ONLY. Not legal advice.',
        }, null, 2),
      }],
    };
  }

  return {
    content: [{ type: 'text', text: `Error: unknown tool "${name}"` }],
    isError: true,
  };
}

export function createServer(): Server {
  const server = new Server(
    { name: 'f1-compliance-copilot', version: '2.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'check_cpt_eligibility',
        description:
          'Check whether a student is eligible for OPT based on their full-time CPT history. Returns months of full-time CPT accumulated and whether the 12-month bar that permanently eliminates OPT eligibility has been reached.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            studentId: {
              type: 'string',
              description: 'UUID of the student in the synthetic cohort',
            },
          },
          required: ['studentId'],
        },
      },
      {
        name: 'calculate_unemployment_days',
        description:
          'Calculate how many unemployment days a student has accumulated under both the 90-day OPT cap and the 150-day cumulative STEM OPT cap, as of a given date (defaults to today).',
        inputSchema: {
          type: 'object' as const,
          properties: {
            studentId: {
              type: 'string',
              description: 'UUID of the student in the synthetic cohort',
            },
            asOfDate: {
              type: 'string',
              description: 'ISO 8601 date (YYYY-MM-DD) to evaluate as of. Defaults to today.',
            },
          },
          required: ['studentId'],
        },
      },
      {
        name: 'simulate_opt_timeline',
        description:
          'Given a proposed OPT start date, simulate the full authorization timeline: OPT EAD window, worst-case 90-day cap date, and (for STEM-designated students) STEM extension window and 150-day cumulative cap date.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            studentId: {
              type: 'string',
              description: 'UUID of the student (used to determine STEM designation)',
            },
            proposedStartDate: {
              type: 'string',
              description: 'ISO 8601 date (YYYY-MM-DD) for the proposed OPT start',
            },
          },
          required: ['studentId', 'proposedStartDate'],
        },
      },
      {
        name: 'get_compliance_audit_trail',
        description:
          'Retrieve the full immutable audit trail for a student: every compliance rule evaluation that was recorded by the outbox dispatcher, with inputs, outputs, citations, and timestamps.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            studentId: {
              type: 'string',
              description: 'UUID of the student in the synthetic cohort',
            },
          },
          required: ['studentId'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, (args ?? {}) as Record<string, unknown>);
  });

  return server;
}

// Only start the server when run directly (not when imported for tests)
if (require.main === module) {
  initDb();
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err: unknown) => {
    console.error('MCP server error:', err);
    process.exit(1);
  });
}
