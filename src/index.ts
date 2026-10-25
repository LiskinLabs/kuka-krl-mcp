#!/usr/bin/env node

/**
 * KUKA KRL Model Context Protocol (MCP) Server.
 * Developed by LiskinLabs (https://github.com/LiskinLabs).
 *
 * Provides AI assistants (Cursor, Antigravity, Claude Code, Windsurf) with
 * industrial-grade KUKA KRL (KSS 8.3-8.7) domain expertise, error diagnostics,
 * syntax reference, workspace continuous verification, and live controller bridge.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { SYSTEM_VARS_DB, lookupSystemVar } from "./data/system-vars.js";
import { KSS_MESSAGES_CATALOG, lookupKssMessage } from "./data/kss-messages.js";
import { KRL_SYNTAX_DB, lookupSyntax } from "./data/krl-syntax.js";
import { lintKrlCode } from "./safety-linter.js";
import { BridgeClient } from "./bridge-client.js";
import { Locale } from "./types.js";

const bridge = new BridgeClient();

const server = new McpServer({
  name: "kuka-krl-mcp",
  version: "1.0.0",
});

function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(message: string, extra?: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, ...(extra || {}) }, null, 2),
      },
    ],
    isError: true,
  };
}

// ============================================================================
// Tier 0: Standalone Knowledge Tools (Free, Offline, No Extension Required)
// ============================================================================

server.tool(
  "krl_lookup_system_var",
  "Looks up a KUKA System Software (KSS 8.3-8.7) system variable ($TOOL, $BASE, $OV_PRO, $VEL, $ACC, $POS_ACT, $IN, $OUT, $TIMER, $ADVANCE) with description, type, range, read/write permissions, syntax and examples in 6 languages.",
  {
    var_name: z
      .string()
      .describe("Name of the KUKA system variable (e.g. '$TOOL', '$BASE', '$OV_PRO', '$VEL.CP', '$POS_ACT', '$IN', '$OUT')"),
    locale: z
      .enum(["en", "ru", "de", "es", "it", "tr"])
      .optional()
      .default("en")
      .describe("Documentation language (default: 'en')"),
  },
  async ({ var_name, locale }) => {
    const loc = (locale as Locale) || "en";
    const found = lookupSystemVar(var_name, loc);
    if (!found) {
      return errorResult(`System variable '${var_name}' not found in KSS database.`, {
        availableVariables: SYSTEM_VARS_DB.map((v) => v.name),
      });
    }

    return ok({
      name: found.name,
      type: found.type,
      readOnly: found.readOnly,
      range: found.range || "standard",
      description: found.description[loc] || found.description.en,
      syntax: found.syntax,
      example: found.example,
    });
  },
);

server.tool(
  "krl_lookup_kss_message",
  "Resolves KUKA KSS error and status message numbers (e.g. 1, 14, 20, 67, 68, 71, 72, 1376, 1422, 2858) into localized explanations, root causes, and industrial troubleshooting remediation steps.",
  {
    message_id: z
      .union([z.number(), z.string()])
      .describe("KSS error code number (e.g. 1, 20, 67, 68, 71, 1376, 2858)"),
    locale: z
      .enum(["en", "ru", "de", "es", "it", "tr"])
      .optional()
      .default("en")
      .describe("Documentation language (default: 'en')"),
  },
  async ({ message_id, locale }) => {
    const loc = (locale as Locale) || "en";
    const found = lookupKssMessage(message_id, loc);
    if (!found) {
      return errorResult(`KSS message ID ${message_id} not found in offline catalog.`, {
        hint: "For deeper diagnostics, use 'krl_workspace_diagnostics' with the KUKA KRL extension enabled.",
      });
    }

    return ok({
      id: found.id,
      text: found.text[loc] || found.text.en,
      cause: found.cause[loc] || found.cause.en,
      remedy: found.remedy[loc] || found.remedy.en,
    });
  },
);

server.tool(
  "krl_syntax_reference",
  "Provides authoritative syntax definitions and examples for KUKA KRL statements (PTP, LIN, CIRC, SPLINE, INTERRUPT, TRIGGER, FOLD, WAIT, CONTINUE) in 6 languages.",
  {
    keyword: z
      .string()
      .describe("KRL keyword: 'PTP', 'LIN', 'CIRC', 'SPLINE', 'INTERRUPT', 'TRIGGER', 'FOLD', 'WAIT', 'CONTINUE'"),
    locale: z
      .enum(["en", "ru", "de", "es", "it", "tr"])
      .optional()
      .default("en"),
  },
  async ({ keyword, locale }) => {
    const loc = (locale as Locale) || "en";
    const found = lookupSyntax(keyword, loc);
    if (!found) {
      return errorResult(`KRL keyword '${keyword}' not found in syntax database.`, {
        availableKeywords: Object.keys(KRL_SYNTAX_DB),
      });
    }

    return ok({
      keyword: keyword.toUpperCase(),
      description: found.description[loc] || found.description.en,
      syntax: found.syntax,
      example: found.example,
    });
  },
);

server.tool(
  "krl_lint_snippet",
  "Fast offline static code analysis for KRL code snippets. Detects uninitialized $TOOL/$BASE, infinite loops without EXIT, literal division by zero, unbalanced ;FOLD/;ENDFOLD blocks, physical I/O bound overflows, and non-ASCII characters.",
  {
    code: z.string().describe("KRL code snippet text to inspect"),
  },
  async ({ code }) => {
    const result = lintKrlCode(code);
    return ok(result);
  },
);

// ============================================================================
// Tier 1: Workspace Intelligence Tools (Requires LiskinLabs KUKA KRL Extension)
// ============================================================================

server.tool(
  "krl_workspace_diagnostics",
  "Collects project-wide continuous KRL diagnostics across all open .src, .dat, and .sub files from the active VS Code / Cursor / Antigravity workspace (SRC-DAT pair integrity, CIRC 2-point geometry, physical I/O ranges, FOLD balance, duplicate GLOBAL DEFs). Requires LiskinLabs KUKA KRL extension.",
  {},
  async () => {
    const res = await bridge.getWorkspaceDiagnostics();
    return ok(res);
  },
);

server.tool(
  "krl_workspace_files",
  "Lists all KUKA KRL robot programs (.src), data files (.dat), and submit interpreters (.sub) in the active workspace. Requires LiskinLabs KUKA KRL extension.",
  {},
  async () => {
    const res = await bridge.getWorkspaceFiles();
    return ok(res);
  },
);

server.tool(
  "krl_read_file",
  "Reads the text content of a KRL program or data file from the active IDE workspace. Requires LiskinLabs KUKA KRL extension.",
  {
    path: z.string().describe("Relative or absolute path to the KRL file"),
  },
  async ({ path }) => {
    const res = await bridge.getFileContent(path);
    return ok(res);
  },
);

// ============================================================================
// Tier 2: Professional Industrial & Live Controller Tools (Requires Pro License)
// ============================================================================

server.tool(
  "krl_deep_safety_audit",
  "Performs deep industrial robot safety and motion verification (subprogram advance run hazards, payload verification, actuator-sensor races, turn unwind risks). Requires KUKA KRL Professional license.",
  {
    code: z.string().describe("KRL code to audit"),
  },
  async ({ code }) => {
    const res = await bridge.deepSafetyAudit(code);
    return ok(res);
  },
);

server.tool(
  "krl_safe_auto_repair",
  "Automatically repairs common KRL hazards (BOM/encoding corruption, advance run desyncs, unbalanced inline form folds, trailing whitespace, uncommitted payload) and outputs verified repaired code. Requires KUKA KRL Professional license.",
  {
    code: z.string().describe("KRL code to safely repair"),
  },
  async ({ code }) => {
    const res = await bridge.safeAutoRepair(code);
    return ok(res);
  },
);

server.tool(
  "krl_control_flow",
  "Generates an execution Control Flow Graph (CFG) and Mermaid diagram for a KRL routine. Requires KUKA KRL Professional license.",
  {
    code: z.string().describe("KRL code routine"),
  },
  async ({ code }) => {
    const res = await bridge.getControlFlow(code);
    return ok(res);
  },
);

server.tool(
  "krl_live_telemetry",
  "Reads real-time operational telemetry from connected physical or virtual KUKA Robot Controller (robot model, KSS version, actual TCP position, joint angles, current line pointer, override $OV_PRO, mode T1/T2/AUT/EXT, active SmartPAD error alarms). Requires KUKA KRL Professional license and active controller connection.",
  {},
  async () => {
    const res = await bridge.getLiveTelemetry();
    return ok(res);
  },
);

server.tool(
  "krl_bridge_status",
  "Checks connection status between this MCP server and the LiskinLabs KUKA KRL extension local bridge.",
  {},
  async () => {
    const cfg = bridge.resolveConfig();
    const health = await bridge.getHealth();
    return ok({
      bridgeConfigured: cfg !== null,
      bridgeDetails: cfg,
      extensionHealth: health,
    });
  },
);

// ============================================================================
// MCP Prompts & Resources
// ============================================================================

server.prompt(
  "krl-expert-review",
  "Instructs the AI to perform a rigorous industrial review of KUKA KRL code according to KSS 8.3-8.7 standards.",
  {
    code: z.string().describe("KRL code to review"),
  },
  ({ code }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `You are a Principal Industrial Robotics Systems Engineer specializing in KUKA KRL (KSS 8.3-8.7).
Review the following KRL code thoroughly for:
1. Motion Safety: Proper BAS(#INITMOV, 0) or $TOOL / $BASE definition before movement.
2. Trajectory Approximation: Correct usage of $APO.CDIS / $APO.CPTP with C_DIS / C_PTP without stopping advance run pointer.
3. Advance Run Hazards: Avoid bare $OUT or WAIT FOR instructions between motion commands without CONTINUE or TRIGGER.
4. Mathematical & Range Boundaries: Check $IN[1..8192], $OUT[1..8192], $TIMER[1..64].
5. FOLD Integrity: Verify matching ;FOLD and ;ENDFOLD blocks.

Always invoke the 'krl_lint_snippet' or 'krl_deep_safety_audit' MCP tool to verify your findings.

KRL Code to Review:
\`\`\`krl
${code}
\`\`\``,
        },
      },
    ],
  }),
);

server.prompt(
  "krl-diagnose-alarm",
  "Diagnoses a KUKA KSS error code or alarm message and generates step-by-step industrial remediation instructions.",
  {
    error_id_or_text: z.string().describe("KSS error number (e.g. 1376, 67, 2858) or error text"),
  },
  ({ error_id_or_text }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `You are an expert KUKA field service engineer. Analyze this KSS alarm:
"${error_id_or_text}"

Use the 'krl_lookup_kss_message' tool to verify the official KUKA diagnostic database.
Provide:
1. Exact Root Cause (Electrical, Mechanical, Safety, Kinematic, or Software).
2. Immediate Action on SmartPAD (How to reset/acknowledge safely).
3. Long-term Prevention in KRL Code or PLC Handshake.`,
        },
      },
    ],
  }),
);

// Register MCP Resource for System Variables Catalog
server.resource(
  "system-vars-catalog",
  "krl://system-vars",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(SYSTEM_VARS_DB, null, 2),
        mimeType: "application/json",
      },
    ],
  }),
);

// Register MCP Resource for Syntax Guide
server.resource(
  "syntax-guide",
  "krl://syntax-guide",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(KRL_SYNTAX_DB, null, 2),
        mimeType: "application/json",
      },
    ],
  }),
);

// ============================================================================
// Server Initialization
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[KUKA KRL MCP] Server running on stdio.");
}

main().catch((err) => {
  console.error("[KUKA KRL MCP] Fatal startup error:", err);
  process.exit(1);
});
