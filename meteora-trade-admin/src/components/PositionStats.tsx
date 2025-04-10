import { useEffect, useState } from 'react';
import { Table, Card, Spin, Empty, Typography, Collapse, Button, Switch, Space } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { fetchWalletInfo, WalletInfo } from '../services/walletService';
import { getAllUserPositions, PoolPositionInfo, Position } from '../services/meteoraService';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const PositionStats = () => {
  const [loading, setLoading] = useState(true);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [poolPositions, setPoolPositions] = useState<PoolPositionInfo[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get wallet info
      const wallet = await fetchWalletInfo();
      setWalletInfo(wallet);

      // Get all positions if wallet available
      if (wallet?.publicKey) {
        const allPositions = await getAllUserPositions(wallet.publicKey);
        setPoolPositions(allPositions || []);
      }
      
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let intervalId: number | null = null;
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchData();
      }, 10000); // Refresh every 10 seconds
    }
    
    // Cleanup on unmount or when autoRefresh changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh]);

  const handleRefresh = () => {
    fetchData();
  };

  const handleAutoRefreshToggle = (checked: boolean) => {
    setAutoRefresh(checked);
  };

  return (
    <div className="stats-container">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Title level={2}>Position Statistics</Title>
          <Space>
            {lastRefreshed && (
              <Text type="secondary">
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
              </Text>
            )}
            <Button 
              type="primary" 
              icon={<SyncOutlined spin={loading} />} 
              onClick={handleRefresh} 
              loading={loading}
            >
              Refresh
            </Button>
            <Space align="center">
              <Text>Auto-refresh:</Text>
              <Switch 
                checked={autoRefresh} 
                onChange={handleAutoRefreshToggle} 
              />
            </Space>
          </Space>
        </div>
        
        {!poolPositions.length && loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            {walletInfo && (
              <div style={{ marginBottom: '20px' }}>
                <Text strong>Wallet: </Text>
                <Text>{walletInfo.publicKey}</Text>
                <br />
                <Text strong>SOL Balance: </Text>
                <Text>{walletInfo.solBalance.toFixed(6)}</Text>
                <br />
                <Text strong>USDC Balance: </Text>
                <Text>{walletInfo.usdcBalance.toFixed(6)}</Text>
              </div>
            )}

            {poolPositions.length > 0 ? (
              <Collapse defaultActiveKey={[]} className="position-collapse">
                {poolPositions.map((poolInfo, index) => (
                  <Panel 
                    header={
                      <span>
                        <strong>Pool: </strong>
                        <a 
                          href={`https://app.meteora.ag/dlmm/${poolInfo.lbPairAddress}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          {poolInfo.lbPairAddress.substring(0, 8)}...{poolInfo.lbPairAddress.substring(poolInfo.lbPairAddress.length - 8)}
                        </a>
                        <strong> ({poolInfo.positionsCount} positions)</strong>
                        <div>
                          <Text type="secondary">
                            Token X: {parseFloat(poolInfo.tokenX.amount) / Math.pow(10, poolInfo.tokenX.decimals)} {poolInfo.tokenX.mint.substring(0, 4)}...
                          </Text>
                          <br />
                          <Text type="secondary">
                            Token Y: {parseFloat(poolInfo.tokenY.amount) / Math.pow(10, poolInfo.tokenY.decimals)} {poolInfo.tokenY.mint.substring(0, 4)}...
                          </Text>
                        </div>
                      </span>
                    } 
                    key={index}
                  >
                    <Table 
                      dataSource={poolInfo.positions.map(position => ({
                        ...position,
                        xDecimals: poolInfo.tokenX.decimals,
                        yDecimals: poolInfo.tokenY.decimals
                      }))} 
                      columns={[
                        {
                          title: 'Position ID',
                          dataIndex: 'publicKey',
                          key: 'publicKey',
                          ellipsis: true,
                          render: (text: string) => `${text.substring(0, 6)}...${text.substring(text.length - 6)}`,
                        },
                        {
                          title: 'X Amount',
                          dataIndex: 'totalXAmount',
                          key: 'totalXAmount',
                          render: (value: string, record: Position & { xDecimals: number }) => 
                            parseFloat(value) / Math.pow(10, record.xDecimals),
                        },
                        {
                          title: 'SOL Amount',
                          dataIndex: 'totalYAmount',
                          key: 'totalYAmount',
                          render: (value: string, record: Position & { yDecimals: number }) => 
                            parseFloat(value) / Math.pow(10, record.yDecimals),
                        },
                        {
                          title: 'Fees (X/SOL)',
                          key: 'fees',
                          render: (_: unknown, record: Position & { xDecimals: number, yDecimals: number }) => (
                            <span>
                              {parseFloat(record.feeX) / Math.pow(10, record.xDecimals)} / {parseFloat(record.feeY) / Math.pow(10, record.yDecimals)}
                            </span>
                          ),
                        },
                        {
                          title: 'Bin Range',
                          key: 'binRange',
                          render: (_: unknown, record: Position) => (
                            <span>{record.lowerBinId} - {record.upperBinId}</span>
                          ),
                        },
                        {
                          title: 'Last Updated',
                          dataIndex: 'lastUpdatedAt',
                          key: 'lastUpdatedAt',
                          render: (timestamp: string) => new Date(parseInt(timestamp) * 1000).toLocaleString(),
                        },
                      ]} 
                      rowKey="publicKey"
                      pagination={false}
                      loading={loading}
                    />
                  </Panel>
                ))}
              </Collapse>
            ) : (
              <Empty description="No positions found" />
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default PositionStats; 