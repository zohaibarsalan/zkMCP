import {
  getSafeErrorPresentation,
  initZkMcpLogger,
  isZkMcpError,
} from "@zkmcp/core";
import {
  DEMO_AGENT_NAME,
  DEMO_DOCUMENT_TOOL_NAME,
  DEMO_EMAIL_TOOL_NAME,
  DEMO_PAYMENT_TOOL_NAME,
  DEMO_RESOURCE_NAME,
} from "./authorization-state.js";
import {
  createMidnightAuthorizationClient,
  type MidnightAuthorizationReceipt,
  type MidnightAuthorizationRequest,
} from "./client.js";

initZkMcpLogger({
  service: "zkmcp-midnight",
  silent: true,
});

interface DemoAttempt {
  expectAuthorized: boolean;
  label: string;
  request: MidnightAuthorizationRequest;
}

const attempts: DemoAttempt[] = [
  {
    expectAuthorized: true,
    label: "document in assigned matter",
    request: {
      agent: DEMO_AGENT_NAME,
      resource: DEMO_RESOURCE_NAME,
      tool: DEMO_DOCUMENT_TOOL_NAME,
    },
  },
  {
    expectAuthorized: false,
    label: "document in unrelated matter",
    request: {
      agent: DEMO_AGENT_NAME,
      resource: "matter:unrelated-client",
      tool: DEMO_DOCUMENT_TOOL_NAME,
    },
  },
  {
    expectAuthorized: false,
    label: "external email without approval",
    request: {
      agent: DEMO_AGENT_NAME,
      approved: false,
      tool: DEMO_EMAIL_TOOL_NAME,
    },
  },
  {
    expectAuthorized: true,
    label: "external email with approval",
    request: {
      agent: DEMO_AGENT_NAME,
      approved: true,
      tool: DEMO_EMAIL_TOOL_NAME,
    },
  },
  {
    expectAuthorized: true,
    label: "payment below private threshold",
    request: {
      agent: DEMO_AGENT_NAME,
      amount: 2_750n,
      approved: false,
      tool: DEMO_PAYMENT_TOOL_NAME,
    },
  },
  {
    expectAuthorized: false,
    label: "payment above private maximum",
    request: {
      agent: DEMO_AGENT_NAME,
      amount: 8_000n,
      approved: true,
      tool: DEMO_PAYMENT_TOOL_NAME,
    },
  },
  {
    expectAuthorized: false,
    label: "payment needs approval",
    request: {
      agent: DEMO_AGENT_NAME,
      amount: 4_500n,
      approved: false,
      tool: DEMO_PAYMENT_TOOL_NAME,
    },
  },
  {
    expectAuthorized: true,
    label: "payment approved",
    request: {
      agent: DEMO_AGENT_NAME,
      amount: 4_500n,
      approved: true,
      tool: DEMO_PAYMENT_TOOL_NAME,
    },
  },
  {
    expectAuthorized: false,
    label: "wrong agent",
    request: {
      agent: "UntrustedAgent",
      resource: DEMO_RESOURCE_NAME,
      tool: DEMO_DOCUMENT_TOOL_NAME,
    },
  },
  {
    expectAuthorized: false,
    label: "unknown tool",
    request: {
      agent: DEMO_AGENT_NAME,
      tool: "admin.delete_everything",
    },
  },
];

function receiptSummary(receipt: MidnightAuthorizationReceipt): string {
  return `tx ${receipt.transactionId.slice(0, 12)}… @ block ${receipt.blockHeight}`;
}

async function main(): Promise<void> {
  const client = await createMidnightAuthorizationClient();
  let passed = 0;
  let lastReceipt: MidnightAuthorizationReceipt | undefined;

  console.log(
    "\nzkMCP Phase 2 authorization primitive — three MCP policy classes\n"
  );
  console.log(`Contract: ${client.contractAddress}`);
  console.log(`Network:  ${client.network}`);
  console.log(`Policy commitment: ${client.policyCommitment}`);
  console.log("Private policy values: [HIDDEN]\n");

  try {
    for (const attempt of attempts) {
      process.stdout.write(
        `${attempt.expectAuthorized ? "ALLOW" : "DENY "}  ${attempt.label.padEnd(34)} `
      );

      try {
        const receipt = await client.authorize(attempt.request);
        if (!attempt.expectAuthorized) {
          console.log("❌ unexpectedly authorized");
          continue;
        }

        lastReceipt = receipt;
        passed += 1;
        console.log(`✅ ${receiptSummary(receipt)}`);
      } catch (error) {
        if (attempt.expectAuthorized) {
          const safe = isZkMcpError(error)
            ? getSafeErrorPresentation(error)
            : { code: "unknown", message: "Authorization failed" };
          console.log(`❌ [${safe.code}] ${safe.message}`);
          continue;
        }

        passed += 1;
        console.log("✅ blocked by private policy");
      }
    }
  } finally {
    await client.close();
  }

  if (passed !== attempts.length || !lastReceipt) {
    throw new Error(
      `Authorization demo failed: ${passed}/${attempts.length} cases behaved as expected`
    );
  }

  console.log("\nLast public authorization receipt");
  console.log(`  policy commitment:     ${lastReceipt.policyCommitment}`);
  console.log(`  execution commitment:  ${lastReceipt.executionCommitment}`);
  console.log(`  nullifier:             ${lastReceipt.nullifier}`);
  console.log(`  transaction:           ${lastReceipt.transactionId}`);
  console.log("\nWhat Midnight did not receive publicly");
  console.log(
    "  agent/tool identifiers, matter identifier, amounts, approval state, policy secret"
  );
  console.log(
    `\n✅ Multi-tool authorization suite passed (${passed}/${attempts.length})\n`
  );
}

main().catch((error) => {
  const safe = isZkMcpError(error)
    ? getSafeErrorPresentation(error)
    : {
        code: "midnight.UNKNOWN",
        message: "Midnight authorization demo failed",
      };
  console.error(`\n❌ [${safe.code}] ${safe.message}\n`);
  process.exitCode = 1;
});
