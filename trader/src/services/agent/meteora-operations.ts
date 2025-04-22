import { Connection } from "@solana/web3.js";
import axios from "axios";
import { StrategyType } from "@meteora-ag/dlmm";
import { MeteoraService } from "../meteora";
import { logger } from "./logger";
import { ApiResponse } from "./types";
import { SOL_AMOUNT, SOL_MINT } from "./constants";

/**
 * Create a Meteora liquidity position via API
 */
export const createMeteoraPosition = async (params: {
  poolName: string;
  poolAddress: string;
  outputAmount: number;
  remainingSolAmount: number;
  minPrice: number;
  maxPrice: number;
}): Promise<{
  positionId: string;
  txId: string;
  explorerUrl: string;
} | null> => {
  const {
    poolName,
    poolAddress,
    outputAmount,
    remainingSolAmount,
    minPrice,
    maxPrice,
  } = params;
  try {
    // Use HTTP request to create position via API endpoint
    const apiResponse = await axios.post<ApiResponse>(
      `${process.env.API_BASE_URL || ""}/api/meteora/positions`,
      {
        poolName,
        poolAddress,
        maxPrice,
        minPrice,
        xAmount: outputAmount, // Amount of tokens received from swap
        yAmount: remainingSolAmount, // Remaining SOL amount
        openValue: SOL_AMOUNT,
        strategyType: "Spot",
      }
    );

    const result = apiResponse.data;
    if (!result.success) {
      throw new Error(result.error || "Failed to create position via API");
    }

    return {
      positionId: result.data.positionAddress,
      txId: result.data.txId,
      explorerUrl: result.data.explorerUrl,
    };
  } catch (error) {
    logger.error({
      message: `Error creating Meteora position`,
      poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Initialize Meteora service with a DLMM pool
 */
export const initializeMeteoraService = async (
  poolAddress: string,
  poolName: string
): Promise<MeteoraService | null> => {
  try {
    // Get connection
    const rpcEndpoint =
      process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcEndpoint, "confirmed");

    // Initialize Meteora service
    const meteora = new MeteoraService(connection);

    // Initialize the DLMM pool
    const initialized = await meteora.initializeDLMMPool(poolAddress);

    if (!initialized) {
      logger.error({
        message: `Failed to initialize Meteora DLMM pool for ${poolName}`,
        poolAddress,
      });
      return null;
    }

    return meteora;
  } catch (error) {
    logger.error({
      message: `Error initializing Meteora service for ${poolName}`,
      poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
