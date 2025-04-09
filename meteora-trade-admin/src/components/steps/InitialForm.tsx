import { Typography, InputNumber, Radio, Button, Space, Divider } from "antd";
import type { RadioChangeEvent } from 'antd';
import { PoolItem } from "../../services/poolService";
import { PriceInfo } from "../../services/meteoraService";

const { Title, Text } = Typography;

export interface InitialFormProps {
  selectedPool?: PoolItem;
  walletInfo?: {
    solBalance: number;
    usdcBalance: number;
    tokenBalance?: number;
  };
  loadingPrice: boolean;
  priceInfo: PriceInfo | null;
  fetchPoolPrice: () => void;
  solAmount: number | null;
  setSolAmount: (amount: number | null) => void;
  strategy: "Spot" | "Curve" | "Bid Risk";
  setStrategy: (strategy: "Spot" | "Curve" | "Bid Risk") => void;
  startExecution: () => void;
}

const InitialForm = ({
  selectedPool,
  walletInfo,
  loadingPrice,
  priceInfo,
  fetchPoolPrice,
  solAmount,
  setSolAmount,
  strategy,
  setStrategy,
  startExecution
}: InitialFormProps) => {
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
  
  return (
    <>
      {/* Pool Information */}
      <div>
        <Title level={5}>Pool Information</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Base Fee: {selectedPool?.baseFee}%</Text>
          <Text>Bin Step: {selectedPool?.binStep}</Text>
          {loadingPrice ? (
            <Text type="secondary">Loading price...</Text>
          ) : priceInfo ? (
            <>
              <Text>Current Price: {priceInfo.realPrice} {selectedPool?.tokenInfo.name}</Text>
              <Text>Active Bin: {priceInfo.binId}</Text>
            </>
          ) : (
            <Text type="secondary">Price information not available</Text>
          )}
          <Button 
            size="small" 
            onClick={fetchPoolPrice} 
            loading={loadingPrice}
            style={{ width: 'fit-content', marginTop: 8 }}
          >
            Refresh Price
          </Button>
        </Space>
      </div>
      
      <Divider />
      
      {/* Wallet Information */}
      <div>
        <Title level={5}>Wallet Balance</Title>
        <Text>SOL: {walletInfo?.solBalance}</Text>
        <br />
        <Text>USDC: {walletInfo?.usdcBalance}</Text>
        {selectedPool && walletInfo?.tokenBalance !== undefined && (
          <>
            <br />
            <Text>{selectedPool.tokenInfo.name}: {walletInfo.tokenBalance}</Text>
          </>
        )}
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
            min={0.0001}
            step={0.0001}
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
  );
};

export default InitialForm; 