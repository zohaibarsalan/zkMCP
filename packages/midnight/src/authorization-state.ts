import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { isZkMcpError, policyErrors, toErrorCause } from "@zkmcp/core";
import type {
  Ledger,
  Policy,
} from "../contracts/managed/authorization/contract/index.js";

export const DEMO_AGENT_NAME = "LegalAgent";
export const DEMO_TOOL_NAME = "payments.transfer";
export const DEMO_MAX_AMOUNT = 5_000n;
export const DEMO_APPROVAL_THRESHOLD = 4_000n;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POLICY_FILE = path.resolve(__dirname, "..", ".zkmcp-policy.json");
const HEX_32_PATTERN = /^[0-9a-f]{64}$/i;

export interface AuthorizationPrivateState {
  policy: Policy;
}

interface StoredPolicy {
  allowedAgentHex: string;
  allowedToolHex: string;
  approvalThreshold: string;
  maxAmount: string;
  secretHex: string;
  version: 1;
}

export function identifierDigest(value: string): Uint8Array {
  return new Uint8Array(
    createHash("sha256").update(`zkmcp:id:v1\0${value}`, "utf8").digest()
  );
}

function fromHex(value: string): Uint8Array {
  if (!HEX_32_PATTERN.test(value)) {
    throw policyErrors.INVALID_POLICY_STATE({
      cause: new Error("Expected a 32-byte hex value"),
    });
  }
  return new Uint8Array(Buffer.from(value, "hex"));
}

function toHex(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

function validatePolicy(policy: Policy): Policy {
  if (policy.secret.length !== 32) {
    throw policyErrors.INVALID_POLICY_STATE({
      cause: new Error("Policy secret must be 32 bytes"),
    });
  }
  if (policy.allowedAgent.length !== 32) {
    throw policyErrors.INVALID_POLICY_STATE({
      cause: new Error("Allowed agent digest must be 32 bytes"),
    });
  }
  if (policy.allowedTool.length !== 32) {
    throw policyErrors.INVALID_POLICY_STATE({
      cause: new Error("Allowed tool digest must be 32 bytes"),
    });
  }
  if (policy.maxAmount <= 0n) {
    throw policyErrors.INVALID_POLICY_STATE({
      cause: new Error("Policy max amount must be positive"),
    });
  }
  if (policy.approvalThreshold > policy.maxAmount) {
    throw policyErrors.INVALID_POLICY_STATE({
      cause: new Error("Approval threshold must not exceed max amount"),
    });
  }
  return policy;
}

export function loadOrCreateAuthorizationPrivateState(): AuthorizationPrivateState {
  try {
    if (fs.existsSync(POLICY_FILE)) {
      const raw = JSON.parse(
        fs.readFileSync(POLICY_FILE, "utf8")
      ) as StoredPolicy;
      return {
        policy: validatePolicy({
          allowedAgent: fromHex(raw.allowedAgentHex),
          allowedTool: fromHex(raw.allowedToolHex),
          approvalThreshold: BigInt(raw.approvalThreshold),
          maxAmount: BigInt(raw.maxAmount),
          secret: fromHex(raw.secretHex),
        }),
      };
    }

    const policy = validatePolicy({
      allowedAgent: identifierDigest(DEMO_AGENT_NAME),
      allowedTool: identifierDigest(DEMO_TOOL_NAME),
      approvalThreshold: DEMO_APPROVAL_THRESHOLD,
      maxAmount: DEMO_MAX_AMOUNT,
      secret: new Uint8Array(randomBytes(32)),
    });

    const stored: StoredPolicy = {
      allowedAgentHex: toHex(policy.allowedAgent),
      allowedToolHex: toHex(policy.allowedTool),
      approvalThreshold: policy.approvalThreshold.toString(),
      maxAmount: policy.maxAmount.toString(),
      secretHex: toHex(policy.secret),
      version: 1,
    };

    fs.writeFileSync(POLICY_FILE, `${JSON.stringify(stored, null, 2)}\n`, {
      mode: 0o600,
    });
    return { policy };
  } catch (error) {
    if (isZkMcpError(error)) {
      throw error;
    }

    throw policyErrors.INVALID_POLICY_STATE({ cause: toErrorCause(error) });
  }
}

export const witnesses = {
  getPolicy: ({
    privateState,
  }: WitnessContext<Ledger, AuthorizationPrivateState>): [
    AuthorizationPrivateState,
    Policy,
  ] => [privateState, validatePolicy(privateState.policy)],
};
