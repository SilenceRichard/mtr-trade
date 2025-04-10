import axios from "axios";
import { message } from "antd";
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
      message.error(`Failed to initialize pool: ${response.data.error}`);
      return false;
    }
  } catch (error) {
    console.error("Error initializing Meteora pool:", error);
    message.error("Failed to initialize Meteora pool");
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
      message.error(`Failed to get pool price: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching pool price:", error);
    message.error("Failed to get pool price");
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
      message.error(`Failed to get positions: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching positions:", error);
    message.error("Failed to get positions");
    return null;
  }
};

// Create liquidity position
export const createPosition = async (params: CreatePositionParams): Promise<CreatePositionResult | null> => {
  try {
    const response = await axios.post<{ success: boolean; data: CreatePositionResult; error?: string }>(
      `${TRADER_API_URL}/meteora/positions/create`,
      params
    );
    
    if (response.data.success) {
      message.success("Position created successfully");
      return response.data.data;
    } else {
      message.error(`Failed to create position: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    console.error("Error creating position:", error);
    message.error("Failed to create position");
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
      message.error(`Failed to get all positions`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching all positions:", error);
    message.error("Failed to get all positions");
    return null;
  }
};
