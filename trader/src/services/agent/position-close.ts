import { logger, tradingLogger } from "./logger";
import { getQuote, executeSwap } from "../jupiter";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import axios from "axios";
import { getWallet, getWalletBalance } from "../wallet";
import { updatePosition, UpdatePositionParams } from "./position-update";
import { SOL_AMOUNT } from "./constants";

// API基础URL
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4001/api";

// API响应类型
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 处理完整的仓位关闭流程
 */
export const closePosition = async (params: {
  poolAddress: string;
  mintAddress: string;
  positionId: string;
  connection: Connection;
  lowerBinId: number;
  upperBinId: number;
  xDecimals: number;
  yDecimals: number;
  profitData: {
    profit: number;
    profitRate: number;
    fees: number;
    postionSOLAmount: number;
  };
}): Promise<boolean> => {
  const {
    poolAddress,
    mintAddress,
    positionId,
    connection,
    lowerBinId,
    upperBinId,
    xDecimals,
    yDecimals,
    profitData,
  } = params;
  try {
    logger.info({
      message: "开始仓位关闭流程",
      positionId,
    });
    // 步骤1: 调用controller的removeLiquidity方法移除流动性
    const removeLiquidityResult = await removeLiquidity(
      poolAddress,
      positionId,
      lowerBinId,
      upperBinId
    );

    if (!removeLiquidityResult.success) {
      logger.error({
        message: "移除流动性失败",
        positionId,
        error: removeLiquidityResult.error,
      });
      return false;
    }

    logger.info({
      message: "流动性已成功移除",
      positionId,
      details: removeLiquidityResult.data,
    });

    // 步骤2: 调用controller的claimFee方法领取手续费
    const claimFeesResult = await claimFees(poolAddress, positionId);

    if (!claimFeesResult.success) {
      logger.error({
        message: "领取手续费失败",
        positionId,
        error: claimFeesResult.error,
      });
      return false;
    }

    logger.info({
      message: "手续费已成功领取",
      positionId,
      details: claimFeesResult.data,
    });
    const wallet = await getWallet();
    // 步骤3: 如果有需要兑换的代币，处理兑换
    const xBalance = await getWalletBalance({
      mintAddress,
      connection,
      publicKey: wallet.publicKey,
    });

    if (xBalance) {
      logger.info({
        message: "需要将代币兑换为SOL",
        positionId,
        tokenMint: mintAddress,
        amount: xBalance * 10 ** (xDecimals || 6),
      });
      // 使用Jupiter服务进行代币兑换
      const swapResult = await swapToSol(
        mintAddress,
        (xBalance * 10 ** (xDecimals || 6)).toString(),
        connection,
        wallet
      );

      if (!swapResult.success) {
        logger.error({
          message: "代币兑换失败",
          positionId,
          error: swapResult.error,
        });
        return false;
      }
      // 更新position记录，添加收益信息
      const now = new Date();
      const totalSOLAmount =
        profitData.postionSOLAmount +
        Number(swapResult.swapAmount) / 1e9;
      const updateData: UpdatePositionParams = {
        profit: totalSOLAmount - SOL_AMOUNT,
        profit_rate: profitData.profitRate,
        fees: profitData.fees,
        close_time: now,
        // 持续时间可以根据需要计算或从API响应获取
      };
      await updatePosition(positionId, updateData);
      logger.info({
        message: `代币已成功兑换为${Number(swapResult.swapAmount) / 1e9}SOL`,
        positionId,
        swapDetails: swapResult,
      });
    }

    // 步骤4: 调用controller的closePosition方法最终关闭仓位
    const closeResult = await finalizeClosePosition(poolAddress, positionId);

    if (!closeResult.success) {
      logger.error({
        message: "最终关闭仓位失败",
        positionId,
        error: closeResult.error,
      });
      return false;
    }

    logger.info({
      message: "仓位已成功关闭",
      positionId,
      details: closeResult.data,
    });

    return true;
  } catch (error) {
    logger.error({
      message: "仓位关闭过程中出错",
      positionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

/**
 * 步骤1: 通过调用API移除仓位的流动性
 */
export const removeLiquidity = async (
  poolAddress: string,
  positionAddress: string,
  lowerBinId: number,
  upperBinId: number
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> => {
  try {
    // 调用controller的removeLiquidity接口
    const response = await axios.post<ApiResponse<any>>(
      `${API_BASE_URL}/api/meteora/positions/remove`,
      {
        poolAddress,
        positionAddress,
        fromBinId: lowerBinId,
        toBinId: upperBinId,
      }
    );

    // 检查响应
    if (response.data && response.data.success) {
      tradingLogger.info({
        message: "通过API成功移除流动性",
        positionId: positionAddress,
        apiResponse: response.data,
      });

      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.error || "API返回失败状态",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 步骤2: 通过调用API领取仓位的手续费
 */
export const claimFees = async (
  poolAddress: string,
  positionAddress: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> => {
  try {
    // 调用controller的claimFee接口
    const response = await axios.post<ApiResponse<any>>(
      `${API_BASE_URL}/api/meteora/fee/claim`,
      {
        poolAddress,
        positionAddress,
      }
    );

    // 检查响应
    if (response.data && response.data.success) {
      tradingLogger.info({
        message: "通过API成功领取手续费",
        positionId: positionAddress,
        apiResponse: response.data,
      });

      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.error || "API返回失败状态",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 步骤3: 将代币兑换为SOL
 * 注: 这一步仍然使用直接实现，因为controller中可能没有对应方法
 */
export const swapToSol = async (
  tokenMint: string,
  amount: string,
  connection: Connection,
  wallet: Keypair
): Promise<{
  success: boolean;
  swapAmount?: string;
  error?: string;
}> => {
  try {
    // SOL mint地址
    const solMint = "So11111111111111111111111111111111111111112";

    // 获取代币兑换报价
    const quoteResponse = await getQuote({
      inputMint: tokenMint,
      outputMint: solMint,
      amount,
    });

    if (!quoteResponse) {
      return {
        success: false,
        error: "获取兑换报价失败",
      };
    }

    // 执行兑换
    const signature = await executeSwap({
      quoteResponse,
      wallet,
      connection,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
    });

    tradingLogger.info({
      message: "代币已成功兑换为SOL",
      tokenMint,
      amount,
      receivedSolAmount: quoteResponse.outAmount,
      signature,
    });

    return {
      success: true,
      swapAmount: quoteResponse.outAmount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 步骤4: 通过调用API最终关闭仓位
 */
export const finalizeClosePosition = async (
  poolAddress: string,
  positionAddress: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> => {
  try {
    // 调用controller的closePosition接口
    const response = await axios.post<ApiResponse<any>>(
      `${API_BASE_URL}/api/meteora/positions/close`,
      {
        poolAddress,
        positionAddress,
      }
    );

    // 检查响应
    if (response.data && response.data.success) {
      tradingLogger.info({
        message: "通过API成功关闭仓位",
        positionId: positionAddress,
        apiResponse: response.data,
      });

      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.error || "API返回失败状态",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
