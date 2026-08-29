# Phase 1 proof model

Phase 1 established the cryptographic primitive zkMCP now uses in front of MCP tool calls: a private policy is committed once, reopened through a private witness during authorization, and enforced inside a Compact circuit without publishing the policy rules.

The Phase 1 checkpoint began with one payment-style tool and private numeric/approval constraints. Phase 2 kept the same proof model and expanded the live contract to three MCP tool classes. This document describes the proof model as it exists now; the Phase 2 MCP integration is documented separately in [`phase2-mcp-gateway.md`](phase2-mcp-gateway.md).

## Claim proved

For every committed authorization transaction, Midnight proves that the private request satisfied the exact private policy whose commitment was pinned when the contract was deployed.

The current policy constrains:

- agent identity
- allowed tool class
- document resource membership
- email human approval
- private payment maximum
- private payment approval threshold
- one-time execution through a nonce-derived nullifier

## Private policy

The local witness provides:

```text
Policy {
  secret
  allowedAgent
  documentsTool
  emailTool
  paymentsTool
  allowedResource
  maxPaymentAmount
  paymentApprovalThreshold
}
```

`secret` is a random 32-byte value. The remaining fields are private policy rules or private digests of policy identifiers.

The constructor computes a domain-separated `persistentHash` over the complete policy and writes only that hash to the sealed public `policyCommitment` ledger field.

Because every later authorization recomputes the commitment inside the circuit and asserts equality with the sealed ledger commitment, a prover cannot replace the user's policy with an easier one immediately before requesting authorization.

## Private request

`authorize` receives circuit inputs representing:

```text
requestAgent
requestTool
requestResource
requestAmount
approved
nonce
```

They are not disclosed directly into ledger fields.

The circuit first enforces:

```text
hash(privatePolicy) == committedPolicy
requestAgent == policy.allowedAgent
requestTool is one of the private allowed tool digests
```

It then selects the relevant private policy branch.

### Documents

```text
requestTool == documents.read
requestResource == policy.allowedResource
```

### Email

```text
requestTool == email.send
approved == true
```

### Payments

```text
requestTool == payments.transfer
requestAmount <= policy.maxPaymentAmount
requestAmount <= policy.paymentApprovalThreshold OR approved == true
```

Finally, every successful branch requires:

```text
nullifier(policy.secret, nonce) has not already been consumed
```

If any constraint fails, the authorization circuit aborts and no successful authorization receipt is committed.

## Public receipt

A successful authorization exposes public receipt material derived from:

```text
policyCommitment
executionCommitment
nullifier
```

The surrounding Midnight transaction also gives zkMCP a transaction ID, block height, contract address, and network identifier that can be returned to an MCP client.

The execution commitment is a domain-separated hash over the committed policy and private request. The nonce keeps otherwise-identical executions distinct.

The nullifier is a domain-separated hash of the policy secret and nonce. It is inserted into a public set exactly once, preventing reuse of the same authorization context.

## What the chain does not receive as raw ledger fields

The authorization ledger schema has no raw fields for:

- policy secret
- allowed agent identifier
- allowed tool identifiers
- allowed matter/resource identifier
- maximum payment amount
- approval threshold
- requested payment amount
- approval flag
- raw nonce
- prompt
- arbitrary MCP tool arguments

Only deliberately disclosed commitments/nullifiers and normal transaction metadata are public.

## Direct Midnight validation

The current direct Midnight suite exercises all three policy branches:

```text
ALLOW  document in assigned matter
DENY   document in unrelated matter
DENY   external email without approval
ALLOW  external email with approval
ALLOW  payment below private threshold
DENY   payment above private maximum
DENY   payment requiring approval without approval
ALLOW  payment requiring approval with approval
DENY   wrong agent
DENY   unknown tool
```

The validated suite passed **10/10** against the local Midnight node/indexer/proof-server stack. Successful cases generated real proofs and finalized transactions; denied cases failed the constrained authorization path.

## Deliberate current limitation

The current contract still pins one immutable private policy per deployment. Policy rotation, multiple policy versions, delegated agent identities, revocation, and signed approval capabilities are intentionally outside this first primitive.

The important property is already established: **zkMCP can prove that a concrete agent action satisfies a committed private rule set without publishing that rule set.**
