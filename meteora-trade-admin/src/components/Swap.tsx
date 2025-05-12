import { useState, useEffect } from "react";
import { Typography, Input, Button, Space, Card,  InputNumber, Tooltip, Divider } from "antd";
import { InfoCircleOutlined, SwapOutlined } from "@ant-design/icons";
import { getJupiterQuote, executeJupiterSwap, QuoteResponse, ComputeBudgetConfig } from "../services/jupiterService";
import { SOL_MINT, fetchTokenBalance, fetchTokenDecimals } from "../services/walletService";
import notification from "../utils/notification";

const { Title, Text } = Typography;

const Swap = () => {
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [swapDirection, setSwapDirection] = useState<"solToToken" | "tokenToSol">("solToToken");
  const [amount, setAmount] = useState<number | null>(0);
  const [slippageBps, setSlippageBps] = useState<number>(100); // Default 1% slippage
  const [cuBufferMultiplier, setCuBufferMultiplier] = useState<number | null>(1.25); // Default CU buffer multiplier
  const [microLamports, setMicroLamports] = useState<number | null>(null); // Default to null
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | null>(null);
  const [expectedOutput, setExpectedOutput] = useState<number | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number>(0);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(false);
  const [executingSwap, setExecutingSwap] = useState<boolean>(false);
  const [swapResult, setSwapResult] = useState<{ signature: string; explorerUrl: string } | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);

  // Check token decimals when address changes
  useEffect(() => {
    if (tokenAddress) {
      fetchTokenInfo();
    }
  }, [tokenAddress]);

  const fetchTokenInfo = async () => {
    try {
      const decimals = await fetchTokenDecimals(tokenAddress);
      setTokenDecimals(decimals);
      
      // Fetch token and SOL balances
      const tokenBal = await fetchTokenBalance(tokenAddress);
      const solBal = await fetchTokenBalance(SOL_MINT);
      
      setTokenBalance(tokenBal);
      setSolBalance(solBal);
    } catch (error) {
      console.error("Error fetching token info:", error);
      notification.error("无法获取代币信息");
    }
  };

  const handleSlippageChange = (value: number | null) => {
    if (value !== null) {
      // Convert percentage to basis points
      const newSlippageBps = value * 100;
      setSlippageBps(newSlippageBps);
      
      // Re-fetch quote with new slippage if we have a quote already
      if (quoteResponse) {
        getQuote();
      }
    }
  };

  const toggleSwapDirection = () => {
    setSwapDirection(prev => prev === "solToToken" ? "tokenToSol" : "solToToken");
    setQuoteResponse(null);
    setExpectedOutput(null);
  };

  const getQuote = async () => {
    if (!tokenAddress) {
      notification.warning("请输入代币地址");
      return;
    }

    if (!amount || amount <= 0) {
      notification.warning("请输入有效的金额");
      return;
    }

    setLoadingQuote(true);
    setQuoteResponse(null);
    setExpectedOutput(null);

    try {
      const inputMint = swapDirection === "solToToken" ? SOL_MINT : tokenAddress;
      const outputMint = swapDirection === "solToToken" ? tokenAddress : SOL_MINT;
      const inputDecimals = swapDirection === "solToToken" ? 9 : tokenDecimals;
      
      // Convert amount to smallest units based on decimals
      const amountInSmallestUnits = Math.floor(amount * Math.pow(10, inputDecimals)).toString();
      
      const quoteParams = {
        inputMint,
        outputMint,
        amount: amountInSmallestUnits,
        slippageBps,
      };
      
      const quote = await getJupiterQuote(quoteParams);
      if (quote) {
        setQuoteResponse(quote);
        
        // Calculate expected output
        const outputDecimals = swapDirection === "solToToken" ? tokenDecimals : 9;
        const output = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
        setExpectedOutput(output);
      } else {
        notification.error("无法获取交换报价");
      }
    } catch (error) {
      console.error("Error fetching swap quote:", error);
      notification.error("获取报价失败");
    } finally {
      setLoadingQuote(false);
    }
  };

  const executeSwap = async () => {
    if (!quoteResponse) {
      notification.warning("请先获取报价");
      return;
    }

    setExecutingSwap(true);
    try {
      // Prepare compute budget config
      const computeBudgetConfig: ComputeBudgetConfig = {};
      
      if (cuBufferMultiplier !== null) {
        computeBudgetConfig.cuBufferMultiplier = cuBufferMultiplier;
      }
      
      if (microLamports !== null) {
        computeBudgetConfig.microLamports = microLamports;
      }
      
      const result = await executeJupiterSwap(quoteResponse, computeBudgetConfig);
      if (result) {
        setSwapResult(result);
        notification.success(`交换成功！交易ID: ${result.signature}`);
        
        // Refresh balances
        fetchTokenInfo();
      } else {
        notification.error("交换失败");
      }
    } catch (error) {
      console.error("Error executing swap:", error);
      notification.error("执行交换失败");
    } finally {
      setExecutingSwap(false);
    }
  };

  const resetSwap = () => {
    setQuoteResponse(null);
    setExpectedOutput(null);
    setSwapResult(null);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <Card title={<Title level={3}>Token Swap</Title>}>
        <Space direction="vertical" style={{ width: "100%" }}>
          {/* Token Address Input */}
          <div>
            <Text strong>代币地址</Text>
            <Input
              placeholder="输入代币地址"
              value={tokenAddress}
              onChange={(e) => {
                setTokenAddress(e.target.value);
                resetSwap();
              }}
              style={{ width: "100%" }}
              disabled={executingSwap || loadingQuote}
            />
          </div>

          {/* Swap Direction */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "16px 0" }}>
            <Button 
              icon={<SwapOutlined />}
              onClick={toggleSwapDirection}
              disabled={executingSwap || loadingQuote}
            >
              切换方向
            </Button>
            <Text style={{ marginLeft: 8 }}>
              当前方向: {swapDirection === "solToToken" ? "SOL -> Token" : "Token -> SOL"}
            </Text>
          </div>
          
          {/* Balance Display */}
          <div>
            <Text>
              {swapDirection === "solToToken" 
                ? `SOL 余额: ${solBalance.toFixed(6)}`
                : `代币余额: ${tokenBalance.toFixed(tokenDecimals > 6 ? 6 : tokenDecimals)}`}
            </Text>
          </div>

          {/* Amount Input */}
          <div>
            <Text strong>输入金额</Text>
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              value={amount}
              onChange={(value) => {
                setAmount(value);
                resetSwap();
              }}
              disabled={executingSwap || loadingQuote}
              precision={swapDirection === "solToToken" ? 9 : tokenDecimals}
            />
          </div>

          {/* Slippage Setting */}
          <div>
            <Space>
              <Text strong>滑点容差:</Text>
              <InputNumber
                min={0.01}
                max={10}
                step={1}
                value={slippageBps / 100} // Convert from bp to percentage
                onChange={handleSlippageChange}
                formatter={(value) => `${value}%`}
                parser={(value) => value ? parseFloat(value.replace('%', '')) : 1}
                style={{ width: 100 }}
                disabled={executingSwap || loadingQuote}
              />
              <Tooltip title="滑点容差设置：1 bp = 0.01%">
                <InfoCircleOutlined />
              </Tooltip>
            </Space>
          </div>

          {/* Compute Budget Settings */}
          <div>
            <Space>
              <Text strong>计算预算设置:</Text>
            </Space>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div>
                <Text>CU缓冲倍数:</Text>
                <InputNumber
                  min={1}
                  max={10}
                  step={0.25}
                  value={cuBufferMultiplier}
                  onChange={setCuBufferMultiplier}
                  style={{ width: 100 }}
                  disabled={executingSwap || loadingQuote}
                />
                <Tooltip title="计算单元缓冲倍数，默认为 1.25">
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              </div>
              <div>
                <Text>微Lamports:</Text>
                <InputNumber
                  min={0}
                  step={100}
                  value={microLamports}
                  onChange={setMicroLamports}
                  style={{ width: 120 }}
                  disabled={executingSwap || loadingQuote}
                />
                <Tooltip title="每计算单元的微Lamports，留空使用默认值">
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Quote Display */}
          {expectedOutput !== null && (
            <div style={{ margin: "12px 0", textAlign: "center" }}>
              <Text strong>预计获得:</Text>
              <Text> {expectedOutput.toFixed(6)} {swapDirection === "solToToken" ? "代币" : "SOL"}</Text>
              {quoteResponse && (
                <div>
                  <Text>价格影响: {parseFloat(quoteResponse.priceImpactPct).toFixed(4)}%</Text>
                </div>
              )}
            </div>
          )}

          {/* Swap Result */}
          {swapResult && (
            <div style={{ margin: "12px 0", textAlign: "center" }}>
              <Text strong>交换成功!</Text>
              <div>
                <a href={swapResult.explorerUrl} target="_blank" rel="noopener noreferrer">
                  在浏览器中查看交易
                </a>
              </div>
            </div>
          )}

          <Divider />

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button
              type="primary"
              onClick={getQuote}
              disabled={!tokenAddress || amount === null || amount <= 0 || executingSwap || loadingQuote}
              loading={loadingQuote}
            >
              获取报价
            </Button>
            
            <Button
              type="primary"
              onClick={executeSwap}
              disabled={!quoteResponse || executingSwap}
              loading={executingSwap}
            >
              执行交换
            </Button>
            
            <Button
              onClick={resetSwap}
              disabled={executingSwap || loadingQuote || (!quoteResponse && !swapResult)}
            >
              重置
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default Swap; 