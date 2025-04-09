import axios from "axios";
import { message } from "antd";
import { TRADER_API_URL } from "../constant";

// Interfaces
export interface PriceInfo {
  realPrice: number;
  binId: number;
}

export interface Position {
  positionId: string;
  tokenXAmount: number;
  tokenYAmount: number;
  liquidity: string;
  lowerBinId: number;
  upperBinId: number;
  lowerPrice: number;
  upperPrice: number;
}

export interface CreatePositionParams {
  poolAddress: string;
  xAmount: number;
  yAmount: number;
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
