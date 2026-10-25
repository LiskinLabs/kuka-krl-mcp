import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { BridgeConfig } from "./types.js";

/**
 * Client for the KUKA KRL IDE Extension Local Bridge.
 * Allows MCP tools to query workspace symbols, live telemetry, and pro auto-repair.
 */
export class BridgeClient {
  private config: BridgeConfig | null = null;

  constructor() {
    this.resolveConfig();
  }

  public resolveConfig(): BridgeConfig | null {
    // 1. Check environment variables
    const envPort = process.env.KUKA_KRL_BRIDGE_PORT;
    const envToken = process.env.KUKA_KRL_BRIDGE_TOKEN;

    if (envPort && envToken) {
      this.config = {
        port: parseInt(envPort, 10),
        token: envToken,
        url: `http://127.0.0.1:${envPort}`,
      };
      return this.config;
    }

    // 2. Check local bridge.json
    try {
      const bridgeFile = path.join(os.homedir(), ".liskinlabs", "kuka-krl", "bridge.json");
      if (fs.existsSync(bridgeFile)) {
        const raw = fs.readFileSync(bridgeFile, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.port && parsed.token) {
          this.config = {
            port: parsed.port,
            token: parsed.token,
            pid: parsed.pid,
            version: parsed.version,
            url: parsed.url || `http://127.0.0.1:${parsed.port}`,
            updatedAt: parsed.updatedAt,
          };
          return this.config;
        }
      }
    } catch {
      /* ignore */
    }

    this.config = null;
    return null;
  }

  public isAvailable(): boolean {
    return this.config !== null;
  }

  public async getHealth(): Promise<any> {
    const cfg = this.resolveConfig();
    if (!cfg) return { connected: false };
    try {
      const res = await fetch(`${cfg.url}/health`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      /* bridge unreachable */
    }
    return { connected: false };
  }

  public async getWorkspaceDiagnostics(): Promise<any> {
    return this.postRequest("/api/v1/workspace/diagnostics", {});
  }

  public async getWorkspaceFiles(): Promise<any> {
    return this.getRequest("/api/v1/workspace/files");
  }

  public async getFileContent(filePath: string): Promise<any> {
    return this.postRequest("/api/v1/workspace/file_content", { path: filePath });
  }

  public async deepSafetyAudit(code: string): Promise<any> {
    return this.postRequest("/api/v1/safety/deep_audit", { code });
  }

  public async safeAutoRepair(code: string): Promise<any> {
    return this.postRequest("/api/v1/safety/repair", { code });
  }

  public async getControlFlow(code: string): Promise<any> {
    return this.postRequest("/api/v1/control_flow", { code });
  }

  public async getLiveTelemetry(): Promise<any> {
    return this.getRequest("/api/v1/live/telemetry");
  }

  private async getRequest(endpoint: string): Promise<any> {
    const cfg = this.resolveConfig();
    if (!cfg) {
      return {
        error: "EXTENSION_REQUIRED",
        message:
          "KUKA KRL Extension Bridge is offline. Please launch VS Code, Cursor, or Antigravity with the LiskinLabs KUKA KRL extension enabled.",
        installUrl: "https://marketplace.visualstudio.com/items?itemName=LiskinLabs.kuka-krl-extension",
      };
    }

    try {
      const res = await fetch(`${cfg.url}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${cfg.token}`,
        },
      });
      return await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        error: "BRIDGE_COMMUNICATION_ERROR",
        message: `Failed to connect to local KUKA KRL extension bridge on port ${cfg.port}: ${msg}`,
      };
    }
  }

  private async postRequest(endpoint: string, payload: any): Promise<any> {
    const cfg = this.resolveConfig();
    if (!cfg) {
      return {
        error: "EXTENSION_REQUIRED",
        message:
          "This tool requires the LiskinLabs KUKA KRL Extension running in VS Code, Cursor, or Antigravity. Please open your workspace in the editor.",
        installUrl: "https://marketplace.visualstudio.com/items?itemName=LiskinLabs.kuka-krl-extension",
      };
    }

    try {
      const res = await fetch(`${cfg.url}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.token}`,
        },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        error: "BRIDGE_COMMUNICATION_ERROR",
        message: `Failed to communicate with KUKA KRL extension bridge: ${msg}`,
      };
    }
  }
}
