import assert from "node:assert/strict";
import test from "node:test";
import { gatewayErrors, isZkMcpError } from "@zkmcp/core";
import {
  FixedTokenApprovalVerifier,
  ZKMCP_APPROVAL_META_KEY,
} from "./approval.js";
import {
  DOCUMENTS_READ_TOOL,
  EMAIL_SEND_TOOL,
  normalizeToolCall,
  PAYMENTS_TRANSFER_TOOL,
} from "./normalize.js";

const approvalVerifier = new FixedTokenApprovalVerifier("human-approved-token");

test("document calls derive resource membership from the tool arguments", async () => {
  const normalized = await normalizeToolCall({
    agentId: "LegalAgent",
    approvalVerifier,
    arguments: { documentId: "doc-1", matterId: "matter:thompson" },
    tool: DOCUMENTS_READ_TOOL,
  });

  assert.equal(normalized.authorization.agent, "LegalAgent");
  assert.equal(normalized.authorization.resource, "matter:thompson");
  assert.equal(normalized.authorization.tool, DOCUMENTS_READ_TOOL);
  assert.deepEqual(normalized.forwardArguments, {
    documentId: "doc-1",
    matterId: "matter:thompson",
  });
});

test("approval comes from trusted MCP metadata, not an agent boolean", async () => {
  const withoutToken = await normalizeToolCall({
    agentId: "LegalAgent",
    approvalVerifier,
    arguments: {
      approved: true,
      body: "hello",
      subject: "test",
      to: "x@test.dev",
    },
    tool: EMAIL_SEND_TOOL,
  });
  assert.equal(withoutToken.authorization.approved, false);

  const withToken = await normalizeToolCall({
    agentId: "LegalAgent",
    approvalVerifier,
    arguments: { body: "hello", subject: "test", to: "x@test.dev" },
    meta: { [ZKMCP_APPROVAL_META_KEY]: "human-approved-token" },
    tool: EMAIL_SEND_TOOL,
  });
  assert.equal(withToken.authorization.approved, true);
});

test("payment calls normalize the numeric action into a bigint", async () => {
  const normalized = await normalizeToolCall({
    agentId: "LegalAgent",
    approvalVerifier,
    arguments: { amount: 2750, recipient: "settlement-account" },
    tool: PAYMENTS_TRANSFER_TOOL,
  });

  assert.equal(normalized.authorization.amount, 2750n);
  assert.equal(normalized.authorization.approved, false);
});

test("invalid sensitive tool arguments fail before proving", async () => {
  await assert.rejects(
    normalizeToolCall({
      agentId: "LegalAgent",
      approvalVerifier,
      arguments: { amount: 1.25, recipient: "settlement-account" },
      tool: PAYMENTS_TRANSFER_TOOL,
    }),
    (error: unknown) => {
      assert.equal(isZkMcpError(error), true);
      if (!isZkMcpError(error)) {
        return false;
      }
      assert.equal(error.code, gatewayErrors.INVALID_MCP_REQUEST.code);
      return true;
    }
  );
});
