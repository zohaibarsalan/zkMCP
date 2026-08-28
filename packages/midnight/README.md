# zkMCP Midnight package

This package contains the Phase 1 zero-knowledge authorization contract and the local Midnight development environment used by zkMCP.

## Quick start

```bash
npm install
npm run setup
npm run demo:authorization
```

Requirements: Node.js 22+, Docker Desktop / Compose, and Compact compiler 0.31.1.

## What `setup` does

1. Starts a local Midnight node, indexer, and proof server with Docker Compose.
2. Compiles `contracts/authorization.compact`.
3. Creates a local private policy if one does not already exist.
4. Deploys the contract with a commitment to that policy.

The private policy is stored in `.zkmcp-policy.json`, which is gitignored and created with user-only file permissions. Wallet/network/private-state files are also gitignored.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run compile` | Compile the Compact authorization contract |
| `npm run build` | Run TypeScript type checking |
| `npm run setup` | Start local Midnight services, compile, and deploy |
| `npm run demo:authorization` | Run the six-case Phase 1 authorization demo |
| `npm run test:e2e` | Alias for the Phase 1 authorization demo/suite |
| `npm run check-balance` | Inspect local Midnight wallet balances |
| `npm run proof-server:start` | Start Compose services |
| `npm run proof-server:stop` | Stop Compose services |
| `npm run clean` | Remove generated contract/network/wallet state |

## Local services

| Service | Port | Image |
| --- | ---: | --- |
| Midnight node | 9944 | `midnightntwrk/midnight-node:1.0.0` |
| Indexer | 8088 | `midnightntwrk/indexer-standalone:4.3.3` |
| Proof server | 6300 | `midnightntwrk/proof-server:8.1.0` |

## Dependency compatibility note

The package pins:

```json
"overrides": {
  "@midnight-ntwrk/onchain-runtime-v3": "3.0.0"
}
```

Without this override, the current dependency graph can install `onchain-runtime-v3` 3.1.0 under `compact-runtime` while Midnight.js 4.1.1 uses 3.0.0. That creates two WASM `StateValue` class identities and contract calls fail with `expected instance of StateValue` even though compile/deploy/read operations succeed.

The override forces one runtime instance and is covered by the end-to-end authorization suite.

## Privacy model

See [`../../docs/phase1-proof-model.md`](../../docs/phase1-proof-model.md).
