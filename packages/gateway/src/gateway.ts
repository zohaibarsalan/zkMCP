import {
  type CallToolResult,
  type ListToolsResult,
  McpServer,
} from "@modelcontextprotocol/server";
import {
  gatewayErrors,
  getPrivacySafeErrorMetadata,
  getSafeErrorPresentation,
  isZkMcpError,
  toErrorCause,
} from "@zkmcp/core";
import type {
  MidnightAuthorizationReceipt,
  MidnightAuthorizationRequest,
} from "@zkmcp/midnight";
import type { ApprovalVerifier } from "./approval.js";
import { type NormalizedToolCall, normalizeToolCall } from "./normalize.js";

export const ZKMCP_RECEIPT_META_KEY = "io.zkmcp/authorization-receipt";
export const ZKMCP_ERROR_META_KEY = "io.zkmcp/authorization-error";

export interface GatewayAuthorizationBackend {
  authorize: (
    request: MidnightAuthorizationRequest
  ) => Promise<MidnightAuthorizationReceipt>;
  close?: () => Promise<void>;
}

export interface GatewayUpstreamClient {
  callTool: (input: {
    arguments?: Record<string, unknown>;
    name: string;
  }) => Promise<CallToolResult>;
  close?: () => Promise<void>;
  listTools: (input?: { cursor?: string }) => Promise<ListToolsResult>;
}

export interface ZkMcpGatewayOptions {
  agentId: string;
  approvalVerifier: ApprovalVerifier;
  authorizer: GatewayAuthorizationBackend;
  upstream: GatewayUpstreamClient;
}

function receiptMeta(receipt: MidnightAuthorizationReceipt) {
  return {
    blockHeight: receipt.blockHeight,
    contractAddress: receipt.contractAddress,
    executionCommitment: receipt.executionCommitment,
    network: receipt.network,
    nullifier: receipt.nullifier,
    policyCommitment: receipt.policyCommitment,
    proofDurationMs: receipt.proofDurationMs,
    transactionId: receipt.transactionId,
  };
}

function errorResult(error: unknown): CallToolResult {
  const typedError = isZkMcpError(error)
    ? error
    : gatewayErrors.INVALID_MCP_REQUEST({ cause: toErrorCause(error) });
  const safe = getSafeErrorPresentation(typedError);
  return {
    _meta: {
      [ZKMCP_ERROR_META_KEY]: getPrivacySafeErrorMetadata(typedError),
    },
    content: [
      {
        text: `zkMCP blocked this tool call: ${safe.message}`,
        type: "text",
      },
    ],
    isError: true,
  };
}

export class ZkMcpGateway {
  private readonly agentId: string;
  private readonly approvalVerifier: ApprovalVerifier;
  private readonly authorizer: GatewayAuthorizationBackend;
  private readonly outputSchemas = new Map<
    string,
    Readonly<Record<string, unknown>> | undefined
  >();
  private readonly upstream: GatewayUpstreamClient;

  constructor(options: ZkMcpGatewayOptions) {
    this.agentId = options.agentId;
    this.approvalVerifier = options.approvalVerifier;
    this.authorizer = options.authorizer;
    this.upstream = options.upstream;
  }

  createServer(): McpServer {
    const mcp = new McpServer(
      { name: "zkmcp-gateway", version: "0.1.0" },
      { capabilities: { tools: {} } }
    );

    mcp.server.setRequestHandler("tools/list", async (request) => {
      const result = await this.upstream.listTools(
        request.params?.cursor ? { cursor: request.params.cursor } : undefined
      );
      for (const tool of result.tools) {
        this.outputSchemas.set(tool.name, tool.outputSchema);
      }
      return result;
    });

    mcp.server.setRequestHandler("tools/call", async (request) => {
      const result = await this.handleToolCall({
        arguments: request.params.arguments,
        meta: request.params._meta as Record<string, unknown> | undefined,
        name: request.params.name,
      });
      return mcp.server.projectCallToolResult(
        result,
        this.outputSchemas.get(request.params.name)
      );
    });

    return mcp;
  }

  async close(): Promise<void> {
    await this.authorizer.close?.();
    await this.upstream.close?.();
  }

  private async handleToolCall(input: {
    arguments?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    name: string;
  }): Promise<CallToolResult> {
    let normalized: NormalizedToolCall;
    try {
      normalized = await normalizeToolCall({
        agentId: this.agentId,
        approvalVerifier: this.approvalVerifier,
        arguments: input.arguments,
        meta: input.meta,
        tool: input.name,
      });
    } catch (error) {
      return errorResult(error);
    }

    let receipt: MidnightAuthorizationReceipt;
    try {
      receipt = await this.authorizer.authorize(normalized.authorization);
    } catch (error) {
      return errorResult(error);
    }

    try {
      const upstreamResult = await this.upstream.callTool({
        arguments: normalized.forwardArguments,
        name: input.name,
      });
      return {
        ...upstreamResult,
        _meta: {
          ...upstreamResult._meta,
          [ZKMCP_RECEIPT_META_KEY]: receiptMeta(receipt),
        },
      };
    } catch (error) {
      return errorResult(
        gatewayErrors.UPSTREAM_TOOL_FAILED({ cause: toErrorCause(error) })
      );
    }
  }
}
