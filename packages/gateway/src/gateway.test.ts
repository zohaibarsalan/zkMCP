import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { policyErrors } from "@zkmcp/core";
import type {
  MidnightAuthorizationReceipt,
  MidnightAuthorizationRequest,
} from "@zkmcp/midnight";
import { z } from "zod";
import { DenyAllApprovalVerifier } from "./approval.js";
import {
  type GatewayAuthorizationBackend,
  type GatewayUpstreamClient,
  ZKMCP_ERROR_META_KEY,
  ZKMCP_RECEIPT_META_KEY,
  ZkMcpGateway,
} from "./gateway.js";
import { PAYMENTS_TRANSFER_TOOL } from "./normalize.js";

function fakeReceipt(): MidnightAuthorizationReceipt {
  return {
    blockHeight: 42,
    contractAddress: "contract-1",
    executionCommitment: "0xexecution",
    network: "undeployed",
    nullifier: "0xnullifier",
    policyCommitment: "0xpolicy",
    proofDurationMs: 25,
    transactionId: "tx-1",
  };
}

async function connectUpstream(executionCounter: { value: number }) {
  const server = new McpServer({ name: "upstream-test", version: "0.1.0" });
  server.registerTool(
    PAYMENTS_TRANSFER_TOOL,
    {
      inputSchema: z.object({
        amount: z.number().int(),
        recipient: z.string(),
      }),
      outputSchema: z.object({ status: z.literal("submitted") }),
    },
    () => {
      executionCounter.value += 1;
      const structuredContent = { status: "submitted" as const };
      return {
        content: [{ text: "upstream executed", type: "text" }],
        structuredContent,
      };
    }
  );

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client(
    { name: "gateway-upstream-test", version: "0.1.0" },
    { versionNegotiation: { mode: "legacy" } }
  );
  await client.connect(clientTransport);

  const upstream: GatewayUpstreamClient = {
    callTool: (input) => client.callTool(input),
    close: () => client.close(),
    listTools: (input) => client.listTools(input),
  };

  return { server, upstream };
}

test("gateway forwards only authorized MCP tool calls and attaches proof receipts", async () => {
  const executionCounter = { value: 0 };
  const { server: upstreamServer, upstream } =
    await connectUpstream(executionCounter);
  const authorizationRequests: MidnightAuthorizationRequest[] = [];

  const authorizer: GatewayAuthorizationBackend = {
    authorize: (request) => {
      authorizationRequests.push(request);
      if ((request.amount ?? 0n) > 100n) {
        throw policyErrors.AUTHORIZATION_DENIED();
      }
      return Promise.resolve(fakeReceipt());
    },
  };

  const gateway = new ZkMcpGateway({
    agentId: "LegalAgent",
    approvalVerifier: new DenyAllApprovalVerifier(),
    authorizer,
    upstream,
  });
  const gatewayServer = gateway.createServer();
  const [agentTransport, gatewayTransport] =
    InMemoryTransport.createLinkedPair();
  await gatewayServer.connect(gatewayTransport);

  const agent = new Client(
    { name: "agent-test", version: "0.1.0" },
    { versionNegotiation: { mode: "legacy" } }
  );
  await agent.connect(agentTransport);

  try {
    const listed = await agent.listTools();
    assert.equal(listed.tools.length, 1);
    assert.equal(listed.tools[0]?.name, PAYMENTS_TRANSFER_TOOL);

    const allowed = await agent.callTool({
      arguments: { amount: 50, recipient: "vendor" },
      name: PAYMENTS_TRANSFER_TOOL,
    });
    assert.notEqual(allowed.isError, true);
    assert.equal(executionCounter.value, 1);
    assert.deepEqual(allowed.structuredContent, { status: "submitted" });
    const receipt = allowed._meta?.[ZKMCP_RECEIPT_META_KEY] as
      | Record<string, unknown>
      | undefined;
    assert.equal(receipt?.policyCommitment, "0xpolicy");
    assert.equal(receipt?.transactionId, "tx-1");

    const denied = await agent.callTool({
      arguments: { amount: 500, recipient: "vendor" },
      name: PAYMENTS_TRANSFER_TOOL,
    });
    assert.equal(denied.isError, true);
    assert.equal(
      executionCounter.value,
      1,
      "denied call must never reach upstream"
    );
    const failure = denied._meta?.[ZKMCP_ERROR_META_KEY] as
      | Record<string, unknown>
      | undefined;
    assert.equal(failure?.code, "policy.AUTHORIZATION_DENIED");

    assert.equal(authorizationRequests.length, 2);
    assert.equal(authorizationRequests[0]?.agent, "LegalAgent");
    assert.equal(authorizationRequests[0]?.amount, 50n);
    assert.equal(authorizationRequests[1]?.amount, 500n);
  } finally {
    await agent.close();
    await gatewayServer.close();
    await gateway.close();
    await upstreamServer.close();
  }
});
