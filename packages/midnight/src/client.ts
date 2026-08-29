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
  getZkMcpErrorMetadata,
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
  identifierDigest,
  loadOrCreateAuthorizationPrivateState,
  witnesses,
} from "./authorization-state.js";
import {
  getDeployment,
  getOrCreateWallet,
  type NetworkId,
  resolveNetwork,
} from "./network.js";
import {
  createWallet,
  persistWalletState,
  type WalletContext,
} from "./wallet.js";

// @ts-expect-error wallet-sdk requires a global WebSocket implementation
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = "authorizationPrivateState";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(
  __dirname,
  "..",
  "contracts",
  "managed",
  "authorization"
);

const ASSERTION_MARKERS = [
  "Private policy does not match committed policy",
  "Agent is not authorized by policy",
  "Tool is not authorized by policy",
  "Resource is not authorized by private policy",
  "Human approval required by private email policy",
  "Amount exceeds private payment limit",
  "Human approval required by private payment policy",
] as const;
const REPLAY_MARKER = "Authorization nonce has already been used";

export interface MidnightAuthorizationRequest {
  agent: string;
  amount?: bigint;
  approved?: boolean;
  resource?: string;
  tool: string;
}

export interface MidnightAuthorizationReceipt {
  blockHeight: number;
  contractAddress: string;
  executionCommitment: string;
  network: NetworkId;
  nullifier: string;
  policyCommitment: string;
  proofDurationMs: number;
  transactionId: string;
}

export interface MidnightAuthorizationClientOptions {
  network?: NetworkId;
}

function bytes32(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

function hex(value: Uint8Array): string {
  return `0x${Buffer.from(value).toString("hex")}`;
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` ${error.cause.message}` : "";
    return `${error.message}${cause}`;
  }
  return String(error);
}

function createProviders(
  walletCtx: WalletContext,
  networkConfig: ReturnType<typeof resolveNetwork>["config"]
) {
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

const compiledContract = CompiledContract.make<
  AuthorizationContract<AuthorizationPrivateState>
>("authorization", AuthorizationContract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath)
);

