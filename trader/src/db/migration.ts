import pool from './config';

/**
 * Initialize database tables if they don't exist
 */
export async function initializeTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        wallet_address TEXT UNIQUE NOT NULL,
        profit_rate NUMERIC DEFAULT 0,
        fees NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        wallet_address TEXT NOT NULL REFERENCES wallets(wallet_address),
        pool_address TEXT NOT NULL,
        pool_name TEXT,
        open_value NUMERIC NOT NULL,
        profit NUMERIC DEFAULT 0,
        profit_rate NUMERIC DEFAULT 0,
        fees NUMERIC DEFAULT 0,
        open_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        close_time TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
}

/**
 * Add missing columns to existing tables
 */
export async function updateTableStructure() {
  try {
    // Check if fees column exists in positions table
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'positions' AND column_name = 'fees';
    `);
    
    // If fees column doesn't exist, add it
    if (checkColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE positions 
        ADD COLUMN fees NUMERIC DEFAULT 0;
      `);
      console.log('Added fees column to positions table');
    }
    
    console.log('Table structure update completed');
  } catch (error) {
    console.error('Error updating table structure:', error);
    throw error;
  }
}

/**
 * 修复数据库中的表结构问题，包括:
 * 1. 检查是否存在wallet_addresses表
 * 2. 如果存在，修改positions表的外键约束，使其引用wallets表
 * 3. 删除wallet_addresses表
 */
export async function fixTableStructure() {
  try {
    // 检查wallet_addresses表是否存在
    const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'wallet_addresses';
    `);
    
    // 如果wallet_addresses表存在
    if (checkTable.rows.length > 0) {
      console.log('Found wallet_addresses table, fixing references...');
      
      // 检查positions表是否有引用wallet_addresses的外键
      const checkForeignKey = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'positions' 
        AND constraint_type = 'FOREIGN KEY';
      `);
      
      // 如果有外键约束，需要先删除
      for (const row of checkForeignKey.rows) {
        await pool.query(`ALTER TABLE positions DROP CONSTRAINT ${row.constraint_name};`);
        console.log(`Dropped foreign key constraint: ${row.constraint_name}`);
      }
      
      // 添加正确的外键约束，引用wallets表
      await pool.query(`
        ALTER TABLE positions 
        ADD CONSTRAINT positions_wallet_address_fkey 
        FOREIGN KEY (wallet_address) 
        REFERENCES wallets(wallet_address);
      `);
      console.log('Added correct foreign key constraint to positions table');
      
      // 删除wallet_addresses表
      await pool.query(`DROP TABLE IF EXISTS wallet_addresses;`);
      console.log('Dropped wallet_addresses table');
    } else {
      console.log('wallet_addresses table does not exist, no fix needed');
    }
    
    console.log('Table structure fix completed');
  } catch (error) {
    console.error('Error fixing table structure:', error);
    throw error;
  }
}

/**
 * Run database migrations on server startup
 */
export async function runMigrations() {
  try {
    await initializeTables();
    await updateTableStructure();
    await fixTableStructure();
    await fixPositionsTableStructure();
    await addPoolNameColumn();
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running database migrations:', error);
    throw error;
  }
}

/**
 * Fix positions table structure issues, including:
 * 1. Ensure all required columns exist
 * 2. Add missing indexes for performance
 * 3. Add proper constraints for data integrity
 */
export async function fixPositionsTableStructure() {
  try {
    console.log('Fixing positions table structure...');
    
    // Check if pool_address index exists
    const checkPoolIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'positions' AND indexname = 'positions_pool_address_idx';
    `);
    
    // Add index on pool_address for faster queries
    if (checkPoolIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX positions_pool_address_idx ON positions(pool_address);
      `);
      console.log('Added index on pool_address column in positions table');
    }
    
    // Check if wallet_address index exists
    const checkWalletIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'positions' AND indexname = 'positions_wallet_address_idx';
    `);
    
    // Add index on wallet_address for faster queries
    if (checkWalletIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX positions_wallet_address_idx ON positions(wallet_address);
      `);
      console.log('Added index on wallet_address column in positions table');
    }
    
    // Ensure open_time and close_time have indexes for time-based queries
    const checkOpenTimeIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'positions' AND indexname = 'positions_open_time_idx';
    `);
    
    if (checkOpenTimeIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX positions_open_time_idx ON positions(open_time);
      `);
      console.log('Added index on open_time column in positions table');
    }
    
    // Check if close_time index exists
    const checkCloseTimeIndex = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'positions' AND indexname = 'positions_close_time_idx';
    `);
    
    if (checkCloseTimeIndex.rows.length === 0) {
      await pool.query(`
        CREATE INDEX positions_close_time_idx ON positions(close_time);
      `);
      console.log('Added index on close_time column in positions table');
    }
    
    console.log('Positions table structure fix completed');
  } catch (error) {
    console.error('Error fixing positions table structure:', error);
    throw error;
  }
}

/**
 * Add pool_name column to positions table if it doesn't exist
 */
export async function addPoolNameColumn() {
  try {
    // Check if pool_name column exists in positions table
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'positions' AND column_name = 'pool_name';
    `);
    
    // If pool_name column doesn't exist, add it
    if (checkColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE positions 
        ADD COLUMN pool_name TEXT;
      `);
      console.log('Added pool_name column to positions table');
    }
    
    console.log('pool_name column check completed');
  } catch (error) {
    console.error('Error adding pool_name column:', error);
    throw error;
  }
} 