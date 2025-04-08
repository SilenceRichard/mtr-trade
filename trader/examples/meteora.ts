import { Connection, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { MeteoraClient } from "../src/utils/meteora";
import { getWallet } from "../src/utils/wallet";
import { config } from "dotenv";
import { StrategyType } from "@meteora-ag/dlmm";

config();

async function main() {
  // 初始化连接 - 增加 confirmTransactionInitialTimeout 参数
  const connection = new Connection(
    process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com",
    {
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    }
  );

  // 创建Meteora客户端实例
  const meteoraClient = new MeteoraClient(connection);

  // SOL-USDC池地址
  const SOL_USDC_POOL = "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6";

  try {
    // 初始化DLMM池
    await meteoraClient.initializeDLMMPool(SOL_USDC_POOL);

    // 获取当前活跃bin的价格
    const activeBinPrice = await meteoraClient.getActiveBinPrice();
    console.log("Active bin price:", activeBinPrice);

    // 获取钱包
    const user = await getWallet();
    console.log("User:", user.publicKey.toBase58());

    // 根据价格获取binId
    // 这里使用一个较宽的价格范围: 当前价格的80%到130%
    const minBinId = meteoraClient.getBinIdFromPrice(
      Number(activeBinPrice.realPrice) * 1.1,
      true
    );
    const maxBinId = meteoraClient.getBinIdFromPrice(
      Number(activeBinPrice.realPrice) * 1.11,
      true
    );
    console.log("Min bin ID:", minBinId);
    console.log("Max bin ID:", maxBinId);
    console.log("Bin range:", maxBinId - minBinId);

    // 使用新方法创建多个仓位，自动处理大范围的binId
    const positions = await meteoraClient.createMultiplePositions({
      user,
      xAmount: 0.001 * 1e9, // 0.001 SOL
      yAmount: 0.001 * 1e6, // 0.001 USDC
      maxBinId,
      minBinId,
      strategyType: StrategyType.Spot,
    });

    console.log("Created positions:", positions);
    // 获取所有仓位
    const allPositions = await meteoraClient.getUserPositions(user.publicKey);
    console.log("All positions:", allPositions);
    // 提取流动性
    const closePosition = allPositions[0];
    const closeTx = await meteoraClient.removeLiquidity(
      user,
      closePosition.publicKey.toString(),
      closePosition.positionData.lowerBinId,
      closePosition.positionData.upperBinId
    );
    console.log("Close transaction:", closeTx);
    // // 获取交易报价
    // const swapAmount = new BN(100 * 1e6); // 100 USDC
    // const swapQuote = await meteoraClient.getSwapQuote(swapAmount, false);
    // console.log('Swap quote:', swapQuote);

    // // 执行交易
    // const swapTx = await meteoraClient.executeSwap(
    //   user,
    //   swapAmount,
    //   false,
    //   swapQuote.minOutAmount
    // );
    // console.log('Swap transaction:', swapTx);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
