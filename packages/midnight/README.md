# @zkmcp/midnight

Midnight/Compact authorization layer for zkMCP.

This package owns the private authorization policy, Compact contract, wallet/network integration, and reusable TypeScript client consumed by the MCP gateway.

## Quick start

From the repository root:

```bash
npm run setup:midnight
npm run demo:gateway
```

Requirements: Node.js 22+, Docker Desktop / Compose, and Compact compiler 0.31.1.

## Compact policy

The current private policy covers:

- configured agent identity
- `documents.read`
- `email.send`
- `payments.transfer`
- one allowed document resource/matter
- private maximum payment amount
- private payment approval threshold
- replay protection through fresh nonce-derived nullifiers

Only a salted policy commitment is pinned publicly at deployment.

Every authorization recomputes that commitment inside the ZK circuit before checking the appropriate tool-policy branch.

## Reusable client

The package exports:

```ts
import { createMidnightAuthorizationClient } from "@zkmcp/midnight";

const client = await createMidnightAuthorizationClient();

const receipt = await client.authorize({
  agent: "LegalAgent",
  tool: "documents.read",
  resource: "matter:thompson",
});

await client.close();
```

The client generates the nonce itself, submits the Compact call, maps failures to typed zkMCP errors, and returns only public receipt material.

Deployment, wallet-cache, and private-state paths are anchored to this package, so the client works when consumed from another workspace such as `@zkmcp/gateway`.

## Local private state

The policy is stored locally in:

```text
.zkmcp-policy.json
```

It is gitignored and written with user-only permissions. Wallet/network/private-state files and local LevelDB data are also ignored.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run compile` | Compile the Compact authorization contract |
| `npm run build` | Run TypeScript type checking |
| `npm run setup` | Start local Midnight services, compile, and deploy |
| `npm run demo:authorization` | Run the direct multi-tool Midnight authorization suite |
| `npm run test:e2e` | Alias for the direct authorization suite |
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

The workspace pins:

```json
"overrides": {
  "@midnight-ntwrk/onchain-runtime-v3": "3.0.0"
}
```

Without the override, the current dependency graph can install `onchain-runtime-v3` 3.1.0 under `compact-runtime` while Midnight.js 4.1.1 uses 3.0.0. That creates two WASM `StateValue` class identities and contract calls fail with `expected instance of StateValue` even though compile/deploy/read operations succeed.

The override forces one runtime instance and is covered by the real authorization runs.

## Documentation

- [`../../docs/phase1-proof-model.md`](../../docs/phase1-proof-model.md) — proof/privacy model
- [`../../docs/phase2-mcp-gateway.md`](../../docs/phase2-mcp-gateway.md) — MCP integration
