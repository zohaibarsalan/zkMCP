import { randomBytes } from "node:crypto";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {
  createAuthorizationLogger,
  getPrivacySafeErrorMetadata,
  getSafeErrorPresentation,
  getZkMcpErrorMetadata,
  initZkMcpLogger,
  isZkMcpError,
  midnightErrors,
  policyErrors,
  proofErrors,
  replayErrors,
  toErrorCause,
} from "@zkmcp/core";
import { WebSocket } from "ws";
import {
  Contract as AuthorizationContract,
  ledger as readAuthorizationLedger,
} from "../contracts/managed/authorization/contract/index.js";
import {
  type AuthorizationPrivateState,
  DEMO_AGENT_NAME,
  DEMO_TOOL_NAME,
  identifierDigest,
  loadOrCreateAuthorizationPrivateState,
  witnesses,
} from "./authorization-state";
import { getDeployment, getOrCreateWallet, resolveNetwork } from "./network";
import { createWallet, persistWalletState, type WalletContext } from "./wallet";

// @ts-expect-error wallet-sdk requires a global WebSocket implementation
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = "authorizationPrivateState";
const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(
  __dirname,
  "..",
  "contracts",
  "managed",
  "authorization"
);

initZkMcpLogger({
  service: "zkmcp-midnight",
  silent: true,
});

const compiledContract = CompiledContract.make<
  AuthorizationContract<AuthorizationPrivateState>
>("authorization", AuthorizationContract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath)
);

