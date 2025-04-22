import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import axios from "axios";
import { getWallet } from "../wallet";
import { getQuote, executeSwap } from "../jupiter";
import { logger, tradingLogger } from "./logger";
import { DecimalsResponse } from "./types";
import { SOL_MINT } from "./constants";

/**
 * Get token decimals from API
 */
export const getTokenDecimals = async (
  mintAddress: string,
  poolName: string
): Promise<number | null> => {
  try {
    const decimalsResponse = await axios.get(
      `${process.env.API_BASE_URL || ""}/api/wallet/decimals`,
      {
        params: { mintAddress },
      }
    );

    const responseData = decimalsResponse.data as DecimalsResponse;

    if (!responseData.success) {
      logger.error({
        message: `Failed to get token decimals for ${poolName}`,
        error: responseData.error,
      });
      return null;
    }

    return responseData.data.decimals;
  } catch (error) {
    logger.error({
      message: `Error getting token decimals for ${poolName}`,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Swap SOL for pool tokens using Jupiter
 */
export const swapSolForPoolToken = async (
  poolTokenAddress: string,
  poolName: string,
  poolTokenInfo: any,
  decimals: number,
  solAmount: number
): Promise<{ txSignature: string | null; outputAmount: number | null }> => {
  try {
    const halfSolAmount = solAmount / 2;
    const solAmountLamports = halfSolAmount * 1e9; // Convert to lamports

    // Get Jupiter quote
    const quoteResponse = await getQuote({
      inputMint: SOL_MINT,
      outputMint: poolTokenAddress,
      amount: solAmountLamports,
      slippageBps: 100, // 1% slippage
    });

    const expectedOutputAmount = Number(quoteResponse.outAmount);

    // Execute token swap
    const wallet = await getWallet();
    const rpcEndpoint =
      process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcEndpoint, "confirmed");

    const txSignature = await executeSwap({
      quoteResponse,
      wallet,
      connection,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
    });

    tradingLogger.info({
      message: `Successfully swapped SOL for ${poolTokenInfo.name} tokens`,
      pool: poolName,
      outputAmount: expectedOutputAmount / Math.pow(10, decimals),
      txSignature: txSignature,
      explorerUrl: `https://solscan.io/tx/${txSignature}`,
    });

    return { txSignature, outputAmount: expectedOutputAmount };
  } catch (error) {
    logger.error({
      message: `Error swapping SOL for ${poolName} tokens`,
      error: error instanceof Error ? error.message : String(error),
    });
    return { txSignature: null, outputAmount: null };
  }
};
