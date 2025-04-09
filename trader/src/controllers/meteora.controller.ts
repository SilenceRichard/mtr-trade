import { Request, Response } from 'express';
import { Connection } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { MeteoraService } from '../services/meteora';
import { getWallet } from '../services/wallet';

/**
 * 初始化Meteora流动性池
 */
export const initializePool = async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Pool address is required'
      });
    }
    
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    const initialized = await meteora.initializeDLMMPool(address);
    
    if (!initialized) {
      return res.status(400).json({
        success: false,
        error: 'Failed to initialize pool'
      });
    }
    
    res.json({
      success: true,
      data: {
        poolAddress: address,
        status: 'initialized'
      }
    });
  } catch (error) {
    console.error('Error initializing Meteora pool:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 获取活跃bin价格
 */
export const getActiveBinPrice = async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Pool address is required'
      });
    }
    
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    await meteora.initializeDLMMPool(address);
    
    const priceInfo = await meteora.getActiveBinPrice();
    
    res.json({
      success: true,
      data: priceInfo
    });
  } catch (error) {
    console.error('Error getting active bin price:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 获取用户头寸
 */
export const getUserPositions = async (req: Request, res: Response) => {
  try {
    const { poolAddress } = req.query;
    
    if (!poolAddress) {
      return res.status(400).json({
        success: false,
        error: 'poolAddress is required'
      });
    }
    
    const wallet = await getWallet();
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    await meteora.initializeDLMMPool(poolAddress as string);
    
    const positions = await meteora.getUserPositions(wallet.publicKey);
    
    res.json({
      success: true,
      data: {
        positions
      }
    });
  } catch (error) {
    console.error('Error getting user positions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 创建流动性头寸
 */
export const createPosition = async (req: Request, res: Response) => {
  try {
    const { poolAddress, xAmount, yAmount, maxPrice, minPrice, strategyType } = req.body;
    
    if (!poolAddress || xAmount === undefined || yAmount === undefined || 
        maxPrice === undefined || minPrice === undefined || !strategyType) {
      return res.status(400).json({
        success: false,
        error: 'poolAddress, xAmount, yAmount, maxPrice, minPrice, and strategyType are required'
      });
    }
    
    const wallet = await getWallet();
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    await meteora.initializeDLMMPool(poolAddress);
    
    // 将价格转换为bin ID
    const maxBinId = meteora.getBinIdFromPrice(maxPrice, false);
    const minBinId = meteora.getBinIdFromPrice(minPrice, true);
    
    const result = await meteora.createPosition({
      user: wallet,
      xAmount: Number(xAmount),
      yAmount: Number(yAmount),
      maxBinId,
      minBinId,
      strategyType
    });
    
    res.json({
      success: true,
      data: {
        ...result,
        explorerUrl: `https://solscan.io/tx/${result.txId}`
      }
    });
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 执行代币交换
 */
export const executeSwap = async (req: Request, res: Response) => {
  try {
    const { poolAddress, amount, swapYtoX, minOutAmount } = req.body;
    
    if (!poolAddress || amount === undefined || swapYtoX === undefined || minOutAmount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'poolAddress, amount, swapYtoX, and minOutAmount are required'
      });
    }
    
    const wallet = await getWallet();
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    await meteora.initializeDLMMPool(poolAddress);
    
    const txHash = await meteora.executeSwap(
      wallet,
      new BN(amount),
      swapYtoX,
      new BN(minOutAmount)
    );
    
    res.json({
      success: true,
      data: {
        txHash,
        explorerUrl: `https://solscan.io/tx/${txHash}`
      }
    });
  } catch (error) {
    console.error('Error executing Meteora swap:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 