function bytes32(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

function hex(value: Uint8Array): string {
  return `0x${Buffer.from(value).toString("hex")}`;
}

function createProviders(walletCtx: WalletContext) {
  const privateStatePassword =
    process.env.PRIVATE_STATE_PASSWORD?.trim() ||
    "Local-Devnet-Development-Placeholder-1";
  const walletProvider = {
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        {
          dustSecretKey: walletCtx.dustSecretKey,
          shieldedSecretKeys: walletCtx.shieldedSecretKeys,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () =>
      walletCtx.shieldedSecretKeys.encryptionPublicKey,
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    midnightProvider: walletProvider,
    privateStateProvider: levelPrivateStateProvider({
      accountId,
      privateStateStoreName: "authorization-state",
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    proofProvider: httpClientProofProvider(
      networkConfig.proofServer,
      zkConfigProvider
    ),
    publicDataProvider: indexerPublicDataProvider(
      networkConfig.indexer,
      networkConfig.indexerWS
    ),
    walletProvider,
    zkConfigProvider,
  };
}

type DenialReason = "agent" | "amount" | "approval" | "replay";

interface Attempt {
  agent: Uint8Array;
  amount: bigint;
  approved: boolean;
  denialReason?: DenialReason;
  expectAuthorized: boolean;
  name: string;
  nonce: Uint8Array;
  tool: Uint8Array;
}

function denialError(reason: DenialReason) {
  switch (reason) {
    case "agent":
      return policyErrors.AGENT_NOT_AUTHORIZED();
    case "amount":
      return policyErrors.AMOUNT_EXCEEDS_LIMIT();
    case "approval":
      return policyErrors.APPROVAL_REQUIRED();
    case "replay":
      return replayErrors.NULLIFIER_ALREADY_USED();
    default:
      return policyErrors.INVALID_POLICY_STATE();
  }
}

function logStageForError(
  error: unknown
): "policy" | "proof" | "replay" | "midnight" {
  const { stage } = getZkMcpErrorMetadata(error);
  if (stage === "policy" || stage === "proof" || stage === "replay") {
    return stage;
  }
  return "midnight";
}

async function queryAuthorizationLedger(
  providers: ReturnType<typeof createProviders>,
  contractAddress: string
) {
  try {
    const contractState =
      await providers.publicDataProvider.queryContractState(contractAddress);
    if (!contractState) {
      throw midnightErrors.INDEXER_UNAVAILABLE();
    }
    return readAuthorizationLedger(contractState.data);
  } catch (error) {
    if (isZkMcpError(error)) {
      throw error;
    }
    throw midnightErrors.INDEXER_UNAVAILABLE({ cause: toErrorCause(error) });
  }
}

async function main() {
  const deployment = getDeployment(network);
  if (!deployment) {
    throw midnightErrors.CONTRACT_UNAVAILABLE();
  }

  const privateState = loadOrCreateAuthorizationPrivateState();
  const walletCtx = await createWallet({
    network,
    networkConfig,
    seed: WALLET.seed,
  });

  try {
    await walletCtx.wallet.waitForSyncedState();
    await persistWalletState(network, walletCtx);
    const providers = createProviders(walletCtx);

    let deployed: any;
    try {
      deployed = await findDeployedContract(providers, {
        compiledContract: compiledContract as any,
        contractAddress: deployment.address,
        initialPrivateState: privateState,
        privateStateId: PRIVATE_STATE_ID,
      });
    } catch (error) {
      throw midnightErrors.CONTRACT_UNAVAILABLE({ cause: toErrorCause(error) });
    }

    const initialLedger = await queryAuthorizationLedger(
      providers,
      deployment.address
    );
    const publicPolicyCommitment = hex(initialLedger.policyCommitment);
    const validAgent = identifierDigest(DEMO_AGENT_NAME);
    const validTool = identifierDigest(DEMO_TOOL_NAME);
    const firstNonce = bytes32();

    const attempts: Attempt[] = [
      {
        agent: validAgent,
        amount: 2_750n,
        approved: false,
        expectAuthorized: true,
        name: "under private limit",
        nonce: firstNonce,
        tool: validTool,
      },
      {
        agent: validAgent,
        amount: 8_000n,
        approved: true,
        denialReason: "amount",
        expectAuthorized: false,
        name: "over private maximum",
        nonce: bytes32(),
        tool: validTool,
      },
      {
        agent: validAgent,
        amount: 4_500n,
        approved: false,
        denialReason: "approval",
        expectAuthorized: false,
        name: "approval required but absent",
        nonce: bytes32(),
        tool: validTool,
      },
      {
        agent: validAgent,
        amount: 4_500n,
        approved: true,
        expectAuthorized: true,
        name: "approval supplied",
        nonce: bytes32(),
        tool: validTool,
      },
      {
        agent: identifierDigest("UntrustedAgent"),
        amount: 1_000n,
        approved: false,
        denialReason: "agent",
        expectAuthorized: false,
        name: "wrong agent",
        nonce: bytes32(),
        tool: validTool,
      },
      {
        agent: validAgent,
        amount: 2_750n,
        approved: false,
        denialReason: "replay",
        expectAuthorized: false,
        name: "replay first authorization",
        nonce: firstNonce,
        tool: validTool,
      },
    ];

    console.log("\nzkMCP Phase 1 — private authorization proof\n");
    console.log(`Contract: ${deployment.address}`);
    console.log(`Network:  ${network}`);
    console.log("Private policy: [HIDDEN]");
    console.log("  allowed agent:       [HIDDEN]");
    console.log("  allowed tool:        [HIDDEN]");
    console.log("  maximum amount:      [HIDDEN]");
    console.log("  approval threshold:  [HIDDEN]\n");

    let passed = 0;
    for (const attempt of attempts) {
      const authorizationLog = createAuthorizationLogger({
        authorization: { policyCommitment: publicPolicyCommitment },
        contract: { address: deployment.address },
        network,
        stage: "request",
      });
      const startedAt = performance.now();

      process.stdout.write(
        `${attempt.expectAuthorized ? "ALLOW" : "DENY "}  ${attempt.name.padEnd(31)} `
      );

      try {
        const tx = await deployed.callTx.authorize(
          attempt.agent,
          attempt.tool,
          attempt.amount,
          attempt.approved,
          attempt.nonce
        );
        const proofDurationMs = Math.round(performance.now() - startedAt);

        if (!attempt.expectAuthorized) {
          const typedError = midnightErrors.INVALID_STATE();
          authorizationLog.set({
            authorization: {
              policyCommitment: publicPolicyCommitment,
              proofDurationMs,
            },
            failure: getPrivacySafeErrorMetadata(typedError),
            midnight: {
              blockHeight: tx.public.blockHeight,
              transactionId: tx.public.txId,
            },
            result: "failed",
            stage: "midnight",
          });
          authorizationLog.emit();
          console.log("❌ unexpectedly authorized");
          continue;
        }

        authorizationLog.set({
          authorization: {
            policyCommitment: publicPolicyCommitment,
            proofDurationMs,
          },
          midnight: {
            blockHeight: tx.public.blockHeight,
            transactionId: tx.public.txId,
          },
          result: "authorized",
          stage: "midnight",
        });
        authorizationLog.emit();
        console.log(
          `✅ tx ${tx.public.txId.slice(0, 12)}… @ block ${tx.public.blockHeight}`
        );
        passed += 1;
      } catch (error) {
        const proofDurationMs = Math.round(performance.now() - startedAt);

        if (!attempt.expectAuthorized && attempt.denialReason) {
          const typedError = denialError(attempt.denialReason);
          authorizationLog.set({
            authorization: {
              policyCommitment: publicPolicyCommitment,
              proofDurationMs,
            },
            failure: getPrivacySafeErrorMetadata(typedError),
            result: "denied",
            stage: logStageForError(typedError),
          });
          authorizationLog.emit();
          console.log("✅ blocked");
          passed += 1;
          continue;
        }

        const typedError = proofErrors.GENERATION_FAILED({
          cause: toErrorCause(error),
        });
        const safeError = getSafeErrorPresentation(typedError);
        authorizationLog.set({
          authorization: {
            policyCommitment: publicPolicyCommitment,
            proofDurationMs,
          },
          failure: getPrivacySafeErrorMetadata(typedError),
          result: "failed",
          stage: "proof",
        });
        authorizationLog.emit();
        console.log(`❌ [${safeError.code}] ${safeError.message}`);
      }
    }

    const ledger = await queryAuthorizationLedger(
      providers,
      deployment.address
    );

    console.log("\nPublic Midnight state");
    console.log(`  policy commitment:     ${hex(ledger.policyCommitment)}`);
    console.log(
      `  execution commitment:  ${hex(ledger.lastExecutionCommitment)}`
    );
    console.log(`  nullifier:             ${hex(ledger.lastNullifier)}`);
    console.log(`  authorization count:   ${ledger.authorizationCount}`);
    console.log("\nWhat remains private");
    console.log(
      "  policy secret, agent/tool policy, amounts, threshold, approval context"
    );

    if (passed !== attempts.length || ledger.authorizationCount < 2n) {
      throw midnightErrors.INVALID_STATE();
    }

    console.log(
      `\n✅ Phase 1 authorization suite passed (${passed}/${attempts.length})\n`
    );
  } finally {
    await walletCtx.wallet.stop();
  }
}

main().catch((error) => {
  const typedError = isZkMcpError(error)
    ? error
    : midnightErrors.INVALID_STATE({ cause: toErrorCause(error) });
  const safeError = getSafeErrorPresentation(typedError);
  const failureLog = createAuthorizationLogger({
    failure: getPrivacySafeErrorMetadata(typedError),
    network,
    result: "failed",
    stage: logStageForError(typedError),
  });
  failureLog.emit();

  console.error(
    `\n❌ Phase 1 demo failed [${safeError.code}]: ${safeError.message}`
  );
  if (safeError.fix) {
    console.error(`   ${safeError.fix}`);
  }
  process.exit(1);
});
