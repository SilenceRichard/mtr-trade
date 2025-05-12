import { Typography, Button, Steps, Spin, Alert, Slider, InputNumber, Row, Col, Collapse } from "antd";
import { useState, useEffect, useCallback } from "react";
import { PoolItem } from "../../services/poolService";
import * as meteoraService from "../../services/meteoraService";
import { debounce } from "lodash";

const { Title, Text } = Typography;
const { Step } = Steps;
const { Panel } = Collapse;

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
  refreshWalletBalance?: () => Promise<void>;
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
  tokenDecimals = 0,
  refreshWalletBalance
}: CreatePositionStepProps) => {
  const [positionState, setPositionState] = useState<PositionState>({ status: "idle" });
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [priceInfo, setPriceInfo] = useState<{ maxPrice: number; minPrice: number; realPrice: number } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [customMinPrice, setCustomMinPrice] = useState<number | null>(null);
  const [customMaxPrice, setCustomMaxPrice] = useState<number | null>(null);
  const [minPricePercent, setMinPricePercent] = useState<number>(-20);
  const [maxPricePercent, setMaxPricePercent] = useState<number>(20);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<meteoraService.PositionQuoteResult | null>(null);
  const [cuBufferMultiplier, setCuBufferMultiplier] = useState<number>(1.5);
  const [microLamports, setMicroLamports] = useState<number>(1000000);
  
  // Update price when percentage changes
  const updatePriceFromPercent = (percent: number, type: 'min' | 'max') => {
    if (!priceInfo) return;
    
    const realPrice = priceInfo.realPrice;
    const newPrice = realPrice * (1 + percent / 100);
    
    if (type === 'min') {
      setCustomMinPrice(newPrice);
      setMinPricePercent(percent);
    } else {
      setCustomMaxPrice(newPrice);
      setMaxPricePercent(percent);
    }
    
    // Trigger quote update - will be debounced by fetchPositionQuote
    if (customMinPrice && customMaxPrice && selectedPool && solAmount) {
      fetchPositionQuote();
    }
  };

  // Update percentage when price changes
  const updatePercentFromPrice = (price: number | null, type: 'min' | 'max') => {
    if (!priceInfo || !price) return;
    
    const realPrice = priceInfo.realPrice;
    const percent = ((price / realPrice) - 1) * 100;
    
    if (type === 'min') {
      setMinPricePercent(Number(percent.toFixed(2)));
      setCustomMinPrice(price);
    } else {
      setMaxPricePercent(Number(percent.toFixed(2)));
      setCustomMaxPrice(price);
    }
    
    // Trigger quote update - will be debounced by fetchPositionQuote
    if (customMinPrice && customMaxPrice && selectedPool && solAmount) {
      fetchPositionQuote();
    }
  };

  // Debounced function to fetch position quote
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchPositionQuote = useCallback(
    debounce(async () => {
      if (!selectedPool || !solAmount || !customMinPrice || !customMaxPrice) {
        return;
      }
      
      setQuoteLoading(true);
      console.log("Fetching position quote with prices:", { min: customMinPrice, max: customMaxPrice });
      
      try {
        let xAmount = 0; // token
        let yAmount = 0; // SOL
        
        if (strategy === "Bid Risk") {
          yAmount = solAmount * (10 ** 9);
          xAmount = (walletInfo?.tokenBalance || 0) * (10 ** tokenDecimals) || 1;
        } else {
          if (!walletInfo?.tokenBalance) {
            return;
          }
          xAmount = walletInfo.tokenBalance * (10 ** tokenDecimals);
          yAmount = (solAmount / 2) * (10 ** 9);
        }
        
        const quoteParams: meteoraService.CreatePositionParams = {
          poolAddress: selectedPool.poolAddress,
          xAmount: xAmount.toString(),
          yAmount: yAmount.toString(),
          maxPrice: customMaxPrice,
          minPrice: customMinPrice,
          strategyType: strategy,
          cuBufferMultiplier,
          microLamports
        };
        
        const result = await meteoraService.getPositionQuote(quoteParams);
        console.log("Position quote result:", result);
        if (result) {
          setQuoteResult(result);
        }
      } catch (error) {
        console.error("Error fetching position quote:", error);
      } finally {
        setQuoteLoading(false);
      }
    }, 500),
    [selectedPool, solAmount, strategy, walletInfo, tokenDecimals, customMinPrice, customMaxPrice, cuBufferMultiplier, microLamports]
  );

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
          setMaxPricePercent(0);
          setMinPricePercent(-20);
        } else if (strategy === "Curve") {
          // For Curve, set a wider range
          maxPrice = realPrice * 1.3;
          minPrice = realPrice * 0.8;
          setMaxPricePercent(30);
          setMinPricePercent(-20);
        } else {
          setMaxPricePercent(20);
          setMinPricePercent(-20);
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
    
    // Prevent creation if position count is greater than 1
    if (quoteResult && quoteResult.positionCount > 1) {
      setPositionState({ 
        status: "failed", 
        error: "Cannot create position with position count greater than 1" 
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
        openValue: solAmount,
        poolName: selectedPool.poolName,
        maxPrice,
        minPrice,
        strategyType: strategy,
        cuBufferMultiplier,
        microLamports
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

  // Automatically fetch quote when price range changes or is initially set
  useEffect(() => {
    if (customMinPrice && customMaxPrice && selectedPool && solAmount) {
      fetchPositionQuote();
    }
  }, [customMinPrice, customMaxPrice, fetchPositionQuote, selectedPool, solAmount]);

  // Retry handler
  const handleRetryPosition = async () => {
    // Reset position state and proceed with position creation
    setPositionState({ status: "idle" });
    
    // Refresh wallet balance before retrying
    if (refreshWalletBalance) {
      await refreshWalletBalance();
    }
    
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
        <Row style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Text>Current Pool Price: {realPrice.toFixed(6)}</Text>
          </Col>
        </Row>
        
        <Row gutter={16} style={{ marginBottom: 16, alignItems: 'center' }}>
          <Col span={4}>
            <Text>Min Price:</Text>
          </Col>
          <Col span={10}>
            <InputNumber
              style={{ width: '100%' }}
              value={customMinPrice}
              min={0}
              max={customMaxPrice}
              onChange={(value) => updatePercentFromPrice(value, 'min')}
              step={0.000001}
              precision={6}
            />
          </Col>
          <Col span={10}>
            <InputNumber
              style={{ width: '100%' }}
              value={minPricePercent}
              onChange={(value) => updatePriceFromPercent(Number(value), 'min')}
              min={-100}
              max={maxPricePercent}
              step={0.1}
              precision={1}
              addonAfter="%"
            />
          </Col>
        </Row>
        
        <Row gutter={16} style={{ marginBottom: 16, alignItems: 'center' }}>
          <Col span={4}>
            <Text>Max Price:</Text>
          </Col>
          <Col span={10}>
            <InputNumber
              style={{ width: '100%' }}
              value={customMaxPrice}
              min={customMinPrice || 0}
              onChange={(value) => updatePercentFromPrice(value, 'max')}
              step={0.000001}
              precision={6}
            />
          </Col>
          <Col span={10}>
            <InputNumber
              style={{ width: '100%' }}
              value={maxPricePercent}
              onChange={(value) => updatePriceFromPercent(Number(value), 'max')}
              min={minPricePercent}
              step={0.1}
              precision={1}
              addonAfter="%"
            />
          </Col>
        </Row>
        
        <Row gutter={16} style={{ marginBottom: 8 }}>
          <Col span={4}>
            <Text>Price Range:</Text>
          </Col>
          <Col span={20}>
            <Slider
              range
              min={realPrice * 0.1}
              max={realPrice * 2}
              value={[customMinPrice, customMaxPrice]}
              onChange={(value) => {
                if (Array.isArray(value)) {
                  updatePercentFromPrice(value[0], 'min');
                  updatePercentFromPrice(value[1], 'max');
                  
                  // Trigger quote update directly for slider
                  if (selectedPool && solAmount) {
                    fetchPositionQuote();
                  }
                }
              }}
              step={0.000001}
            />
          </Col>
        </Row>
        
        {quoteLoading && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Spin size="small" style={{ marginRight: 8 }} />
              <Text type="secondary">Getting position quote...</Text>
            </Col>
          </Row>
        )}
        
        {quoteResult && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Text type="secondary">
                This will create {quoteResult.positionCount} positions at a rent cost of {quoteResult.positionCost} SOL
              </Text>
            </Col>
          </Row>
        )}
      </div>
    );
  };

  // Render compute budget settings UI
  const renderComputeBudgetSettings = () => {
    return (
      <Collapse style={{ marginTop: 16, marginBottom: 16 }}>
        <Panel header="Advanced Settings (Compute Budget)" key="1">
          <Row gutter={16} style={{ marginBottom: 16, alignItems: 'center' }}>
            <Col span={12}>
              <Text>CU Buffer Multiplier:</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                value={cuBufferMultiplier}
                min={1}
                max={5}
                step={0.1}
                precision={1}
                onChange={(value) => setCuBufferMultiplier(Number(value))}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Multiplier for compute unit buffer (1-5)
              </Text>
            </Col>
            <Col span={12}>
              <Text>Micro Lamports per CU:</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                value={microLamports}
                min={1}
                max={10000000}
                step={100000}
                onChange={(value) => setMicroLamports(Number(value))}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Price per compute unit in micro-lamports
              </Text>
            </Col>
          </Row>
        </Panel>
      </Collapse>
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
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">Compute Budget: CU Buffer Multiplier: {cuBufferMultiplier}, Micro Lamports per CU: {microLamports}</Text>
          </div>
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
              
              {renderComputeBudgetSettings()}
              
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
        {strategy !== "Bid Risk" && currentStep < 2 && (
          <Button
            onClick={() => setCurrentStep(currentStep - 1)}
            style={{ marginRight: 8, marginLeft: 16 }}
          >
            Back
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