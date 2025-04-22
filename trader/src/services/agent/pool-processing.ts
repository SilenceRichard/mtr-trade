import { Connection } from "@solana/web3.js";
import { StrategyType } from "@meteora-ag/dlmm";
import { logger, tradingLogger } from "./logger";
import { Pool } from "./types";
import { checkPools, detectedPools } from "./pools";
import { getTokenDecimals, swapSolForPoolToken } from "./token-operations";
import {
  createMeteoraPosition,
  initializeMeteoraService,
} from "./meteora-operations";
import { startPositionMonitoring } from "./position-monitoring";
import { SOL_AMOUNT } from "./constants";

/**
 * Process a high yield pool
 */
export const processHighYieldPool = async (pool: Pool) => {
  const poolAddress = pool.poolAddress;
  const poolName = pool.poolName;
  const poolTokenAddress = pool.tokenAddress;
  const poolTokenInfo = pool.tokenInfo;

  try {
    // Step 1: Get token decimals
    const decimals = await getTokenDecimals(poolTokenAddress, poolName);
    if (decimals === null) return;

    // Step 2: Swap SOL for pool tokens
    const { txSignature, outputAmount } = await swapSolForPoolToken(
      poolTokenAddress,
      poolName,
      poolTokenInfo,
      decimals,
      SOL_AMOUNT
    );

    if (txSignature && outputAmount) {
      tradingLogger.info({
        message: `Received ${outputAmount} ${poolTokenInfo.name} tokens from swap`,
        pool: poolName,
        txSignature,
      });
    }

    // Step 3: Create liquidity position
    try {
      if (txSignature && outputAmount) {
        // Initialize Meteora service
        const meteora = await initializeMeteoraService(poolAddress, poolName);
        if (!meteora) return;

        // Get active bin price to determine price range
        const priceBin = await meteora.getActiveBinPrice();
        const currentPrice = Number(priceBin.realPrice);

        // Calculate min and max price (±20% from current price)
        const minPrice = currentPrice * 0.8;
        const maxPrice = currentPrice * 1.2;

        // Prepare amounts
        const remainingSolAmount = (SOL_AMOUNT / 2) * 1e9; // Convert to lamports

        // Get position quote
        const positionQuote = await meteora.getPositionQuote({
          xAmount: outputAmount,
          yAmount: remainingSolAmount,
          maxBinId: maxPrice,
          minBinId: minPrice,
          strategyType: StrategyType.Spot,
        });
        console.log("positionQuote", positionQuote);
        if (positionQuote.positionCount > 1) {
          logger.error({
            message: `More than one position found for ${poolName}`,
            poolAddress,
          });
          return;
        }

        try {
          // Create position using encapsulated function
          const positionData = await createMeteoraPosition({
            poolName,
            poolAddress,
            outputAmount,
            remainingSolAmount,
            minPrice,
            maxPrice,
          });

          if (positionData) {
            tradingLogger.info({
              message: `Successfully created liquidity position for ${poolName}`,
              pool: poolName,
              positionId: positionData.positionId,
              txSignature: positionData.txId,
              explorerUrl: positionData.explorerUrl,
            });

            // Start monitoring this position
            startPositionMonitoring({
              meteora,
              positionId: positionData.positionId,
              poolName,
              poolAddress,
              mintAddress: poolTokenAddress,
            });
          }
        } catch (apiError) {
          logger.error({
            message: `Error creating liquidity position for ${poolName}`,
            error:
              apiError instanceof Error ? apiError.message : String(apiError),
          });
        }
      }
    } catch (error) {
      logger.error({
        message: `Error creating liquidity position for ${poolName}`,
        poolAddress: poolAddress,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    logger.error({
      message: `Error processing high yield pool ${poolName}`,
      poolAddress: poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Check and process pools
 */
export const runPoolsCheck = async (isMonitoringActive: boolean) => {
  try {
    const pools = await checkPools(isMonitoringActive);
    if (pools) {
      // Process pools from the detectedPools Map to avoid duplicate monitoring
      for (const [poolAddress, pool] of detectedPools.entries()) {
        // Only process high yield pools
        if (pools.highYieldPools.some((p) => p.poolAddress === poolAddress)) {
          await processHighYieldPool(pool);
        }
        if (pools.emergingPools.some((p) => p.poolAddress === poolAddress)) {
          await processHighYieldPool(pool);
        }
      }
    }
  } catch (error) {
    logger.error({
      message: "Error in scheduled pool check",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
