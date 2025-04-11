/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Typography, Collapse, Button, Switch, Space } from 'antd';
import { SyncOutlined, CopyOutlined } from '@ant-design/icons';
import { fetchWalletInfo, WalletInfo } from '../services/walletService';
import { getAllUserPositions, PoolPositionInfo } from '../services/meteoraService';
import PositionTable from './PositionTable';
import { getPoolName } from '../services/tokenService';
import notification from '../utils/notification';

const { Title, Text } = Typography;
const { Panel } = Collapse;

// Extended interface to include pool name
interface EnhancedPoolPositionInfo extends PoolPositionInfo {
  poolName?: string;
}

const PositionStats = () => {
  const [loading, setLoading] = useState(true);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [poolPositions, setPoolPositions] = useState<EnhancedPoolPositionInfo[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
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
        // Fetch pool names for each position
        const enhancedPositions = await Promise.all((allPositions || []).map(async (position) => {
          const poolName = await getPoolName(position.tokenX.mint, position.tokenY.mint);
          return {
            ...position,
            poolName
          };
        }));
        
        setPoolPositions(enhancedPositions);
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
    let intervalId: any = null;
    
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => notification.success('Copied to clipboard'))
      .catch(() => notification.error('Failed to copy'));
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
                        <strong>Pool: {poolInfo.poolName || 'Loading...'} </strong>
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
                            Token X: {poolInfo.tokenX.mint}
                            <Button 
                              type="text" 
                              icon={<CopyOutlined />} 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(poolInfo.tokenX.mint);
                              }}
                            />
                          </Text>
                          <br />
                          <Text type="secondary">
                            Token Y: {poolInfo.tokenY.mint}
                            <Button 
                              type="text" 
                              icon={<CopyOutlined />} 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(poolInfo.tokenY.mint);
                              }}
                            />
                          </Text>
                        </div>
                      </span>
                    } 
                    key={index}
                  >
                    <PositionTable 
                      positions={poolInfo.positions.map(position => ({
                        ...position,
                        xDecimals: poolInfo.tokenX.decimals,
                        yDecimals: poolInfo.tokenY.decimals,
                        xMint: poolInfo.tokenX.mint,
                        yMint: poolInfo.tokenY.mint
                      }))}
                      loading={loading}
                      poolAddress={poolInfo.lbPairAddress}
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