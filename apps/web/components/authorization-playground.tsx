"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type DemoStatus,
  type ProofReceipt,
  privatePolicy,
  recordedRun,
} from "@/lib/demo-data";
import {
  getLiveHealth,
  type LiveRunResult,
  runLiveScenario,
} from "@/lib/live-api";

type BackendMode = "checking" | "live" | "recorded";

function shortHex(value: string, edge = 8): string {
  if (value.length <= edge * 2 + 2) {
    return value;
  }
  return `${value.slice(0, edge + 2)}…${value.slice(-edge)}`;
}

function Receipt({ receipt, live }: { live: boolean; receipt: ProofReceipt }) {
  const rows = [
    ["Policy commitment", shortHex(receipt.policyCommitment)],
    ["Execution commitment", shortHex(receipt.executionCommitment)],
    ["Nullifier", shortHex(receipt.nullifier)],
    ["Transaction", shortHex(receipt.transactionId)],
    ["Contract", shortHex(receipt.contractAddress)],
    ["Block", `#${receipt.blockHeight}`],
    ["Proof time", `${(receipt.proofDurationMs / 1000).toFixed(1)}s`],
  ] as const;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">Public receipt</span>
        <span className="rounded-md border border-fd-border px-2 py-0.5 font-mono text-[11px] text-fd-muted-foreground">
          {live ? "LIVE" : "RECORDED"}
        </span>
      </div>
      <div className="divide-y divide-fd-border overflow-hidden rounded-lg border border-fd-border">
        {rows.map(([label, value]) => (
          <div
            className="flex items-center justify-between gap-4 px-3 py-2"
            key={label}
          >
            <span className="text-fd-muted-foreground text-xs">{label}</span>
            <code className="truncate text-right text-xs" title={value}>
              {value}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionBadge({ status }: { status: DemoStatus }) {
  const allowed = status === "authorized";
  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-medium text-xs ${
        allowed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
    >
      {allowed ? "Authorized" : "Blocked"}
    </span>
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
  let status = recordedStatus;
  if (liveResult) {
    status = liveResult.isError ? "denied" : "authorized";
  }
  const receipt = liveResult?.receipt ?? step.receipt;

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
        "The local zkMCP demo backend could not complete this request."
      );
    } finally {
      setRunning(false);
    }
  }, [step.id]);

  let backendLabel = "Recorded mode";
  if (backendMode === "live") {
    backendLabel = "Live backend";
  } else if (backendMode === "checking") {
    backendLabel = "Checking…";
  }

  let actionLabel =
    status === "authorized"
      ? "Generate a live proof"
      : "Test live authorization";
  if (running) {
    actionLabel = "Authorizing with Midnight…";
  }

  return (
    <div className="zkmcp-playground overflow-hidden rounded-xl border border-fd-border bg-fd-card text-fd-card-foreground">
      <div className="flex flex-col gap-3 border-fd-border border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold text-sm">Authorization playground</div>
          <div className="mt-0.5 text-fd-muted-foreground text-xs">
            Run the same scenarios used by the real MCP + Midnight integration
            suite.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="max-w-64 rounded-md border border-fd-border bg-fd-background px-2.5 py-1.5 text-xs outline-none"
            onChange={handleScenarioChange}
            value={selectedId}
          >
            {recordedRun.map((item) => (
              <option key={item.id} value={item.id}>
                {item.group} — {item.label}
              </option>
            ))}
          </select>
          <span className="rounded-md border border-fd-border px-2 py-1.5 text-fd-muted-foreground text-xs">
            {backendLabel}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2">
        <div className="space-y-5 border-fd-border p-4 lg:border-r">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-sm">MCP request</span>
              <code className="text-fd-muted-foreground text-xs">
                {step.tool}
              </code>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {step.requestFields.map((field) => (
                <div
                  className="rounded-lg border border-fd-border bg-fd-background p-3"
                  key={field.label}
                >
                  <div className="text-[11px] text-fd-muted-foreground">
                    {field.label}
                  </div>
                  <div className="mt-1 break-words font-mono text-xs">
                    {field.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-sm">Private policy</span>
              <span className="text-[11px] text-fd-muted-foreground">
                local witness
              </span>
            </div>
            <div className="divide-y divide-fd-border overflow-hidden rounded-lg border border-fd-border bg-fd-background">
              {privatePolicy.map((rule) => (
                <div
                  className="grid gap-1 px-3 py-2 sm:grid-cols-[10rem_1fr]"
                  key={rule.label}
                >
                  <div>
                    <div className="text-[11px] text-fd-muted-foreground">
                      {rule.label}
                    </div>
                    <div className="font-mono text-xs">{rule.value}</div>
                  </div>
                  <div className="text-fd-muted-foreground text-xs sm:text-right">
                    {rule.note}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-fd-muted-foreground text-xs">
              These values are visible to the policy owner and prover. The
              public ledger receives the commitment, not the raw rules.
            </p>
          </div>
        </div>

        <div className="space-y-5 p-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-sm">Decision</div>
                <div className="mt-1 text-fd-muted-foreground text-xs">
                  {step.policyCheck}
                </div>
              </div>
              <DecisionBadge status={status} />
            </div>
            <div className="mt-3 rounded-lg border border-fd-border bg-fd-background p-3 text-sm">
              {step.resultSummary}
            </div>
          </div>

          {receipt ? (
            <Receipt live={Boolean(liveResult)} receipt={receipt} />
          ) : (
            <div className="rounded-lg border border-fd-border bg-fd-background p-4">
              <div className="font-medium text-sm">No receipt committed</div>
              <p className="mt-1 text-fd-muted-foreground text-xs">
                The private circuit rejected the request. The upstream MCP
                handler was not invoked.
              </p>
            </div>
          )}

          <div>
            <div className="mb-2 font-medium text-sm">
              Not exposed on the ledger
            </div>
            <div className="flex flex-wrap gap-1.5">
              {step.hiddenFields.map((field) => (
                <span
                  className="rounded-md border border-fd-border bg-fd-background px-2 py-1 text-[11px] text-fd-muted-foreground"
                  key={field}
                >
                  {field}
                </span>
              ))}
            </div>
          </div>

          <div className="border-fd-border border-t pt-4">
            <button
              className="w-full rounded-lg border border-fd-primary bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground text-sm disabled:cursor-not-allowed disabled:opacity-45"
              disabled={backendMode !== "live" || running}
              onClick={handleLiveRun}
              type="button"
            >
              {actionLabel}
            </button>
            <p className="mt-2 text-center text-[11px] text-fd-muted-foreground">
              {backendMode === "live"
                ? "Authorized calls currently take about 20–25 seconds on the local prover. Policy denials usually return before proof generation."
                : "Recorded mode uses receipts from the verified Phase 2 local Midnight run. Start `npm run demo:ui` for live proving."}
            </p>
            {runError ? (
              <p className="mt-2 text-center text-red-500 text-xs">
                {runError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
