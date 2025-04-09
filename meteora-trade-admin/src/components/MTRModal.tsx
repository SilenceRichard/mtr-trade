import { useState, useEffect } from "react";
import { Modal, Typography, InputNumber, Radio, Button, Space, Divider, Steps } from "antd";
import type { RadioChangeEvent } from 'antd';
import { PoolItem } from "./MTRPools"; // Import the PoolItem type

const { Title, Text } = Typography;

export const MTRModal = (props: {
  isModalVisible: boolean;
  handleOk: () => void;
  handleCancel: () => void;
  selectedPool?: PoolItem; // Add selected pool from table
  walletInfo?: {
    solBalance: number;
    usdcBalance: number;
  };
}) => {
  console.log("selectedPool", props.selectedPool);
  // State for form values
  const [solAmount, setSolAmount] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<"Spot" | "Curve" | "Bid Risk">("Spot");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  
  // Reset states when modal is closed
  useEffect(() => {
    if (!props.isModalVisible) {
      resetStates();
    }
  }, [props.isModalVisible]);

  // Function to reset all states
  const resetStates = () => {
    setSolAmount(null);
    setStrategy("Spot");
    setCurrentStep(0);
    setIsExecuting(false);
  };
  
  // Predefined SOL amounts
  const predefinedAmounts = [0.2, 0.5, 1];
  
  // Handle selecting predefined amount
  const handleAmountSelect = (amount: number) => {
    setSolAmount(amount);
  };
  
  // Handle strategy change
  const handleStrategyChange = (e: RadioChangeEvent) => {
    setStrategy(e.target.value);
  };
  
  // Start execution process
  const startExecution = () => {
    if (!solAmount) return;
    setIsExecuting(true);
    setCurrentStep(0);
    // Here we would normally call the API, but we're skipping that for now
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
        <>
          {/* Pool Information */}
          <div>
            <Title level={5}>Pool Information</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>Base Fee: {props.selectedPool?.baseFee}%</Text>
              <Text>Bin Step: {props.selectedPool?.binStep}</Text>
            </Space>
          </div>
          
          <Divider />
          
          {/* Wallet Information */}
          <div>
            <Title level={5}>Wallet Balance</Title>
            <Text>SOL: {props.walletInfo?.solBalance}</Text>
            <br />
            <Text>USDC: {props.walletInfo?.usdcBalance}</Text>
          </div>
          
          <Divider />
          
          {/* SOL Amount Selection */}
          <div>
            <Title level={5}>Select SOL Amount</Title>
            <Space>
              {predefinedAmounts.map((amount) => (
                <Button 
                  key={amount} 
                  type={solAmount === amount ? "primary" : "default"}
                  onClick={() => handleAmountSelect(amount)}
                >
                  {amount} SOL
                </Button>
              ))}
              <InputNumber
                placeholder="Custom amount"
                value={!predefinedAmounts.includes(solAmount || 0) ? solAmount : null}
                onChange={(value) => setSolAmount(value)}
                min={0.01}
                step={0.01}
                addonAfter="SOL"
              />
            </Space>
          </div>
          
          <Divider />
          
          {/* Strategy Selection */}
          <div>
            <Title level={5}>Select Strategy</Title>
            <Radio.Group onChange={handleStrategyChange} value={strategy}>
              <Space direction="vertical">
                <Radio value="Spot">
                  <Text strong>Spot</Text> - Swap half SOL to token, then create position
                </Radio>
                <Radio value="Curve">
                  <Text strong>Curve</Text> - Swap half SOL to token, then create position
                </Radio>
                <Radio value="Bid Risk">
                  <Text strong>Bid Risk</Text> - Use all SOL to create position
                </Radio>
              </Space>
            </Radio.Group>
          </div>
          
          <Divider />
          
          {/* Action Button */}
          <div style={{ textAlign: "right" }}>
            <Button 
              type="primary" 
              size="large"
              disabled={!solAmount}
              onClick={startExecution}
            >
              Execute
            </Button>
          </div>
        </>
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
            {strategy !== "Bid Risk" && currentStep === 0 && (
              <div>
                <Title level={5}>Swapping Tokens</Title>
                <div>
                  <Text>Trading Pair: SOL/{props.selectedPool?.poolName || 'Token'}</Text>
                  <br />
                  <Text>Amount: {solAmount ? solAmount / 2 : 0} SOL</Text>
                  <br />
                  <Text>Fee: {props.selectedPool?.baseFee}%</Text>
                  <br />
                  <Text>Status: Processing...</Text>
                </div>
                <div style={{ marginTop: 16 }}>
                  <Button 
                    type="primary" 
                    onClick={() => setCurrentStep(1)}
                  >
                    Next Step (Simulating success)
                  </Button>
                  <Button 
                    style={{ marginLeft: 8 }}
                    onClick={() => setIsExecuting(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {((strategy !== "Bid Risk" && currentStep === 1) || (strategy === "Bid Risk" && currentStep === 0)) && (
              <div>
                <Title level={5}>Creating Position</Title>
                <div>
                  <Text>Pool: {props.selectedPool?.poolName}</Text>
                  <br />
                  <Text>Position Amount: {solAmount} SOL</Text>
                  <br />
                  <Text>Bin Step: {props.selectedPool?.binStep}</Text>
                  <br />
                  <Text>Status: Processing...</Text>
                </div>
                <div style={{ marginTop: 16 }}>
                  <Button 
                    type="primary" 
                    onClick={() => setCurrentStep(currentStep + 1)}
                  >
                    Next Step (Simulating success)
                  </Button>
                  <Button 
                    style={{ marginLeft: 8 }}
                    onClick={() => setIsExecuting(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {((strategy !== "Bid Risk" && currentStep === 2) || (strategy === "Bid Risk" && currentStep === 1)) && (
              <div>
                <Title level={5}>Position Created Successfully</Title>
                <div>
                  <Text>Pool: {props.selectedPool?.poolName}</Text>
                  <br />
                  <Text>Position Amount: {solAmount} SOL</Text>
                  <br />
                  <Text>Creation Time: {new Date().toLocaleString()}</Text>
                </div>
                <div style={{ marginTop: 16 }}>
                  <Button 
                    type="primary" 
                    onClick={() => {
                      // Just transition to positions view without closing modal directly
                      props.handleOk();
                    }}
                  >
                    View Positions
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
};
