import { TokenInfo } from '@solana/spl-token-registry';
import { TRADER_API_URL } from '../constant';

/**
 * Get token information for a Solana token by mint address
 * @param mintAddress The mint address of the token
 * @returns TokenInfo object or undefined if not found
 */
export async function getTokenInfo(mintAddress: string): Promise<TokenInfo | undefined> {
  try {
    const response = await fetch(`${TRADER_API_URL}/token/info?mintAddress=${mintAddress}`);
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
    return undefined;
  } catch (error) {
    console.error('Error fetching token info:', error);
    return undefined;
  }
}

/**
 * Get formatted pool name from token X and token Y information
 * @param tokenXMint Mint address of token X
 * @param tokenYMint Mint address of token Y
 * @returns Formatted pool name (e.g. "SOL-USDC Pool")
 */
export async function getPoolName(tokenXMint: string, tokenYMint: string): Promise<string> {
  try {
    const response = await fetch(`${TRADER_API_URL}/token/poolname?tokenXMint=${tokenXMint}&tokenYMint=${tokenYMint}`);
    const result = await response.json();
    
    if (result.success) {
      return result.data.poolName;
    }
    
    // Fallback in case of API error
    const tokenXSymbol = tokenXMint.substring(0, 4);
    const tokenYSymbol = tokenYMint.substring(0, 4);
    return `${tokenXSymbol}-${tokenYSymbol} Pool`;
  } catch (error) {
    console.error('Error fetching pool name:', error);
    // Fallback in case of API error
    const tokenXSymbol = tokenXMint.substring(0, 4);
    const tokenYSymbol = tokenYMint.substring(0, 4);
    return `${tokenXSymbol}-${tokenYSymbol} Pool`;
  }
} 