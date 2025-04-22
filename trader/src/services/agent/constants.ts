// Common constants used throughout the agent services

// SOL token mint address (same across all Solana networks)
export const SOL_MINT = "So11111111111111111111111111111111111111112";

// Default SOL amount for swaps and liquidity positions
export const SOL_AMOUNT = 0.1; // 0.1 SOL

// Monitoring intervals
export const MONITORING_INTERVAL_MS = 1 * 1000; // 1 seconds by default
export const POSITION_MONITORING_INTERVAL_MS = 3 * 1000; // 3 seconds 


// Profit threshold for automatic position closing (30%)
export const AUTO_CLOSE_PROFIT_THRESHOLD = 50;
// 止损线
export const AUTO_CLOSE_LOSS_THRESHOLD = -40;