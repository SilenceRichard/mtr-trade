import { Request, Response } from 'express';
import { Connection } from '@solana/web3.js';
import { getWallet, getWalletBalance } from '../services/wallet';

/**
 * 获取钱包公钥
 */
export const getWalletPublicKey = async (req: Request, res: Response) => {
  try {
    const wallet = await getWallet();
    
    res.json({
      success: true,
      data: {
        publicKey: wallet.publicKey.toString(),
      }
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet'
    });
  }
};

/**
 * 获取钱包余额
 */
export const getBalance = async (req: Request, res: Response) => {
  try {
    const wallet = await getWallet();
    const mintAddress = req.query.mintAddress as string;
    
    if (!mintAddress) {
      return res.status(400).json({
        success: false,
        error: 'mintAddress is required'
      });
    }
    
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    
    const balance = await getWalletBalance({
      mintAddress,
      connection,
      publicKey: wallet.publicKey
    });
    
    res.json({
      success: true,
      data: {
        balance,
        mintAddress
      }
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance'
    });
  }
}; 