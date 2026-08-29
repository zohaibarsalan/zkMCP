# zkMCP demo video — live beat sheet

Target: **under 2 minutes**. This is a screen/talking-point guide, not a memorized script.

## Before recording

- Start with `npm run demo:recording` and wait until the local demo API is ready.
- Open `https://zkmcp.zohaibarsalan.me/docs/playground?live=local`. The explicit query parameter makes the hosted docs use the proof backend on your own machine; ordinary visitors remain in recorded mode.
- Keep a terminal with the Midnight proof-server logs available in another window/tab.
- Use the docs in dark mode.
- Have the hosted `/docs`, `/docs/architecture`, and `/docs/playground?live=local` tabs ready.
- The hackathon requires the video to identify the **Midnight Hackathon** at the beginning.
- Do not claim Preprod/public-chain deployment. The fully verified run is the local Midnight `undeployed` environment.

## 0:00–0:10 — identify project + problem

**Screen:** Introduction or Architecture.

Hit these points:

- “Midnight Hackathon 2026 — this is zkMCP.”
- MCP lets agents reach powerful tools; access is not the same thing as authority for every individual action.
- zkMCP is the cryptographic permission boundary between the agent and MCP server.

Do not spend time explaining generic MCP history.

## 0:10–0:28 — show the architecture

**Screen:** `/docs/architecture`.

Point at the flow:

```text
AI agent / MCP client
→ zkMCP
→ normalized authorization facts
→ Midnight / Compact
→ allow or deny
→ upstream MCP tool only after allow
```

Key message:

- The model itself is not being ZK-proven.
- zkMCP proves the smaller deterministic authorization statement around the action the model is trying to take.

## 0:28–0:42 — prove pre-execution blocking quickly

**Screen:** `/docs/playground` → `Payments — Transfer above maximum`.

Run the live authorization.

Point out:

- request = £8,000
- trusted approval is present
- private hard maximum is still authoritative
- result = **Blocked**
- upstream tool = **never invoked**
- no successful authorization receipt exists

This is fast, so use it to establish the fail-closed property before the slower live proof.

## 0:42–1:18 — generate one real live proof

**Screen:** switch to `Payments — Transfer below limit` and click **Generate a fresh proof**.

The successful local proof can take around 20–30 seconds. Do not leave dead air. While the button is running, explain the interface:

- left: private request known to gateway/prover
- private policy: £5,000 hard maximum and £4,000 approval threshold
- these raw values do not need to be published on the ledger
- Compact binds the private witness to the committed policy
- the gateway cannot invoke the upstream tool until authorization finalizes

Briefly switch/show the proof-server terminal if it is clean enough:

```text
Starting to process request for /prove...
proof created; verifying to make sure
proof ok
```

Then return to the browser before the result appears.

## 1:18–1:38 — inspect the fresh receipt

When the live result appears, point out only the important fields:

- `policyCommitment`
- `executionCommitment`
- `nullifier`
- fresh transaction ID
- block height

Then contrast them with the private values.

Key idea:

> The verifier gets evidence that authorization happened without needing the private rule or raw action data as public ledger fields.

Do not read hashes aloud.

## 1:38–1:52 — human approval / generality

Either switch to the email example or mention it while staying in the playground:

- `documents.read` proves resource membership
- `email.send` uses a trusted approval signal outside normal agent arguments
- `payments.transfer` proves private numeric constraints

Important detail if you show email:

- the agent cannot self-authorize by writing `approved: true`; trusted approval is resolved separately by the gateway.

## 1:52–2:00 — finish

Return to the architecture or receipt.

Land on three ideas:

- existing MCP tools do not need to become blockchain applications
- zkMCP sits in front of them as an authorization boundary
- “AI agents shouldn’t just claim they followed the rules. They should be able to prove it.”

Stop. Do not use the last seconds for roadmap/features.

## Recording priorities

If time runs long, cut in this order:

1. reduce the human-approval section
2. reduce architecture explanation
3. never cut the live proof or blocked-before-execution example

The live allow + live deny are the strongest evidence in the video.
