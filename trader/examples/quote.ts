import { config } from 'dotenv';
import { Connection } from '@solana/web3.js';
import { getJupiterQuote, TOKENS } from '../src/utils/jupiter';
import { fetchDecimal } from '../src/utils/decimals';

// 加载环境变量
config();

async function example() {
  try {
    const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');
    
    // 获取代币精度
    const solDecimals = await fetchDecimal(connection, TOKENS.SOL);
    const usdcDecimals = await fetchDecimal(connection, TOKENS.USDC);
    
    // 获取 1 SOL 兑换 USDC 的报价
    const quote = await getJupiterQuote({
      inputMint: TOKENS.SOL,
      outputMint: TOKENS.USDC,
      amount: '1000000000', // 1 SOL (9位小数)
    });
    
    // 使用实际精度计算金额
    const inputAmount = Number(quote.inAmount) / Math.pow(10, solDecimals);
    const outputAmount = Number(quote.outAmount) / Math.pow(10, usdcDecimals);
    
    console.log(`输入: ${inputAmount} SOL`);
    console.log(`预计获得: ${outputAmount} USDC`);
    console.log(`使用的交易所: ${quote.routePlan[0].swapInfo.label}`);
    console.log(`价格影响: ${quote.priceImpactPct}%`);
  } catch (error) {
    console.error('获取报价失败:', error);
  }
}

example();