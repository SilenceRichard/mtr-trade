import React, { useState, useEffect } from 'react';
import { Card, Button, Select, Typography, Space, Spin, message, InputNumber, Form } from 'antd';
import { 
  createPosition, 
  getActiveBinPrice,
  initializePool,
  CreatePositionParams, 
  CreatePositionResult 
} from '../services/meteoraService';
import { fetchWalletInfo, WalletInfo } from '../services/walletService';

const { Option } = Select;
const { Text, Title } = Typography;

const PositionTest: React.FC = () => {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingPosition, setCreatingPosition] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [result, setResult] = useState<CreatePositionResult | null>(null);
  const [form] = Form.useForm();

  // SOL-USDC pool address
  const poolAddress = '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6';

  useEffect(() => {
    loadWalletInfo();
    initPool();
    loadCurrentPrice();
  }, []);

  const loadWalletInfo = async () => {
    setLoading(true);
    try {
      const info = await fetchWalletInfo();
      setWalletInfo(info);
    } catch (error) {
      console.error('Error loading wallet info:', error);
      message.error('Failed to load wallet information');
    } finally {
      setLoading(false);
    }
  };

  const initPool = async () => {
    try {
      const initialized = await initializePool(poolAddress);
      if (initialized) {
        message.success('Pool initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing pool:', error);
      message.error('Failed to initialize pool');
    }
  };

  const loadCurrentPrice = async () => {
    setPriceLoading(true);
    try {
      const priceInfo = await getActiveBinPrice(poolAddress);
      if (priceInfo) {
        setCurrentPrice(parseFloat(priceInfo.realPrice));
        
        // Set default price range (±10% of current price)
        const price = parseFloat(priceInfo.realPrice);
        form.setFieldsValue({
          minPrice: (price * 0.9).toFixed(6),
          maxPrice: (price * 1.1).toFixed(6)
        });
      }
    } catch (error) {
      console.error('Error getting current price:', error);
      message.error('Failed to get current price');
    } finally {
      setPriceLoading(false);
    }
  };

  const handleCreatePosition = async (values: {
    xAmount: number;
    yAmount: number;
    minPrice: number;
    maxPrice: number;
    strategyType: string;
  }) => {
    const params: CreatePositionParams = {
      poolAddress,
      xAmount: values.xAmount * 1e9,
      yAmount: values.yAmount * 1e6,
      minPrice: values.minPrice,
      maxPrice: values.maxPrice,
      strategyType: "Spot"
    };

    setCreatingPosition(true);
    try {
      const positionResult = await createPosition(params);
      if (positionResult) {
        setResult(positionResult);
        message.success(
          <span>
            Position created! <a href={positionResult.explorerUrl} target="_blank" rel="noopener noreferrer">View transaction</a>
          </span>
        );
        await loadWalletInfo();
      }
    } catch (error) {
      console.error('Error creating position:', error);
      message.error('Failed to create position');
    } finally {
      setCreatingPosition(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Title level={2}>Create Meteora Liquidity Position</Title>
      
      <Card className="mb-4">
        <Spin spinning={loading}>
          <Title level={4}>Wallet Balances</Title>
          {walletInfo ? (
            <Space direction="vertical">
              <Text>SOL: {walletInfo.solBalance.toFixed(4)} SOL</Text>
              <Text>USDC: {walletInfo.usdcBalance.toFixed(2)} USDC</Text>
            </Space>
          ) : (
            <Text>No wallet information available</Text>
          )}
        </Spin>
      </Card>

      <Card title="Pool Information">
        <Spin spinning={priceLoading}>
          <Text>Pool Address: {poolAddress}</Text>
          <br />
          <Text>Current Price: {currentPrice ? `${currentPrice.toFixed(6)} USDC/SOL` : 'Loading...'}</Text>
        </Spin>
      </Card>

      <Card title="Create Position" style={{ marginTop: 16 }}>
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={handleCreatePosition}
          initialValues={{
            strategyType: 'spot'
          }}
        >
          <Form.Item name="xAmount" label="SOL Amount" rules={[{ required: true, message: 'Please input SOL amount' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="SOL amount" min={0} step={0.1} />
          </Form.Item>

          <Form.Item name="yAmount" label="USDC Amount" rules={[{ required: true, message: 'Please input USDC amount' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="USDC amount" min={0} step={1} />
          </Form.Item>

          <Form.Item name="minPrice" label="Min Price (USDC/SOL)" rules={[{ required: true, message: 'Please input min price' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="Min price" min={0} step={0.1} />
          </Form.Item>

          <Form.Item name="maxPrice" label="Max Price (USDC/SOL)" rules={[{ required: true, message: 'Please input max price' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="Max price" min={0} step={0.1} />
          </Form.Item>

          <Form.Item name="strategyType" label="Strategy Type" rules={[{ required: true, message: 'Please select strategy' }]}>
            <Select>
              <Option value="spot">Spot</Option>
              <Option value="curve">Curve</Option>
              <Option value="bid">Bid</Option>
              <Option value="ask">Ask</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={creatingPosition}
              disabled={priceLoading || loading}
            >
              Create Position
            </Button>
          </Form.Item>
        </Form>

        {result && (
          <div style={{ marginTop: 16 }}>
            <Title level={5}>Position Created</Title>
            <Text>Position ID: {result.positionId}</Text>
            <br />
            <Text>Transaction: <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer">{result.txId.substring(0, 10)}...</a></Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PositionTest; 