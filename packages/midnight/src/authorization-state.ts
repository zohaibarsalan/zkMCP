import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { Ledger, Policy } from '../contracts/managed/authorization/contract/index.js';

export const DEMO_AGENT_NAME = 'LegalAgent';
export const DEMO_TOOL_NAME = 'payments.transfer';
export const DEMO_MAX_AMOUNT = 5_000n;
export const DEMO_APPROVAL_THRESHOLD = 4_000n;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POLICY_FILE = path.resolve(__dirname, '..', '.zkmcp-policy.json');

export type AuthorizationPrivateState = {
  policy: Policy;
};

type StoredPolicy = {
  version: 1;
  secretHex: string;
  allowedAgentHex: string;
  allowedToolHex: string;
  maxAmount: string;
  approvalThreshold: string;
};

export function identifierDigest(value: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(`zkmcp:id:v1\0${value}`, 'utf8').digest());
}

function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Expected a 32-byte hex value');
  return new Uint8Array(Buffer.from(value, 'hex'));
}

function toHex(value: Uint8Array): string {
  return Buffer.from(value).toString('hex');
}

function validatePolicy(policy: Policy): Policy {
  if (policy.secret.length !== 32) throw new Error('Policy secret must be 32 bytes');
  if (policy.allowedAgent.length !== 32) throw new Error('Allowed agent digest must be 32 bytes');
  if (policy.allowedTool.length !== 32) throw new Error('Allowed tool digest must be 32 bytes');
  if (policy.maxAmount <= 0n) throw new Error('Policy max amount must be positive');
  if (policy.approvalThreshold > policy.maxAmount) {
    throw new Error('Approval threshold must not exceed max amount');
  }
  return policy;
}

export function loadOrCreateAuthorizationPrivateState(): AuthorizationPrivateState {
  if (fs.existsSync(POLICY_FILE)) {
    const raw = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8')) as StoredPolicy;
    return {
      policy: validatePolicy({
        secret: fromHex(raw.secretHex),
        allowedAgent: fromHex(raw.allowedAgentHex),
        allowedTool: fromHex(raw.allowedToolHex),
        maxAmount: BigInt(raw.maxAmount),
        approvalThreshold: BigInt(raw.approvalThreshold),
      }),
    };
  }

  const policy = validatePolicy({
    secret: new Uint8Array(randomBytes(32)),
    allowedAgent: identifierDigest(DEMO_AGENT_NAME),
    allowedTool: identifierDigest(DEMO_TOOL_NAME),
    maxAmount: DEMO_MAX_AMOUNT,
    approvalThreshold: DEMO_APPROVAL_THRESHOLD,
  });

  const stored: StoredPolicy = {
    version: 1,
    secretHex: toHex(policy.secret),
    allowedAgentHex: toHex(policy.allowedAgent),
    allowedToolHex: toHex(policy.allowedTool),
    maxAmount: policy.maxAmount.toString(),
    approvalThreshold: policy.approvalThreshold.toString(),
  };

  fs.writeFileSync(POLICY_FILE, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });
  return { policy };
}

export const witnesses = {
  getPolicy: ({ privateState }: WitnessContext<Ledger, AuthorizationPrivateState>): [AuthorizationPrivateState, Policy] => {
    return [privateState, validatePolicy(privateState.policy)];
  },
};
