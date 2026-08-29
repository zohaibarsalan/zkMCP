# zkMCP

**Cryptographic authorization for AI agents.**

zkMCP is a zero-knowledge authorization gateway for MCP. It sits between an AI agent and its tools, proves that each sensitive action satisfies a private policy with Midnight/Compact, and forwards the MCP call only after authorization succeeds.

```text
AI Agent
   │ MCP tools/call
   ▼
zkMCP Gateway
   │ normalize private authorization facts
   ▼
Midnight / Compact
   │ ZK authorization proof
   ├── denied ──> MCP error; tool never executes
   │
   └── allowed
          ▼
     Upstream MCP Tool
          │
          ▼
 tool result + public proof receipt
```

Built for the Midnight Hackathon, August 2026 — **AI Track**.

## Why

MCP answers how an agent can reach a tool. It does not, by itself, answer the finer-grained question:

> Is this agent allowed to perform **this action**, on **this resource**, with **these parameters**, under this user's private rules, right now?

Giving an agent access to a payment server should not imply unlimited spending authority. Access to a document server should not imply access to every client's matter. Access to email should not imply permission to send externally without approval.

zkMCP separates:

- **access** — the application can reach a service
- **intent** — the model wants to perform an action
- **authority** — the action satisfies the user's policy

The third is what zkMCP proves.

## Current status

**Phase 2 is complete.** A real MCP client can now call a real MCP server through zkMCP, with Midnight acting as the authorization boundary.

The working demo covers three policy classes:

| MCP tool | Private rule demonstrated |
| --- | --- |
| `documents.read` | requested matter must match the agent's allowed resource |
| `email.send` | external send requires trusted human approval |
| `payments.transfer` | amount must remain below a private maximum; higher amounts can require approval |

A real stdio end-to-end run currently verifies:

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

For successful calls, Midnight generates and verifies real proofs, the authorization transaction finalizes, and only then does the upstream MCP tool execute. Denied calls return through MCP before the upstream handler is invoked.

## What is public vs private

The Compact contract commits public proof-receipt material such as:

```text
policyCommitment
executionCommitment
nullifier
transactionId
blockHeight
```

The system does not publish the raw:

```text
policy secret
agent/tool policy identifiers
matter/resource identifier
payment amount
private maximum
approval threshold
approval context
nonce
prompt
arbitrary tool arguments
```

Private policy failures are also intentionally surfaced generically as `policy.AUTHORIZATION_DENIED`, so a verifier does not learn whether the hidden agent, tool, resource, numeric, or approval rule caused the rejection.

## Run it

Requirements:

- Node.js 22+
- Docker Desktop / Docker Compose
- Compact compiler 0.31.1

Install dependencies from the repository root:

```bash
npm install
```

Start the local Midnight node, indexer, proof server, compile the contract, and deploy it:

```bash
npm run setup:midnight
```

Run the full real MCP + Midnight demo:

```bash
npm run demo:gateway
```

Run local quality gates:

```bash
npm run foundation:check
```

Stop the Midnight stack when finished:

```bash
npm run stop:midnight
```

## Repository

```text
zkMCP/
├── docs/
│   ├── engineering-foundation.md
│   ├── phase1-proof-model.md
│   └── phase2-mcp-gateway.md
│
├── packages/
│   ├── core/
│   │   ├── errors.ts / tests
│   │   └── logging.ts / tests
│   │
│   ├── midnight/
│   │   ├── contracts/
│   │   │   └── authorization.compact
│   │   └── src/
│   │       ├── authorization-state.ts
│   │       ├── client.ts
│   │       ├── demo.ts
│   │       └── ...
│   │
│   └── gateway/
│       └── src/
│           ├── gateway.ts
│           ├── normalize.ts
│           ├── approval.ts
│           ├── stdio.ts
│           ├── demo-tools.ts
│           └── demo-client.ts
│
├── biome.jsonc
└── package.json
```

## MCP behavior

`tools/list` is transparently proxied from the upstream MCP server.

`tools/call` is intercepted:

1. zkMCP assigns the configured gateway agent identity.
2. The call is normalized into deterministic authorization facts.
3. Human approval metadata, when required, is verified outside ordinary agent-controlled arguments.
4. `@zkmcp/midnight` generates a fresh nonce and submits the private authorization call.
5. Compact proves the private policy constraints.
6. A denied action returns an MCP `isError` result.
7. An authorized action is forwarded to the upstream MCP server.
8. zkMCP adds the public authorization receipt to result `_meta` under `io.zkmcp/authorization-receipt`.

The demo approval signal is carried under `io.zkmcp/approval-token`. It is deliberately separate from tool arguments so an agent cannot simply write `approved: true` and grant itself authority.

## Engineering foundation

The repo uses:

- **Ultracite + Biome** for formatting and linting
- strict TypeScript checking
- **evlog** for local structured wide events
- typed error catalogs in `@zkmcp/core`
- privacy-safe error/log metadata
- a single root npm workspace and lockfile

No remote observability drain is configured. Local evlog files are gitignored.

## Stack

- Midnight Network
- Compact 0.31.1 / language 0.23
- Midnight.js 4.1.1
- Midnight Proof Server 8.1.0
- Model Context Protocol TypeScript SDK v2
- TypeScript / Node.js
- Zod
- Ultracite / Biome
- evlog
- Docker

## Important current limitations

This is a working hackathon infrastructure prototype, not a finished production authorization platform.

- One immutable private policy is committed per current contract deployment.
- The approval verifier uses a fixed local token for the demo; production should use signed, scoped, expiring approval capabilities.
- The gateway currently protects MCP tools, not MCP resources/prompts.
- Tool normalization is implemented explicitly for the three demo tool classes rather than through a general policy DSL.
- The current validated chain deployment is a local Midnight devnet.
- Proof generation is synchronous and currently adds significant latency.
- Policy rotation, revocation, delegated identities, multi-party approvals, concurrency optimization, and production secret storage are future work.

See [`docs/phase1-proof-model.md`](docs/phase1-proof-model.md) for the ZK model and [`docs/phase2-mcp-gateway.md`](docs/phase2-mcp-gateway.md) for the MCP architecture and validation evidence.

## Next

Phase 3 is the hackathon demo/product layer: build the polished policy studio, agent execution trace, approval interaction, and **What Midnight Saw** privacy inspector on top of the now-working gateway.

**AI agents should not just claim that they followed the rules. They should be able to prove it.**
