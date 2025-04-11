import axios from "axios";
import notification from "../utils/notification";
import { TRADER_API_URL } from "../constant";

// Interfaces
export interface PriceInfo {
  realPrice: string;
  binId: number;
}

export interface Position {
  publicKey: string;
  owner: string;
  lowerBinId: number;
  upperBinId: number;
  totalXAmount: string;
  totalYAmount: string;
  feeX: string;
  feeY: string;
  rewardOne: string;
  rewardTwo: string;
  totalClaimedFeeXAmount: string;
  totalClaimedFeeYAmount: string;
  feeXExcludeTransferFee: string;
  feeYExcludeTransferFee: string;
  rewardOneExcludeTransferFee: string;
  rewardTwoExcludeTransferFee: string;
  totalXAmountExcludeTransferFee: string;
  totalYAmountExcludeTransferFee: string;
  lastUpdatedAt: string;
}

export interface TokenInfo {
  mint: string;
  decimals: number;
  amount: string;
}

export interface PoolPositionInfo {
  lbPairAddress: string;
  positionsCount: number;
  tokenX: TokenInfo;
  tokenY: TokenInfo;
  positions: Position[];
}

export interface CreatePositionParams {
  poolAddress: string;
  xAmount: string | number;
  yAmount: string | number;
  maxPrice: number;
  minPrice: number;
  strategyType: string;
}

export interface CreatePositionResult {
  txId: string;
  positionId: string;
  explorerUrl: string;
}

export interface PositionQuoteResult {
  binArraysCount: number;
  binArrayCost: number;
  positionCount: number;
  positionCost: number;
}

export interface SwapParams {
  poolAddress: string;
  amount: number;
  swapYtoX: boolean;
  minOutAmount: number;
}

// API Functions

// Initialize Meteora pool
export const initializePool = async (poolAddress: string): Promise<boolean> => {
  try {
    const response = await axios.get<{ success: boolean; data: { poolAddress: string; status: string }; error?: string }>(
      `${TRADER_API_URL}/meteora/pool/${poolAddress}`
    );
    
    if (response.data.success) {
      return true;
    } else {
      notification.error("Failed to initialize pool", response.data.error);
      return false;
    }
  } catch (error) {
    console.error("Error initializing Meteora pool:", error);
    notification.error("Failed to initialize Meteora pool");
    return false;
  }
};

// Get active bin price
export const getActiveBinPrice = async (poolAddress: string): Promise<PriceInfo | null> => {
  try {
    const response = await axios.get<{ success: boolean; data: PriceInfo; error?: string }>(
      `${TRADER_API_URL}/meteora/pool/${poolAddress}/price`
    );
    
    if (response.data.success) {
      return response.data.data;
    } else {
      notification.error("Failed to get pool price", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error fetching pool price:", error);
    notification.error("Failed to get pool price");
    return null;
  }
};

// Get user positions
export const getUserPositions = async (poolAddress: string): Promise<Position[] | null> => {
  try {
    const response = await axios.get<{ success: boolean; data: { positions: Position[] }; error?: string }>(
      `${TRADER_API_URL}/meteora/positions`,
      { params: { poolAddress } }
    );
    
    if (response.data.success) {
      return response.data.data.positions;
    } else {
      notification.error("Failed to get positions", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error fetching positions:", error);
    notification.error("Failed to get positions");
    return null;
  }
};

// Create liquidity position
export const createPosition = async (params: CreatePositionParams): Promise<CreatePositionResult | null> => {
  try {
    const response = await axios.post<{ success: boolean; data: CreatePositionResult; error?: string }>(
      `${TRADER_API_URL}/meteora/positions`,
      params
    );
    
    if (response.data.success) {
      notification.success("Position created successfully");
      return response.data.data;
    } else {
      notification.error("Failed to create position", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error creating position:", error);
    notification.error("Failed to create position");
    return null;
  }
};

// Get position quote
export const getPositionQuote = async (params: CreatePositionParams): Promise<PositionQuoteResult | null> => {
  try {
    const response = await axios.post<{ success: boolean; data: PositionQuoteResult; error?: string }>(
      `${TRADER_API_URL}/meteora/positions/quote`,
      params
    );
    
    if (response.data.success) {
      return response.data.data;
    } else {
      notification.error("Failed to get position quote", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error getting position quote:", error);
    notification.error("Failed to get position quote");
    return null;
  }
};

// Get all user positions
export const getAllUserPositions = async (walletAddress: string): Promise<PoolPositionInfo[] | null> => {
  try {
    const response = await axios.get<{ success: boolean; data: { positions: PoolPositionInfo[] }; error?: string }>(
      `${TRADER_API_URL}/meteora/positions/all`,
      { params: { walletAddress } }
    );
    
    console.log('response', response.data);
    if (response.data) {
      const { positions } = response.data as unknown as { positions: PoolPositionInfo[] };
      return positions;
    } else {
      notification.error("Failed to get all positions");
      return null;
    }
  } catch (error) {
    console.error("Error fetching all positions:", error);
    notification.error("Failed to get all positions");
    return null;
  }
};

// Remove liquidity
export interface RemoveLiquidityResult {
  txId: string;
  explorerUrl: string;
}

export const removeLiquidity = async (
  poolAddress: string, 
  positionAddress: string, 
  fromBinId: number, 
  toBinId: number
): Promise<RemoveLiquidityResult | null> => {
  try {
    const response = await axios.post<{ success: boolean; data: RemoveLiquidityResult; error?: string }>(
      `${TRADER_API_URL}/meteora/positions/remove`,
      { poolAddress, positionAddress, fromBinId, toBinId }
    );
    
    if (response.data.success) {
      notification.success("Successfully removed liquidity");
      return response.data.data;
    } else {
      notification.error("Failed to remove liquidity", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error removing liquidity:", error);
    notification.error("Failed to remove liquidity");
    return null;
  }
};

// Claim fee
export interface ClaimFeeResult {
  txId: string;
  explorerUrl: string;
}

export const claimFee = async (
  poolAddress: string,
  positionAddress: string
): Promise<ClaimFeeResult | null> => {
  try {
    const response = await axios.post<{ success: boolean; data: ClaimFeeResult; error?: string }>(
      `${TRADER_API_URL}/meteora/fee/claim`,
      { poolAddress, positionAddress }
    );
    
    if (response.data.success) {
      notification.success("Successfully claimed fees");
      return response.data.data;
    } else {
      notification.error("Failed to claim fees", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error claiming fees:", error);
    notification.error("Failed to claim fees");
    return null;
  }
};

// Close position
export interface ClosePositionResult {
  txId: string;
  explorerUrl: string;
}

export const closePosition = async (
  poolAddress: string,
  positionAddress: string
): Promise<ClosePositionResult | null> => {
  try {
    const response = await axios.post<{ success: boolean; data: ClosePositionResult; error?: string }>(
      `${TRADER_API_URL}/meteora/positions/close`,
      { poolAddress, positionAddress }
    );
    
    if (response.data.success) {
      notification.success("Successfully closed position");
      return response.data.data;
    } else {
      notification.error("Failed to close position", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error closing position:", error);
    notification.error("Failed to close position");
    return null;
  }
};
