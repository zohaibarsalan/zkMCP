# @zkmcp/gateway

MCP tool-call gateway backed by the zkMCP Midnight authorization contract.

## What it does

```text
MCP client
   ↓ tools/call
zkMCP gateway
   ↓ normalize action
Midnight / Compact proof
   ↓ authorized
upstream MCP server
```

A denied action returns an MCP error result before the upstream tool handler is called. An authorized action executes upstream and receives a public zkMCP authorization receipt in MCP result `_meta`.

## Demo

From the repository root, start the Midnight devnet/deployment first:

```bash
npm run setup:midnight
```

Then run the complete stdio demo:

```bash
npm run demo:gateway
```

The demo validates document-resource membership, email approval, and payment-limit policies through real MCP requests and real Midnight proofs.

## Wrapping another stdio MCP server

The gateway entry point accepts an upstream command after `--`:

```bash
ZKMCP_AGENT_ID=LegalAgent \
ZKMCP_APPROVAL_TOKEN=<approval-token> \
npm exec --workspace=@zkmcp/gateway -- \
  tsx src/stdio.ts -- <upstream-command> <upstream-args...>
```

`tools/list` is forwarded transparently. `tools/call` is intercepted and authorized before forwarding.

## Metadata

Trusted demo approval input:

```text
io.zkmcp/approval-token
```

Successful result receipt:

```text
io.zkmcp/authorization-receipt
```

Denied result metadata:

```text
io.zkmcp/authorization-error
```

Private-policy denials are intentionally reported generically as `policy.AUTHORIZATION_DENIED` so observability and client responses do not reveal which private rule failed.

See [`../../docs/phase2-mcp-gateway.md`](../../docs/phase2-mcp-gateway.md) for the architecture, privacy boundary, validation evidence, and current limitations.
