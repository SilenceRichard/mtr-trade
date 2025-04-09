import { Typography, Button } from "antd";
import { PoolItem } from "../../services/poolService";
import { QuoteResponse } from "../../services/jupiterService";

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
  setIsExecuting
}: SwapStepProps) => {
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