import { gatewayErrors, toErrorCause } from "@zkmcp/core";
import type { MidnightAuthorizationRequest } from "@zkmcp/midnight";
import { z } from "zod";
import { type ApprovalVerifier, approvalTokenFromMeta } from "./approval.js";

export const DOCUMENTS_READ_TOOL = "documents.read";
export const EMAIL_SEND_TOOL = "email.send";
export const PAYMENTS_TRANSFER_TOOL = "payments.transfer";

const documentsArgumentsSchema = z
  .object({
    matterId: z.string().min(1),
  })
  .passthrough();

const paymentArgumentsSchema = z
  .object({
    amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .passthrough();

export interface NormalizeToolCallInput {
  agentId: string;
  approvalVerifier: ApprovalVerifier;
  arguments?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  tool: string;
}

export interface NormalizedToolCall {
  authorization: MidnightAuthorizationRequest;
  forwardArguments: Record<string, unknown>;
}

function normalizeArguments(
  value: Record<string, unknown> | undefined
): Record<string, unknown> {
  return value ? { ...value } : {};
}

export async function normalizeToolCall(
  input: NormalizeToolCallInput
): Promise<NormalizedToolCall> {
  const forwardArguments = normalizeArguments(input.arguments);
  const approved = await input.approvalVerifier.isApproved({
    token: approvalTokenFromMeta(input.meta),
    tool: input.tool,
  });

  try {
    if (input.tool === DOCUMENTS_READ_TOOL) {
      const parsed = documentsArgumentsSchema.parse(forwardArguments);
      return {
        authorization: {
          agent: input.agentId,
          resource: parsed.matterId,
          tool: input.tool,
        },
        forwardArguments,
      };
    }

    if (input.tool === EMAIL_SEND_TOOL) {
      return {
        authorization: {
          agent: input.agentId,
          approved,
          tool: input.tool,
        },
        forwardArguments,
      };
    }

    if (input.tool === PAYMENTS_TRANSFER_TOOL) {
      const parsed = paymentArgumentsSchema.parse(forwardArguments);
      return {
        authorization: {
          agent: input.agentId,
          amount: BigInt(parsed.amount),
          approved,
          tool: input.tool,
        },
        forwardArguments,
      };
    }

    // Unknown tools still go through Midnight. The private policy decides
    // whether the tool digest is recognized instead of the gateway silently
    // falling back to an allow path.
    return {
      authorization: {
        agent: input.agentId,
        approved,
        tool: input.tool,
      },
      forwardArguments,
    };
  } catch (error) {
    throw gatewayErrors.INVALID_MCP_REQUEST({ cause: toErrorCause(error) });
  }
}
