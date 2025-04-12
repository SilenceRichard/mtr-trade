import pool from '../db/config';
import { Position } from '../models/position.model';
import { PoolClient } from 'pg';

export class PositionRepository {
  /**
   * Insert a new position
   */
  async insertPosition(position: Position): Promise<Position> {
    const { position_id, wallet_address, pool_address, pool_name, open_value, profit, profit_rate, fees, open_time, duration_seconds } = position;
    
    const query = `
      INSERT INTO positions (
        position_id, wallet_address, pool_address, pool_name, open_value, profit, profit_rate, fees, open_time, duration_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      position_id,
      wallet_address,
      pool_address,
      pool_name,
      open_value,
      profit,
      profit_rate,
      fees,
      open_time,
      duration_seconds
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get all positions for a wallet
   */
  async getPositionsByWallet(walletAddress: string): Promise<Position[]> {
    const query = `
      SELECT * FROM positions
      WHERE wallet_address = $1
      ORDER BY open_time DESC
    `;
    
    const result = await pool.query(query, [walletAddress]);
    return result.rows;
  }
  
  /**
   * Get all positions
   */
  async getAllPositions(): Promise<Position[]> {
    const query = `SELECT * FROM positions ORDER BY open_time DESC`;
    const result = await pool.query(query);
    return result.rows;
  }
  
  /**
   * Update position by position_id
   */
  async updatePosition(position_id: string, updates: Partial<Position>): Promise<Position | null> {
    // Create SET clause dynamically based on provided updates
    const updateFields = Object.keys(updates)
      .filter(key => key !== 'position_id') // Filter out position_id from updates
      .map((key, index) => `${key} = $${index + 2}`); // +2 because $1 is reserved for position_id
      
    if (updateFields.length === 0) {
      return null; // No fields to update
    }
    
    const query = `
      UPDATE positions
      SET ${updateFields.join(', ')}
      WHERE position_id = $1
      RETURNING *
    `;
    
    const values = [
      position_id,
      ...Object.values(updates).filter((_, index) => 
        Object.keys(updates)[index] !== 'position_id'
      )
    ];
    
    const result = await pool.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Update position by position_id using transaction client
   */
  async updatePositionWithClient(position_id: string, updates: Partial<Position>, client: PoolClient): Promise<Position | null> {
    // Create SET clause dynamically based on provided updates
    const updateFields = Object.keys(updates)
      .filter(key => key !== 'position_id') // Filter out position_id from updates
      .map((key, index) => `${key} = $${index + 2}`); // +2 because $1 is reserved for position_id
      
    if (updateFields.length === 0) {
      return null; // No fields to update
    }
    
    const query = `
      UPDATE positions
      SET ${updateFields.join(', ')}
      WHERE position_id = $1
      RETURNING *
    `;
    
    const values = [
      position_id,
      ...Object.values(updates).filter((_, index) => 
        Object.keys(updates)[index] !== 'position_id'
      )
    ];
    
    const result = await client.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Insert a new position using transaction client
   * @param position The position to insert
   * @param client Database client within a transaction
   * @returns The inserted position
   */
  async insertPositionWithClient(position: Position, client: PoolClient): Promise<Position> {
    const { position_id, wallet_address, pool_address, pool_name, open_value, profit, profit_rate, fees, open_time, duration_seconds } = position;
    
    const query = `
      INSERT INTO positions (
        position_id, wallet_address, pool_address, pool_name, open_value, profit, profit_rate, fees, open_time, duration_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      position_id,
      wallet_address,
      pool_address,
      pool_name,
      open_value,
      profit,
      profit_rate,
      fees,
      open_time,
      duration_seconds
    ];
    
    const result = await client.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get position by position_id using transaction client
   */
  async getPositionByIdWithClient(position_id: string, client: PoolClient): Promise<Position | null> {
    const query = `
      SELECT * FROM positions
      WHERE position_id = $1
    `;
    
    const result = await client.query(query, [position_id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Get pool names for multiple position IDs
   * @param positionIds Array of position IDs
   * @returns An object mapping position_id to pool_name
   */
  async getPoolNamesByPositionIds(positionIds: string[]): Promise<Record<string, string>> {
    if (positionIds.length === 0) {
      return {};
    }
    
    // Create placeholders for the IN clause ($1, $2, ...)
    const placeholders = positionIds.map((_, idx) => `$${idx + 1}`).join(',');
    
    const query = `
      SELECT position_id, pool_name
      FROM positions
      WHERE position_id IN (${placeholders})
    `;
    
    const result = await pool.query(query, positionIds);
    
    // Create a mapping from position_id to pool_name
    const poolNameMap: Record<string, string> = {};
    result.rows.forEach(row => {
      poolNameMap[row.position_id] = row.pool_name;
    });
    
    return poolNameMap;
  }
  
  /**
   * Get pool names and open values for multiple position IDs
   * @param positionIds Array of position IDs
   * @returns An object mapping position_id to position data including pool_name and open_value
   */
  async getPositionDataByIds(positionIds: string[]): Promise<Record<string, { poolName: string, openValue: number }>> {
    if (positionIds.length === 0) {
      return {};
    }
    
    // Create placeholders for the IN clause ($1, $2, ...)
    const placeholders = positionIds.map((_, idx) => `$${idx + 1}`).join(',');
    
    const query = `
      SELECT position_id, pool_name, open_value
      FROM positions
      WHERE position_id IN (${placeholders})
    `;
    
    const result = await pool.query(query, positionIds);
    
    // Create a mapping from position_id to position data
    const positionDataMap: Record<string, { poolName: string, openValue: number }> = {};
    result.rows.forEach(row => {
      positionDataMap[row.position_id] = {
        poolName: row.pool_name,
        openValue: parseFloat(row.open_value) || 0
      };
    });
    
    return positionDataMap;
  }
}

// Export singleton instance
export const positionRepository = new PositionRepository(); 