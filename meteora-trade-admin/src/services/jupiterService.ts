import axios from "axios";
import notification from "../utils/notification";
import { TRADER_API_URL } from "../constant";

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface SwapResult {
  signature: string;
  explorerUrl: string;
}

export interface ComputeBudgetConfig {
  cuBufferMultiplier?: number;
  microLamports?: number;
}

// Get Jupiter swap quote
export const getJupiterQuote = async (params: QuoteParams): Promise<QuoteResponse | null> => {
  try {
    const response = await axios.get<{ success: boolean; data: QuoteResponse; error?: string }>(
      `${TRADER_API_URL}/jupiter/quote`,
      { params }
    );
    
    if (response.data.success) {
      return response.data.data;
    } else {
      notification.error("Failed to get Jupiter quote", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error fetching Jupiter quote:", error);
    notification.error("Failed to get Jupiter quote");
    return null;
  }
};

// Execute Jupiter swap
export const executeJupiterSwap = async (
  quoteResponse: QuoteResponse,
  computeBudgetConfig?: ComputeBudgetConfig
): Promise<SwapResult | null> => {
  try {
    const response = await axios.post<{ success: boolean; data: SwapResult; error?: string }>(
      `${TRADER_API_URL}/jupiter/swap`,
      { 
        quoteResponse,
        computeBudgetConfig
      }
    );
    
    if (response.data.success) {
      return response.data.data;
    } else {
      notification.error("Failed to execute swap", response.data.error);
      return null;
    }
  } catch (error) {
    console.error("Error executing Jupiter swap:", error);
    notification.error("Failed to execute swap");
    return null;
  }
}; 