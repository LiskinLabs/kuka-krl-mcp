export type Locale = "en" | "ru" | "de" | "es" | "it" | "tr";

export interface SystemVarDoc {
  name: string;
  type: string;
  description: Record<Locale, string>;
  example?: string;
  range?: string;
  readOnly?: boolean;
  syntax?: string;
}

export interface KeywordDoc {
  description: Record<Locale, string>;
  syntax?: string;
  example?: string;
}

export interface KrlSafetyIssue {
  severity: "error" | "warning" | "info";
  line: number;
  code: string;
  message: string;
}

export interface KrlLintResult {
  safe: boolean;
  issues: string[];
  detailedIssues: KrlSafetyIssue[];
}

export interface BridgeConfig {
  port: number;
  token: string;
  pid?: number;
  version?: string;
  url: string;
  updatedAt?: number;
}
