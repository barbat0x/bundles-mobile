import { getEnv } from "@/lib/env";

import type { WsRequest, WsResponse } from "./types";

const RECONNECT_MS = 3000;

/**
 * Plain WebSocket client for bundles API (PLAN §6.7.1).
 * Auto-reconnect unless normal close (1000).
 */
export class BundlesWsClient {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private openPromise: Promise<void> | null = null;
  private url: string;

  constructor(url?: string) {
    this.url = url ?? getEnv().EXPO_PUBLIC_API_WS_ENDPOINT;
  }

  private ensureOpen(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(this.url);
        this.socket = ws;
        ws.onopen = () => {
          this.openPromise = null;
          resolve();
        };
        ws.onerror = () => {
          this.openPromise = null;
          reject(new Error("WebSocket connection failed"));
        };
        ws.onclose = (ev) => {
          if (ev.code !== 1000) {
            setTimeout(() => {
              this.socket = null;
              void this.ensureOpen().catch(() => undefined);
            }, RECONNECT_MS);
          }
          this.openPromise = null;
        };
        ws.onmessage = (ev) => {
          let msg: WsResponse;
          try {
            msg = JSON.parse(String(ev.data)) as WsResponse;
          } catch {
            return;
          }
          const p = this.pending.get(msg.id);
          if (!p) return;
          this.pending.delete(msg.id);
          if (msg.error) {
            p.reject(new Error("WS server error"));
          } else {
            p.resolve(msg.data);
          }
        };
      } catch (e) {
        this.openPromise = null;
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    return this.openPromise;
  }

  async request<T = unknown>(route: string, data: unknown): Promise<T> {
    await this.ensureOpen();
    const id = this.nextId++;
    const payload: WsRequest = { id, route, data };
    const ws = this.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      ws.send(JSON.stringify(payload));
    });
  }

  close(): void {
    this.socket?.close(1000, "app close");
    this.socket = null;
  }
}

export const globalWsClient = new BundlesWsClient();
