import { config } from 'dotenv';
import { Connection } from '@solana/web3.js';
import { executeJupiterSwap, getJupiterQuote, TOKENS } from '../src/utils/jupiter';
import { fetchDecimal } from '../src/utils/decimals';
import { getWallet } from '../src/utils/wallet';

// 加载环境变量
config();

async function example() {
  try {
    const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');
    const wallet = await getWallet();
    // 获取代币精度
    const solDecimals = await fetchDecimal(connection, TOKENS.SOL);
    const usdcDecimals = await fetchDecimal(connection, TOKENS.USDC);
    
    // 获取 0.1USDC 兑换 SOL 的报价
    const quote = await getJupiterQuote({
      inputMint: TOKENS.USDC,
      outputMint: TOKENS.SOL,
      amount: 0.1 * 10 ** usdcDecimals,
    });
    
    // 使用实际精度计算金额
    const inputAmount = Number(quote.inAmount) / Math.pow(10, usdcDecimals);
    const outputAmount = Number(quote.outAmount) / Math.pow(10, solDecimals);
    const feeAmount = Number(quote.routePlan[0].swapInfo.feeAmount) / Math.pow(10, usdcDecimals);
    console.log(`输入: ${inputAmount} USDC`);
    console.log(`预计获得: ${outputAmount} SOL`);
    console.log(`使用的交易所: ${quote.routePlan[0].swapInfo.label}`);
    console.log(`价格影响: ${quote.priceImpactPct}%`);
    console.log(`滑点: ${quote.slippageBps * 0.01}%`);
    console.log(`手续费: ${feeAmount} ${quote.routePlan[0].swapInfo.feeMint}`);

    // 执行swap
    const swapTx = await executeJupiterSwap({
      quoteResponse: quote,
      wallet: wallet,
      connection: connection,
    });
    console.log(`交易签名: ${swapTx}`);
  } catch (error) {
    console.error('获取报价失败:', error);
  }
}

example();