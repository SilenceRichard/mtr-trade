import { useState, useEffect, useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Button, Tag, Radio, message, Tooltip } from 'antd';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import axios from 'axios';

// Matching the structure from formatPoolSummary in analyzer.js
interface PoolItem {
  poolName: string;
  poolAddress: string;
  tokenAddress: string;
  meteoraLink: string;
  gmgnLink: string;
  geckoTerminalLink: string;
  tokenInfo: {
    name?: string;
    address?: string;
  };
  exchangeInfo: {
    type: string;
  };
  age: string;
  binStep: number;
  baseFee: number;
  liquidity: string;
  volume24h: string;
  fees24h: string;
  feeRatio24h: string;
  hourlyRate24h: string;
  hourlyRate1h: string;
  hourlyRate30m: string;
  change30m: string;
  change1h: string;
  volume24hHourly: string;
  volume1hHourly: string;
  holders: string;
  vol24hGecko: string;
  marketCap: string;
  securityRating: string;
  signals: string;
  rating: string;
}

// API response structure
interface ApiResponse {
  highYieldPools: PoolItem[];
  mediumYieldPools: PoolItem[];
  emergingPools: PoolItem[];
  avoidPools: PoolItem[];
  topPoolsByFeeRatio: PoolItem[];
}

interface SearchParams {
  poolName?: string;
  pageSize?: number;
  current?: number;
  [key: string]: unknown;
}

const columns: ProColumns<PoolItem>[] = [
  {
    title: 'Pool Name',
    dataIndex: 'poolName',
    valueType: 'text',
    width: 140,
    render: (_, record) => (
      <a href={record.meteoraLink} target="_blank" rel="noopener noreferrer">
        {record.poolName}
      </a>
    ),
  },
  {
    title: 'Security',
    dataIndex: 'securityRating',
    width: 80,
    render: (_, record) => (
      <Tag color={record.securityRating.includes('安全') ? 'green' : 'default'}>
        {record.securityRating || 'N/A'}
      </Tag>
    ),
  },
  {
    title: 'Rating',
    dataIndex: 'rating',
    width: 120,
    sorter: (a, b) => {
      const starCountA = (a.rating.match(/⭐/g) || []).length;
      const starCountB = (b.rating.match(/⭐/g) || []).length;
      return starCountB - starCountA;
    },
  },
  {
    title: 'Age',
    dataIndex: 'age',
    width: 100,
  },
  {
    title: 'Fee Ratio (24h)',
    dataIndex: 'feeRatio24h',
    valueType: 'text',
    sorter: (a, b) => parseFloat(a.feeRatio24h) - parseFloat(b.feeRatio24h),
  },
  {
    title: 'Hourly Rate',
    dataIndex: 'hourlyRate30m',
    valueType: 'text',
    width: 120,
    sorter: (a, b) => parseFloat(a.hourlyRate30m) - parseFloat(b.hourlyRate30m),
    render: (_, record) => (
      <Tooltip title={`24h: ${record.hourlyRate24h}, 1h: ${record.hourlyRate1h}`}>
        {record.hourlyRate30m}
      </Tooltip>
    ),
  },
  {
    title: 'Change',
    dataIndex: 'change30m',
    valueType: 'text',
    width: 100,
    sorter: (a, b) => {
      // Parse the percentage values correctly, preserving the sign
      const valueA = parseFloat(a.change30m.replace('%', ''));
      const valueB = parseFloat(b.change30m.replace('%', ''));
      return valueB - valueA; // Descending order (high to low)
    },
    defaultSortOrder: 'ascend',
    render: (_, record) => (
      <Tooltip title={`1h Change: ${record.change1h}`}>
        <Tag color={record.change30m.includes('+') ? 'green' : 'red'}>
          {record.change30m}
        </Tag>
      </Tooltip>
    ),
  },
  {
    title: 'Volume (24h)',
    dataIndex: 'volume24h',
    valueType: 'text',
    sorter: (a, b) => parseFloat(a.volume24h.replace(/[^0-9.-]+/g, '')) - parseFloat(b.volume24h.replace(/[^0-9.-]+/g, '')),
  },
  {
    title: 'Liquidity',
    dataIndex: 'liquidity',
    valueType: 'text',
    sorter: (a, b) => parseFloat(a.liquidity.replace(/[^0-9.-]+/g, '')) - parseFloat(b.liquidity.replace(/[^0-9.-]+/g, '')),
  },
  {
    title: 'Holders',
    dataIndex: 'holders',
    valueType: 'text',
    width: 90,
  },
  {
    title: 'Links',
    valueType: 'option',
    width: 120,
    render: (_, record) => [
      <a key="view" href={record.meteoraLink} target="_blank" rel="noopener noreferrer">
        Meteora
      </a>,
      <a key="gmgn" href={record.gmgnLink} target="_blank" rel="noopener noreferrer">
        GMGN
      </a>,
      <a key="gecko" href={record.geckoTerminalLink} target="_blank" rel="noopener noreferrer">
        Gecko
      </a>,
    ],
  },
];

