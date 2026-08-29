"use client";

import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  EyeOff,
  FileText,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Mail,
  Network,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  type DemoStep,
  recordedRun,
  recordedRunMetadata,
} from "@/lib/demo-data";

const toolIcons = {
  "documents.read": FileText,
  "email.send": Mail,
  "payments.transfer": WalletCards,
} as const;

function shortHex(value: string, edge = 8): string {
  if (value.length <= edge * 2 + 2) {
    return value;
  }
  return `${value.slice(0, edge + 2)}…${value.slice(-edge)}`;
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusPill({ status }: { status: DemoStep["status"] }) {
  const authorized = status === "authorized";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold text-[11px] uppercase tracking-[0.11em] ${
        authorized
          ? "border-[rgba(184,255,114,.22)] bg-[rgba(184,255,114,.08)] text-[#c8ff91]"
          : "border-[rgba(255,117,111,.22)] bg-[rgba(255,117,111,.08)] text-[#ff938e]"
      }`}
    >
      {authorized ? (
        <Check size={12} strokeWidth={2.5} />
      ) : (
        <X size={12} strokeWidth={2.5} />
      )}
      {authorized ? "Authorized" : "Blocked"}
    </span>
  );
}

function FlowNode({
  icon: Icon,
  label,
  detail,
  emphasis = false,
}: {
  detail: string;
  emphasis?: boolean;
  icon: typeof Bot;
  label: string;
}) {
  return (
    <div
      className={`min-w-0 flex-1 rounded-xl border px-3.5 py-3 ${
        emphasis
          ? "border-[rgba(184,255,114,.24)] bg-[rgba(184,255,114,.07)]"
          : "border-white/[0.08] bg-white/[0.025]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`grid size-8 shrink-0 place-items-center rounded-lg border ${
            emphasis
              ? "border-[rgba(184,255,114,.24)] bg-[rgba(184,255,114,.09)] text-[#c8ff91]"
              : "border-white/[0.08] bg-white/[0.035] text-white/65"
          }`}
        >
          <Icon size={15} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-[12px] text-white/90">
            {label}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-white/38">
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivatePolicyCard() {
  const rows = [
    ["Agent identity", "Allowed principal"],
    ["Matter scope", "Resource membership"],
    ["Email approval", "Human authorization"],
    ["Payment ceiling", "Private numeric limit"],
    ["Approval threshold", "Private numeric rule"],
  ];

  return (
    <section className="panel-glow overflow-hidden rounded-2xl border border-white/[0.09] bg-[rgba(14,16,14,.82)]">
      <div className="border-white/[0.07] border-b px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/70">
              <LockKeyhole size={15} />
            </div>
            <div>
              <h2 className="font-semibold text-[13px] text-white/90">
                Private policy
              </h2>
              <p className="mt-0.5 text-[10px] text-white/36">
                Committed once · values never public
              </p>
            </div>
          </div>
          <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[9px] text-white/34 uppercase tracking-[0.12em]">
            witness
          </span>
        </div>
      </div>

      <div className="space-y-1.5 p-3">
        {rows.map(([label, detail]) => (
          <div
            className="rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-3"
            key={label}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-[11px] text-white/72">
                  {label}
                </div>
                <div className="mt-1 text-[9.5px] text-white/30">{detail}</div>
              </div>
              <span className="redacted shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <div className="border-white/[0.07] border-t bg-black/20 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <Fingerprint className="mt-0.5 shrink-0 text-[#c8ff91]" size={14} />
          <div>
            <div className="font-medium text-[10.5px] text-white/68">
              Only the commitment is anchored
            </div>
            <div className="mono mt-1.5 break-all text-[9px] text-white/28 leading-relaxed">
              {shortHex(recordedRunMetadata.policyCommitment, 10)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExecutionTrace({
  selectedId,
  onSelect,
}: {
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  const handleStepClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.stepId;
      if (id) {
        onSelect(id);
      }
    },
    [onSelect]
  );

  return (
    <section className="panel-glow overflow-hidden rounded-2xl border border-white/[0.09] bg-[rgba(14,16,14,.82)]">
      <div className="border-white/[0.07] border-b px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/70">
              <Zap size={15} />
            </div>
            <div>
              <h2 className="font-semibold text-[13px] text-white/90">
                Agent execution trace
              </h2>
              <p className="mt-0.5 text-[10px] text-white/36">
                Every sensitive tools/call hits zkMCP first
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/36">
            <span className="size-1.5 rounded-full bg-[#b8ff72]" />
            Recorded proof run
          </div>
        </div>
      </div>

      <div className="p-2.5">
        {recordedRun.map((step, index) => {
          const Icon = toolIcons[step.tool];
          const selected = step.id === selectedId;
          const authorized = step.status === "authorized";
          return (
            <button
              className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                selected
                  ? "border-white/[0.13] bg-white/[0.055]"
                  : "border-transparent hover:border-white/[0.065] hover:bg-white/[0.025]"
              }`}
              data-step-id={step.id}
              key={step.id}
              onClick={handleStepClick}
              type="button"
            >
              <div className="relative flex w-5 shrink-0 justify-center self-stretch">
                {index < recordedRun.length - 1 ? (
                  <span className="absolute top-8 left-1/2 h-[calc(100%+12px)] w-px -translate-x-1/2 bg-white/[0.06]" />
                ) : null}
                <span
                  className={`relative mt-1 grid size-5 place-items-center rounded-full border ${
                    authorized
                      ? "border-[rgba(184,255,114,.22)] bg-[#10180c] text-[#b8ff72]"
                      : "border-[rgba(255,117,111,.22)] bg-[#1a0f0e] text-[#ff756f]"
                  }`}
                >
                  {authorized ? (
                    <Check size={10} strokeWidth={3} />
                  ) : (
                    <X size={10} strokeWidth={3} />
                  )}
                </span>
              </div>

              <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-black/20 text-white/48">
                <Icon size={14} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-[11.5px] text-white/78">
                    {step.label}
                  </span>
                  {step.receipt ? (
                    <span className="hidden rounded border border-[rgba(184,255,114,.16)] bg-[rgba(184,255,114,.055)] px-1.5 py-0.5 font-mono text-[#b8ff72]/65 text-[8px] uppercase tracking-[0.09em] sm:inline">
                      proof
                    </span>
                  ) : null}
                </div>
                <div className="mono mt-1 truncate text-[9.5px] text-white/28">
                  {step.tool}
                </div>
                <div className="mt-1 truncate text-[9.5px] text-white/36">
                  {step.argumentsSummary}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`hidden font-medium text-[9px] sm:inline ${
                    authorized ? "text-[#b8ff72]/70" : "text-[#ff756f]/70"
                  }`}
                >
                  {authorized ? "EXECUTED" : "STOPPED"}
                </span>
                <ChevronRight
                  className={`transition ${selected ? "text-white/60" : "text-white/18 group-hover:text-white/40"}`}
                  size={14}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Inspector({ step }: { step: DemoStep }) {
  const { receipt } = step;
  const authorized = step.status === "authorized";

  return (
    <section className="panel-glow overflow-hidden rounded-2xl border border-white/[0.09] bg-[rgba(14,16,14,.82)]">
      <div className="border-white/[0.07] border-b px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/70">
              <Network size={15} />
            </div>
            <div>
              <h2 className="font-semibold text-[13px] text-white/90">
                What Midnight exposed
              </h2>
              <p className="mt-0.5 text-[10px] text-white/36">
                Public ledger view · selected action
              </p>
            </div>
          </div>
          <StatusPill status={step.status} />
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border ${
                authorized
                  ? "border-[rgba(184,255,114,.23)] bg-[rgba(184,255,114,.07)] text-[#b8ff72]"
                  : "border-[rgba(255,117,111,.23)] bg-[rgba(255,117,111,.07)] text-[#ff756f]"
              }`}
            >
              {authorized ? <ShieldCheck size={15} /> : <XCircle size={15} />}
            </div>
            <div>
              <div className="font-semibold text-[11.5px] text-white/82">
                {step.label}
              </div>
              <p className="mt-1.5 text-[10px] text-white/40 leading-relaxed">
                {step.description}
              </p>
              <p className="mt-2 text-[10px] text-white/58 leading-relaxed">
                {step.resultSummary}
              </p>
            </div>
          </div>
        </div>

        {receipt ? (
          <div className="mt-3.5 space-y-1.5">
            <ReceiptRow
              label="Policy commitment"
              value={shortHex(receipt.policyCommitment)}
            />
            <ReceiptRow
              label="Execution commitment"
              value={shortHex(receipt.executionCommitment)}
            />
            <ReceiptRow label="Nullifier" value={shortHex(receipt.nullifier)} />
            <ReceiptRow
              label="Transaction"
              value={shortHex(receipt.transactionId)}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <ReceiptRow label="Block" value={`#${receipt.blockHeight}`} />
              <ReceiptRow
                label="Proof time"
                value={formatDuration(receipt.proofDurationMs)}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3.5 rounded-xl border border-[rgba(255,117,111,.12)] bg-[rgba(255,117,111,.035)] px-3.5 py-3">
            <div className="flex items-center gap-2 font-medium text-[#ff938e]/80 text-[10px]">
              <CircleDashed size={13} />
              No authorization receipt committed
            </div>
            <p className="mt-1.5 text-[9.5px] text-white/34 leading-relaxed">
              The private circuit rejected this request, so the upstream MCP
              tool was never invoked.
            </p>
          </div>
        )}

        <div className="mt-4 border-white/[0.06] border-t pt-3.5">
          <div className="mb-2.5 flex items-center gap-2 font-medium text-[10px] text-white/55">
            <EyeOff size={13} />
            Not exposed on the ledger
          </div>
          <div className="flex flex-wrap gap-1.5">
            {step.hiddenFields.map((field) => (
              <span
                className="rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[9px] text-white/34"
                key={field}
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-white/[0.055] bg-white/[0.018] px-3 py-2">
      <span className="text-[9.5px] text-white/32">{label}</span>
      <span className="mono truncate text-[9.5px] text-white/62" title={value}>
        {value}
      </span>
    </div>
  );
}

export function DemoShell() {
  const [selectedId, setSelectedId] = useState("payment-allowed");
  const selected = useMemo(
    () => recordedRun.find((step) => step.id === selectedId) ?? recordedRun[0],
    [selectedId]
  );

  return (
    <main className="mx-auto w-full max-w-[1540px] px-4 pt-4 pb-16 sm:px-6 lg:px-8">
      <div className="mesh" />
      <div className="noise" />

      <header className="flex h-14 items-center justify-between border-white/[0.07] border-b">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg border border-[rgba(184,255,114,.2)] bg-[rgba(184,255,114,.07)] text-[#c8ff91]">
            <KeyRound size={15} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-[15px] text-white tracking-[-0.03em]">
              zkMCP
            </span>
            <span className="hidden text-[10px] text-white/28 sm:inline">
              cryptographic authority for agents
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 font-medium text-[9px] text-white/38 sm:inline-flex">
            AI Track · Midnight Hackathon
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(184,255,114,.17)] bg-[rgba(184,255,114,.055)] px-2.5 py-1 font-medium text-[#c8ff91]/72 text-[9px]">
            <span className="live-pulse size-1.5 rounded-full bg-[#b8ff72]" />
            Recorded chain run
          </span>
        </div>
      </header>

      <section className="pt-10 pb-8 lg:pt-14 lg:pb-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-medium text-[9.5px] text-white/46 uppercase tracking-[0.13em]">
              <Sparkles className="text-[#c8ff91]" size={12} />
              Access is not authority
            </div>
            <h1 className="max-w-4xl text-balance font-semibold text-[clamp(2.35rem,5.2vw,5.6rem)] text-white leading-[0.95] tracking-[-0.065em]">
              Agents can act.
              <br />
              <span className="text-white/34">
                They cannot exceed authority.
              </span>
            </h1>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-pretty text-[13px] text-white/46 leading-6 lg:text-[14px]">
              zkMCP intercepts sensitive MCP tool calls and requires a Midnight
              zero-knowledge authorization proof before the action can reach the
              tool.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "Private policy",
                "Real MCP",
                "Compact circuit",
                "Proof receipt",
              ].map((item) => (
                <span
                  className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[9.5px] text-white/36"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel-glow mb-3.5 rounded-2xl border border-white/[0.08] bg-[rgba(13,15,13,.72)] p-2.5">
        <div className="flex items-center gap-2 overflow-x-auto">
          <FlowNode detail="proposes tools/call" icon={Bot} label="AI agent" />
          <ArrowRight className="shrink-0 text-white/17" size={14} />
          <FlowNode
            detail="normalizes + gates"
            emphasis
            icon={ShieldCheck}
            label="zkMCP gateway"
          />
          <ArrowRight className="shrink-0 text-white/17" size={14} />
          <FlowNode
            detail="private constraint proof"
            icon={Fingerprint}
            label="Midnight / Compact"
          />
          <ArrowRight className="shrink-0 text-white/17" size={14} />
          <FlowNode
            detail="executes only if proven"
            icon={Zap}
            label="MCP tool"
          />
        </div>
      </section>

      <section className="panel-glow mb-3.5 rounded-2xl border border-white/[0.08] bg-[rgba(13,15,13,.72)] px-4 py-3.5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/48">
              <Bot size={15} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[9px] text-white/28 uppercase tracking-[0.12em]">
                Agent instruction
              </div>
              <p className="mt-1 max-w-4xl text-[11px] text-white/62 leading-5">
                Review the Thompson matter, send the settlement proposal to
                outside counsel, and transfer £2,750 to the client settlement
                account.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-md border border-white/[0.07] bg-black/20 px-2 py-1 font-mono text-[8.5px] text-white/28 uppercase tracking-[0.09em]">
            prompt stays off-chain
          </span>
        </div>
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[.78fr_1.35fr_1fr]">
        <PrivatePolicyCard />
        <ExecutionTrace onSelect={setSelectedId} selectedId={selectedId} />
        <Inspector step={selected} />
      </section>

      <section className="mt-3.5 grid gap-3.5 md:grid-cols-3">
        <MetricCard
          detail="Each one generated and verified by the Midnight proof server."
          icon={CheckCircle2}
          label="Proof-backed executions"
          value={String(recordedRunMetadata.successfulProofs)}
        />
        <MetricCard
          detail="Rejected calls stopped before the upstream MCP tool was invoked."
          icon={XCircle}
          label="Calls blocked pre-execution"
          value={String(recordedRunMetadata.blockedCalls)}
        />
        <MetricCard
          detail="One commitment binds every request to the same hidden policy."
          icon={ReceiptText}
          label="Committed private policy"
          value="1"
        />
      </section>

      <footer className="mt-10 flex flex-col justify-between gap-3 border-white/[0.07] border-t pt-5 text-[9.5px] text-white/26 sm:flex-row sm:items-center">
        <span>
          Recorded {recordedRunMetadata.recordedAt} · local Midnight devnet ·
          contract {shortHex(recordedRunMetadata.contractAddress, 6)}
        </span>
        <span className="font-medium text-white/38">
          AI agents should prove authority before execution.
        </span>
      </footer>
    </main>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="panel-glow rounded-2xl border border-white/[0.08] bg-[rgba(13,15,13,.72)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-[9px] text-white/28 uppercase tracking-[0.12em]">
            {label}
          </div>
          <div className="mt-2 font-semibold text-3xl text-white/88 tracking-[-0.05em]">
            {value}
          </div>
        </div>
        <div className="grid size-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-white/42">
          <Icon size={14} />
        </div>
      </div>
      <p className="mt-3 max-w-sm text-[9.5px] text-white/34 leading-relaxed">
        {detail}
      </p>
    </div>
  );
}
