# zkMCP

**A zero-knowledge authorization layer for AI agents and MCP tools.**

MCP can give an agent access to email, source code, databases, payments, documents, and internal systems. zkMCP adds a finer-grained boundary: before a sensitive tool call executes, the agent must satisfy a private authorization policy whose correctness can be proven without publishing the policy itself.

```text
AI Agent -> zkMCP Gateway -> Private Policy -> Midnight ZK Proof -> MCP Tool
```

Built for the Midnight Hackathon, August 2026 — **AI Track**.

## Current status

Phase 1 and the engineering foundation are complete: the core authorization primitive runs end-to-end on a local Midnight devnet with repo-wide quality gates, typed errors, and privacy-safe local observability.

A Compact contract now proves that a private request satisfies an immutable committed policy covering:

- agent identity
- tool identity
- private maximum amount
- private human-approval threshold
- nonce/nullifier replay protection

Successful authorizations generate real Midnight proofs and commit only a policy commitment, execution commitment, and nullifier. Raw policy values and request values are not written to the ledger.

The end-to-end suite currently verifies:

```text
2,750 + correct agent/tool + no approval  -> AUTHORIZED
8,000 + correct agent/tool                -> DENIED
4,500 + no human approval                 -> DENIED
4,500 + human approval                    -> AUTHORIZED
wrong agent                               -> DENIED
replayed nonce                            -> DENIED
```

See [`docs/phase1-proof-model.md`](docs/phase1-proof-model.md) for the exact claim and privacy boundary.

## Run Phase 1

Requirements:

- Node.js 22+
- Docker Desktop / Docker Compose
- Compact compiler 0.31.1

```bash
npm install
npm run setup --workspace=@zkmcp/midnight
npm run test:e2e
```

The setup command starts a local Midnight node, indexer, and proof server, compiles the Compact contract, creates the local private policy, and deploys the contract.

`npm run test:e2e` executes the full allow/deny/replay suite against the deployed contract.

## Engineering foundation

The repository uses **Ultracite + Biome** instead of an ESLint/Prettier stack, plus a shared `@zkmcp/core` package for typed evlog errors and privacy-safe local logging. There are no remote observability drains yet.

```bash
npm run foundation:check
```

Local authorization events are written as NDJSON under `.evlog/logs/` and are gitignored. Raw policy values, amounts, thresholds, prompts, tool arguments, witnesses, secrets, and nonces are redacted or excluded from the typed log schema. Detailed policy denial reasons are collapsed before logging so observability does not reveal the shape of a private policy.

See [`docs/engineering-foundation.md`](docs/engineering-foundation.md).

## Repository

```text
zkMCP/
├── docs/
│   ├── engineering-foundation.md
│   └── phase1-proof-model.md
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── errors.ts
│   │       └── logging.ts
│   └── midnight/
│       ├── contracts/
│       │   └── authorization.compact
│       ├── src/
│       │   ├── authorization-state.ts
│       │   ├── demo.ts
│       │   ├── deploy.ts
│       │   └── ...
│       └── docker-compose.yml
├── biome.jsonc
└── README.md
```

## Proof architecture

At deployment, the private policy is supplied through a Compact witness. The constructor computes a domain-separated commitment and pins only that commitment in sealed ledger state.

Every later authorization recomputes the commitment inside the ZK circuit and asserts that it matches the pinned commitment. This prevents a prover from silently substituting a more permissive policy.

An authorized request then produces:

```text
policyCommitment
executionCommitment
nullifier
```

The raw agent rule, tool rule, thresholds, requested amount, approval context, policy secret, and nonce remain private.

## Stack

- Midnight Network
- Compact 0.31.1 / language 0.23
- Midnight.js 4.1.1
- Proof Server 8.1.0
- TypeScript / Node.js
- Ultracite + Biome
- evlog (local structured observability)
- Docker
- Model Context Protocol (Phase 2)
- Next.js / React (later demo UI)

## Next

**Phase 2:** turn the authorization primitive into an MCP gateway.

The gateway will intercept real `tools/call` requests, normalize them into authorization facts, request a zkMCP proof for sensitive actions, and forward only authorized calls to the underlying MCP server.

The initial MCP demo will cover three policy types:

- `documents.read` — resource membership
- `email.send` — human approval
- `payments.transfer` — private numeric threshold

The long-term goal is simple: **AI agents should not just claim they followed the rules. They should be able to prove it.**
