import { Request, Response } from 'express';
import { Connection } from '@solana/web3.js';
import { getQuote, executeSwap } from '../services/jupiter';
import { getWallet } from '../services/wallet';

/**
 * 获取Jupiter交易报价
 */
export const getJupiterQuote = async (req: Request, res: Response) => {
  try {
    const { inputMint, outputMint, amount, slippageBps = 10 } = req.query;
    
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        success: false,
        error: 'inputMint, outputMint and amount are required'
      });
    }
    
    const quote = await getQuote({
      inputMint: inputMint as string,
      outputMint: outputMint as string,
      amount: amount as string,
      slippageBps: slippageBps ? parseInt(slippageBps as string) : 10
    });
    
    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    console.error('Error fetching Jupiter quote:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 执行Jupiter交易
 */
export const executeJupiterSwap = async (req: Request, res: Response) => {
  try {
    const { quoteResponse } = req.body;
    
    if (!quoteResponse) {
      return res.status(400).json({
        success: false,
        error: 'quoteResponse is required'
      });
    }
    
    const wallet = await getWallet();
    const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    
    const signature = await executeSwap({
      quoteResponse,
      wallet,
      connection,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true
    });
    
    res.json({
      success: true,
      data: {
        signature,
        explorerUrl: `https://solscan.io/tx/${signature}`
      }
    });
  } catch (error) {
    console.error('Error executing Jupiter swap:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 