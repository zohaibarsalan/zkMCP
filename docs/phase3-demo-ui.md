# Phase 3 — judge-facing demo UI

Phase 3 turns the working zkMCP authorization infrastructure into a demo that can be understood before a judge has to read the implementation.

## Goal

The demo should make one security property obvious:

> An AI agent can request a sensitive MCP action, but the upstream tool executes only after Midnight proves the action satisfies the committed private policy.

The UI is intentionally not a generic admin dashboard. It is a proof/execution console built around the authorization boundary.

## Run it

Requirements remain the same as the Midnight package: Node.js 22+, Docker/Compose, and Compact compiler 0.31.1.

From the repository root:

```bash
npm install
npm run demo:ui
```

`demo:ui` performs the complete local setup before launching the UI:

1. starts the local Midnight node, indexer, and proof server
2. compiles the Compact authorization contract
3. deploys the committed private policy
4. starts the local zkMCP demo API on `127.0.0.1:8787`
5. starts the Next.js demo on `http://localhost:4545`

If Midnight is already configured and running, skip redeployment with:

```bash
npm run demo:ui:start
```

Stop the UI with Ctrl+C and stop the Midnight containers with:

```bash
npm run stop:midnight
```

## Two demo modes

The interface deliberately supports two modes.

### Recorded proof run

The page always contains an authentic recorded Phase 2 execution trace. The receipt values shown in this mode were captured from actual local Midnight transactions, not generated UI placeholders.

This lets the page communicate the complete product story immediately even when the local prover is not running.

The recorded trace covers:

- assigned matter read → authorized
- unrelated matter read → blocked
- external email without approval → blocked
- external email after approval → authorized
- payment below private threshold → authorized
- payment requiring approval without approval → blocked
- payment after human approval → authorized
- payment above the private maximum → blocked

### Live proof mode

When the local demo API is reachable, the header changes to **Live backend ready** and the selected trace item exposes a live action button.

For an allowed action, the browser triggers the following real path:

```text
Next.js UI
   │ scenario id only
   ▼
local demo API
   │
   ▼
real MCP Client
   │ tools/call
   ▼
zkMCP Gateway
   │
   ▼
MidnightAuthorizationClient
   │
   ▼
Compact authorization circuit
   │
   ▼
Midnight proof server + local chain
   │
   ├── denied -> MCP isError; upstream never executes
   │
   └── allowed -> transaction finalizes
                    │
                    ▼
               upstream MCP tool
                    │
                    ▼
           result + public receipt
                    │
                    ▼
              browser inspector
```

A successful live action replaces the recorded receipt in the inspector with the newly generated transaction, block height, execution commitment, nullifier, contract address, and proof duration. The inspector marks this state as **LIVE**.

Denied live actions show no receipt because no authorization transaction is committed and the upstream handler is not invoked.

## Trusted approval boundary

The browser never receives the demo approval token.

For the two UI scenarios that represent a trusted human approval, the local demo API chooses the approval context server-side. That context is then carried into MCP metadata and verified by the gateway before Compact receives the private approval boolean.

The agent-controlled tool arguments therefore cannot grant approval by adding an `approved: true` field.

The fixed token remains a hackathon adapter. Production should replace it with a signed, scoped, expiring approval capability.

## Privacy inspector

The right-hand panel is labelled **What Midnight exposed** rather than implying that the prover never processes private witness data.

For authorized actions it shows only public receipt information:

```text
policy commitment
execution commitment
nullifier
transaction id
contract address
block height
proof duration
```

The panel separately lists information that is not exposed on the ledger, including context relevant to the selected action such as:

```text
agent identity
matter/resource identifier
raw tool arguments
email recipient/content
payment amount
private maximum
approval threshold
approval token/state
```

Private denial reasons also remain collapsed to `policy.AUTHORIZATION_DENIED` rather than exposing which hidden constraint failed.

## Recorded evidence vs live evidence

The UI keeps these states visually distinct:

- header badge: recorded chain run vs live backend ready
- receipt source: recorded by default
- **LIVE** marker after a selected scenario is rerun successfully or denied through the live backend

Recorded receipts make the demo fast. Live reruns make the claim independently testable.

## Latency

Allowed actions on the current local proving stack generally take roughly 20–30 seconds because proof generation and transaction finalization are synchronous.

Denied private constraints usually fail in roughly 100–200 ms because they do not proceed to a successful proof/transaction.

The UI communicates this before the user launches a live proof so the delay does not look like a broken interface.

## Local-dev reliability fix

Phase 3 exposed a local network lifecycle bug: persisted wallet sync state from a previous `undeployed` chain can be ahead of a newly restarted local chain and cause wallet synchronization to wait indefinitely.

The Midnight client/deployer now disable wallet-state restore on the ephemeral `undeployed` network while retaining restore behavior for preview/preprod networks. The deterministic genesis wallet still provides the same local identity, but each local run syncs against the actual current chain.

## Frontend stack

- Next.js 16.3.3
- React 19.2.8
- Tailwind CSS 4.3.3
- lucide-react
- TypeScript
- Ultracite + Biome

The web app deliberately does not import the Midnight wallet/proving SDK. The local demo API owns that dependency graph and exposes only privacy-safe demo responses to the browser.

## Validated Phase 3 behavior

Phase 3 was validated through the browser against the live local backend:

- UI detects the live backend and changes state
- recorded trace renders without Midnight running
- live allowed payment produces a new Midnight transaction and receipt
- live over-limit payment is blocked with no receipt
- live result replaces the recorded receipt in the inspector
- no browser console/network errors remain after the final reload
- repo-wide Ultracite/Biome, TypeScript, unit tests, Compact compilation, and Next.js production build pass

The demo now makes the infrastructure visible without turning the cryptographic claims into UI fiction.
