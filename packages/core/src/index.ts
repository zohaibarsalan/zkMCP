export type { ZkMcpErrorMetadata, ZkMcpErrorStage } from "./errors.js";
export {
  gatewayErrors,
  getZkMcpErrorMetadata,
  isZkMcpError,
  midnightErrors,
  policyErrors,
  proofErrors,
  replayErrors,
  toErrorCause,
} from "./errors.js";
export type {
  AuthorizationLogFields,
  ZkMcpLoggerOptions,
} from "./logging.js";
export {
  createAuthorizationLogger,
  initZkMcpLogger,
  privateLogPaths,
} from "./logging.js";
