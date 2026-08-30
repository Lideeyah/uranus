import type { SettlementPayload, ToolExecutionResult, WebMCPToolDescriptor } from './types';
import { httpSubmitPreset } from './bridge-client';

// -------------------------------------------------------------
// Ambient: navigator.modelContext (WebMCP proposal)
// -------------------------------------------------------------
export interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ModelContext {
  registerTool: (tool: ModelContextTool) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
  listTools?: () => ModelContextTool[];
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
  interface Window {
    __URANUS_MCP__?: {
      tools: WebMCPToolDescriptor[];
      transport: 'navigator.modelContext' | 'polyfill';
      version: string;
    };
  }
}

class PolyfillModelContext implements ModelContext {
  private registry = new Map<string, ModelContextTool>();
  registerTool(tool: ModelContextTool): void {
    this.registry.set(tool.name, tool);
  }
  unregisterTool(name: string): void {
    this.registry.delete(name);
  }
  listTools(): ModelContextTool[] {
    return Array.from(this.registry.values());
  }
  invoke(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.registry.get(name);
    if (!tool) return Promise.reject(new Error(`Tool not registered: ${name}`));
    return tool.execute(args);
  }
}

let polyfill: PolyfillModelContext | null = null;

export function ensureModelContext(): ModelContext {
  if (typeof window === 'undefined') throw new Error('WebMCP is browser-only');
  if (navigator.modelContext) return navigator.modelContext;
  if (!polyfill) polyfill = new PolyfillModelContext();
  (navigator as Navigator & { modelContext: ModelContext }).modelContext = polyfill;
  return polyfill;
}

export const TOOL_DESCRIPTORS: WebMCPToolDescriptor[] = [
  {
    name: 'request_guarded_settlement',
    description:
      'Initiate a monetary settlement transfer subject to Uranus guardrail evaluation and human-in-the-loop authorization.',
    schema: {
      recipient_id: 'string',
      amount: 'number',
      currency: 'string',
      reason: 'string',
      idempotency_key: 'string',
    },
  },
  {
    name: 'simulate_preflight',
    description:
      'Dry-run a settlement payload through the guardrail engine without moving funds.',
    schema: {
      recipient_id: 'string',
      amount: 'number',
      currency: 'string',
      reason: 'string',
      idempotency_key: 'string',
    },
  },
];

export function registerWebMCPTools(): {
  ctx: ModelContext;
  transport: 'navigator.modelContext' | 'polyfill';
} {
  const ctx = ensureModelContext();
  const isNative = ctx !== polyfill;

  ctx.registerTool({
    name: TOOL_DESCRIPTORS[0].name,
    description: TOOL_DESCRIPTORS[0].description,
    inputSchema: TOOL_DESCRIPTORS[0].schema,
    execute: async (args) =>
      httpSubmitPreset(args as unknown as SettlementPayload, 'browser-preset'),
  });

  ctx.registerTool({
    name: TOOL_DESCRIPTORS[1].name,
    description: TOOL_DESCRIPTORS[1].description,
    inputSchema: TOOL_DESCRIPTORS[1].schema,
    execute: async () => ({
      status: 'AUTO_APPROVED' as const,
      success: true,
      reason: 'preflight uses the /policy endpoint; see MCP simulate_preflight tool',
    }),
  });

  if (typeof window !== 'undefined') {
    window.__URANUS_MCP__ = {
      tools: TOOL_DESCRIPTORS,
      transport: isNative ? 'navigator.modelContext' : 'polyfill',
      version: '0.1.0',
    };
  }

  return { ctx, transport: isNative ? 'navigator.modelContext' : 'polyfill' };
}

export async function invokeRegisteredTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const ctx = ensureModelContext();
  const tools = ctx.listTools?.() ?? [];
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  return (await tool.execute(args)) as ToolExecutionResult;
}
