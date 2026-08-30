import { spawn } from "node:child_process";

const LOCAL_API = "http://127.0.0.1:8787";
const PUBLIC_PLAYGROUND = "https://zkmcp.zohaibarsalan.me/docs/playground";
const TUNNEL_PATTERN = /https:\/\/[a-z0-9-]+\.ngrok-free\.app/i;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with ${code ?? signal ?? "unknown"}`
        )
      );
    });
  });
}

async function waitForHealth(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: readiness polling must be sequential.
      const response = await fetch(`${url}/health`, {
        cache: "no-store",
        headers: url.includes("ngrok-free.app")
          ? { "ngrok-skip-browser-warning": "true" }
          : undefined,
      });
      if (response.ok) {
        return;
      }
    } catch {
      // The process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}/health`);
}

function pipe(child, stream, output, onChunk) {
  child[stream]?.on("data", (chunk) => {
    const text = chunk.toString();
    output.write(text);
    onChunk?.(text);
  });
}

let api;
let tunnel;
let cleaning = false;

async function cleanup(exitCode = 0) {
  if (cleaning) {
    return;
  }
  cleaning = true;

  tunnel?.kill("SIGTERM");
  api?.kill("SIGTERM");

  try {
    await run("npm", ["run", "stop:midnight"]);
  } catch (error) {
    console.error("Failed to stop the Midnight stack cleanly:", error);
  }

  process.exit(exitCode);
}

function requestCleanup(exitCode) {
  cleanup(exitCode).catch((error) => {
    console.error("Recording cleanup failed:", error);
    process.exit(1);
  });
}

process.on("SIGINT", () => requestCleanup(0));
process.on("SIGTERM", () => requestCleanup(0));

try {
  console.log("\nPreparing zkMCP recording environment…\n");

  // Fail before starting Midnight if ngrok is not authenticated/configured.
  await run("ngrok", ["config", "check"]);
  await run("npm", ["run", "setup:midnight"]);

  api = spawn("npm", ["run", "serve:demo-api", "--workspace=@zkmcp/gateway"], {
    cwd: process.cwd(),
    stdio: ["inherit", "pipe", "pipe"],
  });
  pipe(api, "stdout", process.stdout);
  pipe(api, "stderr", process.stderr);
  api.once("exit", (code) => {
    if (!cleaning) {
      console.error(`\nDemo API exited unexpectedly (${code ?? "unknown"}).`);
      requestCleanup(1);
    }
  });

  await waitForHealth(LOCAL_API);

  console.log("\nStarting temporary ngrok HTTPS tunnel…\n");
  tunnel = spawn(
    "ngrok",
    ["http", "8787", "--log", "stdout", "--log-format", "json"],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let tunnelReadinessStarted = false;
  const observeTunnel = (text) => {
    if (tunnelReadinessStarted) {
      return;
    }
    const match = text.match(TUNNEL_PATTERN);
    if (!match) {
      return;
    }

    const [tunnelUrl] = match;
    tunnelReadinessStarted = true;
    (async () => {
      await waitForHealth(tunnelUrl, 20_000);
      if (cleaning) {
        return;
      }

      const recordingUrl = `${PUBLIC_PLAYGROUND}?live=${encodeURIComponent(tunnelUrl)}`;
      console.log(
        "\n╔══════════════════════════════════════════════════════════════╗"
      );
      console.log(
        "║  zkMCP recording environment ready                         ║"
      );
      console.log(
        "╚══════════════════════════════════════════════════════════════╝\n"
      );
      console.log("Open this exact URL for LIVE proving on the hosted docs:\n");
      console.log(recordingUrl);
      console.log("\nKeep this terminal running while you record.");
      console.log(
        "Press Ctrl+C when you are finished; Midnight will be stopped.\n"
      );
    })().catch((error) => {
      console.error("ngrok tunnel readiness failed:", error);
      requestCleanup(1);
    });
  };

  pipe(tunnel, "stdout", process.stdout, observeTunnel);
  pipe(tunnel, "stderr", process.stderr, observeTunnel);
  tunnel.once("error", (error) => {
    console.error("Could not start ngrok:", error);
    requestCleanup(1);
  });
  tunnel.once("exit", (code) => {
    if (!cleaning) {
      console.error(
        `\nHTTPS tunnel exited unexpectedly (${code ?? "unknown"}).`
      );
      requestCleanup(1);
    }
  });

  await new Promise((resolve) => tunnel.once("close", resolve));
} catch (error) {
  console.error("\nFailed to prepare the recording environment:", error);
  await cleanup(1);
}
