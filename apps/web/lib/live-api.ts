import type { ProofReceipt } from "./demo-data";

const BUILD_API_URL = process.env.NEXT_PUBLIC_ZKMCP_API_URL?.replace(/\/$/, "");
const LOCAL_API_URL = "http://127.0.0.1:8787";

function getApiUrl(): string | undefined {
  if (BUILD_API_URL) {
    return BUILD_API_URL;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  return new URLSearchParams(window.location.search).get("live") === "local"
    ? LOCAL_API_URL
    : undefined;
}

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
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return { mode: "recorded", ready: false };
  }

  const response = await fetch(`${apiUrl}/health`, { cache: "no-store" });
  const body = (await response.json()) as LiveHealth;
  if (!response.ok) {
    return { mode: "recorded", ready: false };
  }
  return body;
}

export async function runLiveScenario(
  scenarioId: string
): Promise<LiveRunResult> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("Live zkMCP backend is not configured for this deployment");
  }

  const response = await fetch(`${apiUrl}/run`, {
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
