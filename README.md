# zkMCP

A zero-knowledge permission layer for AI agents.

Every MCP tool call must prove it satisfies private user-defined policies before execution — without exposing prompts, data, credentials, or policy rules.

## Why

MCP gives AI agents access to powerful tools, but transport-level authorization alone does not answer whether a specific agent action is allowed in a specific context. zkMCP adds a verifiable authorization layer between the agent and the tool.

## Core flow

```text
AI Agent -> zkMCP Gateway -> Policy Engine -> Midnight ZK Proof -> MCP Tool
```

Private inputs can include policy rules, resource scope, thresholds, approvals, and sensitive context. Public outputs reveal only that the requested action satisfied the committed policy.

## Hackathon

Built for the Midnight Hackathon, August 2026.

## Planned stack

- Midnight Network
- Compact
- Model Context Protocol (MCP)
- TypeScript / Node.js
- Next.js / React
- Zero-knowledge proofs

## Status

Work in progress.
