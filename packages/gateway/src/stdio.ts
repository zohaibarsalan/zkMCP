import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { initZkMcpLogger } from "@zkmcp/core";
import { createMidnightAuthorizationClient } from "@zkmcp/midnight";
import {
  DenyAllApprovalVerifier,
  FixedTokenApprovalVerifier,
} from "./approval.js";
import { type GatewayUpstreamClient, ZkMcpGateway } from "./gateway.js";

function upstreamCommand(): { args: string[]; command: string } {
  const args = process.argv.slice(2);
  const separator = args.indexOf("--");
  const commandParts = separator >= 0 ? args.slice(separator + 1) : args;
  const [command, ...commandArgs] = commandParts;
  if (!command) {
    throw new Error(
      "Missing upstream MCP command. Example: tsx src/stdio.ts -- npx tsx src/demo-upstream.ts"
    );
  }
  return { args: commandArgs, command };
}

async function main(): Promise<void> {
  initZkMcpLogger({
    service: "zkmcp-gateway",
    silent: true,
  });

  const upstreamProcess = upstreamCommand();
  const upstreamClient = new Client(
    { name: "zkmcp-upstream-client", version: "0.1.0" },
    { versionNegotiation: { mode: "auto" } }
  );
  await upstreamClient.connect(
    new StdioClientTransport({
      args: upstreamProcess.args,
      command: upstreamProcess.command,
      stderr: "inherit",
    })
  );

  const upstream: GatewayUpstreamClient = {
    callTool: (input) => upstreamClient.callTool(input),
    close: () => upstreamClient.close(),
    listTools: (input) => upstreamClient.listTools(input),
  };

  const authorizer = await createMidnightAuthorizationClient();
  const configuredApprovalToken = process.env.ZKMCP_APPROVAL_TOKEN?.trim();
  const approvalVerifier = configuredApprovalToken
    ? new FixedTokenApprovalVerifier(configuredApprovalToken)
    : new DenyAllApprovalVerifier();

  const gateway = new ZkMcpGateway({
    agentId: process.env.ZKMCP_AGENT_ID?.trim() || "LegalAgent",
    approvalVerifier,
    authorizer,
    upstream,
  });

  const handle = serveStdio(() => gateway.createServer(), {
    onerror: (error) => {
      console.error("[zkmcp-gateway] MCP error:", error.message);
    },
  });

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await handle.close();
    await gateway.close();
  };

  process.once("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  process.once("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });
  process.stdin.once("end", async () => {
    await shutdown();
  });
}

main().catch((error) => {
  console.error(
    "[zkmcp-gateway] startup failed:",
    error instanceof Error ? error.message : "Unknown error"
  );
  process.exitCode = 1;
});
