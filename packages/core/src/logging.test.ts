import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createLogger } from "evlog";
import { readFsLogs } from "evlog/fs";
import {
  createAuthorizationLogger,
  initZkMcpLogger,
  privateLogPaths,
} from "./logging.js";

test("authorization logger only exposes public proof receipt fields", () => {
  const log = createAuthorizationLogger({
    authorization: {
      executionCommitment: "0xexecution",
      nullifier: "0xnullifier",
      policyCommitment: "0xpolicy",
    },
    network: "undeployed",
  });

  const context = log.getContext();

  assert.equal(context.operation, "authorization");
  assert.equal(context.authorization?.policyCommitment, "0xpolicy");
  assert.equal("amount" in context, false);
  assert.equal("prompt" in context, false);
  assert.equal("toolArguments" in context, false);
});

test("evlog redacts zkMCP private fields before emit and local drain", async () => {
  const root = await mkdtemp(join(tmpdir(), "zkmcp-evlog-"));
  const logDir = join(root, "logs");

  try {
    initZkMcpLogger({
      localFiles: true,
      logDir,
      pretty: false,
      service: "zkmcp-core-test",
      silent: true,
    });

    const log = createLogger({
      amount: 2750,
      authorization: { policyCommitment: "0xpublic" },
      nonce: "private-nonce",
      policySecret: "private-policy-secret",
      prompt: "private prompt",
      toolArguments: { recipient: "private recipient" },
    });
    const event = log.emit();

    assert.ok(event);
    assert.equal(event.amount, "[PRIVATE]");
    assert.equal(event.nonce, "[PRIVATE]");
    assert.equal(event.policySecret, "[PRIVATE]");
    assert.equal(event.prompt, "[PRIVATE]");
    assert.equal(event.toolArguments, "[PRIVATE]");
    assert.deepEqual(event.authorization, { policyCommitment: "0xpublic" });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const events: Record<string, unknown>[] = [];
    for await (const storedEvent of readFsLogs({ dir: logDir })) {
      events.push(storedEvent);
    }

    assert.equal(events.length, 1);
    assert.equal(events[0]?.policySecret, "[PRIVATE]");
    assert.equal(events[0]?.amount, "[PRIVATE]");
    assert.deepEqual(events[0]?.authorization, {
      policyCommitment: "0xpublic",
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("privacy policy includes critical zkMCP secret paths", () => {
  assert.ok(privateLogPaths.includes("**.policySecret"));
  assert.ok(privateLogPaths.includes("**.prompt"));
  assert.ok(privateLogPaths.includes("**.toolArguments"));
  assert.ok(privateLogPaths.includes("**.amount"));
  assert.ok(privateLogPaths.includes("**.nonce"));
});
