"use client";

import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleDashed,
  EyeOff,
  FileText,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Mail,
  Radio,
  ReceiptText,
  ShieldCheck,
  WalletCards,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type DemoStep,
  privatePolicy,
  recordedRun,
  recordedRunMetadata,
} from "@/lib/demo-data";
import {
  getLiveHealth,
  type LiveRunResult,
  runLiveScenario,
} from "@/lib/live-api";

const toolIcons = {
  "documents.read": FileText,
  "email.send": Mail,
  "payments.transfer": WalletCards,
} as const;

const groups = ["Documents", "Email", "Payments"] as const;

type BackendMode = "checking" | "live" | "recorded";

function shortHex(value: string, edge = 7): string {
  if (value.length <= edge * 2 + 2) {
    return value;
  }
  return `${value.slice(0, edge + 2)}…${value.slice(-edge)}`;
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function backendLabel(mode: BackendMode): string {
  if (mode === "checking") {
    return "Checking backend";
  }
  if (mode === "live") {
    return "Live proving ready";
  }
  return "Recorded proof run";
}

function liveButtonLabel(running: boolean, authorized: boolean): string {
  if (running) {
    return "Proving with Midnight…";
  }
  if (authorized) {
    return "Generate live proof";
  }
  return "Test live authorization";
}

function liveHint(mode: BackendMode, authorized: boolean): string {
  if (mode === "checking") {
    return "Checking for the local prover and gateway…";
  }
  if (mode === "recorded") {
    return "Recorded mode stays interactive without local Midnight services.";
  }
  if (authorized) {
    return "Successful local proofs currently take about 20–25 seconds.";
  }
  return "Rejected constraints return before upstream tool execution.";
}

function StatusBadge({ status }: { status: DemoStep["status"] }) {
  const allowed = status === "authorized";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-[10px] ${
        allowed
          ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200"
          : "border-red-300/20 bg-red-300/[0.07] text-red-200"
      }`}
    >
      {allowed ? <Check size={11} strokeWidth={2.5} /> : <X size={11} />}
      {allowed ? "Authorized" : "Blocked"}
    </span>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-[10px] border border-white/10 bg-white/[0.045] text-white/85">
        <KeyRound size={15} strokeWidth={1.8} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-[15px] tracking-[-0.035em]">
          zkMCP
        </span>
        <span className="hidden text-[10px] text-white/30 sm:inline">
          authority layer for agents
        </span>
      </div>
    </div>
  );
}

function ScenarioRail({
  onSelect,
  selectedId,
}: {
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.scenario;
      if (id) {
        onSelect(id);
      }
    },
    [onSelect]
  );

  return (
    <aside className="border-white/[0.07] border-b bg-white/[0.012] p-3 lg:border-r lg:border-b-0 lg:p-4">
      <div className="flex items-center justify-between px-2 pb-3">
        <div>
          <div className="font-medium text-[11px] text-white/80">Scenarios</div>
          <div className="mt-1 text-[9.5px] text-white/30">
            Real Phase 2 allow / deny cases
          </div>
        </div>
        <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[8px] text-white/32">
          8 tests
        </span>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-1.5 px-2 font-medium text-[8px] text-white/25 uppercase tracking-[0.16em]">
              {group}
            </div>
            <div className="space-y-1">
              {recordedRun
                .filter((step) => step.group === group)
                .map((step) => {
                  const selected = step.id === selectedId;
                  const allowed = step.status === "authorized";
                  const Icon = toolIcons[step.tool];
                  return (
                    <button
                      className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition ${
                        selected
                          ? "bg-white/[0.075] text-white"
                          : "text-white/52 hover:bg-white/[0.035] hover:text-white/78"
                      }`}
                      data-scenario={step.id}
                      key={step.id}
                      onClick={handleClick}
                      type="button"
                    >
                      {selected ? (
                        <motion.span
                          className="absolute inset-y-2 left-0 w-px bg-white/70"
                          layoutId="scenario-indicator"
                        />
                      ) : null}
                      <div className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-black/20">
                        <Icon size={12} strokeWidth={1.7} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-[10.5px]">
                          {step.label}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[8.5px] text-white/27">
                          {step.tool}
                        </div>
                      </div>
                      <div
                        className={`size-1.5 shrink-0 rounded-full ${
                          allowed ? "bg-emerald-300/75" : "bg-red-300/65"
                        }`}
                      />
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-3">
        <div className="flex items-center gap-2 text-[9px] text-white/34">
          <Fingerprint size={12} />
          Committed policy
        </div>
        <div className="mt-2 font-mono text-[9px] text-white/56">
          {shortHex(recordedRunMetadata.policyCommitment, 9)}
        </div>
      </div>
    </aside>
  );
}

