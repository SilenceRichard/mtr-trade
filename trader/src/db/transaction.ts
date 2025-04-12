import { Pool, PoolClient } from 'pg';
import pool from './config';

/**
 * 执行数据库事务
 * @param callback 在事务中执行的回调函数
 * @returns 回调函数的结果
 */
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default { withTransaction }; 