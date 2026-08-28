import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import { resolveNetwork, getOrCreateWallet, getDeployment } from './network';
import { createWallet, persistWalletState, type WalletContext } from './wallet';
import {
  DEMO_AGENT_NAME,
  DEMO_TOOL_NAME,
  identifierDigest,
  loadOrCreateAuthorizationPrivateState,
  witnesses,
  type AuthorizationPrivateState,
} from './authorization-state';
import {
  Contract as AuthorizationContract,
  ledger as readAuthorizationLedger,
} from '../contracts/managed/authorization/contract/index.js';

// @ts-expect-error wallet-sdk requires a global WebSocket implementation
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'authorizationPrivateState';
const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'authorization');

const compiledContract = CompiledContract.make<AuthorizationContract<AuthorizationPrivateState>>(
  'authorization',
  AuthorizationContract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

function bytes32(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

function hex(value: Uint8Array): string {
  return `0x${Buffer.from(value).toString('hex')}`;
}

async function createProviders(walletCtx: WalletContext) {
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';
  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'authorization-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

type Attempt = {
  name: string;
  agent: Uint8Array;
  tool: Uint8Array;
  amount: bigint;
  approved: boolean;
  nonce: Uint8Array;
  expectAuthorized: boolean;
};

async function main() {
  const deployment = getDeployment(network);
  if (!deployment) {
    throw new Error(`No ${network} deployment. Run npm run setup first.`);
  }

  const privateState = loadOrCreateAuthorizationPrivateState();
  const walletCtx = await createWallet({ network, networkConfig, seed: WALLET.seed });

  try {
    await walletCtx.wallet.waitForSyncedState();
    await persistWalletState(network, walletCtx);
    const providers = await createProviders(walletCtx);

    const deployed: any = await findDeployedContract(providers, {
      compiledContract: compiledContract as any,
      contractAddress: deployment.address,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: privateState,
    });

    const validAgent = identifierDigest(DEMO_AGENT_NAME);
    const validTool = identifierDigest(DEMO_TOOL_NAME);
    const firstNonce = bytes32();

    const attempts: Attempt[] = [
      {
        name: 'under private limit',
        agent: validAgent,
        tool: validTool,
        amount: 2_750n,
        approved: false,
        nonce: firstNonce,
        expectAuthorized: true,
      },
      {
        name: 'over private maximum',
        agent: validAgent,
        tool: validTool,
        amount: 8_000n,
        approved: true,
        nonce: bytes32(),
        expectAuthorized: false,
      },
      {
        name: 'approval required but absent',
        agent: validAgent,
        tool: validTool,
        amount: 4_500n,
        approved: false,
        nonce: bytes32(),
        expectAuthorized: false,
      },
      {
        name: 'approval supplied',
        agent: validAgent,
        tool: validTool,
        amount: 4_500n,
        approved: true,
        nonce: bytes32(),
        expectAuthorized: true,
      },
      {
        name: 'wrong agent',
        agent: identifierDigest('UntrustedAgent'),
        tool: validTool,
        amount: 1_000n,
        approved: false,
        nonce: bytes32(),
        expectAuthorized: false,
      },
      {
        name: 'replay first authorization',
        agent: validAgent,
        tool: validTool,
        amount: 2_750n,
        approved: false,
        nonce: firstNonce,
        expectAuthorized: false,
      },
    ];

    console.log('\nzkMCP Phase 1 — private authorization proof\n');
    console.log(`Contract: ${deployment.address}`);
    console.log(`Network:  ${network}`);
    console.log('Private policy: [HIDDEN]');
    console.log('  allowed agent:       [HIDDEN]');
    console.log('  allowed tool:        [HIDDEN]');
    console.log('  maximum amount:      [HIDDEN]');
    console.log('  approval threshold:  [HIDDEN]\n');

    let passed = 0;
    for (const attempt of attempts) {
      process.stdout.write(`${attempt.expectAuthorized ? 'ALLOW' : 'DENY '}  ${attempt.name.padEnd(31)} `);
      try {
        const tx = await deployed.callTx.authorize(
          attempt.agent,
          attempt.tool,
          attempt.amount,
          attempt.approved,
          attempt.nonce,
        );
        if (!attempt.expectAuthorized) {
          console.log('❌ unexpectedly authorized');
          continue;
        }
        console.log(`✅ tx ${tx.public.txId.slice(0, 12)}… @ block ${tx.public.blockHeight}`);
        passed += 1;
      } catch (error) {
        if (attempt.expectAuthorized) {
          console.log(`❌ ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
        console.log('✅ blocked');
        passed += 1;
      }
    }

    const contractState = await providers.publicDataProvider.queryContractState(deployment.address);
    if (!contractState) throw new Error('Authorization contract state not found in indexer');
    const ledger = readAuthorizationLedger(contractState.data);

    console.log('\nPublic Midnight state');
    console.log(`  policy commitment:     ${hex(ledger.policyCommitment)}`);
    console.log(`  execution commitment:  ${hex(ledger.lastExecutionCommitment)}`);
    console.log(`  nullifier:             ${hex(ledger.lastNullifier)}`);
    console.log(`  authorization count:   ${ledger.authorizationCount}`);
    console.log('\nWhat remains private');
    console.log('  policy secret, agent/tool policy, amounts, threshold, approval context');

    if (passed !== attempts.length) {
      throw new Error(`Phase 1 demo failed: ${passed}/${attempts.length} cases behaved as expected`);
    }
    if (ledger.authorizationCount < 2n) {
      throw new Error(`Expected at least 2 committed authorizations, got ${ledger.authorizationCount}`);
    }

    console.log(`\n✅ Phase 1 authorization suite passed (${passed}/${attempts.length})\n`);
  } finally {
    await walletCtx.wallet.stop();
  }
}

main().catch((error) => {
  console.error('\n❌ Phase 1 demo failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