function RequestPanel({ step }: { step: DemoStep }) {
  return (
    <div className="rounded-2xl border border-white/[0.075] bg-white/[0.018] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[9px] text-white/28 uppercase tracking-[0.13em]">
            MCP request
          </div>
          <div className="mt-1.5 font-mono text-[12px] text-white/76">
            {step.tool}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[8.5px] text-white/34">
          <LockKeyhole size={10} />
          private inputs
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {step.requestFields.map((field) => (
          <div
            className="min-w-0 rounded-xl border border-white/[0.055] bg-black/20 px-3 py-2.5"
            key={field.label}
          >
            <div className="flex items-center gap-1.5 text-[8.5px] text-white/28">
              {field.private ? <EyeOff size={10} /> : null}
              {field.label}
            </div>
            <div
              className="mt-1.5 truncate font-medium text-[10.5px] text-white/72"
              title={field.value}
            >
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PathNode({
  detail,
  icon: Icon,
  label,
  state,
}: {
  detail: string;
  icon: typeof Bot;
  label: string;
  state: "done" | "blocked" | "idle";
}) {
  let stateClass = "border-white/[0.07] bg-white/[0.018] text-white/50";
  if (state === "done") {
    stateClass =
      "border-emerald-300/15 bg-emerald-300/[0.035] text-emerald-100/80";
  }
  if (state === "blocked") {
    stateClass = "border-red-300/15 bg-red-300/[0.035] text-red-100/75";
  }

  return (
    <div className={`min-w-0 flex-1 rounded-xl border p-3 ${stateClass}`}>
      <div className="flex items-center gap-2.5">
        <div className="grid size-7 shrink-0 place-items-center rounded-lg border border-current/10 bg-black/15">
          <Icon size={12} strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium text-[10px]">{label}</div>
          <div className="mt-0.5 truncate text-[8.5px] opacity-45">
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthorizationPath({ status }: { status: DemoStep["status"] }) {
  const allowed = status === "authorized";
  return (
    <div className="rounded-2xl border border-white/[0.075] bg-[#080908] p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="text-[9px] text-white/28 uppercase tracking-[0.13em]">
          Authorization path
        </div>
        <div
          className={`font-mono text-[8.5px] ${
            allowed ? "text-emerald-200/55" : "text-red-200/55"
          }`}
        >
          {allowed ? "proof → execution" : "constraint → stop"}
        </div>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <PathNode
          detail="proposes tools/call"
          icon={Bot}
          label="Agent"
          state="done"
        />
        <ArrowRight className="shrink-0 text-white/15" size={13} />
        <PathNode
          detail="normalizes request"
          icon={ShieldCheck}
          label="zkMCP"
          state="done"
        />
        <ArrowRight className="shrink-0 text-white/15" size={13} />
        <PathNode
          detail={allowed ? "proof verified" : "policy rejected"}
          icon={Fingerprint}
          label="Midnight"
          state={allowed ? "done" : "blocked"}
        />
        <ArrowRight className="shrink-0 text-white/15" size={13} />
        <PathNode
          detail={allowed ? "handler invoked" : "never invoked"}
          icon={Zap}
          label="MCP tool"
          state={allowed ? "done" : "idle"}
        />
      </div>
    </div>
  );
}

function PolicyPanel({ step }: { step: DemoStep }) {
  const relevant = useCallback(
    (label: string): boolean => {
      if (step.tool === "documents.read") {
        return label === "Agent" || label === "Matter scope";
      }
      if (step.tool === "email.send") {
        return label === "Agent" || label === "External email";
      }
      return (
        label === "Agent" ||
        label === "Payment ceiling" ||
        label === "Approval threshold"
      );
    },
    [step.tool]
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.075] bg-white/[0.018]">
      <div className="flex items-center justify-between border-white/[0.06] border-b px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2 font-medium text-[11px] text-white/78">
            <LockKeyhole size={13} />
            Private policy
          </div>
          <div className="mt-1 text-[8.5px] text-white/28">
            Local witness · visible to the owner, never published
          </div>
        </div>
        <span className="rounded-md border border-violet-300/10 bg-violet-300/[0.035] px-2 py-1 font-mono text-[8px] text-violet-200/50">
          PRIVATE
        </span>
      </div>
      <div className="p-2.5">
        {privatePolicy.map((rule) => {
          const active = relevant(rule.label);
          return (
            <div
              className={`flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition ${
                active ? "bg-white/[0.045]" : "bg-transparent"
              }`}
              key={rule.label}
            >
              <div className="min-w-0">
                <div className="text-[9px] text-white/32">{rule.label}</div>
                <div className="mt-1 truncate font-medium text-[10.5px] text-white/70">
                  {rule.value}
                </div>
              </div>
              <div className="hidden max-w-44 text-right text-[8px] text-white/23 leading-relaxed xl:block">
                {rule.note}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-white/[0.06] border-t px-4 py-3">
        <div className="flex items-start gap-2 text-[8.5px] text-white/28 leading-relaxed">
          <Fingerprint className="mt-0.5 shrink-0" size={11} />
          The policy is salted with a private secret. Only its commitment is
          anchored publicly.
        </div>
      </div>
    </section>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-white/[0.05] border-b px-0 py-2 last:border-b-0">
      <span className="text-[8.5px] text-white/28">{label}</span>
      <span
        className="max-w-[65%] truncate font-mono text-[9px] text-white/58"
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function LedgerPanel({
  receipt,
  status,
}: {
  receipt?: DemoStep["receipt"] | null;
  status: DemoStep["status"];
}) {
  const allowed = status === "authorized";
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.075] bg-white/[0.018]">
      <div className="flex items-center justify-between border-white/[0.06] border-b px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2 font-medium text-[11px] text-white/78">
            <ReceiptText size={13} />
            Midnight ledger
          </div>
          <div className="mt-1 text-[8.5px] text-white/28">
            What a public verifier can actually inspect
          </div>
        </div>
        <span className="rounded-md border border-sky-300/10 bg-sky-300/[0.035] px-2 py-1 font-mono text-[8px] text-sky-200/50">
          PUBLIC
        </span>
      </div>

      {allowed && receipt ? (
        <div className="px-4 py-2">
          <ReceiptRow
            label="policy commitment"
            value={shortHex(receipt.policyCommitment, 9)}
          />
          <ReceiptRow
            label="execution commitment"
            value={shortHex(receipt.executionCommitment, 9)}
          />
          <ReceiptRow
            label="nullifier"
            value={shortHex(receipt.nullifier, 9)}
          />
          <ReceiptRow
            label="transaction"
            value={shortHex(receipt.transactionId, 9)}
          />
          <div className="grid grid-cols-2 gap-3 py-2.5">
            <div className="rounded-lg bg-black/20 px-2.5 py-2">
              <div className="text-[8px] text-white/24">block</div>
              <div className="mt-1 font-mono text-[9.5px] text-white/58">
                #{receipt.blockHeight}
              </div>
            </div>
            <div className="rounded-lg bg-black/20 px-2.5 py-2">
              <div className="text-[8px] text-white/24">proof time</div>
              <div className="mt-1 font-mono text-[9.5px] text-white/58">
                {formatDuration(receipt.proofDurationMs)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">
          <div className="grid size-10 place-items-center rounded-full border border-red-300/15 bg-red-300/[0.035] text-red-200/70">
            <CircleDashed size={16} />
          </div>
          <div className="mt-3 font-medium text-[11px] text-white/66">
            No receipt committed
          </div>
          <p className="mt-1.5 max-w-xs text-[9px] text-white/28 leading-relaxed">
            The private circuit rejected the request. There is no authorization
            transaction and the upstream MCP handler is not called.
          </p>
        </div>
      )}
    </section>
  );
}

function PrivateBoundary({ fields }: { fields: string[] }) {
  return (
    <div className="flex flex-col gap-3 border-white/[0.06] border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-[9px] text-white/38">
        <EyeOff size={12} />
        Never exposed on the ledger
      </div>
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {fields.map((field) => (
          <span
            className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8px] text-white/29"
            key={field}
          >
            {field}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionWorkspace({
  backendMode,
  liveResult,
  onRun,
  runError,
  running,
  step,
}: {
  backendMode: BackendMode;
  liveResult?: LiveRunResult;
  onRun: () => void;
  runError?: string;
  running: boolean;
  step: DemoStep;
}) {
  const { status: recordedStatus } = step;
  let status = recordedStatus;
  if (liveResult) {
    status = liveResult.isError ? "denied" : "authorized";
  }
  const receipt = liveResult?.receipt ?? step.receipt;
  const allowed = status === "authorized";
  const Icon = toolIcons[step.tool];

  return (
    <div className="min-w-0 p-4 sm:p-5 lg:p-6">
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          initial={{ opacity: 0, y: 5 }}
          key={step.id}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="flex flex-col gap-4 border-white/[0.06] border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/72">
                <Icon size={16} strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] text-white/28">
                    {step.tool}
                  </span>
                  {liveResult ? (
                    <span className="rounded border border-sky-300/12 bg-sky-300/[0.035] px-1.5 py-0.5 font-mono text-[7.5px] text-sky-200/55 uppercase tracking-[0.08em]">
                      live result
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1.5 font-semibold text-[22px] text-white/92 tracking-[-0.035em] sm:text-[25px]">
                  {step.label}
                </h2>
                <p className="mt-1.5 max-w-2xl text-[11px] text-white/36 leading-relaxed sm:text-[12px]">
                  {step.description}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
              <StatusBadge status={status} />
              <span className="font-mono text-[8px] text-white/23">
                {allowed ? "proof-backed execution" : "pre-execution stop"}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <RequestPanel step={step} />
            <AuthorizationPath status={status} />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <PolicyPanel step={step} />
            <LedgerPanel receipt={receipt} status={status} />
          </div>

          <div className="mt-4">
            <PrivateBoundary fields={step.hiddenFields} />
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[9px] text-white/30">
                {allowed ? (
                  <CheckCircle2 className="text-emerald-200/55" size={12} />
                ) : (
                  <XCircle className="text-red-200/55" size={12} />
                )}
                Policy evaluation
              </div>
              <div className="mt-1.5 max-w-2xl text-[10px] text-white/54 leading-relaxed">
                {step.policyCheck}
              </div>
              <div className="mt-1 text-[8.5px] text-white/27">
                {step.resultSummary}
              </div>
            </div>
            <div className="shrink-0 sm:w-56">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.05] px-3 py-2.5 font-medium text-[10px] text-white/74 transition hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-35"
                disabled={backendMode !== "live" || running}
                onClick={onRun}
                type="button"
              >
                {running ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    className="inline-flex"
                    transition={{
                      duration: 1,
                      ease: "linear",
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  >
                    <Fingerprint size={12} />
                  </motion.span>
                ) : (
                  <Radio size={12} />
                )}
                {liveButtonLabel(running, allowed)}
              </button>
              <div className="mt-1.5 text-center text-[7.5px] text-white/22 leading-relaxed">
                {liveHint(backendMode, allowed)}
              </div>
            </div>
          </div>

          {runError ? (
            <div className="mt-3 rounded-xl border border-red-300/12 bg-red-300/[0.035] px-3 py-2.5 text-[9px] text-red-100/60">
              {runError}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProofStats() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-white/[0.06] border-t pt-4 text-[9px] text-white/27">
      <span>
        <strong className="mr-1.5 font-medium text-white/58">
          {recordedRunMetadata.successfulProofs}
        </strong>
        proven executions
      </span>
      <span>
        <strong className="mr-1.5 font-medium text-white/58">
          {recordedRunMetadata.blockedCalls}
        </strong>
        calls blocked pre-execution
      </span>
      <span>
        <strong className="mr-1.5 font-medium text-white/58">1</strong>
        committed private policy
      </span>
      <span className="ml-auto hidden font-mono text-white/18 md:inline">
        local Midnight devnet · 29 Aug 2026
      </span>
    </div>
  );
}

export function DemoShell() {
  const [selectedId, setSelectedId] = useState("payment-allowed");
  const [backendMode, setBackendMode] = useState<BackendMode>("checking");
  const [liveResults, setLiveResults] = useState<Record<string, LiveRunResult>>(
    {}
  );
  const [runningId, setRunningId] = useState<string>();
  const [runError, setRunError] = useState<string>();

  const selected = useMemo(
    () => recordedRun.find((step) => step.id === selectedId) ?? recordedRun[0],
    [selectedId]
  );
  const selectedLiveResult = liveResults[selectedId];

  useEffect(() => {
    let active = true;
    getLiveHealth()
      .then((health) => {
        if (active) {
          setBackendMode(health.ready ? "live" : "recorded");
        }
      })
      .catch(() => {
        if (active) {
          setBackendMode("recorded");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setRunError(undefined);
  }, []);

  const handleLiveRun = useCallback(async () => {
    setRunningId(selectedId);
    setRunError(undefined);
    try {
      const result = await runLiveScenario(selectedId);
      setLiveResults((current) => ({ ...current, [selectedId]: result }));
    } catch {
      setRunError(
        "Live authorization failed. The recorded proof remains available; check the local Midnight stack and demo API."
      );
      setBackendMode("recorded");
    } finally {
      setRunningId(undefined);
    }
  }, [selectedId]);

  return (
    <main className="mx-auto w-full max-w-[1320px] px-4 pt-4 pb-12 sm:px-6 lg:px-8">
      <header className="flex h-14 items-center justify-between border-white/[0.06] border-b">
        <BrandMark />
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-white/[0.07] px-2.5 py-1 text-[8.5px] text-white/28 sm:inline-flex">
            Midnight Hackathon · AI Track
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8.5px] ${
              backendMode === "live"
                ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-100/55"
                : "border-white/[0.07] bg-white/[0.02] text-white/30"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                backendMode === "live"
                  ? "live-pulse bg-emerald-300/80"
                  : "bg-white/20"
              }`}
            />
            {backendLabel(backendMode)}
          </span>
        </div>
      </header>

      <section className="grid gap-7 pt-14 pb-9 lg:grid-cols-[1fr_430px] lg:items-end lg:pt-20 lg:pb-12">
        <div>
          <div className="mb-4 flex items-center gap-2 text-[9px] text-white/32 uppercase tracking-[0.17em]">
            <ShieldCheck size={12} />
            Zero-knowledge authorization for MCP
          </div>
          <h1 className="max-w-4xl text-balance font-semibold text-[clamp(2.7rem,5.2vw,5.3rem)] leading-[0.94] tracking-[-0.065em]">
            Prove the action.
            <br />
            <span className="text-white/34">Keep the policy private.</span>
          </h1>
        </div>
        <div className="pb-1">
          <p className="max-w-md text-pretty text-[12px] text-white/42 leading-6 sm:text-[13px]">
            zkMCP sits between an AI agent and its MCP tools. Every sensitive
            call must satisfy a private Compact policy on Midnight before the
            upstream tool can execute.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[8.5px] text-white/28">
            <span className="rounded-md border border-white/[0.065] px-2 py-1">
              Private policy
            </span>
            <span className="rounded-md border border-white/[0.065] px-2 py-1">
              Real MCP
            </span>
            <span className="rounded-md border border-white/[0.065] px-2 py-1">
              Compact
            </span>
            <span className="rounded-md border border-white/[0.065] px-2 py-1">
              Proof receipt
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-white/[0.085] bg-[#0a0b0a] shadow-[0_30px_100px_rgba(0,0,0,.34)]">
        <div className="flex flex-col gap-3 border-white/[0.07] border-b bg-white/[0.018] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-black/20 text-white/48">
              <Bot size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[8px] text-white/25 uppercase tracking-[0.14em]">
                Blackwood & Co · Legal agent instruction
              </div>
              <div className="mt-1 truncate text-[10.5px] text-white/56">
                Review Thompson, send the settlement proposal, and transfer
                £2,750 to the client settlement account.
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-[8px] text-white/25">
            <EyeOff size={10} />
            prompt stays off-chain
          </div>
        </div>

        <div className="grid lg:grid-cols-[286px_minmax(0,1fr)]">
          <ScenarioRail onSelect={handleSelect} selectedId={selectedId} />
          <ActionWorkspace
            backendMode={backendMode}
            liveResult={selectedLiveResult}
            onRun={handleLiveRun}
            runError={runError}
            running={runningId === selectedId}
            step={selected}
          />
        </div>
      </section>

      <ProofStats />

      <footer className="mt-8 flex flex-col justify-between gap-2 text-[8.5px] text-white/20 sm:flex-row sm:items-center">
        <span>
          Recorded receipts are from the verified Phase 2 local Midnight run.
        </span>
        <span className="font-medium text-white/30">
          Access is not authority. zkMCP proves the difference.
        </span>
      </footer>
    </main>
  );
}
