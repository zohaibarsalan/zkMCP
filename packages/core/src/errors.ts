import { defineErrorCatalog, EvlogError } from "evlog";

export type ZkMcpErrorStage =
  | "policy"
  | "proof"
  | "replay"
  | "midnight"
  | "gateway";

interface ErrorRuntimeMetadata extends Record<string, unknown> {
  retryable: boolean;
  stage: ZkMcpErrorStage;
}

function metadata(
  stage: ZkMcpErrorStage,
  retryable: boolean
): ErrorRuntimeMetadata {
  return { retryable, stage };
}

export const policyErrors = defineErrorCatalog("policy", {
  AGENT_NOT_AUTHORIZED: {
    fix: "Use an authorized agent or update the policy through an explicit policy lifecycle flow.",
    internal: metadata("policy", false),
    message: "Agent is not authorized for this policy",
    status: 403,
    why: "The requested agent does not satisfy the private policy constraint.",
  },
  AMOUNT_EXCEEDS_LIMIT: {
    fix: "Reduce the requested action or use an approval flow permitted by the policy.",
    internal: metadata("policy", false),
    message: "Action exceeds the private authorization limit",
    status: 403,
    why: "A private numeric constraint in the committed policy rejected the requested action.",
  },
  APPROVAL_REQUIRED: {
    fix: "Obtain the required approval and retry with a fresh authorization nonce.",
    internal: metadata("policy", false),
    message: "Human approval is required for this action",
    status: 403,
    why: "The action crossed a private approval threshold and no valid approval was supplied.",
  },
  INVALID_POLICY_STATE: {
    fix: "Repair or recreate the local policy state before authorizing further actions.",
    internal: metadata("policy", false),
    message: "Private policy state is invalid",
    status: 500,
    why: "The local private policy could not be loaded or validated safely.",
  },
  POLICY_MISMATCH: {
    fix: "Use the policy that was committed when the authorization contract was deployed.",
    internal: metadata("policy", false),
    message: "Authorization policy does not match the committed policy",
    status: 403,
    why: "The private policy supplied to the proof does not hash to the policy commitment pinned by the contract.",
  },
  TOOL_NOT_AUTHORIZED: {
    fix: "Request an allowed capability or update the policy through an explicit policy lifecycle flow.",
    internal: metadata("policy", false),
    message: "Tool is not authorized for this policy",
    status: 403,
    why: "The requested tool does not satisfy the private policy constraint.",
  },
});

export const proofErrors = defineErrorCatalog("proof", {
  GENERATION_FAILED: {
    fix: "Retry if the prover failure was transient; otherwise inspect the proof service and circuit inputs.",
    internal: metadata("proof", true),
    message: "Authorization proof generation failed",
    status: 500,
    why: "The prover could not construct a valid proof for the requested authorization.",
  },
  SERVER_UNAVAILABLE: {
    fix: "Start or restore the proof server, then retry the authorization request.",
    internal: metadata("proof", true),
    message: "Proof server is unavailable",
    status: 503,
    why: "zkMCP could not reach the configured Midnight proof server.",
  },
  VERIFICATION_FAILED: {
    fix: "Do not execute the tool action. Rebuild the authorization request from trusted inputs.",
    internal: metadata("proof", false),
    message: "Authorization proof verification failed",
    status: 403,
    why: "The produced proof did not verify against the expected authorization circuit.",
  },
});

export const replayErrors = defineErrorCatalog("replay", {
  NULLIFIER_ALREADY_USED: {
    fix: "Create a new authorization request with a fresh nonce.",
    internal: metadata("replay", false),
    message: "Authorization has already been used",
    status: 409,
    why: "The authorization nullifier already exists on the contract ledger.",
  },
});

export const midnightErrors = defineErrorCatalog("midnight", {
  CONTRACT_UNAVAILABLE: {
    fix: "Verify the network, contract address, node, and indexer before retrying.",
    internal: metadata("midnight", true),
    message: "Midnight authorization contract is unavailable",
    status: 503,
    why: "zkMCP could not connect to the configured authorization contract.",
  },
  INDEXER_UNAVAILABLE: {
    fix: "Restore indexer connectivity and confirm it is caught up before retrying.",
    internal: metadata("midnight", true),
    message: "Midnight indexer is unavailable",
    status: 503,
    why: "zkMCP could not query the public contract state required for authorization.",
  },
  INVALID_STATE: {
    fix: "Stop authorization and inspect the deployment, compiled contract, and indexed state.",
    internal: metadata("midnight", false),
    message: "Midnight contract state is invalid",
    status: 500,
    why: "The observed contract state did not match the structure zkMCP expects.",
  },
  TX_SUBMISSION_FAILED: {
    fix: "Check node connectivity and wallet state, then retry only with a safe fresh authorization context.",
    internal: metadata("midnight", true),
    message: "Midnight transaction submission failed",
    status: 502,
    why: "The authorization transaction could not be submitted or finalized.",
  },
});

export const gatewayErrors = defineErrorCatalog("gateway", {
  INVALID_MCP_REQUEST: {
    fix: "Correct the MCP request shape before retrying.",
    internal: metadata("gateway", false),
    message: "MCP request cannot be authorized",
    status: 400,
    why: "The incoming MCP request could not be normalized into a valid zkMCP authorization envelope.",
  },
  UPSTREAM_TOOL_FAILED: {
    fix: "Inspect the upstream tool failure and retry only if the operation is safe and idempotent.",
    internal: metadata("gateway", true),
    message: "Authorized MCP tool execution failed",
    status: 502,
    why: "Authorization succeeded, but the upstream MCP tool failed during execution.",
  },
});

export interface ZkMcpErrorMetadata {
  code?: string;
  retryable: boolean;
  stage?: ZkMcpErrorStage;
  status: number;
}

function isStage(value: unknown): value is ZkMcpErrorStage {
  return (
    value === "policy" ||
    value === "proof" ||
    value === "replay" ||
    value === "midnight" ||
    value === "gateway"
  );
}

export function isZkMcpError(error: unknown): error is EvlogError {
  return EvlogError.isEvlogError(error);
}

export function getZkMcpErrorMetadata(error: unknown): ZkMcpErrorMetadata {
  if (!isZkMcpError(error)) {
    return { retryable: false, status: 500 };
  }

  const { internal } = error;
  const stage =
    internal && isStage(internal.stage) ? internal.stage : undefined;

  return {
    code: error.code,
    retryable: internal?.retryable === true,
    stage,
    status: error.status,
  };
}

export function toErrorCause(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown error");
}

declare module "evlog" {
  interface RegisteredErrorCatalogs {
    gateway: typeof gatewayErrors;
    midnight: typeof midnightErrors;
    policy: typeof policyErrors;
    proof: typeof proofErrors;
    replay: typeof replayErrors;
  }
}
