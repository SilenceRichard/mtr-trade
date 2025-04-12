export interface WalletAddress {
  id?: number;
  wallet_address: string;
  profit_rate: number;  // in SOL
  fees: number;         // in SOL
} 