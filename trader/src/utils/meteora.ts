import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import DLMM, { LbPosition, StrategyType } from "@meteora-ag/dlmm";
import { BN } from "@coral-xyz/anchor";
import { buildOptimalTransaction } from "./opTx";

export class MeteoraClient {
  private connection: Connection;
  private dlmmPool: DLMM | null = null;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async initializeDLMMPool(poolAddress: string) {
    try {
      this.dlmmPool = await DLMM.create(
        this.connection,
        new PublicKey(poolAddress)
      );
      return true;
    } catch (error) {
      console.error("Failed to initialize DLMM pool:", error);
      return false;
    }
  }

  async getActiveBinPrice() {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");

    try {
      const activeBin = await this.dlmmPool.getActiveBin();
      return {
        binId: activeBin.binId,
        priceInLamports: activeBin.price,
        realPrice: this.dlmmPool.fromPricePerLamport(Number(activeBin.price)),
      };
    } catch (error) {
      console.error("Failed to get active bin price:", error);
      throw error;
    }
  }

  async getUserPositions(userPublicKey: PublicKey) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");

    try {
      const { userPositions } = await this.dlmmPool.getPositionsByUserAndLbPair(
        userPublicKey
      );
      return userPositions;
    } catch (error) {
      console.error("Failed to get user positions:", error);
      throw error;
    }
  }

  getBinIdFromPrice(price: number, min: boolean) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");
    return this.dlmmPool.getBinIdFromPrice(price, min);
  }

  async createPosition(props: {
    user: Keypair;
    xAmount: number;
    yAmount: number;
    maxBinId: number;
    minBinId: number;
    strategyType: StrategyType;
  }) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");
    const { user, xAmount, yAmount, maxBinId, minBinId, strategyType } = props;
    try {
      const newPosition = new Keypair();
      const totalXAmount = new BN(xAmount);
      const totalYAmount = new BN(yAmount);

      const createPositionTx =
        await this.dlmmPool.initializePositionAndAddLiquidityByStrategy({
          positionPubKey: newPosition.publicKey,
          user: user.publicKey,
          totalXAmount,
          totalYAmount,
          strategy: {
            maxBinId,
            minBinId,
            strategyType,
          },
        });

      const { opTx, blockhash, lastValidBlockHeight } = await buildOptimalTransaction({
        transaction: createPositionTx,
        connection: this.connection,
        publicKey: user.publicKey,
        signers: [user, newPosition],
      });

      opTx.sign([user, newPosition]);
      const rawTx = opTx.serialize();
      const txId = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      });

      await this.connection.confirmTransaction({
        signature: txId,
        blockhash,
        lastValidBlockHeight,
      });

      return {
        positionAddress: newPosition.publicKey.toString(),
        txId,
      };
    } catch (error) {
      console.error("Failed to create position:", error);
      throw error;
    }
  }

  async removeLiquidity(
    user: Keypair,
    positionAddress: string,
    fromBinId: number,
    toBinId: number
  ) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");

    try {
      const txs = await this.dlmmPool.removeLiquidity({
        position: new PublicKey(positionAddress),
        user: user.publicKey,
        fromBinId,
        toBinId,
        bps: new BN(10000),
      });

      const txArray = Array.isArray(txs) ? txs : [txs];
      const txHashes = [];

      for (const tx of txArray) {
        const { opTx, blockhash, lastValidBlockHeight } = await buildOptimalTransaction({
          transaction: tx,
          connection: this.connection,
          publicKey: user.publicKey,
          signers: [user],
        });

        opTx.sign([user]);
        const rawTx = opTx.serialize();
        const txHash = await this.connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        await this.connection.confirmTransaction({
          signature: txHash,
          blockhash,
          lastValidBlockHeight,
        });

        txHashes.push(txHash);
      }

      return txHashes.length === 1 ? txHashes[0] : txHashes;
    } catch (error) {
      console.error("Failed to remove liquidity:", error);
      throw error;
    }
  }

  async executeSwap(
    user: Keypair,
    amount: BN,
    swapYtoX: boolean,
    minOutAmount: BN
  ) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");

    try {
      const binArrays = await this.dlmmPool.getBinArrayForSwap(swapYtoX);
      const swapTx = await this.dlmmPool.swap({
        inToken: swapYtoX
          ? this.dlmmPool.tokenY.publicKey
          : this.dlmmPool.tokenX.publicKey,
        binArraysPubkey: binArrays.map((array) => array.publicKey),
        inAmount: amount,
        lbPair: this.dlmmPool.pubkey,
        user: user.publicKey,
        minOutAmount,
        outToken: swapYtoX
          ? this.dlmmPool.tokenX.publicKey
          : this.dlmmPool.tokenY.publicKey,
      });

      const { opTx, blockhash, lastValidBlockHeight } = await buildOptimalTransaction({
        transaction: swapTx,
        connection: this.connection,
        publicKey: user.publicKey,
        signers: [user],
      });

      opTx.sign([user]);
      const rawTx = opTx.serialize();
      const txHash = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      });

      await this.connection.confirmTransaction({
        signature: txHash,
        blockhash,
        lastValidBlockHeight,
      });

      return txHash;
    } catch (error) {
      console.error("Failed to execute swap:", error);
      throw error;
    }
  }

  async claimAllRewards(user: Keypair, positions: LbPosition[]) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");

    try {
      const txs = await this.dlmmPool.claimAllRewards({
        owner: user.publicKey,
        positions,
      });

      const txHashes = [];
      for (const tx of txs) {
        const { opTx, blockhash, lastValidBlockHeight } = await buildOptimalTransaction({
          transaction: tx,
          connection: this.connection,
          publicKey: user.publicKey,
          signers: [user],
        });

        opTx.sign([user]);
        const rawTx = opTx.serialize();
        const txHash = await this.connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        await this.connection.confirmTransaction({
          signature: txHash,
          blockhash,
          lastValidBlockHeight,
        });

        txHashes.push(txHash);
      }

      return txHashes;
    } catch (error) {
      console.error("Failed to claim rewards:", error);
      throw error;
    }
  }

  async createMultiplePositions(props: {
    user: Keypair;
    xAmount: number;
    yAmount: number;
    maxBinId: number;
    minBinId: number;
    strategyType: StrategyType;
  }) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");
    const { user, xAmount, yAmount, maxBinId, minBinId, strategyType } = props;

    try {
      const quote = await this.dlmmPool.quoteCreatePosition({
        strategy: {
          maxBinId,
          minBinId,
          strategyType,
        },
      });

      if (quote.positionCount === 1) {
        return [await this.createPosition(props)];
      }

      const totalBinRange = maxBinId - minBinId;
      const binRangePerPosition = Math.ceil(totalBinRange / quote.positionCount);

      const positions = [];
      let currentMinBin = minBinId;

      const xAmountPerPosition = xAmount / quote.positionCount;
      const yAmountPerPosition = yAmount / quote.positionCount;

      for (let i = 0; i < quote.positionCount; i++) {
        const positionMaxBin = Math.min(
          currentMinBin + binRangePerPosition,
          maxBinId
        );

        const position = await this.createPosition({
          user,
          xAmount: xAmountPerPosition,
          yAmount: yAmountPerPosition,
          minBinId: currentMinBin,
          maxBinId: positionMaxBin,
          strategyType,
        });

        positions.push(position);
        currentMinBin = positionMaxBin + 1;

        if (currentMinBin >= maxBinId) {
          break;
        }
      }

      return positions;
    } catch (error) {
      console.error("Failed to create multiple positions:", error);
      throw error;
    }
  }
}