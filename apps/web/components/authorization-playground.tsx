"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type DemoStatus,
  type DemoStep,
  type ProofReceipt,
  privatePolicy,
  recordedRun,
  recordedRunMetadata,
} from "@/lib/demo-data";
import {
  getLiveHealth,
  type LiveRunResult,
  runLiveScenario,
} from "@/lib/live-api";

type BackendMode = "checking" | "live" | "recorded";

const relevantPolicyLabels: Record<DemoStep["tool"], readonly string[]> = {
  "documents.read": ["Agent", "Matter scope"],
  "email.send": ["Agent", "External email"],
  "payments.transfer": ["Agent", "Payment ceiling", "Approval threshold"],
};

function shortHex(value: string, edge = 10): string {
  if (value.length <= edge * 2 + 2) {
    return value;
  }
  return `${value.slice(0, edge + 2)}…${value.slice(-edge)}`;
}

function getBackendLabel(mode: BackendMode): string {
  if (mode === "live") {
    return "Live prover ready";
  }
  if (mode === "checking") {
    return "Checking local backend…";
  }
  return "Recorded proof run";
}

function getRunLabel(running: boolean, status: DemoStatus): string {
  if (running) {
    return "Authorizing with Midnight…";
  }
  return status === "authorized"
    ? "Generate a fresh proof"
    : "Test live authorization";
}

function DecisionBadge({ status }: { status: DemoStatus }) {
  const allowed = status === "authorized";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 font-medium text-xs ${
        allowed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
    >
      {allowed ? "Authorized" : "Blocked"}
    </span>
  );
}

function getProcessStepClass(rejected: boolean, stopped: boolean): string {
  if (rejected) {
    return "border-red-500/25 bg-red-500/[0.06]";
  }
  if (stopped) {
    return "border-fd-border bg-fd-background opacity-55";
  }
  return "border-fd-border bg-fd-background";
}

