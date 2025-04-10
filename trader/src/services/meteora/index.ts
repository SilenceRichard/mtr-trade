import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import DLMM, { LbPosition, StrategyType } from "@meteora-ag/dlmm";
import { BN } from "@coral-xyz/anchor";
import { buildOptimalTransaction } from "../../utils/transaction";



export class MeteoraService {
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

  toPricePerLamport(realPrice: string | number): string {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");
    return this.dlmmPool.toPricePerLamport(Number(realPrice));
  }

  async createPosition(props: {
    user: Keypair;
    xAmount: string | number;
    yAmount: string | number;
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

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');

      const { opTx } = await buildOptimalTransaction({
        transaction: createPositionTx,
        connection: this.connection,
        publicKey: user.publicKey,
        signers: [user, newPosition],
      });

      opTx.sign([user, newPosition]);
      const rawTx = opTx.serialize();
      const txId = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 5,
        preflightCommitment: 'confirmed',
      });

      await this.connection.confirmTransaction({
        signature: txId,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return {
        positionAddress: newPosition.publicKey.toString(),
        txId,
      };
    } catch (error) {
      console.error("Failed to create position:", error);
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

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');

      const { opTx } = await buildOptimalTransaction({
        transaction: swapTx,
        connection: this.connection,
        publicKey: user.publicKey,
        signers: [user],
      });

      opTx.sign([user]);
      const rawTx = opTx.serialize();
      const txHash = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 5,
        preflightCommitment: 'confirmed',
      });

      await this.connection.confirmTransaction({
        signature: txHash,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return txHash;
    } catch (error) {
      console.error("Failed to execute swap:", error);
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
        bps: new BN(10000), // 100% of liquidity
      });

      const txArray = Array.isArray(txs) ? txs : [txs];
      const txHashes = [];

      for (const tx of txArray) {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');

        const { opTx } = await buildOptimalTransaction({
          transaction: tx,
          connection: this.connection,
          publicKey: user.publicKey,
          signers: [user],
        });

        opTx.sign([user]);
        const rawTx = opTx.serialize();
        const txHash = await this.connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 5,
          preflightCommitment: 'confirmed',
        });

        await this.connection.confirmTransaction({
          signature: txHash,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        txHashes.push(txHash);
      }

      return txHashes.length === 1 ? txHashes[0] : txHashes;
    } catch (error) {
      console.error("Failed to remove liquidity:", error);
      throw error;
    }
  }

  async claimFee(
    user: Keypair,
    positionAddress: string
  ) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");

    try {
      // First get the position
      const position = await this.dlmmPool.getPosition(new PublicKey(positionAddress));
      
      // Then claim rewards
      const txs = await this.dlmmPool.claimAllRewards({
        owner: user.publicKey,
        positions: [position],
      });

      const txHashes = [];
      for (const tx of txs) {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');

        const { opTx } = await buildOptimalTransaction({
          transaction: tx,
          connection: this.connection,
          publicKey: user.publicKey,
          signers: [user],
        });

        opTx.sign([user]);
        const rawTx = opTx.serialize();
        const txHash = await this.connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 5,
          preflightCommitment: 'confirmed',
        });

        await this.connection.confirmTransaction({
          signature: txHash,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        txHashes.push(txHash);
      }

      return txHashes.length === 1 ? txHashes[0] : txHashes;
    } catch (error) {
      console.error("Failed to claim fee:", error);
      throw error;
    }
  }

  async closePosition(
    user: Keypair,
    positionAddress: string
  ) {
    if (!this.dlmmPool) throw new Error("DLMM pool not initialized");

    try {
      // First get the position
      const position = await this.dlmmPool.getPosition(new PublicKey(positionAddress));
      
      // Close the position
      const tx = await this.dlmmPool.closePosition({
        owner: user.publicKey,
        position: position,
      });

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');

      const { opTx } = await buildOptimalTransaction({
        transaction: tx,
        connection: this.connection,
        publicKey: user.publicKey,
        signers: [user],
      });

      opTx.sign([user]);
      const rawTx = opTx.serialize();
      const txHash = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 5,
        preflightCommitment: 'confirmed',
      });

      await this.connection.confirmTransaction({
        signature: txHash,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return txHash;
    } catch (error) {
      console.error("Failed to close position:", error);
      throw error;
    }
  }
} 