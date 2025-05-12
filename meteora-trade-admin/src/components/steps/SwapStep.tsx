import { Typography, Button, InputNumber, Space, Tooltip } from "antd";
import { PoolItem } from "../../services/poolService";
import { QuoteResponse } from "../../services/jupiterService";
import { InfoCircleOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export interface SwapStepProps {
  selectedPool?: PoolItem;
  solAmount: number | null;
  swapStatus: "idle" | "loading" | "success" | "failed";
  swapQuote: QuoteResponse | null;
  swapResult: { signature: string; explorerUrl: string } | null;
  initiateSwap: () => void;
  executeSwap: () => void;
  setCurrentStep: (step: number) => void;
  setIsExecuting: (executing: boolean) => void;
  slippageBps: number;
  setSlippageBps: (slippage: number) => void;
}

const SwapStep = ({
  selectedPool,
  solAmount,
  swapStatus,
  swapQuote,
  swapResult,
  initiateSwap,
  executeSwap,
  setCurrentStep,
  setIsExecuting,
  slippageBps,
  setSlippageBps
}: SwapStepProps) => {
  // Convert basis points to percentage for display
  const slippagePercent = slippageBps / 100;
  
  // Handler for slippage change
  const handleSlippageChange = (value: number | null) => {
    if (value !== null) {
      // Convert percentage to basis points
      setSlippageBps(value * 100);
      
      // Request a new quote if we already have a quote and we're not in loading state
      if (swapQuote && swapStatus !== "loading") {
        // Use setTimeout to ensure state is updated before initiating swap
        setTimeout(() => {
          initiateSwap();
        }, 0);
      }
    }
  };
  
  return (
    <div>
      <Title level={5}>Swapping Tokens</Title>
      <div>
        <Text>Trading Pair: SOL/{selectedPool?.tokenInfo.name || 'Token'}</Text>
        <br />
        <Text>Amount: {solAmount ? solAmount / 2 : 0} SOL</Text>
        <br />
        {swapQuote && (
          <>
            <Text>Expected Output: {Number(swapQuote.outAmount) / (10 ** 6)} {selectedPool?.tokenInfo.name}</Text>
            <br />
            <Text>Price Impact: {swapQuote.priceImpactPct}%</Text>
            <br />
          </>
        )}
        <Text>Fee: {selectedPool?.baseFee}%</Text>
        <br />
        
        {/* Slippage Setting */}
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <Space>
            <Text>滑点容差:</Text>
            <InputNumber
              min={0.01}
              max={10}
              step={1}
              value={slippagePercent}
              onChange={handleSlippageChange}
              formatter={(value) => `${value}%`}
              parser={(value) => value ? parseFloat(value.replace('%', '')) : 1}
              style={{ width: 100 }}
              // disabled={swapStatus === "loading" || swapStatus === "success"}
            />
            <Tooltip title="滑点容差设置：1 bp = 0.01%">
              <InfoCircleOutlined />
            </Tooltip>
          </Space>
        </div>
        
        <Text>Status: {
          swapStatus === "idle" ? "Ready to swap" :
          swapStatus === "loading" ? "Processing..." :
          swapStatus === "success" ? swapResult ? "Swap successful!" : "Quote obtained" :
          "Failed to swap"
        }</Text>
        
        {swapResult && (
          <>
            <br />
            <Text>
              Transaction: <a href={swapResult.explorerUrl} target="_blank" rel="noopener noreferrer">
                View on Explorer
              </a>
            </Text>
          </>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        {swapStatus === "idle" && (
          <Button 
            type="primary" 
            onClick={initiateSwap}
          >
            Get Quote
          </Button>
        )}
        
        {swapStatus === "loading" && (
          <Button 
            type="primary" 
            loading
          >
            Processing
          </Button>
        )}
        
        {swapStatus === "success" && !swapResult && (
          <Button 
            type="primary" 
            onClick={executeSwap}
          >
            Execute Swap
          </Button>
        )}
        
        {swapStatus === "success" && swapResult && (
          <Button 
            type="primary" 
            onClick={() => setCurrentStep(1)}
          >
            Next Step
          </Button>
        )}
        
        {swapStatus === "failed" && (
          <Button 
            type="primary" 
            onClick={initiateSwap}
          >
            Retry
          </Button>
        )}
        
        <Button 
          style={{ marginLeft: 8 }}
          onClick={() => setIsExecuting(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default SwapStep; 