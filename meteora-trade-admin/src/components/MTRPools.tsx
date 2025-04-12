import { useState, useEffect, useRef } from "react";
import { ProTable } from "@ant-design/pro-components";
import { Button, Radio } from "antd";
import type { ActionType } from "@ant-design/pro-components";
import { columns } from "./MTRcolumns";
import { MTRModal } from "./MTRModal";
import notification from "../utils/notification";
import { 
  fetchWalletInfo, 
  fetchPoolTokenBalance,
  fetchPools,
  filterPoolsByCategory,
  PoolItem,
  ApiResponse,
  SearchParams,
  WalletInfo
} from "../services";

const MTRPools = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [poolCategory, setPoolCategory] = useState<string>("all");
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [filteredPools, setFilteredPools] = useState<PoolItem[]>([]);
  const actionRef = useRef<ActionType>(null);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<PoolItem | undefined>(undefined);
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    solBalance: 0,
    usdcBalance: 0,
    tokenBalance: 0,
  });
  const [loadingWallet, setLoadingWallet] = useState<boolean>(false);

  // Fetch wallet information
  const handleFetchWalletInfo = async () => {
    if (loadingWallet) return;
    
    setLoadingWallet(true);
    try {
      const walletInfoResult = await fetchWalletInfo();
      if (walletInfoResult) {
        setWalletInfo({
          ...walletInfoResult,
          tokenBalance: walletInfo.tokenBalance
        });
      }
      setLoadingWallet(false);
    } catch (error) {
      console.error("Error fetching wallet info:", error);
      setLoadingWallet(false);
      notification.error("Failed to fetch wallet information");
    }
  };

  // Fetch token balance for selected pool
  const handleFetchPoolTokenBalance = async (pool: PoolItem) => {
    if (!pool || !pool.tokenAddress) return;
    
    try {
      const tokenBalance = await fetchPoolTokenBalance(pool.tokenAddress);
      setWalletInfo(prev => ({
        ...prev,
        tokenBalance,
      }));
    } catch (error) {
      console.error("Error fetching pool token balance:", error);
    }
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setSelectedPool(undefined); // Clear selected pool when closing modal
  };

  const handleCreatePosition = (record: PoolItem) => {
    // console.log("Creating position for pool:", record);
    setSelectedPool({
      ...record,
      poolName: record.poolName // Explicitly ensure poolName is included
    }); // Set the selected pool when creating a position
    handleFetchPoolTokenBalance(record); // Fetch token balance for selected pool
    showModal();
  };

  // Fetch initial wallet information
  useEffect(() => {
    handleFetchWalletInfo();
  }, []);

  // Fetch API data
  useEffect(() => {
    const fetchApiData = async () => {
      try {
        setLoading(true);
        const data = await fetchPools();
        if (data) {
          setApiData(data);
          // Initialize filtered pool data
          const filtered = filterPoolsByCategory(data, poolCategory);
          setFilteredPools(filtered);
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch API data:", error);
        setLoading(false);
        notification.error("Failed to fetch pool data");
      }
    };

    fetchApiData();

    // Set timer to refresh data every minute
    const intervalId = setInterval(() => {
      fetchApiData();
    }, 60000); // 60000ms = 1 minute

    return () => clearInterval(intervalId); // Clean up timer
  }, []);

  // When poolCategory changes, filter local data
  useEffect(() => {
    if (apiData) {
      const filtered = filterPoolsByCategory(apiData, poolCategory);
      setFilteredPools(filtered);

      // Force refresh table
      if (actionRef.current) {
        actionRef.current.reload();
      }
    }
  }, [poolCategory, apiData]);

  // Process local data and apply search filtering
  const getTableData = async (params: SearchParams) => {
    console.log("getTableData called with params:", params);
    try {
      // Use already filtered local data
      let result = [...filteredPools];

      // Apply additional search filtering
      if (params.poolName && typeof params.poolName === "string") {
        result = result.filter((pool) =>
          pool.poolName.toLowerCase().includes(params.poolName!.toLowerCase())
        );
      }

      console.log("Filtered pools for display:", result.length);

      return {
        data: result,
        success: true,
        total: result.length,
      };
    } catch (error) {
      console.error("Error processing pool data:", error);
      notification.error("Failed to process data");

      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      const data = await fetchPools();
      if (data) {
        setApiData(data);
        const filtered = filterPoolsByCategory(data, poolCategory);
        setFilteredPools(filtered);
        
        if (actionRef.current) {
          actionRef.current.reload();
        }
        
        notification.success("Data refreshed successfully");
      }
      setRefreshing(false);
    } catch (error) {
      console.error("Failed to refresh data:", error);
      setRefreshing(false);
      notification.error("Failed to refresh data");
    }
  };

  return (
    <div style={{ padding: 24, overflow: "auto", width: "100%" }}>
      <Radio.Group
        value={poolCategory}
        onChange={(e) => setPoolCategory(e.target.value)}
        style={{ marginBottom: 16, width: "100%", overflow: "auto" }}
        size="middle"
      >
        <Radio.Button value="all">All Pools</Radio.Button>
        <Radio.Button value="topPoolsByFeeRatio">Top 10 Fee</Radio.Button>
        <Radio.Button
          value="highYieldPools"
          style={{
            backgroundColor: apiData?.highYieldPools?.length
              ? "#f6ffed"
              : undefined,
            borderColor: apiData?.highYieldPools?.length
              ? "#b7eb8f"
              : undefined,
            color:
              apiData?.highYieldPools?.length &&
              poolCategory !== "highYieldPools"
                ? "#52c41a"
                : undefined,
          }}
        >
          High Yield{" "}
          {apiData?.highYieldPools?.length
            ? `(${apiData.highYieldPools.length})`
            : ""}
        </Radio.Button>
        <Radio.Button
          value="mediumYieldPools"
          style={{
            backgroundColor: apiData?.mediumYieldPools?.length
              ? "#e6f7ff"
              : undefined,
            borderColor: apiData?.mediumYieldPools?.length
              ? "#91d5ff"
              : undefined,
            color:
              apiData?.mediumYieldPools?.length &&
              poolCategory !== "mediumYieldPools"
                ? "#1890ff"
                : undefined,
          }}
        >
          Medium{" "}
          {apiData?.mediumYieldPools?.length
            ? `(${apiData.mediumYieldPools.length})`
            : ""}
        </Radio.Button>
        <Radio.Button
          value="emergingPools"
          style={{
            backgroundColor: apiData?.emergingPools?.length
              ? "#fff7e6"
              : undefined,
            borderColor: apiData?.emergingPools?.length ? "#ffd591" : undefined,
            color:
              apiData?.emergingPools?.length && poolCategory !== "emergingPools"
                ? "#fa8c16"
                : undefined,
          }}
        >
          Emerging{" "}
          {apiData?.emergingPools?.length
            ? `(${apiData.emergingPools.length})`
            : ""}
        </Radio.Button>
        <Radio.Button value="avoidPools">Avoid</Radio.Button>
      </Radio.Group>

      <ProTable<PoolItem>
        key={poolCategory} // Important: ensure table is re-rendered when category changes
        actionRef={actionRef}
        columns={columns(handleCreatePosition, showModal)}
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
          sortField: "change30m",
          sortOrder: "descend",
        }}
        toolBarRender={() => [
          <Button
            key="refresh"
            loading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </Button>,
          <Button
            key="refreshWallet"
            loading={loadingWallet}
            onClick={handleFetchWalletInfo}
          >
            Refresh Wallet
          </Button>,
        ]}
      />
      <MTRModal
        isModalVisible={isModalVisible}
        handleOk={handleOk}
        handleCancel={handleCancel}
        selectedPool={selectedPool}
        walletInfo={{
          solBalance: walletInfo.solBalance, 
          usdcBalance: walletInfo.usdcBalance,
          tokenBalance: walletInfo.tokenBalance || 0
        }}
      />
    </div>
  );
};

export default MTRPools;
