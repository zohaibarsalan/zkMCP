# Phase 2: MCP authorization gateway

Phase 2 turns the Phase 1 Compact authorization primitive into an actual MCP execution boundary.

## End-to-end path

```text
AI / MCP client
      │
      │ tools/list, tools/call
      ▼
┌───────────────────────────┐
│        zkMCP Gateway      │
│                           │
│  1. normalize tool call   │
│  2. verify approval meta  │
│  3. request ZK auth       │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│    Midnight / Compact     │
│                           │
│ private policy witness    │
│ deterministic constraints │
│ proof + transaction       │
└─────────────┬─────────────┘
              │
        authorized?
          /       \
        no         yes
        │           │
        ▼           ▼
 MCP error      upstream MCP server
 tool untouched       │
                      ▼
                  tool executes
                      │
                      ▼
               MCP tool result
               + public zkMCP
                 receipt in _meta
```

The gateway uses the official `@modelcontextprotocol/server` and `@modelcontextprotocol/client` v2 packages. The current stdio entry point uses the SDK's explicit legacy/2025 protocol negotiation mode for compatibility with the normal request/response MCP handshake. The gateway itself remains built on the current v2 SDK APIs.

## Tool policy classes

The private Compact policy currently covers three sensitive tool classes.

### `documents.read`

The gateway derives the resource fact from the tool's `matterId` argument.

The Compact circuit proves that the requested matter matches the private allowed resource.

```text
matter:thompson       -> authorized
matter:unrelated      -> denied
```

The matter identifier is not written to public Midnight ledger state or observability events.

### `email.send`

External email requires a trusted approval signal.

The agent cannot authorize itself by including `approved: true` in ordinary tool arguments. Approval is supplied through MCP request metadata under:

```text
io.zkmcp/approval-token
```

The gateway verifies this token before converting it into the private boolean consumed by Compact. The approval token is not forwarded to the upstream tool and is covered by the logging redaction policy.

The current fixed-token verifier is deliberately a demo primitive. A production implementation should replace it with an approval issuer or signed, scoped, expiring capability.

### `payments.transfer`

The gateway converts the integer `amount` argument into the private numeric fact consumed by Compact.

The private policy currently demonstrates:

```text
max payment              = private
approval threshold       = private
requested amount         = private
approval state           = private
```

The circuit enforces both the maximum and the approval threshold without publishing those values.

## MCP behavior

### `tools/list`

`tools/list` is transparently proxied to the upstream MCP server. zkMCP caches output schemas so returned tool results can still be projected correctly by the MCP SDK.

### `tools/call`

For every tool call:

1. The configured gateway identity supplies the agent identity. The requesting model cannot override it in tool arguments.
2. zkMCP normalizes relevant MCP arguments into deterministic authorization facts.
3. Trusted approval metadata is verified separately from ordinary tool arguments.
4. A fresh nonce is generated inside the Midnight client.
5. The Compact authorization circuit is executed.
6. If authorization fails, zkMCP returns an MCP `isError` result and never calls the upstream tool.
7. If authorization succeeds, the upstream MCP tool is called.
8. The public authorization receipt is attached to the MCP result metadata.

Successful results include:

```text
io.zkmcp/authorization-receipt
```

with public fields such as:

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

Denied results include privacy-safe metadata under:

```text
io.zkmcp/authorization-error
```

Private policy denials deliberately collapse to:

```text
policy.AUTHORIZATION_DENIED
```

rather than revealing whether the private resource rule, amount rule, approval rule, agent rule, or tool rule failed.

## Reusable Midnight client

`@zkmcp/midnight` now exports `createMidnightAuthorizationClient()`.

The client:

- reconnects to the configured zkMCP contract
- loads the private local policy witness
- owns nonce generation
- serializes authorization transactions so receipt lookup remains ordered
- maps Compact/Midnight failures into typed zkMCP errors
- returns a public authorization receipt
- anchors deployment, wallet, and private-state paths to the Midnight package instead of the caller's current working directory

That last property matters because the client is consumed from `@zkmcp/gateway`, not only from scripts executed inside `packages/midnight`.

## Real Phase 2 validation

The real stdio demonstration uses three nested components:

```text
Phase 2 demo MCP Client
        ↓ stdio
zkMCP Gateway
        ↓ stdio
Demo MCP Tool Server
```

The gateway independently connects to the real Midnight local network and proof server.

The validated suite is:

```text
ALLOW  assigned matter document
DENY   unrelated matter document
DENY   external email without approval
ALLOW  external email with approval
ALLOW  payment below private threshold
DENY   payment that needs approval
ALLOW  payment with human approval
DENY   payment above private maximum
```

Result: **8/8 passed**.

Authorized calls produced real Midnight transaction IDs and only then executed the upstream MCP tool. The protocol-level in-memory test additionally counts upstream executions and asserts that a denied call does not reach the upstream handler.

Proof-server logs independently showed `/prove`, proof creation, proof verification, and successful proof responses during the stdio run.

## Privacy verification

The generated local evlog stream was scanned after the real gateway demo for the demo's raw:

- matter identifiers
- email recipient and subject
- payment recipient
- payment amounts
- approval token
- private policy field names / values
- tool arguments

None appeared.

Authorization events contain only public receipt material and generic denial metadata.

## Running it

First start/deploy Midnight:

```bash
npm run setup:midnight
```

Then run the real MCP gateway demo:

```bash
npm run demo:gateway
```

Stop local Midnight services afterward:

```bash
npm run stop:midnight
```

For an MCP host, the gateway stdio process can wrap another stdio MCP server:

```bash
ZKMCP_AGENT_ID=LegalAgent \
ZKMCP_APPROVAL_TOKEN=<approval-token> \
npm exec --workspace=@zkmcp/gateway -- \
  tsx src/stdio.ts -- <upstream-command> <upstream-args...>
```

The demo upstream is:

```bash
npm run serve:gateway-demo
```

## Current limitations

Phase 2 is a working hackathon infrastructure prototype, not a production authorization service yet.

- The current contract has one immutable private policy per deployment.
- Approval uses a fixed local token verifier for the demo rather than signed/scoped approval capabilities.
- The current gateway proxies MCP tools; resource/prompt proxying is not implemented.
- The three tool normalizers are explicit adapters rather than a general policy DSL.
- Payment values are integer demo units; currency semantics are not modeled yet.
- The current tested deployment is a local Midnight devnet, not a public Midnight network deployment.
- Proof generation on the local stack is intentionally synchronous and adds noticeable latency.
- More work is needed for concurrent authorization throughput, policy rotation, revocation, delegated identities, and production secret storage.

Those are Phase 3+ concerns. Phase 2's target was narrower: prove that a real MCP tool call can be stopped at a cryptographic authorization boundary and only forwarded after a real Midnight proof succeeds. That target is complete.
