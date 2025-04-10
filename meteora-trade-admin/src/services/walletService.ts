import axios from "axios";
import { message } from "antd";
import { TRADER_API_URL } from "../constant";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface WalletInfo {
  publicKey?: string;
  solBalance: number;
  usdcBalance: number;
  tokenBalance?: number;
}

// Fetch wallet public key
export const fetchWalletPublicKey = async (): Promise<string | null> => {
  try {
    const response = await axios.get<{success: boolean, data: {publicKey: string}}>(`${TRADER_API_URL}/wallet`);
    if (response.data.success) {
      return response.data.data.publicKey;
    } else {
      message.error("Failed to get wallet public key");
      return null;
    }
  } catch (error) {
    console.error("Error fetching wallet public key:", error);
    message.error("Failed to get wallet public key");
    return null;
  }
};

// Fetch token balance
export const fetchTokenBalance = async (mintAddress: string): Promise<number> => {
  try {
    const response = await axios.get<{success: boolean, data: {balance: number, mintAddress: string}, error?: string}>(`${TRADER_API_URL}/wallet/balance`, {
      params: { mintAddress }
    });
    if (response.data.success) {
      return response.data.data.balance;
    } else {
      console.error("Failed to get token balance:", response.data.error);
      return 0;
    }
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return 0;
  }
};

// Fetch wallet information
export const fetchWalletInfo = async (): Promise<WalletInfo | null> => {
  try {
    const publicKey = await fetchWalletPublicKey();
    if (!publicKey) {
      return null;
    }
    
    // Fetch SOL balance
    const solBalance = await fetchTokenBalance(SOL_MINT);
    
    // Fetch USDC balance
    const usdcBalance = await fetchTokenBalance(USDC_MINT);
    
    // Return wallet info
    return {
      publicKey,
      solBalance,
      usdcBalance,
    };
  } catch (error) {
    console.error("Error fetching wallet info:", error);
    message.error("Failed to fetch wallet information");
    return null;
  }
};

// Fetch token balance for selected pool
export const fetchPoolTokenBalance = async (tokenAddress: string): Promise<number> => {
  if (!tokenAddress) return 0;
  
  try {
    return await fetchTokenBalance(tokenAddress);
  } catch (error) {
    console.error("Error fetching pool token balance:", error);
    return 0;
  }
};

// Fetch token decimals
export const fetchTokenDecimals = async (mintAddress: string): Promise<number> => {
  try {
    const response = await axios.get<{success: boolean, data: {decimals: number, mintAddress: string}, error?: string}>(`${TRADER_API_URL}/wallet/decimals`, {
      params: { mintAddress }
    });
    if (response.data.success) {
      return response.data.data.decimals;
    } else {
      console.error("Failed to get token decimals:", response.data.error);
      return 0;
    }
  } catch (error) {
    console.error("Error fetching token decimals:", error);
    return 0;
  }
}; 