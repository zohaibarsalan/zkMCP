# Devpost gallery

Upload the PNGs in this order. The screenshots are intentionally captured from the real Fumadocs developer portal at 1600×900.

## 1. `01-architecture.png`

**Title:** zkMCP authorization architecture

**Caption:** Every protected MCP `tools/call` crosses zkMCP before execution. The gateway normalizes the requested action, proves the private authorization policy with Midnight/Compact, and only then invokes the upstream MCP tool.

## 2. `02-authorized-payment.png`

**Title:** Private payment policy → public proof receipt

**Caption:** A £2,750 transfer satisfies a private £5,000 hard maximum and £4,000 approval threshold. The action is authorized and returns a Midnight receipt while the constrained policy/request values remain private. This screenshot uses the final verified proof run.

## 3. `03-blocked-payment.png`

**Title:** Denied before the payment tool executes

**Caption:** Even with trusted approval present, an £8,000 transfer exceeds the private hard maximum. Midnight rejects the authorization, no successful receipt is committed, and the upstream MCP payment handler is never invoked.

## 4. `04-privacy-model.png`

**Title:** What stays private vs what becomes public

**Caption:** zkMCP explicitly separates private witness/request data from public authorization evidence. Policy values, amounts, thresholds, approval context, prompts, and nonces are not raw public ledger fields; commitments, nullifiers, and transaction evidence are.

## Recommended gallery order

Keep the architecture first, then show one allow state, one deny state, and finish with the privacy model. That tells the story without requiring judges to read the entire project description first.
