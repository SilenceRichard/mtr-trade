import { TokenListProvider, TokenInfo } from "@solana/spl-token-registry";
import { Connection, PublicKey } from "@solana/web3.js";

// Default Solana RPC endpoint
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const connection = new Connection(SOLANA_RPC);

// Metaplex Token Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

/**
 * Get token information for a Solana token by mint address
 * @param mintAddress The mint address of the token
 * @returns TokenInfo object or undefined if not found
 */
export async function getTokenInfo(mintAddress: string): Promise<TokenInfo | undefined> {
  const tokenListProvider = new TokenListProvider();
  const tokens = await tokenListProvider.resolve();
  const tokenList = tokens.filterByChainId(101).getList(); // 101 is mainnet-beta
  return tokenList.find((t: TokenInfo) => t.address === mintAddress);
}

/**
 * Get formatted pool name from token X and token Y information
 * @param tokenXMint Mint address of token X
 * @param tokenYMint Mint address of token Y
 * @returns Formatted pool name (e.g. "SOL-USDC Pool")
 * @deprecated Use getEnhancedPoolName instead which provides better token name resolution
 */
export async function getPoolName(tokenXMint: string, tokenYMint: string): Promise<string> {
  const tokenXInfo = await getTokenInfo(tokenXMint);
  const tokenYInfo = await getTokenInfo(tokenYMint);
  
  const tokenXSymbol = tokenXInfo?.symbol || tokenXMint.substring(0, 4);
  const tokenYSymbol = tokenYInfo?.symbol || tokenYMint.substring(0, 4);
  
  return `${tokenXSymbol}-${tokenYSymbol} Pool`;
}

/**
 * Calculate Metaplex Metadata PDA address
 * @param mint The mint address as a PublicKey
 * @returns The metadata account address
 */
async function getMetadataAddress(mint: PublicKey): Promise<PublicKey> {
  const [metadataPDA] = await PublicKey.findProgramAddress(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return metadataPDA;
}

/**
 * Fetch on-chain Metaplex Metadata for a token
 * @param mint The mint address
 * @returns Object with name and symbol if found
 */
async function getOnchainTokenMetadata(mint: string) {
  try {
    const mintPubkey = new PublicKey(mint);
    const metadataAddress = await getMetadataAddress(mintPubkey);
    const accountInfo = await connection.getAccountInfo(metadataAddress);
    if (!accountInfo) return undefined;

    // Simple manual parsing of metadata account
    // Based on Metaplex Token Metadata structure
    const buffer = accountInfo.data;
    
    // Skip the first bytes which contain header info
    const nameLength = buffer[4] & 0xff;
    let offset = 5;
    const name = buffer.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
    
    offset += nameLength;
    const symbolLength = buffer[offset] & 0xff;
    offset += 1;
    const symbol = buffer.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '');
    
    return {
      name: name.trim(),
      symbol: symbol.trim(),
    };
  } catch (err) {
    console.error("Error loading on-chain metadata:", err);
    return undefined;
  }
}

/**
 * Enhanced token information lookup that checks both token registry and on-chain metadata
 * @param mint The mint address of the token
 * @returns Object with name, symbol, and source of the data
 */
export async function getTokenNameAndSymbol(mint: string) {
  // First try the token registry (faster)
  const fromRegistry = await getTokenInfo(mint);
  if (fromRegistry) {
    return {
      name: fromRegistry.name,
      symbol: fromRegistry.symbol,
      source: "registry",
    };
  }

  // If not found, try on-chain metadata
  const onChain = await getOnchainTokenMetadata(mint);
  if (onChain) {
    return {
      ...onChain,
      source: "on-chain",
    };
  }

  // If neither source has the token, return unknown
  return {
    name: "Unknown",
    symbol: "???",
    source: "not found",
  };
}

/**
 * Enhanced pool name lookup that uses the enhanced token info lookup
 * @param tokenXMint Mint address of token X
 * @param tokenYMint Mint address of token Y
 * @returns Formatted pool name with enhanced lookup
 */
export async function getEnhancedPoolName(tokenXMint: string, tokenYMint: string): Promise<string> {
  const tokenXInfo = await getTokenNameAndSymbol(tokenXMint);
  const tokenYInfo = await getTokenNameAndSymbol(tokenYMint);
  
  return `${tokenXInfo.symbol}-${tokenYInfo.symbol} Pool`;
} 