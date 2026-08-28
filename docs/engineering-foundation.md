# Engineering foundation

This repository uses one shared local engineering foundation before the MCP gateway is introduced.

## Code quality

Formatting and linting are handled by **Ultracite + Biome** from the repository root.

```bash
npm run check
npm run fix
npm run typecheck
npm test
npm run compile:contracts
```

The combined local gate is:

```bash
npm run foundation:check
```

The Biome configuration extends `ultracite/biome/core`. Generated Midnight contract artifacts, wallet state, LevelDB state, and evlog output are excluded.

A small set of rules is relaxed only for the existing Midnight SDK integration layer, where dynamic SDK types and deliberately sequential wallet/prover operations make the generic rule incorrect. Those exceptions live in `biome.jsonc`; they are not disabled repository-wide.

Compact source is still validated by the Compact compiler rather than Biome.

## Typed errors

`packages/core` owns the shared error taxonomy using evlog error catalogs.

Current domains are:

```text
policy
├── AUTHORIZATION_DENIED
├── POLICY_MISMATCH
├── AGENT_NOT_AUTHORIZED
├── TOOL_NOT_AUTHORIZED
├── AMOUNT_EXCEEDS_LIMIT
├── APPROVAL_REQUIRED
└── INVALID_POLICY_STATE

proof
├── GENERATION_FAILED
├── VERIFICATION_FAILED
└── SERVER_UNAVAILABLE

replay
└── NULLIFIER_ALREADY_USED

midnight
├── CONTRACT_UNAVAILABLE
├── TX_SUBMISSION_FAILED
├── INDEXER_UNAVAILABLE
└── INVALID_STATE

gateway
├── INVALID_MCP_REQUEST
└── UPSTREAM_TOOL_FAILED
```

Each error has a stable code, HTTP-compatible status, user-safe message/fix information, and internal `stage` / `retryable` metadata.

Internal diagnostic metadata is not serialized by evlog's client-facing error representation. Raw SDK errors can be retained as `cause` for local debugging while terminal/user output uses `getSafeErrorPresentation()`.

## Local observability with evlog

There is deliberately **no Sentry, Axiom, OTLP, or other remote drain yet**.

`initZkMcpLogger()` configures evlog locally. By default it writes NDJSON events under:

```text
.evlog/logs/
```

For the Midnight package that resolves to `packages/midnight/.evlog/logs/` when run as an npm workspace lifecycle. `.evlog/` is gitignored everywhere.

The Phase 1 demo emits one wide event for each authorization attempt. A successful local event contains data such as:

```json
{
  "operation": "authorization",
  "result": "authorized",
  "network": "undeployed",
  "authorization": {
    "policyCommitment": "0x...",
    "proofDurationMs": 1234
  },
  "midnight": {
    "transactionId": "00...",
    "blockHeight": 12
  }
}
```

## Logging privacy boundary

Logging is treated as part of the authorization security boundary, not as a debug escape hatch.

The shared logger redacts sensitive paths including:

- policy secrets and private keys
- wallet seeds and mnemonics
- witnesses and private state
- prompts
- MCP tool arguments
- authorization context
- amounts and private thresholds
- raw nonces
- passwords/tokens

More importantly, typed log schemas only expose fields that are expected to be safe, such as commitments, transaction IDs, block heights, public contract addresses, timing, and generic authorization results.

Detailed private policy denial reasons are **not written to logs**. For example, the application may internally distinguish `AMOUNT_EXCEEDS_LIMIT` from `APPROVAL_REQUIRED`, but `getPrivacySafeErrorMetadata()` collapses either to:

```text
policy.AUTHORIZATION_DENIED
```

This avoids leaking the shape of a private policy through observability metadata.

## Verification

The foundation is covered by local tests for:

- stable typed error codes and retryability metadata
- non-serialization of internal error diagnostics
- privacy-safe policy error collapsing
- evlog field redaction before emit
- evlog filesystem drain redaction
- authorization logger allowlisted fields

The Midnight end-to-end suite is then run separately with Docker to confirm the observability/error changes do not alter proof behavior:

```bash
npm run setup --workspace=@zkmcp/midnight
npm run test:e2e
```

The current E2E test still proves all six Phase 1 authorization cases against a real local Midnight node/indexer/proof-server stack.
