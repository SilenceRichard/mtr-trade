import { Request, Response } from 'express';
import { getTokenInfo, getEnhancedPoolName, getTokenNameAndSymbol } from '../utils/tokenInfo';

/**
 * 获取代币信息
 */
export const getTokenInformation = async (req: Request, res: Response) => {
  try {
    const mintAddress = req.query.mintAddress as string;
    
    if (!mintAddress) {
      return res.status(400).json({
        success: false,
        error: 'mintAddress is required'
      });
    }
    
    const tokenInfo = await getTokenInfo(mintAddress);
    
    if (tokenInfo) {
      res.json({
        success: true,
        data: tokenInfo
      });
    } else {
      // 如果在registry中没找到，尝试使用增强版查询方法
      const enhancedInfo = await getTokenNameAndSymbol(mintAddress);
      res.json({
        success: true,
        data: {
          address: mintAddress,
          symbol: enhancedInfo.symbol,
          name: enhancedInfo.name,
          logoURI: null,
          source: enhancedInfo.source
        }
      });
    }
  } catch (error) {
    console.error('Error fetching token information:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token information'
    });
  }
};

/**
 * 获取币对名称
 */
export const getTokenPairName = async (req: Request, res: Response) => {
  try {
    const tokenXMint = req.query.tokenXMint as string;
    const tokenYMint = req.query.tokenYMint as string;
    
    if (!tokenXMint || !tokenYMint) {
      return res.status(400).json({
        success: false,
        error: 'tokenXMint and tokenYMint are required'
      });
    }
    
    const poolName = await getEnhancedPoolName(tokenXMint, tokenYMint);
    
    res.json({
      success: true,
      data: {
        poolName,
        tokenXMint,
        tokenYMint
      }
    });
  } catch (error) {
    console.error('Error generating pool name:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate pool name'
    });
  }
}; 