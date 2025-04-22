import axios from "axios";
import { logger } from "./logger";
import { Pool, PoolsData } from "./types";
// Map to track already detected pools
export const detectedPools = new Map<string, Pool>();

/**
 * Check pools for trading opportunities
 */
export async function checkPools(
  isMonitoringActive: boolean
): Promise<PoolsData | undefined> {
  // Skip processing if monitoring is disabled
  if (!isMonitoringActive) {
    return;
  }

  try {
    // Call the tokleo-scraper API to get pool opportunities
    const response = await axios.get<Pool[]>(
      process.env.TOKLEO_SCRAPER_URL + "/api/pools"
    );
    const pools = response.data as unknown as PoolsData;
    const { highYieldPools = [], emergingPools = [] } = pools as PoolsData;
    
    // Track newly detected pools
    const newHighYieldPools: Pool[] = [];
    const newEmergingPools: Pool[] = [];
    const filterOnlySOLPool = (pool: Pool) => {
      const tokenYName = pool.tokenInfo.name.split("/")[1];
      return tokenYName.toLowerCase() === "sol";
    }
    // Process high yield pools
    highYieldPools.forEach((pool) => {
      if (!filterOnlySOLPool(pool)) {
        console.log("filterOnlySOLPool", pool);
        return;
      }
      // Only log if this pool hasn't been detected before
      if (!detectedPools.has(pool.poolAddress)) {
        detectedPools.set(pool.poolAddress, pool);
        newHighYieldPools.push(pool);
        logger.info({
          message: "New pool opportunity detected",
          type: "高收益", // High Yield in Chinese as requested
          poolName: pool.poolName,
          poolAddress: pool.poolAddress,
          liquidity: pool.liquidity,
          volume24h: pool.volume24h,
          hourlyRate24h: pool.hourlyRate24h,
          hourlyRate1h: pool.hourlyRate1h,
          feeRatio24h: pool.feeRatio24h,
          signals: pool.signals,
          rating: pool.rating,
        });
      }
    });

    // Process emerging pools
    emergingPools.forEach((pool) => {
      if (!filterOnlySOLPool(pool)) {
        return;
      }
      // Only log if this pool hasn't been detected before
      if (!detectedPools.has(pool.poolAddress)) {
        detectedPools.set(pool.poolAddress, pool);
        newEmergingPools.push(pool);
        logger.info({
          message: "New pool opportunity detected",
          type: "新兴池", // Emerging Pool in Chinese
          poolName: pool.poolName,
          poolAddress: pool.poolAddress,
          age: pool.age,
          liquidity: pool.liquidity,
          volume24h: pool.volume24h,
          hourlyRate24h: pool.hourlyRate24h,
          hourlyRate1h: pool.hourlyRate1h,
          signals: pool.signals,
          rating: pool.rating,
        });
      }
    });
    
    // Return only newly detected pools
    return { 
      highYieldPools: newHighYieldPools, 
      emergingPools: newEmergingPools 
    };
  } catch (error) {
    logger.error({
      message: "Error checking pools",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
