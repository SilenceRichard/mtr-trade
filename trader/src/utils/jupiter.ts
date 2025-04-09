import {
  PublicKey,
  Connection,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  SendOptions,
  Signer,
  Finality,
  Keypair,
} from "@solana/web3.js";

/**
 * Response type for Jupiter's quote API
 * @see https://docs.jup.ag/jupiter-api/swap-api-for-solana/quote-api
 */
interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

/**
 * Parameters for getting a Jupiter quote
 */
interface GetQuoteParams {
  /** Input token mint address */
  inputMint: string;
  /** Output token mint address */
  outputMint: string;
  /** Amount of input tokens (in raw units) */
  amount: string | number;
  /** Slippage tolerance in basis points (1 bp = 0.01%) */
  slippageBps?: number;
  /** Whether to restrict intermediate tokens to only highly liquid ones */
  restrictIntermediateTokens?: boolean;
  /** Use legacy transaction format for wallets that don't support versioned transactions */
  asLegacyTransaction?: boolean;
  /** Only route through a single market */
  onlyDirectRoutes?: boolean;
  /** Maximum number of accounts that can be included in the transaction */
  maxAccounts?: number;
}

/**
 * Get a quote for swapping tokens using Jupiter
 * @param params Quote parameters
 * @returns Quote response from Jupiter API
 * @throws Error if the API request fails
 */
export async function getJupiterQuote({
  inputMint,
  outputMint,
  amount,
  slippageBps = 10,
  restrictIntermediateTokens = true,
  asLegacyTransaction = false,
  onlyDirectRoutes = false,
  maxAccounts = 64,
}: GetQuoteParams): Promise<QuoteResponse> {
  // Construct URL with query parameters
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    restrictIntermediateTokens: restrictIntermediateTokens.toString(),
    asLegacyTransaction: asLegacyTransaction.toString(),
    onlyDirectRoutes: onlyDirectRoutes.toString(),
    maxAccounts: maxAccounts.toString(),
  });

  const url = `https://api.jup.ag/swap/v1/quote?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }

    const data = await response.json();
    // 输出data
    return data as QuoteResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get Jupiter quote: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Interface for Jupiter swap response
 * 交易响应接口
 */
interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  prioritizationType: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport?: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
    categoryName: string;
    heuristicMaxSlippageBps: number;
  };
  simulationError: null | string;
}

/**
 * Priority fee configuration options
 * 优先级费用配置选项
 */
interface PrioritizationFeeLamportsConfig {
  /**
   * Set a max priority fee with a specific priority level
   * 设置具有特定优先级的最大优先费用
   */
  priorityLevelWithMaxLamports?: {
    /** Maximum amount in lamports for priority fee */
    maxLamports: number;
    /** Whether to use global fee market (true) or local fee market (false) */
    global?: boolean;
    /** Priority level based on percentiles of recent fees */
    priorityLevel: "low" | "medium" | "high" | "veryHigh";
  };
  /**
   * Set a fixed amount for Jito tip in lamports
   * 为Jito小费设置固定金额（以lamports为单位）
   */
  jitoTipLamports?: number;
}

/**
 * Parameters for executing a Jupiter swap
 * Jupiter交换执行参数
 */
interface ExecuteJupiterSwapParams {
  /** Quote response from Jupiter's quote API */
  quoteResponse: QuoteResponse;
  /** User's wallet for signing the transaction */
  wallet: Keypair;
  /** Connection to Solana network */
  connection: Connection;
  /** Whether to use dynamic compute unit limit (recommended) */
  dynamicComputeUnitLimit?: boolean;
  /** Whether to use dynamic slippage (recommended) */
  dynamicSlippage?: boolean;
  /** Priority fee configuration */
  prioritizationFeeLamports?: PrioritizationFeeLamportsConfig;
  /** Whether to use legacy transactions (default: false) */
  asLegacyTransaction?: boolean;
  /** Transaction confirmation commitment level */
  commitment?: Finality;
  /** Max retry attempts for transaction */
  maxRetries?: number;
}

/**
 * Execute a token swap using Jupiter Swap API
 * 使用Jupiter Swap API执行代币交换
 * @param params Parameters for executing the swap
 * @returns Transaction signature if the swap was successful
 * @throws Error if the swap fails
 */
export async function executeJupiterSwap({
  quoteResponse,
  wallet,
  connection,
  dynamicComputeUnitLimit = true,
  dynamicSlippage = true,
  prioritizationFeeLamports = {
    priorityLevelWithMaxLamports: {
      maxLamports: 10000000,
      global: false,
      priorityLevel: "high",
    },
  },
  asLegacyTransaction = false,
  commitment = "finalized",
  maxRetries = 2,
}: ExecuteJupiterSwapParams): Promise<string> {
  try {
    // 1. 从Jupiter API获取交易数据
    const swapResponse = (await (
      await fetch("https://api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey.toString(),
          dynamicComputeUnitLimit, // 启用动态计算单元限制，优化交易处理
          dynamicSlippage, // 启用动态滑点，根据市场情况自动调整
          prioritizationFeeLamports, // 配置优先级费用，提高交易被打包概率
        }),
      })
    ).json()) as SwapResponse;

    // 2. 检查交易模拟是否有错误
    if (swapResponse.simulationError) {
      throw new Error(
        `交易模拟错误 (Swap simulation error): ${swapResponse.simulationError}`
      );
    }

    // 3. 将base64编码的交易数据转换为二进制缓冲区
    const swapTransactionBuf = Buffer.from(
      swapResponse.swapTransaction,
      "base64"
    );

    let signature: string;
    // 处理versioned交易（推荐）
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    // 5. 签名交易
    transaction.sign([wallet]);

    // 6. 发送交易
    const transactionBinary = transaction.serialize();
    signature = await connection.sendRawTransaction(transactionBinary, {
      skipPreflight: false, // 启用预检，可以捕获可能的错误
      preflightCommitment: commitment,
      maxRetries, // 最大重试次数
    });

    // 7. 等待交易确认
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: (await connection.getLatestBlockhash()).blockhash,
        lastValidBlockHeight: (
          await connection.getLatestBlockhash()
        ).lastValidBlockHeight,
      },
      commitment
    );

    // 8. 检查确认结果
    // 8. Check confirmation result
    if (confirmation.value.err) {
      throw new Error(
        `交易失败 (Transaction failed): ${JSON.stringify(
          confirmation.value.err
        )}\nhttps://solscan.io/tx/${signature}/`
      );
    }

    // 9. 返回交易签名
    // 9. Return the transaction signature
    return signature;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `执行Jupiter交换失败 (Failed to execute Jupiter swap): ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Common token addresses
 * 常用代币地址
 */
export const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;