const API_URL = 'http://localhost:3000';

const MTRPools = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [poolCategory, setPoolCategory] = useState<string>('all');
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [filteredPools, setFilteredPools] = useState<PoolItem[]>([]);
  const actionRef = useRef<ActionType>(null);

  // Fetch API data
  useEffect(() => {
    const fetchApiData = async () => {
      try {
        setLoading(true);
        const response = await axios.get<ApiResponse>(`${API_URL}/api/pools`);
        console.log('API Response:', response.data);
        
        // 验证API返回的数据结构
        if (!response.data) {
          console.error('API response data is empty');
          message.error('No data received from API');
          setLoading(false);
          return;
        }
        
        // 检查是否有topPoolsByFeeRatio数据
        if (!response.data.topPoolsByFeeRatio || response.data.topPoolsByFeeRatio.length === 0) {
          console.warn('No topPoolsByFeeRatio data in API response');
        }
        
        // 输出各个类别的池子数量，帮助调试
        console.log('Top Pools By Fee Ratio count:', response.data.topPoolsByFeeRatio?.length || 0);
        console.log('High Yield Pools count:', response.data.highYieldPools?.length || 0);
        console.log('Medium Yield Pools count:', response.data.mediumYieldPools?.length || 0);
        console.log('Emerging Pools count:', response.data.emergingPools?.length || 0);
        console.log('Avoid Pools count:', response.data.avoidPools?.length || 0);
        
        setApiData(response.data);
        
        // 初始化已过滤的池数据
        filterPoolsByCategory(response.data, poolCategory);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch API data:', error);
        setLoading(false);
        message.error('Failed to fetch pool data');
      }
    };

    fetchApiData();
    
    // 设置定时器，每分钟刷新一次数据
    const intervalId = setInterval(() => {
      fetchApiData();
    }, 60000); // 60000ms = 1分钟
    
    return () => clearInterval(intervalId); // 清理定时器
  }, []);

  // 根据选择的类别过滤池数据
  const filterPoolsByCategory = (data: ApiResponse | null, category: string) => {
    if (!data) {
      setFilteredPools([]);
      return;
    }
    
    let pools: PoolItem[] = [];
    
    if (category === 'all') {
      // 合并所有类别的池
      const allPoolsSet = new Set<string>(); // 使用Set避免重复
      const allPools: PoolItem[] = [];
      
      // 按特定顺序处理类别，以确保重要的池显示在前面
      [
        data.topPoolsByFeeRatio || [],
        data.highYieldPools || [],
        data.mediumYieldPools || [],
        data.emergingPools || [],
        data.avoidPools || []
      ].forEach(categoryPools => {
        categoryPools.forEach(pool => {
          if (!allPoolsSet.has(pool.poolAddress)) {
            allPoolsSet.add(pool.poolAddress);
            allPools.push(pool);
          }
        });
      });
      
      pools = allPools;
    } else if (category === 'topPoolsByFeeRatio') {
      pools = data.topPoolsByFeeRatio || [];
      console.log(`Using ${pools.length} pools from topPoolsByFeeRatio`);
    } else if (category === 'highYieldPools') {
      pools = data.highYieldPools || [];
    } else if (category === 'mediumYieldPools') {
      pools = data.mediumYieldPools || [];
    } else if (category === 'emergingPools') {
      pools = data.emergingPools || [];
    } else if (category === 'avoidPools') {
      pools = data.avoidPools || [];
    }
    
    console.log(`Category: ${category}, Filtered pools: ${pools.length}`);
    setFilteredPools(pools);
    
    // 强制刷新表格
    if (actionRef.current) {
      actionRef.current.reload();
    }
  };

  // 当poolCategory变化时，仅对本地数据进行过滤
  useEffect(() => {
    filterPoolsByCategory(apiData, poolCategory);
  }, [poolCategory, apiData]);

  // 此函数现在只处理本地数据并应用搜索过滤
  const getTableData = async (params: SearchParams) => {
    console.log('getTableData called with params:', params);
    try {
      // 使用已过滤的本地数据
      let result = [...filteredPools];
      
      // 应用额外的搜索过滤
      if (params.poolName && typeof params.poolName === 'string') {
        result = result.filter(pool => 
          pool.poolName.toLowerCase().includes(params.poolName!.toLowerCase())
        );
      }
      
      console.log('Filtered pools for display:', result.length);
      
      return {
        data: result,
        success: true,
        total: result.length,
      };
    } catch (error) {
      console.error('Error processing pool data:', error);
      message.error('Failed to process data');
      
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  return (
    <div style={{ padding: 24, overflow: 'auto', width: '100%' }}>
      <Radio.Group 
        value={poolCategory}
        onChange={(e) => setPoolCategory(e.target.value)}
        style={{ marginBottom: 16, width: '100%', overflow: 'auto' }}
        size="middle"
      >
        <Radio.Button value="all">All Pools</Radio.Button>
        <Radio.Button value="topPoolsByFeeRatio">Top 10 Fee</Radio.Button>
        <Radio.Button 
          value="highYieldPools"
          style={{ 
            backgroundColor: apiData?.highYieldPools?.length ? '#f6ffed' : undefined,
            borderColor: apiData?.highYieldPools?.length ? '#b7eb8f' : undefined,
            color: apiData?.highYieldPools?.length && poolCategory !== 'highYieldPools' ? '#52c41a' : undefined
          }}
        >
          High Yield {apiData?.highYieldPools?.length ? `(${apiData.highYieldPools.length})` : ''}
        </Radio.Button>
        <Radio.Button 
          value="mediumYieldPools"
          style={{ 
            backgroundColor: apiData?.mediumYieldPools?.length ? '#e6f7ff' : undefined,
            borderColor: apiData?.mediumYieldPools?.length ? '#91d5ff' : undefined,
            color: apiData?.mediumYieldPools?.length && poolCategory !== 'mediumYieldPools' ? '#1890ff' : undefined
          }}
        >
          Medium {apiData?.mediumYieldPools?.length ? `(${apiData.mediumYieldPools.length})` : ''}
        </Radio.Button>
        <Radio.Button 
          value="emergingPools"
          style={{ 
            backgroundColor: apiData?.emergingPools?.length ? '#fff7e6' : undefined,
            borderColor: apiData?.emergingPools?.length ? '#ffd591' : undefined,
            color: apiData?.emergingPools?.length && poolCategory !== 'emergingPools' ? '#fa8c16' : undefined
          }}
        >
          Emerging {apiData?.emergingPools?.length ? `(${apiData.emergingPools.length})` : ''}
        </Radio.Button>
        <Radio.Button value="avoidPools">Avoid</Radio.Button>
      </Radio.Group>
      
      <ProTable<PoolItem>
        key={poolCategory} // 重要：确保在分类变化时重新渲染表格
        actionRef={actionRef}
        columns={columns}
        request={getTableData}
        rowKey="poolAddress"
        pagination={{
          showQuickJumper: true,
          pageSize: 10,
        }}
        search={false}
        dateFormatter="string"
        headerTitle="Meteora Pools Analysis"
        loading={loading}
        params={{
          sortField: 'change30m',
          sortOrder: 'descend',
        }}
        toolBarRender={() => [
          <Button 
            key="refresh" 
            loading={refreshing}
            onClick={() => {
              setRefreshing(true);
              setLoading(true);
              setApiData(null);
              // 刷新数据
              const fetchData = async () => {
                try {
                  const response = await axios.get<ApiResponse>(`${API_URL}/api/pools`);
                  console.log('Refresh API Response:', response.data);
                  
                  // 验证API返回的数据结构
                  if (!response.data) {
                    console.error('Refresh API response data is empty');
                    message.error('No data received from API');
                    setLoading(false);
                    setRefreshing(false);
                    return;
                  }
                  
                  // 检查是否有topPoolsByFeeRatio数据
                  if (!response.data.topPoolsByFeeRatio || response.data.topPoolsByFeeRatio.length === 0) {
                    console.warn('No topPoolsByFeeRatio data in refresh API response');
                  }
                  
                  // 输出各个类别的池子数量，帮助调试
                  console.log('Refresh - Top Pools By Fee Ratio count:', response.data.topPoolsByFeeRatio?.length || 0);
                  
                  setApiData(response.data);
                  filterPoolsByCategory(response.data, poolCategory);
                  setLoading(false);
                  setRefreshing(false);
                  
                  message.success('Data refreshed successfully');
                } catch (error) {
                  console.error('Failed to refresh data:', error);
                  setLoading(false);
                  setRefreshing(false);
                  message.error('Failed to refresh data');
                }
              };
              fetchData();
            }}>
            Refresh
          </Button>,
        ]}
      />
    </div>
  );
};

export default MTRPools; 