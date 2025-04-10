import { useState, useEffect } from "react";
import { Modal, Steps } from "antd";
import { PoolItem } from "../services/poolService"; // Import the PoolItem type
import { getJupiterQuote, executeJupiterSwap, QuoteResponse } from "../services/jupiterService";
import { getActiveBinPrice, PriceInfo } from "../services/meteoraService";
import { 
  fetchWalletInfo, 
  fetchPoolTokenBalance, 
  fetchTokenDecimals 
} from "../services";
import { 
  InitialForm, 
  SwapStep, 
  CreatePositionStep, 
  FinishStep 
} from "./steps";

export const MTRModal = (props: {
  isModalVisible: boolean;
  handleOk: () => void;
  handleCancel: () => void;
  selectedPool?: PoolItem; // Add selected pool from table
  walletInfo?: {
    solBalance: number;
    usdcBalance: number;
    tokenBalance?: number;
  };
}) => {
  // State for form values
  const [solAmount, setSolAmount] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<"Spot" | "Curve" | "Bid Risk">("Spot");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  
  // Swap states
  const [swapStatus, setSwapStatus] = useState<"idle" | "loading" | "success" | "failed">("idle");
  const [swapQuote, setSwapQuote] = useState<QuoteResponse | null>(null);
  const [swapResult, setSwapResult] = useState<{ signature: string; explorerUrl: string } | null>(null);
  
  // Price info state
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  
  // Local wallet info state
  const [localWalletInfo, setLocalWalletInfo] = useState(props.walletInfo);

  // Token decimals state
  const [tokenDecimals, setTokenDecimals] = useState<number>(0);
  const [solDecimals, setSolDecimals] = useState<number>(9); // SOL has 9 decimals by default
  
  // Reset states when modal is closed
  useEffect(() => {
    if (!props.isModalVisible) {
      resetStates();
    } else if (props.selectedPool?.poolAddress) {
      fetchPoolPrice();
      setLocalWalletInfo(props.walletInfo);
      fetchPoolTokenDecimals();
    }
  }, [props.isModalVisible, props.selectedPool?.poolAddress, props.walletInfo]);

  // Fetch pool token decimals
  const fetchPoolTokenDecimals = async () => {
    if (!props.selectedPool?.tokenInfo.address) return;
    
    try {
      // Fetch token decimals
      const decimals = await fetchTokenDecimals(props.selectedPool.tokenInfo.address);
      setTokenDecimals(decimals);
      
      // Also fetch SOL decimals (though we know it's 9)
      const solDecimalValue = await fetchTokenDecimals("So11111111111111111111111111111111111111112");
      setSolDecimals(solDecimalValue);
    } catch (error) {
      console.error("Error fetching token decimals:", error);
    }
  };

  // Function to refresh wallet balance
  const refreshWalletBalance = async () => {
    try {
      const walletInfoResult = await fetchWalletInfo();
      
      if (walletInfoResult && props.selectedPool?.tokenAddress) {
        const tokenBalance = await fetchPoolTokenBalance(props.selectedPool.tokenAddress);
        
        setLocalWalletInfo({
          ...walletInfoResult,
          tokenBalance
        });
      }
    } catch (error) {
      console.error("Error refreshing wallet balance:", error);
    }
  };

  // Function to fetch pool price
  const fetchPoolPrice = async () => {
    if (!props.selectedPool?.poolAddress) return;
    
    setLoadingPrice(true);
    try {
      const price = await getActiveBinPrice(props.selectedPool.poolAddress);
      setPriceInfo(price);
    } catch (error) {
      console.error("Error fetching pool price:", error);
    } finally {
      setLoadingPrice(false);
    }
  };

  // Function to reset all states
  const resetStates = () => {
    setSolAmount(null);
    setStrategy("Spot");
    setCurrentStep(0);
    setIsExecuting(false);
    setSwapStatus("idle");
    setSwapQuote(null);
    setSwapResult(null);
    setPriceInfo(null);
    setLocalWalletInfo(props.walletInfo);
  };
  
  // Start execution process
  const startExecution = () => {
    if (!solAmount) return;
    setIsExecuting(true);
    setCurrentStep(0);
    
    // If strategy is "Bid Risk", skip the swap step
    if (strategy === "Bid Risk") {
      // Just prepare for position creation
    } else {
      // For Spot and Curve, initiate the swap process
      initiateSwap();
    }
  };
  
  // Initiate swap process
  const initiateSwap = async () => {
    if (!solAmount || !props.selectedPool || !props.selectedPool.tokenInfo.address) return;
    
    setSwapStatus("loading");
    
    try {
      // Calculate the amount to swap (half of the total SOL)
      const swapAmount = (solAmount / 2 * (10 ** solDecimals)).toString();
      
      // Get quote from Jupiter
      const quoteParams = {
        inputMint: "So11111111111111111111111111111111111111112", // SOL mint address
        outputMint: props.selectedPool.tokenInfo.address, // Token mint address from selected pool
        amount: swapAmount,
        slippageBps: 100, // 0.5% slippage
      };
      
      const quote = await getJupiterQuote(quoteParams);
      
      if (quote) {
        setSwapQuote(quote);
        setSwapStatus("success");
      } else {
        setSwapStatus("failed");
      }
    } catch (error) {
      console.error("Error initiating swap:", error);
      setSwapStatus("failed");
    }
  };
  
  // Execute swap with the obtained quote
  const executeSwap = async () => {
    if (!swapQuote) return;
    
    setSwapStatus("loading");
    
    try {
      const result = await executeJupiterSwap(swapQuote);
      
      if (result) {
        setSwapResult(result);
        setSwapStatus("success");
        
        // Refresh wallet balance after successful swap
        await refreshWalletBalance();
        
        // Automatically move to next step on success
        setCurrentStep(1);
      } else {
        setSwapStatus("failed");
      }
    } catch (error) {
      console.error("Error executing swap:", error);
      setSwapStatus("failed");
    }
  };
  
  // Get steps based on selected strategy
  const getSteps = () => {
    if (strategy === "Bid Risk") {
      return [
        { title: "Create Position", description: "Using SOL to create position" },
        { title: "Finish", description: "Position created successfully" }
      ];
    }
    
    return [
      { title: "Swap", description: "Swap half SOL to token" },
      { title: "Create Position", description: "Create position with tokens" },
      { title: "Finish", description: "Position created successfully" }
    ];
  };
  
  // Render the current step content
  const renderStepContent = () => {
    // For Bid Risk strategy
    if (strategy === "Bid Risk") {
      switch (currentStep) {
        case 0:
          return (
            <CreatePositionStep
              selectedPool={props.selectedPool}
              solAmount={solAmount}
              setCurrentStep={setCurrentStep}
              currentStep={currentStep}
              setIsExecuting={setIsExecuting}
              strategy={strategy}
              walletInfo={localWalletInfo}
              tokenDecimals={tokenDecimals}
            />
          );
        case 1:
          return (
            <FinishStep
              selectedPool={props.selectedPool}
              solAmount={solAmount}
              handleOk={props.handleOk}
            />
          );
        default:
          return null;
      }
    }
    
    // For Spot and Curve strategies
    switch (currentStep) {
      case 0:
        return (
          <SwapStep
            selectedPool={props.selectedPool}
            solAmount={solAmount}
            swapStatus={swapStatus}
            swapQuote={swapQuote}
            swapResult={swapResult}
            initiateSwap={initiateSwap}
            executeSwap={executeSwap}
            setCurrentStep={setCurrentStep}
            setIsExecuting={setIsExecuting}
          />
        );
      case 1:
        return (
          <CreatePositionStep
            selectedPool={props.selectedPool}
            solAmount={solAmount}
            setCurrentStep={setCurrentStep}
            currentStep={currentStep}
            setIsExecuting={setIsExecuting}
            strategy={strategy}
            walletInfo={localWalletInfo}
            tokenDecimals={tokenDecimals}
          />
        );
      case 2:
        return (
          <FinishStep
            selectedPool={props.selectedPool}
            solAmount={solAmount}
            handleOk={props.handleOk}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <Modal
      title={`${props.selectedPool?.poolName || 'Pool'}`}
      open={props.isModalVisible}
      onOk={props.handleOk}
      onCancel={props.handleCancel}
      footer={null}
      width={600}
      maskClosable={false}
      closeIcon={true}
    >
      {!isExecuting ? (
        <InitialForm
          selectedPool={props.selectedPool}
          walletInfo={localWalletInfo}
          loadingPrice={loadingPrice}
          priceInfo={priceInfo}
          fetchPoolPrice={fetchPoolPrice}
          solAmount={solAmount}
          setSolAmount={setSolAmount}
          strategy={strategy}
          setStrategy={setStrategy}
          startExecution={startExecution}
        />
      ) : (
        <>
          {/* Execution Steps */}
          <Steps
            current={currentStep}
            items={getSteps().map(step => ({
              title: step.title,
              description: step.description,
            }))}
          />
          
          <div style={{ marginTop: 24, padding: 24, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
            {renderStepContent()}
          </div>
        </>
      )}
    </Modal>
  );
};
