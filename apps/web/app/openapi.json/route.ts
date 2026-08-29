const scenarioIds = [
  "document-allowed",
  "document-denied",
  "email-approved",
  "email-denied",
  "payment-allowed",
  "payment-approval-denied",
  "payment-approved",
  "payment-limit-denied",
] as const;

const specification = {
  components: {
    schemas: {
      AuthorizationError: {
        additionalProperties: false,
        properties: {
          code: { type: ["string", "null"] },
          retryable: { type: "boolean" },
          stage: {
            enum: ["policy", "proof", "replay", "midnight", "gateway"],
            type: ["string", "null"],
          },
          status: { type: "integer" },
        },
        required: ["retryable", "status"],
        type: "object",
      },
      HealthReady: {
        additionalProperties: false,
        properties: {
          mode: { const: "live" },
          ready: { const: true },
          tools: { items: { type: "string" }, type: "array" },
        },
        required: ["mode", "ready", "tools"],
        type: "object",
      },
      HealthUnavailable: {
        additionalProperties: false,
        properties: {
          error: { $ref: "#/components/schemas/SafeError" },
          mode: { const: "recorded" },
          ready: { const: false },
        },
        required: ["error", "mode", "ready"],
        type: "object",
      },
      ProofReceipt: {
        additionalProperties: false,
        properties: {
          blockHeight: { type: "integer" },
          contractAddress: { type: "string" },
          executionCommitment: { type: "string" },
          network: {
            enum: ["undeployed", "preview", "preprod"],
            type: "string",
          },
          nullifier: { type: "string" },
          policyCommitment: { type: "string" },
          proofDurationMs: { type: "integer" },
          transactionId: { type: "string" },
        },
        required: [
          "blockHeight",
          "contractAddress",
          "executionCommitment",
          "network",
          "nullifier",
          "policyCommitment",
          "proofDurationMs",
          "transactionId",
        ],
        type: "object",
      },
      RunResult: {
        additionalProperties: false,
        properties: {
          authorizationError: {
            anyOf: [
              { $ref: "#/components/schemas/AuthorizationError" },
              { type: "null" },
            ],
          },
          durationMs: { type: "integer" },
          isError: { type: "boolean" },
          receipt: {
            anyOf: [
              { $ref: "#/components/schemas/ProofReceipt" },
              { type: "null" },
            ],
          },
          scenarioId: { enum: scenarioIds, type: "string" },
        },
        required: [
          "authorizationError",
          "durationMs",
          "isError",
          "receipt",
          "scenarioId",
        ],
        type: "object",
      },
      SafeError: {
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          fix: { type: "string" },
          message: { type: "string" },
          status: { type: "integer" },
        },
        required: ["code", "message", "status"],
        type: "object",
      },
      SafeErrorEnvelope: {
        additionalProperties: false,
        properties: {
          error: { $ref: "#/components/schemas/SafeError" },
        },
        required: ["error"],
        type: "object",
      },
      SimpleError: {
        additionalProperties: false,
        properties: { error: { type: "string" } },
        required: ["error"],
        type: "object",
      },
    },
  },
  info: {
    description:
      "Local HTTP bridge used by the zkMCP documentation playground. This is a demo/debug API around the real MCP + Midnight runtime, not the zkMCP protocol surface itself.",
    title: "zkMCP Playground API",
    version: "0.1.0",
  },
  openapi: "3.1.0",
  paths: {
    "/health": {
      get: {
        description:
          "Initializes the local demo runtime, verifies that the gateway can list upstream MCP tools, and reports whether live mode is ready.",
        operationId: "getDemoHealth",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthReady" },
              },
            },
            description: "Live demo runtime is ready.",
          },
          "503": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthUnavailable" },
              },
            },
            description: "Midnight or the MCP demo runtime is unavailable.",
          },
        },
        summary: "Check live playground readiness",
      },
    },
    "/run": {
      post: {
        description:
          "Runs one predefined authorization scenario through the real local MCP gateway. Authorized scenarios may generate a new Midnight proof/transaction; denied scenarios return privacy-safe error metadata and no receipt.",
        operationId: "runDemoScenario",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                additionalProperties: false,
                properties: {
                  scenarioId: {
                    enum: scenarioIds,
                    type: "string",
                  },
                },
                required: ["scenarioId"],
                type: "object",
              },
            },
          },
          required: true,
        },
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RunResult" },
              },
            },
            description:
              "Scenario completed. `isError` distinguishes authorization denial from allowed execution.",
          },
          "400": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleError" },
              },
            },
            description: "Unknown scenario identifier.",
          },
          "500": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SafeErrorEnvelope" },
              },
            },
            description: "Unexpected runtime failure.",
          },
          "503": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SafeErrorEnvelope" },
              },
            },
            description:
              "A retryable Midnight/prover dependency is unavailable.",
          },
        },
        summary: "Run a protected MCP scenario",
      },
    },
  },
  servers: [
    {
      description: "Local demo API started by `npm run demo:ui`",
      url: "http://127.0.0.1:8787",
    },
  ],
} as const;

export function GET() {
  return Response.json(specification);
}
