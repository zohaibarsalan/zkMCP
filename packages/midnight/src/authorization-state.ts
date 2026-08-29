import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { policyErrors, toErrorCause } from "@zkmcp/core";
import type {
  Ledger,
  Policy,
} from "../contracts/managed/authorization/contract/index.js";

export const DEMO_AGENT_NAME = "LegalAgent";
export const DEMO_DOCUMENT_TOOL_NAME = "documents.read";
export const DEMO_EMAIL_TOOL_NAME = "email.send";
export const DEMO_PAYMENT_TOOL_NAME = "payments.transfer";
export const DEMO_RESOURCE_NAME = "matter:thompson";
export const DEMO_MAX_PAYMENT_AMOUNT = 5_000n;
export const DEMO_PAYMENT_APPROVAL_THRESHOLD = 4_000n;

// Backward-compatible aliases used by the Phase 1 demo while Phase 2 migrates
// callers onto the explicit tool-specific names.
export const DEMO_TOOL_NAME = DEMO_PAYMENT_TOOL_NAME;
export const DEMO_MAX_AMOUNT = DEMO_MAX_PAYMENT_AMOUNT;
export const DEMO_APPROVAL_THRESHOLD = DEMO_PAYMENT_APPROVAL_THRESHOLD;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POLICY_FILE = path.resolve(__dirname, "..", ".zkmcp-policy.json");
const HEX_32_PATTERN = /^[0-9a-f]{64}$/i;

export interface AuthorizationPrivateState {
  policy: Policy;
}

interface StoredPolicyV1 {
  allowedAgentHex: string;
  allowedToolHex: string;
  approvalThreshold: string;
  maxAmount: string;
  secretHex: string;
  version: 1;
}

interface StoredPolicyV2 {
  allowedAgentHex: string;
  allowedResourceHex: string;
  documentsToolHex: string;
  emailToolHex: string;
  maxPaymentAmount: string;
  paymentApprovalThreshold: string;
  paymentsToolHex: string;
  secretHex: string;
  version: 2;
}

type StoredPolicy = StoredPolicyV1 | StoredPolicyV2;

export function identifierDigest(value: string): Uint8Array {
  return new Uint8Array(
    createHash("sha256").update(`zkmcp:id:v1\0${value}`, "utf8").digest()
  );
}

function fromHex(value: string): Uint8Array {
  if (!HEX_32_PATTERN.test(value)) {
    throw policyErrors.INVALID_POLICY_STATE();
  }
  return new Uint8Array(Buffer.from(value, "hex"));
}

function toHex(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

function validatePolicy(policy: Policy): Policy {
  const digests = [
    policy.secret,
    policy.allowedAgent,
    policy.documentsTool,
    policy.emailTool,
    policy.paymentsTool,
    policy.allowedResource,
  ];
  if (digests.some((digest) => digest.length !== 32)) {
    throw policyErrors.INVALID_POLICY_STATE();
  }
  if (policy.maxPaymentAmount <= 0n) {
    throw policyErrors.INVALID_POLICY_STATE();
  }
  if (policy.paymentApprovalThreshold > policy.maxPaymentAmount) {
    throw policyErrors.INVALID_POLICY_STATE();
  }
  return policy;
}

function buildPolicy(secret: Uint8Array): Policy {
  return validatePolicy({
    allowedAgent: identifierDigest(DEMO_AGENT_NAME),
    allowedResource: identifierDigest(DEMO_RESOURCE_NAME),
    documentsTool: identifierDigest(DEMO_DOCUMENT_TOOL_NAME),
    emailTool: identifierDigest(DEMO_EMAIL_TOOL_NAME),
    maxPaymentAmount: DEMO_MAX_PAYMENT_AMOUNT,
    paymentApprovalThreshold: DEMO_PAYMENT_APPROVAL_THRESHOLD,
    paymentsTool: identifierDigest(DEMO_PAYMENT_TOOL_NAME),
    secret,
  });
}

function storedPolicyV2(policy: Policy): StoredPolicyV2 {
  return {
    allowedAgentHex: toHex(policy.allowedAgent),
    allowedResourceHex: toHex(policy.allowedResource),
    documentsToolHex: toHex(policy.documentsTool),
    emailToolHex: toHex(policy.emailTool),
    maxPaymentAmount: policy.maxPaymentAmount.toString(),
    paymentApprovalThreshold: policy.paymentApprovalThreshold.toString(),
    paymentsToolHex: toHex(policy.paymentsTool),
    secretHex: toHex(policy.secret),
    version: 2,
  };
}

function writePolicy(policy: Policy): void {
  fs.writeFileSync(
    POLICY_FILE,
    `${JSON.stringify(storedPolicyV2(policy), null, 2)}\n`,
    { mode: 0o600 }
  );
}

function loadStoredPolicy(): Policy | null {
  if (!fs.existsSync(POLICY_FILE)) {
    return null;
  }

  try {
    const stored = JSON.parse(
      fs.readFileSync(POLICY_FILE, "utf8")
    ) as StoredPolicy;

    if (stored.version === 1) {
      // Preserve the existing random secret while upgrading the private policy
      // shape. A fresh contract deployment is still required because v2 uses a
      // new policy commitment domain and additional constraints.
      const migrated = buildPolicy(fromHex(stored.secretHex));
      writePolicy(migrated);
      return migrated;
    }

    return validatePolicy({
      allowedAgent: fromHex(stored.allowedAgentHex),
      allowedResource: fromHex(stored.allowedResourceHex),
      documentsTool: fromHex(stored.documentsToolHex),
      emailTool: fromHex(stored.emailToolHex),
      maxPaymentAmount: BigInt(stored.maxPaymentAmount),
      paymentApprovalThreshold: BigInt(stored.paymentApprovalThreshold),
      paymentsTool: fromHex(stored.paymentsToolHex),
      secret: fromHex(stored.secretHex),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "EvlogError") {
      throw error;
    }
    throw policyErrors.INVALID_POLICY_STATE({ cause: toErrorCause(error) });
  }
}

export function loadOrCreateAuthorizationPrivateState(): AuthorizationPrivateState {
  const stored = loadStoredPolicy();
  if (stored) {
    return { policy: stored };
  }

  const policy = buildPolicy(new Uint8Array(randomBytes(32)));
  writePolicy(policy);
  return { policy };
}

export const witnesses = {
  getPolicy: ({
    privateState,
  }: WitnessContext<Ledger, AuthorizationPrivateState>): [
    AuthorizationPrivateState,
    Policy,
  ] => [privateState, validatePolicy(privateState.policy)],
};
