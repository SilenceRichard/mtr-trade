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
} 