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
} 