# zkMCP

**Cryptographic authorization for AI agents.**

zkMCP is a zero-knowledge authorization gateway for Model Context Protocol. It sits between an AI agent and an existing MCP server, proves that each sensitive `tools/call` satisfies a private policy with Midnight/Compact, and forwards the call only after authorization succeeds.

```text
AI Agent
   │ MCP tools/call
   ▼
zkMCP Gateway
   │ normalize authorization facts
   ▼
Midnight / Compact
   │ private policy proof
   ├── denied ──> MCP error; upstream tool never executes
   │
   └── allowed
          ▼
     Upstream MCP Tool
          │
          ▼
 tool result + public proof receipt
```

Built for the Midnight Hackathon, August 2026 — **AI Track**.

## Developer documentation

The web application is intentionally a **documentation site, not a marketing site**. It is built with Fumadocs and includes the architecture, quickstart, security model, exact current APIs, examples, troubleshooting, diagrams-as-code, an embedded authorization playground, and a Scalar OpenAPI reference for the local playground bridge.

Run the docs only:

```bash
npm install
npm run dev:web
```

Open:

```text
http://localhost:4545/docs
```

Useful routes:

```text
/docs                         documentation home
/docs/getting-started         installation + quickstart
/docs/playground              recorded/live authorization playground
/docs/security/privacy-model  public/private data boundary
/docs/reference               current workspace APIs
/api-reference                Scalar HTTP demo API reference
/openapi.json                 OpenAPI 3.1 document
```

The documentation search is backed by Fumadocs at `/api/search`.

## Run the live playground

Requirements:

- Node.js 22+
- Docker Desktop / Docker Compose
- Compact compiler `0.31.1`

Start Midnight, compile/deploy the authorization contract, start the real MCP demo runtime, and launch the docs with live proving enabled:

```bash
npm run demo:ui
```

Then open:

```text
http://localhost:4545/docs/playground
```

The docs also work without Midnight. In ordinary `npm run dev:web` mode, the playground uses proof receipts captured from the verified local Phase 2 run and does not attempt to contact a localhost backend.

Stop Midnight when finished:

```bash
npm run stop:midnight
```

## What is implemented

A real MCP client can call a real MCP server through zkMCP, with Midnight acting as the authorization boundary.

The current demo covers three policy classes:

| MCP tool | Private rule demonstrated |
| --- | --- |
| `documents.read` | requested matter must match the agent's authorized resource |
| `email.send` | external send requires trusted human approval |
| `payments.transfer` | amount must stay below a private maximum; higher values can require approval |

The verified real MCP + Midnight run exercises:

```text
ALLOW  assigned matter document
DENY   unrelated matter document
DENY   external email without approval
ALLOW  external email with approval
ALLOW  payment below private threshold
DENY   payment that needs approval
ALLOW  payment with human approval
DENY   payment above private maximum

8/8 passed
```

For an allowed action, the sequence is:

1. Receive MCP `tools/call`.
2. Normalize deterministic authorization facts.
3. Resolve trusted approval metadata outside ordinary agent-controlled arguments.
4. Submit the private authorization request to the Compact contract.
5. Generate and verify the Midnight proof.
6. Finalize the authorization transaction.
7. Only then invoke the upstream MCP handler.
8. Attach the public proof receipt to the MCP result.

Denied actions return before the upstream handler is invoked.

## Access is not authority

MCP gives an agent a standardized way to reach a tool. zkMCP handles the finer-grained question:

> Is this agent allowed to perform **this action**, on **this resource**, with **these parameters**, under the user's private rules?

zkMCP separates:

- **access** — the application can reach a service
- **intent** — the model wants to perform an action
- **authority** — the individual action satisfies the user's policy

The third is what zkMCP proves.

## What zkMCP proves

zkMCP does **not** attempt to prove arbitrary LLM reasoning or inference.

For an accepted authorization transaction, the current Compact contract proves the deterministic authorization envelope conceptually contains:

```text
private policy hashes to committed policy
AND agent constraint passes
AND tool constraint passes
AND resource constraint passes when applicable
AND numeric constraints pass when applicable
AND approval requirement passes when applicable
AND authorization nonce has not been replayed
```

The model can remain probabilistic. The authority boundary does not.

## Public vs private

A successful authorization returns public receipt material such as:

```text
policyCommitment
executionCommitment
nullifier
transactionId
blockHeight
contractAddress
network
proofDurationMs
```

The system does not deliberately publish or log the raw:

```text
policy secret
agent/tool policy identifiers
resource / matter identifier
payment amount
private maximum
approval threshold
approval context / token
nonce
prompt
arbitrary tool arguments
```

