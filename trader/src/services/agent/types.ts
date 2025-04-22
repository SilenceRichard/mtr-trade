// Interface for pool data
export interface Pool {
  poolName: string;
  poolAddress: string;
  tokenAddress: string;
  meteoraLink: string;
  gmgnLink: string;
  geckoTerminalLink: string;
  tokenInfo: {
    name: string;
    address: string;
  };
  exchangeInfo: any;
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

export interface MonitoringStatus {
  isActive: boolean;
  isRunning: boolean;
  positionMonitoringCount?: number;
}

export interface MonitoringResponse {
  success: boolean;
  monitoring: boolean;
  message?: string;
}

export interface PoolsData {
  highYieldPools: Pool[];
  emergingPools: Pool[];
}

export interface DecimalsResponse {
  success: boolean;
  data: {
    decimals: number;
    mintAddress: string;
  };
  error?: string;
}

export interface CreatePositionResult {
  txId: string;
  positionAddress: string;
  explorerUrl: string;
}

export interface ApiResponse {
  success: boolean;
  data: CreatePositionResult;
  error?: string;
}
