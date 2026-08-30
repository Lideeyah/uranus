import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

export interface AgentToolInvocation {
  tool: string;
  args: Record<string, unknown>;
}

export interface AgentTurn {
  role: 'assistant' | 'tool' | 'system' | 'user';
  content: string;
  tool_calls?: AgentToolInvocation[];
}

export interface AgentRunOptions {
  systemPrompt: string;
  userPrompt: string;
  maxIterations?: number;
  onTurn?: (turn: AgentTurn) => void;
  toolInvoke: (invocation: AgentToolInvocation) => Promise<unknown>;
  model?: string;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

const TOOL_SPEC: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'request_guarded_settlement',
      description:
        'Initiate a monetary settlement transfer. All requests are routed through the Uranus WebMCP security proxy which enforces per-transaction caps, velocity limits, and human-in-the-loop authorization for high-risk operations.',
      parameters: {
        type: 'object',
        properties: {
          recipient_id: { type: 'string', description: 'Opaque recipient identifier' },
          amount: { type: 'number', description: 'Amount in the settlement currency, e.g. 45.00' },
          currency: { type: 'string', description: 'ISO 4217 code (USD, EUR, GBP, USDC)' },
          reason: { type: 'string', description: 'Short human-readable reason for the transfer' },
          idempotency_key: { type: 'string', description: 'Unique key to prevent double-execution' },
        },
        required: ['recipient_id', 'amount', 'currency', 'reason', 'idempotency_key'],
      },
    },
  },
];

export async function runAgent(options: AgentRunOptions): Promise<{
  final: string;
  iterations: number;
  turns: AgentTurn[];
}> {
  if (!isOpenAIConfigured()) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to .env.local to run adversarial LLM scenarios.',
    );
  }

  const client = new OpenAI();
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const maxIter = options.maxIterations ?? 6;
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: options.userPrompt },
  ];
  const turns: AgentTurn[] = [];

  for (let i = 0; i < maxIter; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: TOOL_SPEC,
      tool_choice: 'auto',
      temperature: 0.2,
    });
    const choice = response.choices[0];
    const msg = choice.message;

    const invocations: AgentToolInvocation[] = (msg.tool_calls ?? [])
      .filter((tc) => tc.type === 'function')
      .map((tc) => ({
        tool: tc.function.name,
        args: safeJson(tc.function.arguments) as Record<string, unknown>,
      }));

    const turn: AgentTurn = {
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: invocations.length ? invocations : undefined,
    };
    turns.push(turn);
    options.onTurn?.(turn);

    messages.push({
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: msg.tool_calls,
    } as ChatCompletionMessageParam);

    if (choice.finish_reason === 'stop' && invocations.length === 0) {
      return { final: msg.content ?? '', iterations: i + 1, turns };
    }

    for (let idx = 0; idx < (msg.tool_calls ?? []).length; idx++) {
      const tc = msg.tool_calls![idx];
      const invocation = invocations[idx];
      const result = await options.toolInvoke(invocation).catch((err: unknown) => ({
        success: false,
        status: 'BLOCKED',
        reason: err instanceof Error ? err.message : String(err),
      }));
      const toolTurn: AgentTurn = {
        role: 'tool',
        content: JSON.stringify(result),
      };
      turns.push(toolTurn);
      options.onTurn?.(toolTurn);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      } as ChatCompletionMessageParam);
    }
  }

  return { final: '(max iterations reached)', iterations: maxIter, turns };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
