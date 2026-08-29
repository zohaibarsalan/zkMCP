import { Client } from "@modelcontextprotocol/client";
import {
  type CallToolResult,
  InMemoryTransport,
} from "@modelcontextprotocol/server";
import { createMidnightAuthorizationClient } from "@zkmcp/midnight";
import {
  FixedTokenApprovalVerifier,
  ZKMCP_APPROVAL_META_KEY,
} from "./approval.js";
import { createDemoToolServer } from "./demo-tools.js";
import { ZkMcpGateway } from "./gateway.js";

const DEMO_AGENT_ID = "LegalAgent";
const DEMO_APPROVAL_TOKEN = "zkmcp-demo-human-approval";

export interface DemoRuntimeToolCall {
  approved?: boolean;
  arguments?: Record<string, unknown>;
  name: string;
}

export interface DemoRuntime {
  callTool: (input: DemoRuntimeToolCall) => Promise<CallToolResult>;
  close: () => Promise<void>;
  listTools: () => Promise<string[]>;
}

export async function createDemoRuntime(): Promise<DemoRuntime> {
  const upstreamServer = createDemoToolServer();
  const upstreamClient = new Client(
    { name: "zkmcp-phase3-upstream", version: "0.1.0" },
    { versionNegotiation: { mode: "legacy" } }
  );
  const [upstreamClientTransport, upstreamServerTransport] =
    InMemoryTransport.createLinkedPair();

  await upstreamServer.connect(upstreamServerTransport);
  await upstreamClient.connect(upstreamClientTransport);

  const authorizer = await createMidnightAuthorizationClient();
  const gateway = new ZkMcpGateway({
    agentId: DEMO_AGENT_ID,
    approvalVerifier: new FixedTokenApprovalVerifier(DEMO_APPROVAL_TOKEN),
    authorizer,
    upstream: {
      callTool: (input) => upstreamClient.callTool(input),
      close: () => upstreamClient.close(),
      listTools: (input) => upstreamClient.listTools(input),
    },
  });

  const gatewayServer = gateway.createServer();
  const agentClient = new Client(
    { name: "zkmcp-phase3-agent", version: "0.1.0" },
    { versionNegotiation: { mode: "legacy" } }
  );
  const [agentClientTransport, gatewayServerTransport] =
    InMemoryTransport.createLinkedPair();

  await gatewayServer.connect(gatewayServerTransport);
  await agentClient.connect(agentClientTransport);

  return {
    callTool: (input) =>
      agentClient.callTool({
        ...(input.approved
          ? {
              _meta: {
                [ZKMCP_APPROVAL_META_KEY]: DEMO_APPROVAL_TOKEN,
              },
            }
          : {}),
        arguments: input.arguments,
        name: input.name,
      }),
    close: async () => {
      await agentClient.close();
      await gateway.close();
      await upstreamServer.close();
    },
    listTools: async () => {
      const result = await agentClient.listTools();
      return result.tools.map((tool) => tool.name);
    },
  };
}