Private policy failures are surfaced externally as the generic `policy.AUTHORIZATION_DENIED`, so the error channel does not reveal whether an agent, tool, resource, numeric, or approval rule caused the rejection.

See the full [privacy model](apps/web/content/docs/security/privacy-model.mdx) and [threat model](apps/web/content/docs/security/threat-model.mdx).

## Current APIs

The codebase is separated into three workspace packages:

```text
@zkmcp/core      typed errors + privacy-safe local observability
@zkmcp/midnight  Midnight/Compact authorization client
@zkmcp/gateway   MCP proxy + normalization + trusted approval boundary
```

These packages are **not published to npm yet**. Documentation uses their workspace package names because those are the actual current code boundaries.

The gateway API today is deliberately lower-level than a future SDK:

```ts
const authorizer = await createMidnightAuthorizationClient();

const gateway = new ZkMcpGateway({
  agentId: "LegalAgent-01",
  approvalVerifier,
  authorizer,
  upstream,
});

const server = gateway.createServer();
```

There is no fake `definePolicy()` or one-line `wrapServer()` API in the docs. The reference documents the implementation that exists now.

## MCP metadata

Successful authorizations are attached under:

```text
io.zkmcp/authorization-receipt
```

Privacy-safe authorization failures use:

```text
io.zkmcp/authorization-error
```

Trusted demo approval is carried separately from agent arguments under:

```text
io.zkmcp/approval-token
```

An agent cannot authorize itself simply by adding an `approved: true` tool argument.

## Repository

```text
zkMCP/
├── apps/
│   └── web/
│       ├── app/                    Fumadocs routes, search, Scalar/OpenAPI
│       ├── components/             MDX components + authorization playground
│       ├── content/docs/           developer documentation
│       └── lib/
│
├── docs/                            implementation-phase engineering notes
│   ├── engineering-foundation.md
│   ├── phase1-proof-model.md
│   ├── phase2-mcp-gateway.md
│   └── phase3-demo-ui.md
│
├── packages/
│   ├── core/
│   │   └── src/                    typed errors + evlog helpers
│   │
│   ├── midnight/
│   │   ├── contracts/
│   │   │   └── authorization.compact
│   │   └── src/                    client, wallet, network, witnesses
│   │
│   └── gateway/
│       └── src/                    MCP gateway, normalizer, approval, demos
│
├── biome.jsonc
└── package.json
```

## Testing

Run the repository-wide quality gate:

```bash
npm run foundation:check
```

It runs:

```text
Ultracite / Biome
→ TypeScript builds
→ core tests
→ gateway tests
→ Compact compilation
```

Run the direct Midnight authorization suite:

```bash
npm run test:midnight
```

Run the real stdio MCP + Midnight integration demo:

```bash
npm run demo:gateway
```

## Engineering foundation

The repository uses:

- **Ultracite + Biome** for formatting and linting
- strict TypeScript checking
- **evlog** for local structured wide events
- typed error catalogs in `@zkmcp/core`
- privacy-safe error/log metadata
- a single root npm workspace and lockfile

No remote observability drain is configured. Local evlog files are gitignored.

## Documentation stack

- **Fumadocs** — docs shell, navigation, MDX content, TOC, and search
- **Beautiful Mermaid** — architecture and flow diagrams from Mermaid source
- **Scalar** — OpenAPI reference for the local HTTP playground bridge
- Next.js 16 / React 19
- Tailwind CSS 4

The Scalar API describes the local `/health` and `/run` playground bridge. It is explicitly documented as a demo/debug API around the real MCP + Midnight runtime, **not** as the zkMCP protocol itself.

## Core stack

- Midnight Network
- Compact `0.31.1` / language `0.23`
- Midnight.js `4.1.1`
- Midnight Proof Server `8.1.0`
- Model Context Protocol TypeScript SDK v2
- TypeScript / Node.js
- Zod
- Docker

## Important current limitations

This is a working hackathon infrastructure prototype, not a finished production authorization platform.

- One immutable private policy is committed per current contract deployment.
- The approval verifier uses a fixed local token for the demo; production should use signed, scoped, expiring approval capabilities.
- The gateway currently protects MCP tools, not MCP resources/prompts.
- Tool normalization is explicit for the three demo tool classes rather than driven by a general policy DSL.
- Workspace packages are not published to npm.
- The fully validated chain deployment is the local Midnight `undeployed` devnet.
- Proof generation is synchronous and currently adds significant latency.
- Policy rotation/revocation, delegated identities, multi-party approvals, concurrency optimization, and production secret storage remain future work.

For the complete developer-facing documentation, run `npm run dev:web` and open `/docs`.

**AI agents should not just claim that they followed the rules. They should be able to prove it.**
