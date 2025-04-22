export interface Position {
  id?: number;
  wallet_address: string;
  pool_address: string;
  pool_name: string;      // name of the pool
  position_id: string;
  open_value: number;     // in SOL
  profit: number;         // in SOL
  profit_rate: number;    // percentage
  fees: number;           // in SOL
  open_time: Date;
  close_time?: Date;      // when position was closed
  duration_seconds: number;
  status?: string;        // current status of the position (e.g., 'open', 'closing', 'closed')
  error_message?: string; // error message if any operation failed
  token_x_mint?: string;  // mint address of token X
  token_x_amount?: string;// amount of token X
  swap_amount?: string;   // amount received from token swap
} 