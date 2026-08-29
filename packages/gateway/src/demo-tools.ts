import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  DOCUMENTS_READ_TOOL,
  EMAIL_SEND_TOOL,
  PAYMENTS_TRANSFER_TOOL,
} from "./normalize.js";

export function createDemoToolServer(): McpServer {
  const server = new McpServer({
    name: "zkmcp-demo-tools",
    version: "0.1.0",
  });

  server.registerTool(
    DOCUMENTS_READ_TOOL,
    {
      annotations: { idempotentHint: true, readOnlyHint: true },
      description: "Read a document from a legal matter",
      inputSchema: z.object({
        documentId: z.string().min(1),
        matterId: z.string().min(1),
      }),
      outputSchema: z.object({
        content: z.string(),
        documentId: z.string(),
        matterId: z.string(),
      }),
      title: "Read matter document",
    },
    ({ documentId, matterId }) => {
      const structuredContent = {
        content: `Demo document ${documentId} for ${matterId}`,
        documentId,
        matterId,
      };
      return {
        content: [
          {
            text: structuredContent.content,
            type: "text",
          },
        ],
        structuredContent,
      };
    }
  );

  server.registerTool(
    EMAIL_SEND_TOOL,
    {
      annotations: { destructiveHint: true, idempotentHint: false },
      description: "Send an external email",
      inputSchema: z.object({
        body: z.string().min(1),
        subject: z.string().min(1),
        to: z.string().email(),
      }),
      outputSchema: z.object({
        messageId: z.string(),
        status: z.literal("sent"),
      }),
      title: "Send email",
    },
    ({ to }) => {
      const structuredContent = {
        messageId: `msg_${Date.now()}`,
        status: "sent" as const,
      };
      return {
        content: [
          {
            text: `Demo email sent to ${to}`,
            type: "text",
          },
        ],
        structuredContent,
      };
    }
  );

  server.registerTool(
    PAYMENTS_TRANSFER_TOOL,
    {
      annotations: { destructiveHint: true, idempotentHint: false },
      description: "Transfer a payment",
      inputSchema: z.object({
        amount: z.number().int().nonnegative(),
        memo: z.string().optional(),
        recipient: z.string().min(1),
      }),
      outputSchema: z.object({
        paymentId: z.string(),
        status: z.literal("submitted"),
      }),
      title: "Transfer payment",
    },
    ({ amount, recipient }) => {
      const structuredContent = {
        paymentId: `pay_${Date.now()}`,
        status: "submitted" as const,
      };
      return {
        content: [
          {
            text: `Demo payment of ${amount} submitted to ${recipient}`,
            type: "text",
          },
        ],
        structuredContent,
      };
    }
  );

  return server;
}