function ProcessRail({ status }: { status: DemoStatus }) {
  const allowed = status === "authorized";
  const steps = [
    ["1", "MCP request", "agent proposes tools/call"],
    ["2", "zkMCP", "normalizes trusted facts"],
    ["3", "Midnight", allowed ? "policy satisfied" : "policy rejected"],
    ["4", "Upstream tool", allowed ? "handler invoked" : "never invoked"],
  ] as const;

  return (
    <div className="grid gap-2 md:grid-cols-4">
      {steps.map(([number, title, detail], index) => {
        const stopped = !allowed && index === 3;
        const rejected = !allowed && index === 2;
        return (
          <div
            className={`rounded-lg border px-3 py-2.5 ${getProcessStepClass(
              rejected,
              stopped
            )}`}
            key={number}
          >
            <div className="text-[10px] text-fd-muted-foreground">{number}</div>
            <div className="mt-1 font-medium text-sm">{title}</div>
            <div className="mt-0.5 text-fd-muted-foreground text-xs">
              {detail}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Receipt({ receipt, live }: { live: boolean; receipt: ProofReceipt }) {
  const commitmentRows = [
    ["Policy commitment", receipt.policyCommitment],
    ["Execution commitment", receipt.executionCommitment],
    ["Nullifier", receipt.nullifier],
  ] as const;
  const transactionRows = [
    ["Transaction", receipt.transactionId],
    ["Contract", receipt.contractAddress],
    ["Network", receipt.network],
  ] as const;

  return (
    <section className="rounded-xl border border-fd-border bg-fd-background">
      <div className="flex items-center justify-between gap-3 border-fd-border border-b px-4 py-3">
        <div>
          <div className="font-medium text-sm">
            Public authorization receipt
          </div>
          <div className="mt-0.5 text-fd-muted-foreground text-xs">
            Evidence exposed after successful authorization.
          </div>
        </div>
        <span className="rounded-md border border-fd-border px-2 py-1 font-mono text-[10px] text-fd-muted-foreground">
          {live ? "LIVE" : "RECORDED"}
        </span>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="divide-y divide-fd-border rounded-lg border border-fd-border">
          {commitmentRows.map(([label, value]) => (
            <div className="px-3 py-2.5" key={label}>
              <div className="text-[11px] text-fd-muted-foreground">
                {label}
              </div>
              <code
                className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs"
                title={value}
              >
                {shortHex(value)}
              </code>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="divide-y divide-fd-border rounded-lg border border-fd-border">
            {transactionRows.map(([label, value]) => (
              <div
                className="flex items-center justify-between gap-3 px-3 py-2"
                key={label}
              >
                <span className="text-[11px] text-fd-muted-foreground">
                  {label}
                </span>
                <code className="max-w-[65%] truncate text-xs" title={value}>
                  {label === "Network" ? value : shortHex(value, 7)}
                </code>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-fd-border px-3 py-2">
              <div className="text-[11px] text-fd-muted-foreground">Block</div>
              <div className="mt-1 font-mono text-sm">
                #{receipt.blockHeight}
              </div>
            </div>
            <div className="rounded-lg border border-fd-border px-3 py-2">
              <div className="text-[11px] text-fd-muted-foreground">
                Authorization time
              </div>
              <div className="mt-1 font-mono text-sm">
                {(receipt.proofDurationMs / 1000).toFixed(1)}s
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuthorizationPlayground() {
  const [backendMode, setBackendMode] = useState<BackendMode>("checking");
  const [selectedId, setSelectedId] = useState("payment-allowed");
  const [liveResults, setLiveResults] = useState<Record<string, LiveRunResult>>(
    {}
  );
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string>();

  useEffect(() => {
    getLiveHealth()
      .then((health) => setBackendMode(health.ready ? "live" : "recorded"))
      .catch(() => setBackendMode("recorded"));
  }, []);

  const step = useMemo(
    () => recordedRun.find((item) => item.id === selectedId) ?? recordedRun[0],
    [selectedId]
  );
  const liveResult = liveResults[selectedId];
  const { status: recordedStatus } = step;
  let status: DemoStatus = recordedStatus;
  if (liveResult) {
    status = liveResult.isError ? "denied" : "authorized";
  }
  const receipt = liveResult?.receipt ?? step.receipt;
  const relevantLabels = relevantPolicyLabels[step.tool];
  const relevantPolicy = privatePolicy.filter((rule) =>
    relevantLabels.includes(rule.label)
  );

  const handleScenarioChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setSelectedId(event.target.value);
      setRunError(undefined);
    },
    []
  );

  const handleLiveRun = useCallback(async () => {
    setRunning(true);
    setRunError(undefined);
    try {
      const result = await runLiveScenario(step.id);
      setLiveResults((current) => ({ ...current, [step.id]: result }));
    } catch {
      setRunError(
        "The local zkMCP backend could not complete this authorization request."
      );
    } finally {
      setRunning(false);
    }
  }, [step.id]);

  return (
    <div className="zkmcp-playground overflow-hidden rounded-xl border border-fd-border bg-fd-card text-fd-card-foreground">
      <div className="flex flex-col gap-4 border-fd-border border-b p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="font-medium text-[11px] text-fd-muted-foreground uppercase tracking-[0.14em]">
            Authorization playground
          </div>
          <div className="mt-1 font-semibold text-lg tracking-[-0.02em]">
            Inspect one protected action at a time
          </div>
          <div className="mt-1 max-w-2xl text-fd-muted-foreground text-sm">
            The request and private policy stay on the left side of the trust
            boundary. The decision and public receipt show what a verifier can
            learn.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            aria-label="Authorization scenario"
            className="min-w-72 rounded-lg border border-fd-border bg-fd-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-fd-ring"
            onChange={handleScenarioChange}
            value={selectedId}
          >
            {recordedRun.map((item) => (
              <option key={item.id} value={item.id}>
                {item.group} — {item.label}
              </option>
            ))}
          </select>
          <span className="whitespace-nowrap rounded-lg border border-fd-border bg-fd-background px-3 py-2 text-fd-muted-foreground text-xs">
            {getBackendLabel(backendMode)}
          </span>
        </div>
      </div>

      <div className="space-y-5 p-4 md:p-5">
        <ProcessRail status={status} />

        <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-xl border border-fd-border bg-fd-background">
            <div className="flex items-center justify-between gap-3 border-fd-border border-b px-4 py-3">
              <div>
                <div className="font-medium text-sm">Private request</div>
                <div className="mt-0.5 text-fd-muted-foreground text-xs">
                  Application values known to the gateway/prover.
                </div>
              </div>
              <code className="rounded-md border border-fd-border bg-fd-card px-2 py-1 text-xs">
                {step.tool}
              </code>
            </div>

            <div className="divide-y divide-fd-border px-4">
              {step.requestFields.map((field) => (
                <div
                  className="grid gap-1 py-2.5 sm:grid-cols-[9rem_1fr]"
                  key={field.label}
                >
                  <span className="text-fd-muted-foreground text-xs">
                    {field.label}
                  </span>
                  <code className="break-words text-xs sm:text-right">
                    {field.value}
                  </code>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-fd-border bg-fd-background">
            <div className="border-fd-border border-b px-4 py-3">
              <div className="font-medium text-sm">
                Relevant private constraints
              </div>
              <div className="mt-0.5 text-fd-muted-foreground text-xs">
                Only the policy rules used by this scenario are shown here.
              </div>
            </div>

            <div className="divide-y divide-fd-border px-4">
              {relevantPolicy.map((rule) => (
                <div
                  className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr]"
                  key={rule.label}
                >
                  <div>
                    <div className="text-fd-muted-foreground text-xs">
                      {rule.label}
                    </div>
                    <code className="mt-0.5 block text-xs">{rule.value}</code>
                  </div>
                  <div className="text-fd-muted-foreground text-xs sm:text-right">
                    {rule.note}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-fd-border border-t px-4 py-3 text-fd-muted-foreground text-xs">
              Committed policy:{" "}
              <code>{shortHex(recordedRunMetadata.policyCommitment, 8)}</code>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-fd-border bg-fd-background">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2">
                <div className="font-medium text-sm">
                  Authorization decision
                </div>
                <DecisionBadge status={status} />
              </div>
              <p className="mt-2 text-sm">{step.policyCheck}</p>
              <p className="mt-1 text-fd-muted-foreground text-xs">
                {step.resultSummary}
              </p>
            </div>

            <div className="w-full sm:w-64">
              <button
                className="w-full rounded-lg border border-fd-primary bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground text-sm disabled:cursor-not-allowed disabled:opacity-45"
                disabled={backendMode !== "live" || running}
                onClick={handleLiveRun}
                type="button"
              >
                {getRunLabel(running, status)}
              </button>
              <div className="mt-1.5 text-center text-[11px] text-fd-muted-foreground">
                {backendMode === "live"
                  ? "Allowed calls generate a new local proof and transaction."
                  : "Start npm run demo:ui to enable fresh local proofs."}
              </div>
              {runError ? (
                <div className="mt-2 text-center text-red-500 text-xs">
                  {runError}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {receipt ? (
          <Receipt live={Boolean(liveResult)} receipt={receipt} />
        ) : (
          <section className="rounded-xl border border-red-500/20 bg-red-500/[0.035] p-4">
            <div className="font-medium text-sm">
              No authorization receipt was committed
            </div>
            <p className="mt-1 max-w-3xl text-fd-muted-foreground text-xs">
              The private authorization path rejected the request. The upstream
              MCP handler was not invoked, so there is no successful
              authorization transaction to inspect.
            </p>
          </section>
        )}

        <details className="rounded-xl border border-fd-border bg-fd-background">
          <summary className="cursor-pointer px-4 py-3 font-medium text-sm">
            Values not exposed on the public ledger ({step.hiddenFields.length})
          </summary>
          <div className="flex flex-wrap gap-2 border-fd-border border-t px-4 py-3">
            {step.hiddenFields.map((field) => (
              <span
                className="rounded-md border border-fd-border bg-fd-card px-2 py-1 text-[11px] text-fd-muted-foreground"
                key={field}
              >
                {field}
              </span>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
