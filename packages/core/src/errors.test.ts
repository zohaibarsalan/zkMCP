import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPrivacySafeErrorMetadata,
  getZkMcpErrorMetadata,
  isZkMcpError,
  policyErrors,
  proofErrors,
  replayErrors,
  toErrorCause,
} from "./errors.js";

test("typed error catalogs expose stable codes and runtime metadata", () => {
  const error = proofErrors.SERVER_UNAVAILABLE();

  assert.equal(error.code, "proof.SERVER_UNAVAILABLE");
  assert.equal(error.status, 503);
  assert.equal(isZkMcpError(error), true);
  assert.deepEqual(getZkMcpErrorMetadata(error), {
    code: "proof.SERVER_UNAVAILABLE",
    retryable: true,
    stage: "proof",
    status: 503,
  });
});

test("policy and replay denials are explicitly non-retryable", () => {
  const policyError = policyErrors.AGENT_NOT_AUTHORIZED();
  const replayError = replayErrors.NULLIFIER_ALREADY_USED();

  assert.equal(getZkMcpErrorMetadata(policyError).retryable, false);
  assert.equal(getZkMcpErrorMetadata(policyError).stage, "policy");
  assert.equal(getZkMcpErrorMetadata(replayError).retryable, false);
  assert.equal(getZkMcpErrorMetadata(replayError).stage, "replay");
});

test("internal diagnostics are not serialized to clients", () => {
  const error = proofErrors.GENERATION_FAILED({
    internal: {
      retryable: true,
      safeDiagnostic: "prover rejected request",
      stage: "proof",
    },
  });

  const serialized = error.toJSON();

  assert.equal("internal" in serialized, false);
  const serializedData = serialized.data as { code?: string };
  assert.equal(serializedData.code, "proof.GENERATION_FAILED");
});

test("unknown thrown values become Error causes safely", () => {
  assert.equal(toErrorCause("failed").message, "failed");
  assert.equal(
    toErrorCause({ secret: "never stringify arbitrary objects" }).message,
    "Unknown error"
  );
});

test("privacy-safe metadata hides which private policy rule denied the action", () => {
  const amountError = policyErrors.AMOUNT_EXCEEDS_LIMIT();
  const approvalError = policyErrors.APPROVAL_REQUIRED();

  assert.deepEqual(getPrivacySafeErrorMetadata(amountError), {
    code: "policy.AUTHORIZATION_DENIED",
    retryable: false,
    stage: "policy",
    status: 403,
  });
  assert.equal(
    getPrivacySafeErrorMetadata(approvalError).code,
    "policy.AUTHORIZATION_DENIED"
  );
});
