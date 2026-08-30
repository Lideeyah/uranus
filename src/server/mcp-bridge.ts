#!/usr/bin/env node
/**
 * Uranus MCP stdio bridge.
 *
 * Runs as a standalone Node process launched by an MCP client
 * (e.g. Claude Desktop). Speaks the Model Context Protocol on
 * stdio, forwards every tool call over HTTP to the local Uranus
 * bridge server, and blocks until the browser operator resolves
 * or rejects the call.
 *
 * Claude Desktop config example (~/Library/Application Support/
 *   Claude/claude_desktop_config.json):
 *
 *   {
 *     "mcpServers": {
 *       "uranus": {
 *         "command": "npx",
 *         "args": ["tsx", "<abs-path>/src/server/mcp-bridge.ts"],
 *         "env": { "URANUS_URL": "http://localhost:3223" }
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const URANUS_URL = (process.env.URANUS_URL ?? 'http://localhost:3223').replace(/\/$/, '');

const settlementSchema = {
  recipient_id: z.string().describe('Opaque recipient identifier'),
  amount: z.number().describe('Amount in the settlement currency'),
  currency: z.string().describe('ISO 4217 code, e.g. USD, EUR, GBP, USDC'),
  reason: z.string().describe('Human-readable reason for the transfer'),
  idempotency_key: z.string().describe('Unique key preventing double-execution'),
};

async function submit(
  toolName: string,
  args: Record<string, unknown>,
  origin: 'mcp-external',
): Promise<unknown> {
  const res = await fetch(`${URANUS_URL}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool_name: toolName, payload: args, origin }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      success: false,
      status: 'BLOCKED',
      reason: `bridge_error:${res.status}:${text.slice(0, 200)}`,
    };
  }
  return res.json();
}

async function main() {
  const server = new McpServer({
    name: 'uranus',
    version: '0.1.0',
  });

  server.tool(
    'request_guarded_settlement',
    'Initiate a monetary settlement subject to Uranus WebMCP guardrails and human-in-the-loop authorization.',
    settlementSchema,
    async (args) => {
      const result = await submit('request_guarded_settlement', args, 'mcp-external');
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    'simulate_preflight',
    'Dry-run a settlement payload through the guardrail engine without moving funds.',
    settlementSchema,
    async (args) => {
      const res = await fetch(`${URANUS_URL}/policy`);
      const policy = (await res.json().catch(() => ({}))) as {
        auto_approve_max_usd?: number;
      };
      const would_step_up =
        typeof args.amount === 'number' &&
        typeof policy.auto_approve_max_usd === 'number' &&
        args.amount > policy.auto_approve_max_usd;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                dry_run: true,
                would_step_up,
                auto_approve_max_usd: policy.auto_approve_max_usd,
                args,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[uranus-mcp-bridge] connected · forwarding to ${URANUS_URL}`);
}

main().catch((err) => {
  console.error('[uranus-mcp-bridge] fatal', err);
  process.exit(1);
});
