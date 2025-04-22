import { logger, tradingLogger } from "./logger";
import { MeteoraService } from "../meteora";
import {
  AUTO_CLOSE_LOSS_THRESHOLD,
  AUTO_CLOSE_PROFIT_THRESHOLD,
  POSITION_MONITORING_INTERVAL_MS,
  SOL_AMOUNT,
  SOL_MINT,
} from "./constants";
import { getQuote } from "../jupiter";
import { getTokenDecimals } from "./token-operations";
import { closePosition } from "./position-close";
import { Connection } from "@solana/web3.js";
import { getWallet } from "../wallet";
import { detectedPools } from "./pools";

// Position monitoring
const positionMonitoringInstances: Map<string, NodeJS.Timeout> = new Map();

// Set to track positions that are currently being processed
const processingPositions = new Set<string>();

// Map to track position info fetch failures
const positionFailureCount: Map<string, number> = new Map();

/**
 * Calculate position profit
 */
export const calculatePositionProfit = async (position: {
  totalXAmount: string;
  totalYAmount: string;
  feeYExcludeTransferFee: string;
  xDecimals: number;
  yDecimals: number;
  xMint?: string;
  yMint?: string;
  openValue?: number;
}) => {
  try {
    // Calculate Y amount (already in SOL/native token)
    const yAmount =
      parseFloat(position.totalYAmount) / Math.pow(10, position.yDecimals);

    // Calculate fees
    const feeSol =
      parseFloat(position.feeYExcludeTransferFee) /
      Math.pow(10, position.yDecimals);

    // Get X amount in SOL if x token is not SOL and has a mint address
    let xValueInSol = 0;
    if (position.xMint && position.yMint && position.xMint !== position.yMint) {
      const xAmount = parseFloat(position.totalXAmount);
      if (xAmount > 0) {
        // Call Jupiter API to get quote for X token to SOL conversion
        const quoteResponse = await getQuote({
          inputMint: position.xMint,
          outputMint: position.yMint,
          amount: xAmount.toString(),
        });

        if (quoteResponse) {
          xValueInSol =
            parseFloat(quoteResponse.outAmount) /
            Math.pow(10, position.yDecimals);
        }
      }
    }

    // Total amount includes both Y amount and X amount converted to SOL
    const totalAmount = yAmount + xValueInSol;
    const totalValue = totalAmount + feeSol;

    // Calculate profit if openValue is available
    const openValue = position.openValue || 0;
    const profit = totalValue - openValue;
    const profitRate =
      openValue === 0 ? 0 : ((totalValue - openValue) / openValue) * 100;

    return {
      totalAmountInSol: totalAmount,
      totalSolFees: feeSol,
      totalValue,
      profit,
      profitRate,
    };
  } catch (error) {
    logger.error({
      message: `Error calculating position profit`,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      totalAmountInSol: 0,
      totalSolFees: 0,
      totalValue: 0,
      profit: 0,
      profitRate: 0,
    };
  }
};

// Function to start monitoring a specific position
export const startPositionMonitoring = (params: {
  meteora: MeteoraService;
  positionId: string;
  poolName: string;
  poolAddress: string;
  mintAddress: string;
}) => {
  const { meteora, positionId, poolName, poolAddress, mintAddress } = params;
  // Stop any existing monitoring for this position
  if (positionMonitoringInstances.has(positionId)) {
    clearInterval(positionMonitoringInstances.get(positionId)!);
  }

  // Reset failure count when starting/restarting monitoring
  positionFailureCount.set(positionId, 0);

  // Create a new monitoring interval
  const intervalId = setInterval(async () => {
    try {
      const position = await meteora.getPositionInfo(positionId);
      // Reset failure count on success
      positionFailureCount.set(positionId, 0);
      
      // Get processedPosition from the position
      const { positionData } = position;
      // Get pool info to access token info
      const openValue = SOL_AMOUNT;
      // Get token decimals - we need to estimate these based on standard decimals
      // Usually SOL and most SPL tokens have 9 decimals, some have 6
      const xDecimals = await getTokenDecimals(mintAddress, poolName); // Default to x decimals
      const yDecimals = await getTokenDecimals(SOL_MINT, poolName); // Default to SOL decimals

      // Calculate profit
      const profitInfo = await calculatePositionProfit({
        totalXAmount: positionData.totalXAmount.toString(),
        totalYAmount: positionData.totalYAmount.toString(),
        feeYExcludeTransferFee: positionData.feeYExcludeTransferFee.toString(),
        xDecimals: xDecimals || 6,
        yDecimals: yDecimals || 9,
        xMint: mintAddress,
        yMint: SOL_MINT,
        openValue,
      });

      // Check if position is already being processed
      if (processingPositions.has(positionId)) {
        return;
      }

      // Check if profit rate exceeds threshold for auto-closing
      if (
        profitInfo.profitRate > AUTO_CLOSE_PROFIT_THRESHOLD ||
        profitInfo.profitRate < AUTO_CLOSE_LOSS_THRESHOLD
      ) {
        // Lock this position before processing
        processingPositions.add(positionId);

        tradingLogger.info({
          message: `Auto-closing position due to ${
            profitInfo.profitRate > AUTO_CLOSE_PROFIT_THRESHOLD
              ? "high profit rate"
              : "loss rate"
          }`,
          positionId,
          poolName,
          profitRate: `${profitInfo.profitRate.toFixed(2)}%`,
          threshold: `${
            profitInfo.profitRate > AUTO_CLOSE_PROFIT_THRESHOLD
              ? AUTO_CLOSE_PROFIT_THRESHOLD
              : AUTO_CLOSE_LOSS_THRESHOLD
          }%`,
        });

        // Stop monitoring this position
        stopPositionMonitoring(positionId);

        try {
          // Initialize connection and wallet
          const connection = new Connection(
            process.env.RPC_ENDPOINT || "",
            "confirmed"
          );

          // Close the position
          const closeResult = await closePosition({
            poolAddress,
            positionId,
            mintAddress,
            connection,
            lowerBinId: positionData.lowerBinId,
            upperBinId: positionData.upperBinId,
            xDecimals: xDecimals || 6,
            yDecimals: yDecimals || 9,
            profitData: {
              profit: profitInfo.profit,
              profitRate: profitInfo.profitRate,
              fees: profitInfo.totalSolFees,
              postionSOLAmount: Number(positionData.totalYAmount) / 1e9,
            },
          });

          if (closeResult) {
            tradingLogger.info({
              message: `Successfully closed position with high profit`,
              positionId,
              poolName,
              profitRate: `${profitInfo.profitRate.toFixed(2)}%`,
            });

            // Remove the pool from detectedPools if it exists
            if (poolAddress && detectedPools.has(poolAddress)) {
              detectedPools.delete(poolAddress);
              tradingLogger.info({
                message: `Removed pool from detected pools after closing position`,
                poolAddress,
                poolName,
                remainingDetectedPools: detectedPools.size,
              });
            }
          } else {
            logger.error({
              message: `Failed to close position despite high profit`,
              positionId,
              poolName,
              profitRate: `${profitInfo.profitRate.toFixed(2)}%`,
            });

            // Restart monitoring in case of failure
            startPositionMonitoring({
              meteora,
              positionId,
              poolName,
              poolAddress,
              mintAddress,
            });
          }
        } finally {
          // Always release the lock, even if an error occurs
          processingPositions.delete(positionId);
        }
      }
    } catch (error) {
      // Increment failure count
      const currentFailures = positionFailureCount.get(positionId) || 0;
      const newFailureCount = currentFailures + 1;
      positionFailureCount.set(positionId, newFailureCount);
      
      logger.error({
        message: `Error monitoring position ${positionId} for ${poolName}`,
        error: error instanceof Error ? error.message : String(error),
        failureCount: newFailureCount,
      });
      
      // If three consecutive failures, stop monitoring this position
      if (newFailureCount >= 3) {
        logger.error({
          message: `Stopping position monitoring after 3 consecutive failures`,
          positionId,
          poolName,
        });
        
        stopPositionMonitoring(positionId);
        
        // Remove the pool from detectedPools if it exists
        if (poolAddress && detectedPools.has(poolAddress)) {
          detectedPools.delete(poolAddress);
          tradingLogger.info({
            message: `Removed pool from detected pools after failure threshold`,
            poolAddress,
            poolName,
            remainingDetectedPools: detectedPools.size,
          });
        }
        
        // Remove failure count tracking
        positionFailureCount.delete(positionId);
      }
    }
  }, POSITION_MONITORING_INTERVAL_MS);

  // Store the interval ID
  positionMonitoringInstances.set(positionId, intervalId);

  tradingLogger.info({
    message: `Started position monitoring for ${poolName}`,
    positionId,
    interval: `${POSITION_MONITORING_INTERVAL_MS}ms`,
  });
};

// Function to stop monitoring a specific position
export const stopPositionMonitoring = (positionId: string) => {
  if (positionMonitoringInstances.has(positionId)) {
    clearInterval(positionMonitoringInstances.get(positionId)!);
    positionMonitoringInstances.delete(positionId);
    tradingLogger.info({
      message: `Stopped position monitoring`,
      positionId,
    });
  }
};

// Function to stop all position monitoring instances
export const stopAllPositionMonitoring = () => {
  for (const [
    positionId,
    intervalId,
  ] of positionMonitoringInstances.entries()) {
    clearInterval(intervalId);
    tradingLogger.info({
      message: `Stopped position monitoring`,
      positionId,
    });
  }
  positionMonitoringInstances.clear();
};

export const getPositionMonitoringCount = (): number => {
  return positionMonitoringInstances.size;
};
