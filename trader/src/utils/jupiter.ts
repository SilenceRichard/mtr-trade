import { PublicKey } from '@solana/web3.js';

/**
 * Response type for Jupiter's quote API
 * @see https://docs.jup.ag/jupiter-api/swap-api-for-solana/quote-api
 */
interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | {
    amount: string;
    feeBps: number;
  };
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

/**
 * Parameters for getting a Jupiter quote
 */
interface GetQuoteParams {
  /** Input token mint address */
  inputMint: string;
  /** Output token mint address */
  outputMint: string;
  /** Amount of input tokens (in raw units) */
  amount: string | number;
  /** Slippage tolerance in basis points (1 bp = 0.01%) */
  slippageBps?: number;
  /** Whether to restrict intermediate tokens to only highly liquid ones */
  restrictIntermediateTokens?: boolean;
  /** Use legacy transaction format for wallets that don't support versioned transactions */
  asLegacyTransaction?: boolean;
  /** Only route through a single market */
  onlyDirectRoutes?: boolean;
  /** Maximum number of accounts that can be included in the transaction */
  maxAccounts?: number;
}

/**
 * Get a quote for swapping tokens using Jupiter
 * @param params Quote parameters
 * @returns Quote response from Jupiter API
 * @throws Error if the API request fails
 */
export async function getJupiterQuote({
  inputMint,
  outputMint,
  amount,
  slippageBps = 50,
  restrictIntermediateTokens = true,
  asLegacyTransaction = false,
  onlyDirectRoutes = false,
  maxAccounts = 64,
}: GetQuoteParams): Promise<QuoteResponse> {
  // Construct URL with query parameters
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    restrictIntermediateTokens: restrictIntermediateTokens.toString(),
    asLegacyTransaction: asLegacyTransaction.toString(),
    onlyDirectRoutes: onlyDirectRoutes.toString(),
    maxAccounts: maxAccounts.toString(),
  });

  const url = `https://api.jup.ag/swap/v1/quote?${params.toString()}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data as QuoteResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get Jupiter quote: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Common token addresses
 */
export const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
} as const; 