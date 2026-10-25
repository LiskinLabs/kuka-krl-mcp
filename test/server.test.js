import test from "node:test";
import assert from "node:assert/strict";

import { lookupSystemVar, SYSTEM_VARS_DB } from "../dist/data/system-vars.js";
import { lookupKssMessage, KSS_MESSAGES_CATALOG } from "../dist/data/kss-messages.js";
import { lookupSyntax, KRL_SYNTAX_DB } from "../dist/data/krl-syntax.js";
import { lintKrlCode } from "../dist/safety-linter.js";
import { BridgeClient } from "../dist/bridge-client.js";

test("Tier 0: System Variables DB Lookup", () => {
  const toolEn = lookupSystemVar("$TOOL", "en");
  assert.ok(toolEn, "$TOOL should exist in system vars database");
  assert.strictEqual(toolEn.type, "FRAME");
  assert.strictEqual(toolEn.readOnly, false);
  assert.ok(toolEn.description.en.includes("TCP"));

  const toolRu = lookupSystemVar("tool", "ru");
  assert.ok(toolRu, "Case-insensitive and prefix-insensitive lookup should succeed");
  assert.ok(toolRu.description.ru.includes("инструмента"));

  const ovPro = lookupSystemVar("$OV_PRO", "en");
  assert.ok(ovPro);
  assert.strictEqual(ovPro.type, "INT");
  assert.strictEqual(ovPro.range, "0 .. 100");

  const nonExistent = lookupSystemVar("$UNKNOWN_VAR_123");
  assert.strictEqual(nonExistent, undefined);
});

test("Tier 0: KSS Messages Catalog Lookup", () => {
  const msg1376 = lookupKssMessage(1376, "en");
  assert.ok(msg1376, "Message 1376 should exist");
  assert.ok(msg1376.text.en.includes("velocity exceeded"));
  assert.ok(msg1376.remedy.en.includes("Reduce $VEL.CP"));

  const msg67Ru = lookupKssMessage("67", "ru");
  assert.ok(msg67Ru);
  assert.ok(msg67Ru.text.ru.includes("безопасность оператора"));
  assert.ok(msg67Ru.remedy.ru.includes("SmartPAD"));

  const nonExistent = lookupKssMessage(999999);
  assert.strictEqual(nonExistent, undefined);
});

test("Tier 0: KRL Syntax Reference", () => {
  const ptp = lookupSyntax("PTP", "en");
  assert.ok(ptp);
  assert.ok(ptp.syntax.includes("PTP TargetPoint"));
  assert.ok(ptp.description.en.includes("Point-to-Point"));

  const spline = lookupSyntax("spline", "ru");
  assert.ok(spline);
  assert.ok(spline.description.ru.includes("сплайновый блок"));
});

test("Tier 0: Safety & Logic Linter", () => {
  // 1. Safe code
  const safeCode = `
DEF SafeRoutine()
  BAS(#INITMOV, 0)
  $TOOL = TOOL_DATA[1]
  $BASE = BASE_DATA[1]
  $VEL.CP = 0.5
  PTP XP1
  LIN XP2
END
`;
  const resSafe = lintKrlCode(safeCode);
  assert.strictEqual(resSafe.safe, true);
  assert.strictEqual(resSafe.detailedIssues.length, 0);

  // 2. Code with multiple hazards: uninitialized TCP, division by zero, unbalanced fold, out of bound IO
  const unsafeCode = `
;FOLD MotionBlock
DEF UnsafeRoutine()
  PTP XP1
  val = 100 / 0
  $OUT[99999] = TRUE
  LOOP
    $FLAG[1] = TRUE
  ENDLOOP
END
`;
  const resUnsafe = lintKrlCode(unsafeCode);
  assert.strictEqual(resUnsafe.safe, false);
  const codes = resUnsafe.detailedIssues.map((i) => i.code);
  assert.ok(codes.includes("KRL_UNINITIALIZED_TCP"), "Should detect uninitialized TCP");
  assert.ok(codes.includes("KRL_DIV_BY_ZERO"), "Should detect div by zero");
  assert.ok(codes.includes("KRL_IO_BOUNDS"), "Should detect out of bound IO");
  assert.ok(codes.includes("KRL_INFINITE_LOOP"), "Should detect infinite loop without exit");
  assert.ok(codes.includes("KRL_FOLD_UNBALANCED"), "Should detect missing ;ENDFOLD");
});

test("Tier 1 & 2: Bridge Client EXTENSION_REQUIRED Fallback", async () => {
  const client = new BridgeClient();
  // With no bridge running or mock environment
  const diag = await client.getWorkspaceDiagnostics();
  assert.ok(diag.error === "EXTENSION_REQUIRED" || diag.error === "BRIDGE_COMMUNICATION_ERROR");
  if (diag.error === "EXTENSION_REQUIRED") {
    assert.ok(diag.message.includes("LiskinLabs"));
    assert.ok(diag.installUrl.includes("LiskinLabs.kuka-krl-extension"));
  }

  const repair = await client.safeAutoRepair("DEF a()\nEND");
  assert.ok(repair.error === "EXTENSION_REQUIRED" || repair.error === "BRIDGE_COMMUNICATION_ERROR");
});
