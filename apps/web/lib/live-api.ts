import type { ProofReceipt } from "./demo-data";

const API_URL = process.env.NEXT_PUBLIC_ZKMCP_API_URL?.replace(/\/$/, "");

export interface LiveHealth {
  mode: "live" | "recorded";
  ready: boolean;
  tools?: string[];
}

export interface LiveAuthorizationError {
  code?: string;
  retryable?: boolean;
  stage?: string;
  status?: number;
}

export interface LiveRunResult {
  authorizationError: LiveAuthorizationError | null;
  durationMs: number;
  isError: boolean;
  receipt: ProofReceipt | null;
  scenarioId: string;
}

export async function getLiveHealth(): Promise<LiveHealth> {
  if (!API_URL) {
    return { mode: "recorded", ready: false };
  }

  const response = await fetch(`${API_URL}/health`, { cache: "no-store" });
  const body = (await response.json()) as LiveHealth;
  if (!response.ok) {
    return { mode: "recorded", ready: false };
  }
  return body;
}

export async function runLiveScenario(
  scenarioId: string
): Promise<LiveRunResult> {
  if (!API_URL) {
    throw new Error("Live zkMCP backend is not configured for this deployment");
  }

  const response = await fetch(`${API_URL}/run`, {
    body: JSON.stringify({ scenarioId }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body = (await response.json()) as LiveRunResult | { error?: unknown };
  if (!(response.ok && "scenarioId" in body)) {
    throw new Error(
      "Live zkMCP backend could not complete the authorization request"
    );
  }
  return body;
}
