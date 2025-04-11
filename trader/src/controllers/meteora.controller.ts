import { Request, Response } from 'express';
import { Connection } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { MeteoraService } from '../services/meteora';
import { getWallet } from '../services/wallet';
import { LbPosition, StrategyType } from '@meteora-ag/dlmm';
import * as DLMM from '@meteora-ag/dlmm';
import { PublicKey } from '@solana/web3.js';

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
    // "Spot" | "Curve" | "Bid Risk"
    const STRATEGY_TYPE = {
      "Spot": StrategyType.Spot,
      "Curve": StrategyType.Curve,
      "Bid Risk": StrategyType.BidAsk
    }
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
    // The priceInLamports is the raw price value obtained from the Meteora DLMM pool, which is the price representation used internally by the liquidity pool. 
    const maxPriceInLamports = meteora.toPricePerLamport(maxPrice);
    const minPriceInLamports = meteora.toPricePerLamport(minPrice);
    // 将价格转换为bin ID
    const maxBinId = meteora.getBinIdFromPrice(Number(maxPriceInLamports), true);
    const minBinId = meteora.getBinIdFromPrice(Number(minPriceInLamports), true);
   
    const result = await meteora.createPosition({
      user: wallet,
      xAmount,
      yAmount,
      maxBinId,
      minBinId,
      strategyType: STRATEGY_TYPE[strategyType as keyof typeof STRATEGY_TYPE]
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
 * 获取创建头寸的报价
 */
export const getPositionQuote = async (req: Request, res: Response) => {
  try {
    const { poolAddress, xAmount, yAmount, maxPrice, minPrice, strategyType } = req.body;
    // "Spot" | "Curve" | "Bid Risk"
    const STRATEGY_TYPE = {
      "Spot": StrategyType.Spot,
      "Curve": StrategyType.Curve,
      "Bid Risk": StrategyType.BidAsk
    }
    
    if (!poolAddress || xAmount === undefined || yAmount === undefined || 
        maxPrice === undefined || minPrice === undefined || !strategyType) {
      return res.status(400).json({
        success: false,
        error: 'poolAddress, xAmount, yAmount, maxPrice, minPrice, and strategyType are required'
      });
    }
    
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    await meteora.initializeDLMMPool(poolAddress);
    
    // 将价格转换为Lamport格式
    const maxPriceInLamports = meteora.toPricePerLamport(maxPrice);
    const minPriceInLamports = meteora.toPricePerLamport(minPrice);
    
    // 将价格转换为bin ID
    const maxBinId = meteora.getBinIdFromPrice(Number(maxPriceInLamports), true);
    const minBinId = meteora.getBinIdFromPrice(Number(minPriceInLamports), true);
   
    const quoteResult = await meteora.getPositionQuote({
      xAmount,
      yAmount,
      maxBinId,
      minBinId,
      strategyType: STRATEGY_TYPE[strategyType as keyof typeof STRATEGY_TYPE]
    });
    
    res.json({
      success: true,
      data: quoteResult
    });
  } catch (error) {
    console.error('Error getting position quote:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Define Position interface with processed BN values
export interface ProcessedPosition {
  publicKey: string;
  owner: string;
  lowerBinId: number;
  upperBinId: number;
  totalXAmount: string;
  totalYAmount: string;
  feeX: string;
  feeY: string;
  rewardOne: string;
  rewardTwo: string;
  totalClaimedFeeXAmount: string;
  totalClaimedFeeYAmount: string;
  feeXExcludeTransferFee: string;
  feeYExcludeTransferFee: string;
  rewardOneExcludeTransferFee: string;
  rewardTwoExcludeTransferFee: string;
  totalXAmountExcludeTransferFee: string;
  totalYAmountExcludeTransferFee: string;
  lastUpdatedAt: string;
}

 // Helper method to convert LbPosition to a more usable format
 function processPositionData(position: LbPosition): ProcessedPosition {
  const { positionData } = position;
  
  // Helper function to convert BN or hex string to decimal string
  const bnToDecimal = (value: BN | string): string => {
    if (value instanceof BN) {
      return value.toString(10);
    } else {
      return value;
    }
  };
  
  // Process BN values to strings for display
  return {
    publicKey: position.publicKey.toString(),
    owner: positionData.owner.toString(),
    lowerBinId: positionData.lowerBinId,
    upperBinId: positionData.upperBinId,
    totalXAmount: bnToDecimal(positionData.totalXAmount),
    totalYAmount: bnToDecimal(positionData.totalYAmount),
    feeX: bnToDecimal(positionData.feeX),
    feeY: bnToDecimal(positionData.feeY),
    rewardOne: bnToDecimal(positionData.rewardOne),
    rewardTwo: bnToDecimal(positionData.rewardTwo),
    totalClaimedFeeXAmount: bnToDecimal(positionData.totalClaimedFeeXAmount),
    totalClaimedFeeYAmount: bnToDecimal(positionData.totalClaimedFeeYAmount),
    feeXExcludeTransferFee: bnToDecimal(positionData.feeXExcludeTransferFee),
    feeYExcludeTransferFee: bnToDecimal(positionData.feeYExcludeTransferFee),
    rewardOneExcludeTransferFee: bnToDecimal(positionData.rewardOneExcludeTransferFee),
    rewardTwoExcludeTransferFee: bnToDecimal(positionData.rewardTwoExcludeTransferFee),
    totalXAmountExcludeTransferFee: bnToDecimal(positionData.totalXAmountExcludeTransferFee),
    totalYAmountExcludeTransferFee: bnToDecimal(positionData.totalYAmountExcludeTransferFee),
    lastUpdatedAt: bnToDecimal(positionData.lastUpdatedAt),
  };
}

/**
 * 获取用户在所有池中的仓位
 */
export const getAllUserPositions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletAddress } = req.query;

    // 参数验证
    if (!walletAddress) {
      res.status(400).json({ error: 'Missing wallet address' });
      return;
    }

    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    
    // 使用DLMM的静态方法获取用户在所有流动性池中的仓位
    const allPositions = await DLMM.default.getAllLbPairPositionsByUser(
      connection, 
      new PublicKey(walletAddress as string)
    );
    
    // 处理结果为更友好的格式
    const positions = Array.from(allPositions.entries()).map(([lbPairAddress, positionInfo]) => {
      return {
        lbPairAddress: lbPairAddress.toString(),
        positionsCount: positionInfo.lbPairPositionsData.length,
        tokenX: {
          mint: positionInfo.tokenX.mint.address,
          decimals: positionInfo.tokenX.mint.decimals,
          amount: positionInfo.tokenX.amount.toString()
        },
        tokenY: {
          mint: positionInfo.tokenY.mint.address,
          decimals: positionInfo.tokenY.mint.decimals,
          amount: positionInfo.tokenY.amount.toString()
        },
        positions: positionInfo.lbPairPositionsData.map(pos => ({
          ...processPositionData(pos)
        }))
      };
    });

    res.status(200).json({ positions });
  } catch (error: any) {
    console.error('Error fetching all user positions:', error);
    res.status(500).json({ error: `Failed to fetch all user positions: ${error.message}` });
  }
};

/**
 * 移除流动性
 */
export const removeLiquidity = async (req: Request, res: Response) => {
  try {
    const { poolAddress, positionAddress, fromBinId, toBinId } = req.body;
    
    if (!poolAddress || !positionAddress || fromBinId === undefined || toBinId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'poolAddress, positionAddress, fromBinId, and toBinId are required'
      });
    }
    
    const wallet = await getWallet();
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    await meteora.initializeDLMMPool(poolAddress);
    
    const txId = await meteora.removeLiquidity(wallet, positionAddress, fromBinId, toBinId);
    
    res.json({
      success: true,
      data: {
        txId,
        explorerUrl: `https://solscan.io/tx/${typeof txId === 'string' ? txId : txId[0]}`
      }
    });
  } catch (error) {
    console.error('Error removing liquidity:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 关闭头寸
 */
export const closePosition = async (req: Request, res: Response) => {
  try {
    const { poolAddress, positionAddress } = req.body;
    
    if (!poolAddress || !positionAddress) {
      return res.status(400).json({
        success: false,
        error: 'poolAddress and positionAddress are required'
      });
    }
    
    const wallet = await getWallet();
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    await meteora.initializeDLMMPool(poolAddress);
    
    const txId = await meteora.closePosition(wallet, positionAddress);
    
    res.json({
      success: true,
      data: {
        txId,
        explorerUrl: `https://solscan.io/tx/${typeof txId === 'string' ? txId : txId[0]}`
      }
    });
  } catch (error) {
    console.error('Error closing position:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 领取手续费
 */
export const claimFee = async (req: Request, res: Response) => {
  try {
    const { poolAddress, positionAddress } = req.body;
    
    if (!poolAddress || !positionAddress) {
      return res.status(400).json({
        success: false,
        error: 'poolAddress and positionAddress are required'
      });
    }
    
    const wallet = await getWallet();
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const meteora = new MeteoraService(connection);
    await meteora.initializeDLMMPool(poolAddress);
    
    const txId = await meteora.claimFee(wallet, positionAddress);
    
    res.json({
      success: true,
      data: {
        txId,
        explorerUrl: `https://solscan.io/tx/${typeof txId === 'string' ? txId : txId[0]}`
      }
    });
  } catch (error) {
    console.error('Error claiming fee:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 
