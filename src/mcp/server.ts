import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadRuleFile } from '../rules/loader';

// Map of topic slug → YAML filename
const topicToFilename: Record<string, string> = {
  'opt-unemployment':    'opt-unemployment.yaml',
  'cpt-authorization':   'cpt-authorization.yaml',
  'd-s-transition-2026': 'd-s-transition-2026.yaml',
};

/**
 * Handles a tool call by name with the given arguments.
 * Exported for direct unit testing without spinning up the MCP transport.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  if (name === 'lookup_rule') {
    const topic = args['topic'] as string | undefined;
    if (!topic) {
      return {
        content: [{ type: 'text', text: 'Error: topic is required' }],
        isError: true,
      };
    }
    const filename = topicToFilename[topic];
    if (!filename) {
      return {
        content: [{ type: 'text', text: `Error: unknown topic "${topic}"` }],
        isError: true,
      };
    }
    const ruleFile = loadRuleFile(filename);
    return {
      content: [{ type: 'text', text: JSON.stringify(ruleFile, null, 2) }],
    };
  }

  if (name === 'get_compliance_status') {
    const res = await fetch('http://localhost:3000/status');
    const data = await res.json() as unknown;
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }

  return {
    content: [{ type: 'text', text: `Error: unknown tool "${name}"` }],
    isError: true,
  };
}

export function createServer(): Server {
  const server = new Server(
    { name: 'f1-compliance-copilot', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'lookup_rule',
        description:
          'Look up F-1 compliance rules for a given topic. Returns rule text, citations, and disclaimer.',
        inputSchema: {
          type: 'object' as const,
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
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
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
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err: unknown) => {
    console.error('MCP server error:', err);
    process.exit(1);
  });
}
