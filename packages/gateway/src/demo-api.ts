import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { getSafeErrorPresentation, initZkMcpLogger } from "@zkmcp/core";
import {
  createDemoRuntime,
  type DemoRuntime,
  type DemoRuntimeToolCall,
} from "./demo-runtime.js";
import { ZKMCP_ERROR_META_KEY, ZKMCP_RECEIPT_META_KEY } from "./gateway.js";
import {
  DOCUMENTS_READ_TOOL,
  EMAIL_SEND_TOOL,
  PAYMENTS_TRANSFER_TOOL,
} from "./normalize.js";

const PORT = Number(process.env.ZKMCP_DEMO_API_PORT ?? 8787);
const HOST = process.env.ZKMCP_DEMO_API_HOST ?? "127.0.0.1";
const MAX_BODY_BYTES = 16_384;

initZkMcpLogger({ service: "zkmcp-demo-api", silent: true });

const scenarios = {
  "document-allowed": {
    arguments: {
      documentId: "settlement-offer.pdf",
      matterId: "matter:thompson",
    },
    name: DOCUMENTS_READ_TOOL,
  },
  "document-denied": {
    arguments: {
      documentId: "acquisition-notes.pdf",
      matterId: "matter:unrelated-client",
    },
    name: DOCUMENTS_READ_TOOL,
  },
  "email-approved": {
    approved: true,
    arguments: {
      body: "Please find the settlement proposal attached.",
      subject: "Thompson settlement proposal",
      to: "outside-counsel@example.com",
    },
    name: EMAIL_SEND_TOOL,
  },
  "email-denied": {
    arguments: {
      body: "Please find the settlement proposal attached.",
      subject: "Thompson settlement proposal",
      to: "outside-counsel@example.com",
    },
    name: EMAIL_SEND_TOOL,
  },
  "payment-allowed": {
    arguments: {
      amount: 2750,
      memo: "Thompson settlement disbursement",
      recipient: "client-settlement-account",
    },
    name: PAYMENTS_TRANSFER_TOOL,
  },
  "payment-approval-denied": {
    arguments: {
      amount: 4500,
      memo: "Thompson settlement disbursement",
      recipient: "client-settlement-account",
    },
    name: PAYMENTS_TRANSFER_TOOL,
  },
  "payment-approved": {
    approved: true,
    arguments: {
      amount: 4500,
      memo: "Thompson settlement disbursement",
      recipient: "client-settlement-account",
    },
    name: PAYMENTS_TRANSFER_TOOL,
  },
  "payment-limit-denied": {
    approved: true,
    arguments: {
      amount: 8000,
      memo: "Thompson settlement disbursement",
      recipient: "client-settlement-account",
    },
    name: PAYMENTS_TRANSFER_TOOL,
  },
} satisfies Record<string, DemoRuntimeToolCall>;

type ScenarioId = keyof typeof scenarios;

let runtimePromise: Promise<DemoRuntime> | undefined;

function getRuntime(): Promise<DemoRuntime> {
  runtimePromise ??= createDemoRuntime().catch((error) => {
    runtimePromise = undefined;
    throw error;
  });
  return runtimePromise;
}

function setCors(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", "*");
}

function json(response: ServerResponse, status: number, value: unknown): void {
  setCors(response);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) {
      throw new Error("Request body is too large");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function scenarioFromBody(body: unknown): ScenarioId | undefined {
  if (!(body && typeof body === "object" && "scenarioId" in body)) {
    return undefined;
  }
  const value = (body as { scenarioId?: unknown }).scenarioId;
  return typeof value === "string" && value in scenarios
    ? (value as ScenarioId)
    : undefined;
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method === "OPTIONS") {
    setCors(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    try {
      const runtime = await getRuntime();
      const tools = await runtime.listTools();
      json(response, 200, { mode: "live", ready: true, tools });
    } catch (error) {
      const safe = getSafeErrorPresentation(error);
      json(response, 503, {
        error: safe,
        mode: "recorded",
        ready: false,
      });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/run") {
    try {
      const scenarioId = scenarioFromBody(await readJsonBody(request));
      if (!scenarioId) {
        json(response, 400, { error: "Unknown demo scenario" });
        return;
      }

      const runtime = await getRuntime();
      const startedAt = performance.now();
      const result = await runtime.callTool(scenarios[scenarioId]);
      const receipt = result._meta?.[ZKMCP_RECEIPT_META_KEY];
      const authorizationError = result._meta?.[ZKMCP_ERROR_META_KEY];

      json(response, 200, {
        authorizationError: authorizationError ?? null,
        durationMs: Math.round(performance.now() - startedAt),
        isError: result.isError === true,
        receipt: receipt ?? null,
        scenarioId,
      });
    } catch (error) {
      const safe = getSafeErrorPresentation(error);
      json(response, safe.status >= 400 ? safe.status : 500, { error: safe });
    }
    return;
  }

  json(response, 404, { error: "Not found" });
}

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    const safe = getSafeErrorPresentation(error);
    json(response, 500, { error: safe });
  });
});

server.listen(PORT, HOST, () => {
  process.stderr.write(`zkMCP demo API listening on http://${HOST}:${PORT}\n`);
});

async function shutdown(): Promise<void> {
  const runtime = runtimePromise
    ? await runtimePromise.catch(() => undefined)
    : undefined;
  await runtime?.close();
  server.close();
}

process.once("SIGINT", () => {
  shutdown()
    .finally(() => process.exit(0))
    .catch(() => process.exit(1));
});
process.once("SIGTERM", () => {
  shutdown()
    .finally(() => process.exit(0))
    .catch(() => process.exit(1));
});
