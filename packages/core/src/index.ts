export type {
  ZkMcpErrorMetadata,
  ZkMcpErrorPresentation,
  ZkMcpErrorStage,
} from "./errors.js";
export {
  gatewayErrors,
  getPrivacySafeErrorMetadata,
  getSafeErrorPresentation,
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
