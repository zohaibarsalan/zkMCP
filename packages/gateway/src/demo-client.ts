import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";
import { ZKMCP_APPROVAL_META_KEY } from "./approval.js";
import { ZKMCP_ERROR_META_KEY, ZKMCP_RECEIPT_META_KEY } from "./gateway.js";
import {
  DOCUMENTS_READ_TOOL,
  EMAIL_SEND_TOOL,
  PAYMENTS_TRANSFER_TOOL,
} from "./normalize.js";

const DEMO_APPROVAL_TOKEN = "zkmcp-demo-human-approval";

interface DemoCase {
  approved?: boolean;
  arguments: Record<string, unknown>;
  expectAuthorized: boolean;
  label: string;
  tool: string;
}

const cases: DemoCase[] = [
  {
    arguments: {
      documentId: "settlement-draft",
      matterId: "matter:thompson",
    },
    expectAuthorized: true,
    label: "assigned matter document",
    tool: DOCUMENTS_READ_TOOL,
  },
  {
    arguments: {
      documentId: "secret-memo",
      matterId: "matter:unrelated-client",
    },
    expectAuthorized: false,
    label: "unrelated matter document",
    tool: DOCUMENTS_READ_TOOL,
  },
  {
    arguments: {
      body: "Please see the attached settlement proposal.",
      subject: "Settlement proposal",
      to: "outside-counsel@example.test",
    },
    expectAuthorized: false,
    label: "external email without approval",
    tool: EMAIL_SEND_TOOL,
  },
  {
    approved: true,
    arguments: {
      body: "Please see the attached settlement proposal.",
      subject: "Settlement proposal",
      to: "outside-counsel@example.test",
    },
    expectAuthorized: true,
    label: "external email with approval",
    tool: EMAIL_SEND_TOOL,
  },
  {
    arguments: {
      amount: 2750,
      memo: "Settlement disbursement",
      recipient: "client-settlement-account",
    },
    expectAuthorized: true,
    label: "payment below private threshold",
    tool: PAYMENTS_TRANSFER_TOOL,
  },
  {
    arguments: {
      amount: 4500,
      memo: "Settlement disbursement",
      recipient: "client-settlement-account",
    },
    expectAuthorized: false,
    label: "payment needs approval",
    tool: PAYMENTS_TRANSFER_TOOL,
  },
  {
    approved: true,
    arguments: {
      amount: 4500,
      memo: "Settlement disbursement",
      recipient: "client-settlement-account",
    },
    expectAuthorized: true,
    label: "payment with human approval",
    tool: PAYMENTS_TRANSFER_TOOL,
  },
  {
    approved: true,
    arguments: {
      amount: 8000,
      memo: "Settlement disbursement",
      recipient: "client-settlement-account",
    },
    expectAuthorized: false,
    label: "payment above private maximum",
    tool: PAYMENTS_TRANSFER_TOOL,
  },
];

async function main(): Promise<void> {
  const client = new Client(
    { name: "zkmcp-phase2-demo", version: "0.1.0" },
    { versionNegotiation: { mode: "legacy" } }
  );

  const transport = new StdioClientTransport({
    args: ["tsx", "src/stdio.ts", "--", "npx", "tsx", "src/demo-upstream.ts"],
    command: "npx",
    cwd: process.cwd(),
    env: {
      ...getDefaultEnvironment(),
      ZKMCP_AGENT_ID: "LegalAgent",
      ZKMCP_APPROVAL_TOKEN: DEMO_APPROVAL_TOKEN,
    },
    stderr: "inherit",
  });

  await client.connect(transport);

  try {
    const listed = await client.listTools();
    const toolNames = new Set(listed.tools.map((tool) => tool.name));
    assert.equal(toolNames.has(DOCUMENTS_READ_TOOL), true);
    assert.equal(toolNames.has(EMAIL_SEND_TOOL), true);
    assert.equal(toolNames.has(PAYMENTS_TRANSFER_TOOL), true);

    console.log(
      "\nzkMCP Phase 2 — real MCP gateway + Midnight authorization\n"
    );
    console.log(
      `MCP tools visible through gateway: ${[...toolNames].join(", ")}\n`
    );

    let passed = 0;
    for (const demoCase of cases) {
      process.stdout.write(
        `${demoCase.expectAuthorized ? "ALLOW" : "DENY "}  ${demoCase.label.padEnd(34)} `
      );

      // Sequential execution is deliberate: the current Midnight client keeps
      // public receipt lookup ordered with each finalized authorization.
      // biome-ignore lint/performance/noAwaitInLoops: preserve proof/receipt ordering
      const result = await client.callTool({
        ...(demoCase.approved
          ? {
              _meta: {
                [ZKMCP_APPROVAL_META_KEY]: DEMO_APPROVAL_TOKEN,
              },
            }
          : {}),
        arguments: demoCase.arguments,
        name: demoCase.tool,
      });

      if (demoCase.expectAuthorized) {
        assert.notEqual(result.isError, true);
        const receipt = result._meta?.[ZKMCP_RECEIPT_META_KEY] as
          | Record<string, unknown>
          | undefined;
        assert.ok(receipt, "authorized result must include a zkMCP receipt");
        assert.equal(typeof receipt.transactionId, "string");
        assert.equal(typeof receipt.executionCommitment, "string");
        console.log(
          `✅ proof + upstream execution (tx ${String(receipt.transactionId).slice(0, 12)}…)`
        );
      } else {
        assert.equal(result.isError, true);
        assert.equal(result._meta?.[ZKMCP_RECEIPT_META_KEY], undefined);
        const failure = result._meta?.[ZKMCP_ERROR_META_KEY] as
          | Record<string, unknown>
          | undefined;
        assert.ok(
          failure,
          "denied result must include safe zkMCP error metadata"
        );
        assert.equal(failure.code, "policy.AUTHORIZATION_DENIED");
        console.log("✅ blocked before upstream execution");
      }

      passed += 1;
    }

    console.log(
      `\n✅ Phase 2 MCP gateway suite passed (${passed}/${cases.length})\n`
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(
    "\n❌ Phase 2 gateway demo failed:",
    error instanceof Error ? error.message : "Unknown error"
  );
  process.exitCode = 1;
});
