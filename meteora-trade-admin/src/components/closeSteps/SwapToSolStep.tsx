import { Button, InputNumber, Space, Spin, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { Position } from "../../services/meteoraService";
import { getJupiterQuote, executeJupiterSwap, QuoteResponse } from "../../services/jupiterService";
import { SOL_MINT, fetchTokenBalance } from "../../services/walletService";
import notification from "../../utils/notification";

interface SwapToSolStepProps {
  position: Position & {
    xDecimals: number;
    yDecimals: number;
    xMint?: string;
    yMint?: string;
    xTokenName?: string;
    yTokenName?: string;
    totalSolFees?: number;
    totalAmountInSol?: number;
  };
  onSuccess: (txId: string) => void;
  onError: (error: unknown) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const SwapToSolStep: React.FC<SwapToSolStepProps> = ({
  position,
  onSuccess,
  onError,
  loading,
  setLoading,
}) => {
  const [swapSlippageBps, setSwapSlippageBps] = useState<number>(100); // Default 1% slippage
  const [currentSwapQuote, setCurrentSwapQuote] = useState<QuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(false);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [expectedOutput, setExpectedOutput] = useState<number | null>(null);
  const [hasTokensToSwap, setHasTokensToSwap] = useState<boolean>(false);

  useEffect(() => {
    // Check if there are X tokens to swap
    checkTokenBalance();
  }, [position.xMint]);

  const checkTokenBalance = async () => {
    if (!position.xMint) {
      setHasTokensToSwap(false);
      return;
    }

    setLoadingQuote(true);
    try {
      const balance = await fetchTokenBalance(position.xMint);
      setTokenBalance(balance);
      setHasTokensToSwap(balance > 0);
      
      if (balance > 0) {
        // If we have tokens, automatically fetch quote
        fetchSwapQuote(balance);
      } else {
        // No tokens to swap, we can skip this step
        setLoadingQuote(false);
      }
    } catch (error) {
      console.error("Error checking token balance:", error);
      setHasTokensToSwap(false);
      setLoadingQuote(false);
    }
  };

  const handleSlippageChange = (value: number | null) => {
    if (value !== null) {
      // Convert percentage to basis points
      const newSlippageBps = value * 100;
      setSwapSlippageBps(newSlippageBps);
      
      // Re-fetch quote with new slippage
      if (tokenBalance > 0) {
        fetchSwapQuote(tokenBalance, newSlippageBps);
      }
    }
  };

  const fetchSwapQuote = async (balance: number, customSlippageBps?: number) => {
    if (!position.xMint || balance <= 0) {
      setLoadingQuote(false);
      return;
    }
    
    setLoadingQuote(true);
    
    try {
      // Use custom slippage if provided, otherwise use the state value
      const slippageToUse = customSlippageBps !== undefined ? customSlippageBps : swapSlippageBps;
      
      // Prepare the swap quote
      const quoteParams = {
        inputMint: position.xMint,
        outputMint: SOL_MINT,
        amount: Math.floor(balance * Math.pow(10, position.xDecimals)).toString(),
        slippageBps: slippageToUse,
      };
      
      // Get the quote
      const quote = await getJupiterQuote(quoteParams);
      if (quote) {
        setCurrentSwapQuote(quote);
        // Calculate expected output - SOL has 9 decimals
        const output = parseInt(quote.outAmount) / 1e9;
        setExpectedOutput(output);
      } else {
        setCurrentSwapQuote(null);
        setExpectedOutput(null);
      }
    } catch (error) {
      console.error("Error fetching swap quote:", error);
      setCurrentSwapQuote(null);
      setExpectedOutput(null);
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleSwapXToSol = async () => {
    // If no tokens to swap, skip this step
    if (!hasTokensToSwap || !position.xMint) {
      onSuccess("skipped-no-tokens");
      return;
    }

    setLoading(true);

    try {
      // Use existing quote if available
      if (currentSwapQuote) {
        // Execute the swap with current quote
        const swapResult = await executeJupiterSwap(currentSwapQuote);
        if (swapResult) {
          notification.success(
            `交换成功，交易ID: ${swapResult.signature}`
          );
          onSuccess(swapResult.signature);
        } else {
          notification.error("交换失败");
          onError(new Error("Swap failed with no error"));
        }
      } else {
        // Try to fetch new quote and execute
        const balance = await fetchTokenBalance(position.xMint);
        if (balance <= 0) {
          notification.warning("钱包中没有可交换的X代币");
          onSuccess("skipped-no-tokens"); // Skip this step
          setLoading(false);
          return;
        }

        // Prepare the swap quote
        const quoteParams = {
          inputMint: position.xMint,
          outputMint: SOL_MINT,
          amount: Math.floor(balance * Math.pow(10, position.xDecimals)).toString(),
          slippageBps: swapSlippageBps,
        };

        // Get the quote
        const quote = await getJupiterQuote(quoteParams);
        if (!quote) {
          notification.error("无法获取交换报价");
          onError(new Error("Could not get swap quote"));
          setLoading(false);
          return;
        }

        // Execute the swap
        const swapResult = await executeJupiterSwap(quote);
        if (swapResult) {
          notification.success(
            `交换成功，交易ID: ${swapResult.signature}`
          );
          onSuccess(swapResult.signature);
        } else {
          notification.error("交换失败");
          onError(new Error("Swap execution failed"));
        }
      }
    } catch (error) {
      console.error("Error swapping X to SOL:", error);
      notification.error("交换X代币到SOL失败");
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  // If no tokens to swap, show a message and auto-proceed
  if (!hasTokensToSwap) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <p>钱包中没有{position.xTokenName || "X"}代币需要兑换，将自动跳过此步骤</p>
        <Button
          type="primary"
          onClick={handleSwapXToSol}
          loading={loading}
        >
          继续
        </Button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <p>将{position.xTokenName || "X"}代币兑换为{position.yTokenName || "SOL"}</p>
      
      <div style={{ marginBottom: 12 }}>
        <Space>
          <span>滑点容差:</span>
          <InputNumber
            min={0.01}
            max={10}
            step={1}
            value={swapSlippageBps / 100} // Convert from bp to percentage
            onChange={handleSlippageChange}
            formatter={(value) => `${value}%`}
            parser={(value) => value ? parseFloat(value.replace('%', '')) : 1}
            style={{ width: 80 }}
            disabled={loadingQuote || loading}
          />
          <Tooltip title="滑点容差设置：1 bp = 0.01%">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      </div>
      
      {/* Show quote information */}
      {loadingQuote && (
        <div style={{ margin: "12px 0" }}>
          <Spin size="small" /> 正在获取报价...
        </div>
      )}
      
      {expectedOutput !== null && !loadingQuote && (
        <div style={{ margin: "12px 0" }}>
          <p>预计获得: {expectedOutput.toFixed(6)} {position.yTokenName || 'SOL'}</p>
          {currentSwapQuote && (
            <p>价格影响: {parseFloat(currentSwapQuote.priceImpactPct).toFixed(4)}%</p>
          )}
        </div>
      )}
      
      <Button 
        type="primary"
        onClick={handleSwapXToSol}
        loading={loading}
        disabled={loading || loadingQuote || !currentSwapQuote}
      >
        确认兑换
      </Button>
    </div>
  );
};

export default SwapToSolStep; 