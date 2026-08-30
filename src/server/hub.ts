import { EventEmitter } from 'node:events';
import type {
  BridgeServerMessage,
  LogEntry,
  PendingToolRequest,
  ToolExecutionResult,
} from '../lib/types';

interface PendingSlot {
  request: PendingToolRequest;
  resolve: (result: ToolExecutionResult) => void;
  timer: NodeJS.Timeout;
}

class BridgeHub extends EventEmitter {
  private pending = new Map<string, PendingSlot>();

  register(
    request: PendingToolRequest,
    timeoutMs: number,
  ): Promise<ToolExecutionResult> {
    return new Promise<ToolExecutionResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id);
        resolve({
          success: false,
          status: 'REJECTED',
          reason: `timeout waiting for operator (>${Math.round(timeoutMs / 1000)}s)`,
        });
      }, timeoutMs);
      this.pending.set(request.id, { request, resolve, timer });
      this.publish({ type: 'pending', request });
    });
  }

  resolve(requestId: string, result: ToolExecutionResult): boolean {
    const slot = this.pending.get(requestId);
    if (!slot) return false;
    clearTimeout(slot.timer);
    this.pending.delete(requestId);
    slot.resolve(result);
    this.publish({ type: 'resolved', request_id: requestId, result });
    return true;
  }

  listPending(): PendingToolRequest[] {
    return Array.from(this.pending.values()).map((s) => s.request);
  }

  publish(message: BridgeServerMessage): void {
    this.emit('bridge-message', message);
  }

  onMessage(handler: (message: BridgeServerMessage) => void): () => void {
    this.on('bridge-message', handler);
    return () => this.off('bridge-message', handler);
  }

  log(entry: LogEntry): void {
    this.publish({ type: 'log', entry });
  }
}

// Module-level singleton — but survive hot reload via globalThis.
declare global {
  var __URANUS_HUB__: BridgeHub | undefined;
}

export const hub: BridgeHub =
  globalThis.__URANUS_HUB__ ?? (globalThis.__URANUS_HUB__ = new BridgeHub());

// EventEmitter default is 10 — we may have many WS clients + log listeners.
hub.setMaxListeners(256);