async function queryLedger(
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

function classifyAuthorizationFailure(error: unknown): Error {
  const text = errorText(error);

  if (text.includes(REPLAY_MARKER)) {
    return replayErrors.NULLIFIER_ALREADY_USED({ cause: toErrorCause(error) });
  }

  if (ASSERTION_MARKERS.some((marker) => text.includes(marker))) {
    return policyErrors.AUTHORIZATION_DENIED({ cause: toErrorCause(error) });
  }

  if (
    text.includes("Failed to connect to Proof Server") ||
    text.includes("ECONNREFUSED 127.0.0.1:6300") ||
    text.toLowerCase().includes("proof server")
  ) {
    return proofErrors.SERVER_UNAVAILABLE({ cause: toErrorCause(error) });
  }

  return proofErrors.GENERATION_FAILED({ cause: toErrorCause(error) });
}

export class MidnightAuthorizationClient {
  readonly contractAddress: string;
  readonly network: NetworkId;
  readonly policyCommitment: string;

  private authorizationTail: Promise<void> = Promise.resolve();
  private readonly deployed: any;
  private readonly providers: ReturnType<typeof createProviders>;
  private readonly walletCtx: WalletContext;

  private constructor(
    walletCtx: WalletContext,
    providers: ReturnType<typeof createProviders>,
    deployed: any,
    network: NetworkId,
    contractAddress: string,
    policyCommitment: string
  ) {
    this.walletCtx = walletCtx;
    this.providers = providers;
    this.deployed = deployed;
    this.network = network;
    this.contractAddress = contractAddress;
    this.policyCommitment = policyCommitment;
  }

  static async connect(
    options: MidnightAuthorizationClientOptions = {}
  ): Promise<MidnightAuthorizationClient> {
    const resolved = resolveNetwork(
      options.network
        ? { argv: ["node", "zkmcp", "--network", options.network] }
        : undefined
    );
    const { network, config: networkConfig } = resolved;
    const deployment = getDeployment(network);
    if (!deployment) {
      throw midnightErrors.CONTRACT_UNAVAILABLE();
    }

    const privateState = loadOrCreateAuthorizationPrivateState();
    const wallet = getOrCreateWallet(network);
    const walletCtx = await createWallet({
      network,
      networkConfig,
      seed: wallet.seed,
    });

    try {
      await walletCtx.wallet.waitForSyncedState();
      await persistWalletState(network, walletCtx);
      const providers = createProviders(walletCtx, networkConfig);

      let deployed: any;
      try {
        deployed = await findDeployedContract(providers, {
          compiledContract: compiledContract as any,
          contractAddress: deployment.address,
          initialPrivateState: privateState,
          privateStateId: PRIVATE_STATE_ID,
        });
      } catch (error) {
        throw midnightErrors.CONTRACT_UNAVAILABLE({
          cause: toErrorCause(error),
        });
      }

      const ledger = await queryLedger(providers, deployment.address);
      return new MidnightAuthorizationClient(
        walletCtx,
        providers,
        deployed,
        network,
        deployment.address,
        hex(ledger.policyCommitment)
      );
    } catch (error) {
      await walletCtx.wallet.stop();
      throw error;
    }
  }

  async authorize(
    request: MidnightAuthorizationRequest
  ): Promise<MidnightAuthorizationReceipt> {
    const previous = this.authorizationTail;
    let release!: () => void;
    this.authorizationTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await this.authorizeSerial(request);
    } finally {
      release();
    }
  }

  async close(): Promise<void> {
    await this.authorizationTail;
    await persistWalletState(this.network, this.walletCtx);
    await this.walletCtx.wallet.stop();
  }

  private async authorizeSerial(
    request: MidnightAuthorizationRequest
  ): Promise<MidnightAuthorizationReceipt> {
    const startedAt = performance.now();
    const log = createAuthorizationLogger({
      authorization: { policyCommitment: this.policyCommitment },
      contract: { address: this.contractAddress },
      network: this.network,
      stage: "request",
    });

    try {
      const tx = await this.deployed.callTx.authorize(
        identifierDigest(request.agent),
        identifierDigest(request.tool),
        identifierDigest(request.resource ?? ""),
        request.amount ?? 0n,
        request.approved ?? false,
        bytes32()
      );
      const proofDurationMs = Math.round(performance.now() - startedAt);
      const ledger = await queryLedger(this.providers, this.contractAddress);
      const receipt: MidnightAuthorizationReceipt = {
        blockHeight: tx.public.blockHeight,
        contractAddress: this.contractAddress,
        executionCommitment: hex(ledger.lastExecutionCommitment),
        network: this.network,
        nullifier: hex(ledger.lastNullifier),
        policyCommitment: this.policyCommitment,
        proofDurationMs,
        transactionId: tx.public.txId,
      };

      log.set({
        authorization: {
          executionCommitment: receipt.executionCommitment,
          nullifier: receipt.nullifier,
          policyCommitment: receipt.policyCommitment,
          proofDurationMs,
        },
        midnight: {
          blockHeight: receipt.blockHeight,
          transactionId: receipt.transactionId,
        },
        result: "authorized",
        stage: "midnight",
      });
      log.emit();
      return receipt;
    } catch (error) {
      const typedError = classifyAuthorizationFailure(error);
      const metadata = getZkMcpErrorMetadata(typedError);
      const isDenial =
        metadata.stage === "policy" || metadata.stage === "replay";
      log.set({
        authorization: {
          policyCommitment: this.policyCommitment,
          proofDurationMs: Math.round(performance.now() - startedAt),
        },
        failure: getPrivacySafeErrorMetadata(typedError),
        result: isDenial ? "denied" : "failed",
        stage: metadata.stage === "gateway" ? "midnight" : metadata.stage,
      });
      log.emit();
      throw typedError;
    }
  }
}

export function createMidnightAuthorizationClient(
  options?: MidnightAuthorizationClientOptions
): Promise<MidnightAuthorizationClient> {
  return MidnightAuthorizationClient.connect(options);
}
