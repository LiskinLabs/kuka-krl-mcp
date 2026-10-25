import { KrlLintResult, KrlSafetyIssue } from "./types.js";

/**
 * Tier 0 Lightweight Offline KRL Safety & Logic Linter.
 * Works 100% locally without IDE extensions or external services.
 */
export function lintKrlCode(code: string): KrlLintResult {
  const detailedIssues: KrlSafetyIssue[] = [];
  const lines = code.split(/\r?\n/);

  let hasMotion = false;
  let toolInitialized = false;
  let baseInitialized = false;

  let inLoop = false;
  let loopStartLine = 0;
  let loopHasExit = false;

  let foldCount = 0;
  const foldStack: { name: string; line: number }[] = [];

  // Check UTF-8 BOM
  if (code.charCodeAt(0) === 0xfeff) {
    detailedIssues.push({
      severity: "warning",
      line: 1,
      code: "KRL_BOM_DETECTED",
      message: "UTF-8 Byte Order Mark (BOM) detected. KUKA KRC controllers may fail to compile files with BOM.",
    });
  }

  lines.forEach((rawLine, idx) => {
    const lineNum = idx + 1;
    // Strip comments
    const codePart = rawLine.split(";")[0].trim();
    const upper = codePart.toUpperCase();

    // Check for FOLD balance in raw line
    const rawTrimmed = rawLine.trim().toUpperCase();
    if (rawTrimmed.startsWith(";FOLD")) {
      foldCount++;
      foldStack.push({ name: rawLine.trim(), line: lineNum });
    } else if (rawTrimmed.startsWith(";ENDFOLD")) {
      foldCount--;
      if (foldStack.length > 0) foldStack.pop();
    }

    if (!codePart) return;

    // Check non-ASCII characters in code part
    if (/[^\x00-\x7F]/.test(codePart)) {
      detailedIssues.push({
        severity: "error",
        line: lineNum,
        code: "KRL_NON_ASCII_CHAR",
        message: `Non-ASCII character detected in code: "${codePart}". KUKA KRL parser will reject this.`,
      });
    }

    // Check TOOL / BASE initialization
    if (upper.includes("$TOOL") && upper.includes("=")) {
      toolInitialized = true;
    }
    if (upper.includes("$BASE") && upper.includes("=")) {
      baseInitialized = true;
    }
    if (upper.startsWith("BAS(#INITMOV") || upper.startsWith("BAS(#PTP_PARAMS") || upper.startsWith("BAS(#CP_PARAMS")) {
      toolInitialized = true;
      baseInitialized = true;
    }

    // Check Motion commands
    if (
      upper.startsWith("PTP ") ||
      upper.startsWith("LIN ") ||
      upper.startsWith("CIRC ") ||
      upper.startsWith("SPTP ") ||
      upper.startsWith("SLIN ") ||
      upper.startsWith("SCIRC ")
    ) {
      hasMotion = true;
      if (!toolInitialized && !baseInitialized) {
        detailedIssues.push({
          severity: "warning",
          line: lineNum,
          code: "KRL_UNINITIALIZED_TCP",
          message: `Motion command executed before $TOOL / $BASE or BAS(#INITMOV) initialization.`,
        });
        toolInitialized = true; // Flag once
        baseInitialized = true;
      }

      // Check CIRC 2-point requirement
      if (upper.startsWith("CIRC ") || upper.startsWith("SCIRC ")) {
        const afterCmd = codePart.substring(upper.indexOf("CIRC") + 4).trim();
        const parts = afterCmd.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.length < 2) {
          detailedIssues.push({
            severity: "error",
            line: lineNum,
            code: "KRL_CIRC_PARAM_MISSING",
            message: `CIRC requires two points: Auxiliary point and Target point (e.g. CIRC AuxPoint, TargetPoint).`,
          });
        }
      }
    }

    // Check Loop statements
    if (upper === "LOOP") {
      inLoop = true;
      loopStartLine = lineNum;
      loopHasExit = false;
    } else if (upper.startsWith("EXIT") || upper.startsWith("RETURN")) {
      if (inLoop) loopHasExit = true;
    } else if (upper === "ENDLOOP") {
      if (inLoop && !loopHasExit) {
        detailedIssues.push({
          severity: "warning",
          line: loopStartLine,
          code: "KRL_INFINITE_LOOP",
          message: `LOOP starting at line ${loopStartLine} has no EXIT or RETURN statement (potential infinite execution).`,
        });
      }
      inLoop = false;
    }

    // Check Division by Zero
    const divZeroMatch = codePart.match(/\/(\s*0+(\.0+)?)(?![0-9])/);
    if (divZeroMatch) {
      detailedIssues.push({
        severity: "error",
        line: lineNum,
        code: "KRL_DIV_BY_ZERO",
        message: `Literal division by zero detected: "${divZeroMatch[0]}".`,
      });
    }

    // Check Physical I/O Ranges
    const inMatch = codePart.match(/\$IN\[\s*([0-9]+)\s*\]/i);
    if (inMatch) {
      const idxVal = parseInt(inMatch[1], 10);
      if (idxVal < 1 || idxVal > 8192) {
        detailedIssues.push({
          severity: "error",
          line: lineNum,
          code: "KRL_IO_BOUNDS",
          message: `$IN[${idxVal}] is out of bounds (allowed range: $IN[1..8192]).`,
        });
      }
    }

    const outMatch = codePart.match(/\$OUT\[\s*([0-9]+)\s*\]/i);
    if (outMatch) {
      const idxVal = parseInt(outMatch[1], 10);
      if (idxVal < 1 || idxVal > 8192) {
        detailedIssues.push({
          severity: "error",
          line: lineNum,
          code: "KRL_IO_BOUNDS",
          message: `$OUT[${idxVal}] is out of bounds (allowed range: $OUT[1..8192]).`,
        });
      }
    }

    const timerMatch = codePart.match(/\$TIMER\[\s*([0-9]+)\s*\]/i);
    if (timerMatch) {
      const idxVal = parseInt(timerMatch[1], 10);
      if (idxVal < 1 || idxVal > 64) {
        detailedIssues.push({
          severity: "error",
          line: lineNum,
          code: "KRL_TIMER_BOUNDS",
          message: `$TIMER[${idxVal}] is out of bounds (allowed range: $TIMER[1..64]).`,
        });
      }
    }

    const flagMatch = codePart.match(/\$FLAG\[\s*([0-9]+)\s*\]/i);
    if (flagMatch) {
      const idxVal = parseInt(flagMatch[1], 10);
      if (idxVal < 1 || idxVal > 1024) {
        detailedIssues.push({
          severity: "error",
          line: lineNum,
          code: "KRL_FLAG_BOUNDS",
          message: `$FLAG[${idxVal}] is out of bounds (allowed range: $FLAG[1..1024]).`,
        });
      }
    }
  });

  // Check FOLD balance
  if (foldCount !== 0) {
    detailedIssues.push({
      severity: "error",
      line: foldStack.length > 0 ? foldStack[foldStack.length - 1].line : 1,
      code: "KRL_FOLD_UNBALANCED",
      message: `Unbalanced ;FOLD / ;ENDFOLD blocks (difference: ${foldCount}). This will corrupt SmartPAD screen display.`,
    });
  }

  const hasErrors = detailedIssues.some((i) => i.severity === "error");
  const humanIssues = detailedIssues.map((i) => `Line ${i.line} [${i.code}]: ${i.message}`);

  return {
    safe: !hasErrors && detailedIssues.length === 0,
    issues: humanIssues,
    detailedIssues,
  };
}
