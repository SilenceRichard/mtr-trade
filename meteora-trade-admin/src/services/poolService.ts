import axios from "axios";
import notification from "../utils/notification";
import { POOL_API_URL } from "../constant";

// Matching the structure from formatPoolSummary in analyzer.js
export interface PoolItem {
  poolName: string;
  poolAddress: string;
  tokenAddress: string;
  meteoraLink: string;
  gmgnLink: string;
  geckoTerminalLink: string;
  tokenInfo: {
    name?: string;
    address?: string;
  };
  exchangeInfo: {
    type: string;
  };
  age: string;
  binStep: number;
  baseFee: number;
  liquidity: string;
  volume24h: string;
  fees24h: string;
  feeRatio24h: string;
  hourlyRate24h: string;
  hourlyRate1h: string;
  hourlyRate30m: string;
  change30m: string;
  change1h: string;
  volume24hHourly: string;
  volume1hHourly: string;
  holders: string;
  vol24hGecko: string;
  marketCap: string;
  securityRating: string;
  signals: string;
  rating: string;
}

// API response structure
export interface ApiResponse {
  highYieldPools: PoolItem[];
  mediumYieldPools: PoolItem[];
  emergingPools: PoolItem[];
  avoidPools: PoolItem[];
  topPoolsByFeeRatio: PoolItem[];
}

export interface SearchParams {
  poolName?: string;
  pageSize?: number;
  current?: number;
  [key: string]: unknown;
}

// Fetch API data for pools
export const fetchPools = async (): Promise<ApiResponse | null> => {
  try {
    const response = await axios.get<ApiResponse>(`${POOL_API_URL}/pools`);
    
    // Validate API response structure
    if (!response.data) {
      console.error("API response data is empty");
      notification.error("No data received from API");
      return null;
    }

    // Log pool counts for debugging
    console.log(
      "Top Pools By Fee Ratio count:",
      response.data.topPoolsByFeeRatio?.length || 0
    );
    console.log(
      "High Yield Pools count:",
      response.data.highYieldPools?.length || 0
    );
    console.log(
      "Medium Yield Pools count:",
      response.data.mediumYieldPools?.length || 0
    );
    console.log(
      "Emerging Pools count:",
      response.data.emergingPools?.length || 0
    );
    console.log(
      "Avoid Pools count:",
      response.data.avoidPools?.length || 0
    );

    return response.data;
  } catch (error) {
    console.error("Failed to fetch pool data:", error);
    notification.error("Failed to fetch pool data");
    return null;
  }
};

// Filter pools by category
export const filterPoolsByCategory = (
  data: ApiResponse | null,
  category: string
): PoolItem[] => {
  if (!data) {
    return [];
  }

  let pools: PoolItem[] = [];

  if (category === "all") {
    // Merge all categories of pools
    const allPoolsSet = new Set<string>(); // Use Set to avoid duplicates
    const allPools: PoolItem[] = [];

    // Process categories in specific order to ensure important pools show first
    [
      data.topPoolsByFeeRatio || [],
      data.highYieldPools || [],
      data.mediumYieldPools || [],
      data.emergingPools || [],
      data.avoidPools || [],
    ].forEach((categoryPools) => {
      categoryPools.forEach((pool) => {
        if (!allPoolsSet.has(pool.poolAddress)) {
          allPoolsSet.add(pool.poolAddress);
          allPools.push(pool);
        }
      });
    });

    pools = allPools;
  } else if (category === "topPoolsByFeeRatio") {
    pools = data.topPoolsByFeeRatio || [];
    console.log(`Using ${pools.length} pools from topPoolsByFeeRatio`);
  } else if (category === "highYieldPools") {
    pools = data.highYieldPools || [];
  } else if (category === "mediumYieldPools") {
    pools = data.mediumYieldPools || [];
  } else if (category === "emergingPools") {
    pools = data.emergingPools || [];
  } else if (category === "avoidPools") {
    pools = data.avoidPools || [];
  }

  console.log(`Category: ${category}, Filtered pools: ${pools.length}`);
  return pools;
}; 