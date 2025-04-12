import pool from '../db/config';
import { WalletAddress } from '../models/wallet.model';
import { PoolClient } from 'pg';

export class WalletRepository {
  /**
   * Insert a new wallet record
   */
  async insertWallet(wallet: WalletAddress): Promise<WalletAddress> {
    const { wallet_address, profit_rate, fees } = wallet;
    
    const query = `
      INSERT INTO wallets (wallet_address, profit_rate, fees)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [
      wallet_address, 
      profit_rate,
      fees
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get a wallet by address
   */
  async getWalletByAddress(address: string): Promise<WalletAddress | null> {
    const query = `
      SELECT * FROM wallets
      WHERE wallet_address = $1
    `;
    
    const result = await pool.query(query, [address]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Update wallet positions information
   */
  async updateWallet(wallet: WalletAddress): Promise<WalletAddress> {
    const { wallet_address, profit_rate, fees } = wallet;
    
    const query = `
      UPDATE wallets
      SET profit_rate = $2, fees = $3
      WHERE wallet_address = $1
      RETURNING *
    `;
    
    const values = [
      wallet_address,
      profit_rate,
      fees
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get all wallets
   */
  async getAllWallets(): Promise<WalletAddress[]> {
    const query = `SELECT * FROM wallets`;
    const result = await pool.query(query);
    return result.rows;
  }
  
  /**
   * Create or update wallet
   */
  async upsertWallet(wallet: WalletAddress): Promise<WalletAddress> {
    const existingWallet = await this.getWalletByAddress(wallet.wallet_address);
    
    if (existingWallet) {
      return this.updateWallet(wallet);
    } else {
      return this.insertWallet(wallet);
    }
  }
  
  /**
   * Create or update wallet using transaction client
   * @param wallet The wallet to upsert
   * @param client Database client within a transaction
   * @returns The upserted wallet
   */
  async upsertWalletWithClient(wallet: WalletAddress, client: PoolClient): Promise<WalletAddress> {
    const { wallet_address, profit_rate, fees } = wallet;
    
    // Using a single query with ON CONFLICT to ensure the wallet exists
    const query = `
      INSERT INTO wallets (wallet_address, profit_rate, fees)
      VALUES ($1, $2, $3)
      ON CONFLICT (wallet_address) 
      DO UPDATE SET profit_rate = $2, 
                    fees = $3
      RETURNING *
    `;
    
    const values = [wallet_address, profit_rate, fees];
    const result = await client.query(query, values);
    return result.rows[0];
  }
}

// Export singleton instance
export const walletRepository = new WalletRepository(); 