import { createLogger, initLogger, type RequestLogger } from "evlog";
import { createFsDrain } from "evlog/fs";
import type { ZkMcpErrorMetadata } from "./errors.js";

const PRIVATE_LOG_PATHS = [
  "**.policySecret",
  "**.secret",
  "**.seed",
  "**.mnemonic",
  "**.privateKey",
  "**.userSecretKey",
  "**.witness",
  "**.privateState",
  "**.prompt",
  "**.toolArguments",
  "**.toolArgs",
  "**.authorizationContext",
  "**.amount",
  "**.requestAmount",
  "**.maxAmount",
  "**.approvalThreshold",
  "**.nonce",
  "**.password",
  "**.token",
  "**.authorizationHeader",
] as const;

interface ZkMcpGlobalLoggerState {
  __zkmcpEvlogInitialized?: boolean;
}

const globalLoggerState = globalThis as typeof globalThis &
  ZkMcpGlobalLoggerState;

export interface ZkMcpLoggerOptions {
  environment?: string;
  localFiles?: boolean;
  logDir?: string;
  pretty?: boolean;
  service: string;
  silent?: boolean;
}

export interface AuthorizationLogFields {
  authorization?: {
    agentCommitment?: string;
    authorizationCount?: number;
    executionCommitment?: string;
    nullifier?: string;
    policyCommitment?: string;
    proofDurationMs?: number;
  };
  contract?: {
    address?: string;
  };
  failure?: ZkMcpErrorMetadata;
  midnight?: {
    blockHeight?: number;
    transactionId?: string;
  };
  network?: string;
  operation?: "authorization";
  result?: "authorized" | "denied" | "failed";
  stage?: "request" | "policy" | "proof" | "midnight" | "tool";
}

export function initZkMcpLogger(options: ZkMcpLoggerOptions): void {
  if (globalLoggerState.__zkmcpEvlogInitialized) {
    return;
  }

  const localFiles = options.localFiles ?? true;

  initLogger({
    env: {
      environment: options.environment ?? process.env.NODE_ENV ?? "development",
      service: options.service,
    },
    pretty: options.pretty ?? process.env.NODE_ENV !== "production",
    redact: {
      paths: [...PRIVATE_LOG_PATHS],
      replacement: "[PRIVATE]",
    },
    silent: options.silent ?? false,
    ...(localFiles
      ? {
          drain: createFsDrain({
            dir: options.logDir ?? ".evlog/logs",
            maxFiles: 7,
            pretty: false,
          }),
        }
      : {}),
  });

  globalLoggerState.__zkmcpEvlogInitialized = true;
}

export function createAuthorizationLogger(
  initial: Omit<AuthorizationLogFields, "operation"> = {}
): RequestLogger<AuthorizationLogFields> {
  return createLogger<AuthorizationLogFields>({
    operation: "authorization",
    ...initial,
  });
}

export const privateLogPaths = PRIVATE_LOG_PATHS;
