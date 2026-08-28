# Phase 1 proof model

Phase 1 establishes the cryptographic primitive that zkMCP will place in front of MCP tool calls.

## Claim proved

For every committed authorization transaction, Midnight proves that the private request satisfies the exact private policy whose commitment was pinned when the contract was deployed.

The Phase 1 policy constrains:

- agent identity
- tool identity
- maximum numeric amount
- a human-approval threshold
- one-time execution via a nonce-derived nullifier

## Private policy

The local witness provides:

```text
Policy {
  secret
  allowedAgent
  allowedTool
  maxAmount
  approvalThreshold
}
```

`secret` is a random 32-byte value. The remaining fields are policy rules.

The contract constructor computes a domain-separated `persistentHash` over the complete policy and writes only that hash to the sealed public `policyCommitment` ledger field.

Because every later call recomputes the commitment inside the circuit and asserts equality with the sealed ledger commitment, a prover cannot replace the user's policy with an easier policy just before requesting authorization.

## Private request

`authorize` receives:

```text
requestAgent
requestTool
requestAmount
approved
nonce
```

These values are circuit inputs. zkMCP does not disclose them directly to ledger state.

The circuit enforces:

```text
hash(privatePolicy) == committedPolicy
requestAgent == policy.allowedAgent
requestTool == policy.allowedTool
requestAmount <= policy.maxAmount
requestAmount <= policy.approvalThreshold OR approved == true
nullifier(policy.secret, nonce) has not already been consumed
```

If any condition fails, the authorization circuit aborts and no authorization receipt is committed.

## Public receipt

A successful authorization discloses only:

```text
policyCommitment
executionCommitment
nullifier
```

The execution commitment is a domain-separated hash over the committed policy and the private request. The random 32-byte nonce prevents otherwise-identical requests from producing a trivially guessable preimage.

The nullifier is a domain-separated hash of the policy secret and nonce. It is inserted into a public set exactly once. Reusing the same execution nonce fails the circuit.

The contract also exposes an authorization counter and the most recent execution commitment/nullifier for the Phase 1 demo.

## What the chain does not receive

The ledger schema contains no fields for:

- raw policy secret
- allowed agent
- allowed tool
- maximum amount
- approval threshold
- requested amount
- approval flag
- raw nonce

Only commitments, nullifiers, and receipt metadata are deliberately disclosed.

## Demo cases

`npm run demo:authorization` exercises six cases against a live local Midnight node and proof server:

| Case | Expected |
| --- | --- |
| Correct agent/tool, 2,750, no approval | authorized |
| Correct agent/tool, 8,000 | denied |
| 4,500 without approval | denied |
| 4,500 with approval | authorized |
| Wrong agent | denied |
| Replay first successful nonce | denied |

Successful cases generate real Midnight proofs and land on the local chain. Denied cases fail the constrained authorization path and do not increment the authorization counter.

## Current limitation

Phase 1 intentionally pins one immutable policy per contract deployment. Policy rotation, multiple agents/tools per policy, delegated capabilities, and the MCP gateway are later phases.

This phase proves the primitive first: **a private rule set can be committed once and later opened inside a ZK circuit to authorize an action without publishing the rule set itself.**
