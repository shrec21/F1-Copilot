import Anthropic from '@anthropic-ai/sdk';
import { loadRuleFile } from '../rules/loader';
import { TOPIC_TO_FILENAME } from '../rules/topics';

const SYSTEM_PROMPT = `You are an F-1 student visa compliance assistant.

You have access to two tools:
- lookup_rule: retrieves the official rule text, citations, and disclaimer for a topic
- get_compliance_status: retrieves the user's current computed compliance data

Rules for every response:
1. ALWAYS call lookup_rule for the relevant topic before answering any rule question.
2. ALWAYS call get_compliance_status before answering any question about the user's specific situation.
3. ALWAYS include the exact citation from the rule (e.g. "8 CFR § 214.2(f)(10)(ii)(C)") in your answer.
4. ALWAYS include the disclaimer text from the rule file at the end of your answer.
5. If the question cannot be answered using the available tools and rule corpus, respond ONLY with:
   "This isn't covered by what I can verify — please talk to your DSO or an immigration attorney."
   Do not improvise, interpret, or speculate about rules not in the corpus.
6. Never say "you are compliant" or "this is legal" as a bare conclusion.
   Always frame answers as: computed fact + rule citation + disclaimer.`;

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'lookup_rule',
    description:
      'Look up F-1 compliance rules for a given topic. Returns rule text, citations, and disclaimer.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: ['opt-unemployment', 'cpt-authorization', 'd-s-transition-2026'],
          description: 'The rule topic to look up',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'get_compliance_status',
    description:
      'Get the current computed compliance status for the user. Returns unemployment days used/remaining, CPT impact, conflicts, and D/S transition status.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

/**
 * Execute a tool call locally (without MCP protocol overhead).
 */
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === 'lookup_rule') {
    const topic = input['topic'] as string | undefined;
    if (!topic || !TOPIC_TO_FILENAME[topic]) {
      return JSON.stringify({ error: `Unknown topic: ${String(topic)}` });
    }
    const ruleFile = loadRuleFile(TOPIC_TO_FILENAME[topic]);
    return JSON.stringify(ruleFile);
  }

  if (name === 'get_compliance_status') {
    const res = await fetch('http://localhost:3000/status');
    const data = await res.json() as unknown;
    return JSON.stringify(data);
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

export async function askAgent(question: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: question },
  ];

  // Agentic loop
  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      // Collect all text blocks from the final response
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      return textBlocks.map((b) => b.text).join('\n').trim();
    }

    if (response.stop_reason === 'tool_use') {
      // Add the assistant's turn (may contain both text and tool_use blocks)
      messages.push({ role: 'assistant', content: response.content });

      // Process each tool use block
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(
            block.name,
            (block.input ?? {}) as Record<string, unknown>,
          );
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Feed tool results back
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Any other stop reason (max_tokens, stop_sequence, etc.)
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );
    if (textBlocks.length > 0) {
      return textBlocks.map((b) => b.text).join('\n').trim();
    }

    return "This isn't covered by what I can verify — please talk to your DSO or an immigration attorney.";
  }
}
