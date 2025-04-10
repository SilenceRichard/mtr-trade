import { Typography, Button, Steps, Spin, Alert, Slider, InputNumber, Row, Col } from "antd";
import { useState, useEffect } from "react";
import { PoolItem } from "../../services/poolService";
import * as meteoraService from "../../services/meteoraService";

const { Title, Text } = Typography;
const { Step } = Steps;

export interface CreatePositionStepProps {
  selectedPool?: PoolItem;
  solAmount: number | null;
  setCurrentStep: (step: number) => void;
  currentStep: number;
  setIsExecuting: (executing: boolean) => void;
  strategy: "Spot" | "Curve" | "Bid Risk";
  walletInfo?: {
    solBalance: number;
    usdcBalance: number;
    tokenBalance?: number;
  };
  tokenDecimals?: number;
}

interface PositionState {
  status: "idle" | "pending" | "success" | "failed";
  result?: {
    positionId?: string;
    txId?: string;
    explorerUrl?: string;
  };
  error?: string;
}

const CreatePositionStep = ({
  selectedPool,
  solAmount,
  setCurrentStep,
  currentStep,
  setIsExecuting,
  strategy,
  walletInfo,
  tokenDecimals = 0
}: CreatePositionStepProps) => {
  const [positionState, setPositionState] = useState<PositionState>({ status: "idle" });
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [priceInfo, setPriceInfo] = useState<{ maxPrice: number; minPrice: number; realPrice: number } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [customMinPrice, setCustomMinPrice] = useState<number | null>(null);
  const [customMaxPrice, setCustomMaxPrice] = useState<number | null>(null);
  
  // Fetch pool price for position creation range calculation
  const fetchPoolPrice = async () => {
    if (!selectedPool) return;
    
    try {
      setPriceLoading(true);
      const price = await meteoraService.getActiveBinPrice(selectedPool.poolAddress);
      const realPrice = Number(price?.realPrice || 0);
      if (price) {
        // Set initial values for price range based on strategy (as a starting suggestion)
        let maxPrice = realPrice * 1.2; // 20% above current price
        let minPrice = realPrice * 0.8; // 20% below current price
        
        if (strategy === "Bid Risk") {
          // For Bid Risk, set a narrower range below current price
          maxPrice = realPrice;
          minPrice = realPrice * 0.8; // 20% below current price
        } else if (strategy === "Curve") {
          // For Curve, set a wider range
          maxPrice = realPrice * 1.3;
          minPrice = realPrice * 0.8;
        }
        
        // Set initial values for price range inputs
        setCustomMinPrice(minPrice);
        setCustomMaxPrice(maxPrice);
        
        setPriceInfo({ maxPrice, minPrice, realPrice });
        setPriceLoading(false);
        return { maxPrice, minPrice, realPrice };
      }
      setPriceLoading(false);
      return null;
    } catch (error) {
      console.error("Error fetching pool price:", error);
      setPriceLoading(false);
      return null;
    }
  };

  // Create position on Meteora
  const createPosition = async () => {
    if (!selectedPool || !solAmount || !customMinPrice || !customMaxPrice) {
      setPositionState({ 
        status: "failed", 
        error: "Pool, amount, or price range information missing" 
      });
      return;
    }
    
    setPositionState({ status: "pending" });
    
    try {
      // Get price info if we don't have it yet
      if (!priceInfo) {
        const fetchedPriceInfo = await fetchPoolPrice();
        
        if (!fetchedPriceInfo) {
          setPositionState({ 
            status: "failed", 
            error: "Failed to get pool price information" 
          });
          return;
        }
      }
      
      // Use the user-defined price range
      const maxPrice = customMaxPrice;
      const minPrice = customMinPrice;
      
      let xAmount = 0; // token
      let yAmount = 0; // SOL
      // Set amounts based on strategy
      if (strategy === "Bid Risk") {
        // For Bid Risk, use all SOL for y and ensure x is set to a proper amount (not 0)
        yAmount = solAmount * (10 ** 9);
        // We should still provide a small amount of token X to ensure the position is created correctly
        xAmount = (walletInfo?.tokenBalance || 0) * (10 ** tokenDecimals) || 1;
      } else {
        // For Spot or Curve, use 50% SOL and 50% token value
        // Make sure we're using the actual token balance, not a placeholder
        if (!walletInfo?.tokenBalance) {
          setPositionState({ 
            status: "failed", 
            error: "Token balance is required for Spot or Curve strategies" 
          });
          return;
        }
        xAmount = walletInfo.tokenBalance * (10 ** tokenDecimals);
        yAmount = (solAmount / 2) * (10 ** 9);
      }
      
      console.log("Creating position with amounts:", { xAmount, yAmount, strategy });
      
      // Create position
      const positionParams: meteoraService.CreatePositionParams = {
        poolAddress: selectedPool.poolAddress,
        xAmount: xAmount.toString(),
        yAmount: yAmount.toString(),
        maxPrice,
        minPrice,
        strategyType: strategy
      };
    
      const result = await meteoraService.createPosition(positionParams);
      
      if (!result) {
        setPositionState({ 
          status: "failed", 
          error: "Failed to create position" 
        });
        return;
      }
      
      setPositionState({
        status: "success",
        result: {
          positionId: result.positionId,
          txId: result.txId,
          explorerUrl: result.explorerUrl
        }
      });
      
      setCurrentSubStep(1);
      
    } catch (error) {
      console.error("Error creating position:", error);
      setPositionState({ 
        status: "failed", 
        error: error instanceof Error ? error.message : "Unknown error occurred during position creation" 
      });
    }
  };

  // Load price data only when component mounts
  useEffect(() => {
    if (selectedPool && solAmount) {
      fetchPoolPrice().catch(console.error);
    }
  }, [selectedPool, solAmount, strategy]);

  // Retry handler
  const handleRetryPosition = () => {
    setPositionState({ status: "idle" });
    createPosition().catch(console.error);
  };

  // Handle finish
  const handleFinish = () => {
    setCurrentStep(currentStep + 1);
  };

  // Render steps
  const renderSteps = () => {
    return (
      <Steps current={currentSubStep} direction="vertical">
        <Step 
          title="Create Position" 
          status={positionState.status === "failed" ? "error" : positionState.status === "success" ? "finish" : "process"}
          description={renderPositionStepContent()} 
        />
        <Step title="Finish" description="Position created successfully" />
      </Steps>
    );
  };

  // Render price range selector UI
  const renderPriceRangeSelector = () => {
    if (!priceInfo || !customMinPrice || !customMaxPrice) return null;
    
    const realPrice = priceInfo.realPrice;
    
    return (
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Row gutter={16} style={{ marginBottom: 8 }}>
          <Col span={8}>
            <Text>Min Price:</Text>
          </Col>
          <Col span={10}>
            <Slider
              min={realPrice * 0.1}
              max={customMaxPrice}
              value={customMinPrice}
              onChange={(value) => setCustomMinPrice(value)}
              step={0.000001}
            />
          </Col>
          <Col span={6}>
            <InputNumber
              style={{ width: '100%' }}
              value={customMinPrice}
              min={realPrice * 0.1}
              max={customMaxPrice}
              onChange={(value) => setCustomMinPrice(value)}
              step={0.0000001}
              precision={10}
            />
          </Col>
        </Row>
        
        <Row gutter={16}>
          <Col span={8}>
            <Text>Max Price:</Text>
          </Col>
          <Col span={10}>
            <Slider
              min={customMinPrice}
              max={realPrice * 2}
              value={customMaxPrice}
              onChange={(value) => setCustomMaxPrice(value)}
              step={0.000001}
            />
          </Col>
          <Col span={6}>
            <InputNumber
              style={{ width: '100%' }}
              value={customMaxPrice}
              min={customMinPrice}
              max={realPrice * 2}
              onChange={(value) => setCustomMaxPrice(value)}
              step={0.0000001}
              precision={10}
            />
          </Col>
        </Row>
      </div>
    );
  };

  // Render position step content
  const renderPositionStepContent = () => {
    if (positionState.status === "pending") {
      return (
        <div style={{ marginTop: 16 }}>
          <Spin size="small" style={{ marginRight: 8 }} />
          <Text>Creating position with {strategy} strategy...</Text>
        </div>
      );
    } else if (positionState.status === "success" && positionState.result) {
      return (
        <div style={{ marginTop: 16 }}>
          <Text>Pool: {selectedPool?.poolName}</Text>
          <br />
          <Text>Position ID: {positionState.result.positionId}</Text>
          <br />
          <Text>Strategy: {strategy}</Text>
          <br />
          {strategy === "Bid Risk" ? (
            <Text>Position Amount: {solAmount} SOL</Text>
          ) : (
            <>
              <Text>SOL Amount: {solAmount ? solAmount / 2 : 0} SOL</Text>
              <br />
              <Text>Token Amount: Converted from {solAmount ? solAmount / 2 : 0} SOL</Text>
              <br />
              <Text>Token Decimals: {tokenDecimals}</Text>
            </>
          )}
          <br />
          <Text>Bin Step: {selectedPool?.binStep}</Text>
          <br />
          {customMinPrice && customMaxPrice && (
            <>
              <Text>Price Range: {customMinPrice.toFixed(6)} - {customMaxPrice.toFixed(6)}</Text>
              <br />
            </>
          )}
          <Text type="success">Position created successfully!</Text>
          {positionState.result.explorerUrl && (
            <div style={{ marginTop: 8 }}>
              <a href={positionState.result.explorerUrl} target="_blank" rel="noopener noreferrer">
                View transaction
              </a>
            </div>
          )}
          {walletInfo && (
            <>
              <br />
              <Text type="secondary">Remaining wallet balance: {walletInfo.solBalance - (solAmount || 0)} SOL</Text>
            </>
          )}
        </div>
      );
    } else if (positionState.status === "failed") {
      return (
        <div style={{ marginTop: 16 }}>
          <Alert message={`Position creation failed: ${positionState.error || "Unknown error"}`} type="error" showIcon />
          <Button 
            type="primary" 
            onClick={handleRetryPosition}
            style={{ marginTop: 8 }}
          >
            Retry Creating Position
          </Button>
        </div>
      );
    } else {
      // Idle state - show create position button
      return (
        <div style={{ marginTop: 16 }}>
          {priceLoading ? (
            <>
              <Spin size="small" style={{ marginRight: 8 }} />
              <Text>Loading pool price information...</Text>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <Text>Pool: {selectedPool?.poolName}</Text>
                <br />
                <Text>Strategy: {strategy}</Text>
                <br />
                {strategy === "Bid Risk" ? (
                  <Text>Position Amount: {solAmount} SOL</Text>
                ) : (
                  <>
                    <Text>SOL Amount: {solAmount ? solAmount / 2 : 0} SOL</Text>
                    <br />
                    <Text>Token Amount: Converted from {solAmount ? solAmount / 2 : 0} SOL</Text>
                  </>
                )}
                <br />
                {customMinPrice && customMaxPrice && (
                  <>
                    <Text>
                      Price Range: {customMinPrice.toFixed(6)} - {customMaxPrice.toFixed(6)}
                    </Text>
                    <br />
                  </>
                )}
              </div>
              
              {renderPriceRangeSelector()}
              
              <Button 
                type="primary" 
                onClick={() => createPosition()}
                disabled={!customMinPrice || !customMaxPrice}
              >
                Create Position
              </Button>
            </>
          )}
        </div>
      );
    }
  };

  return (
    <div>
      <Title level={5}>Creating Position - {strategy} Strategy</Title>
      
      {renderSteps()}
      
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        {positionState.status === "success" && (
          <Button 
            type="primary" 
            onClick={handleFinish}
          >
            Finish
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

export default CreatePositionStep; 