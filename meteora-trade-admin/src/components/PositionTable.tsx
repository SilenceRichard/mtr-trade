import { Table, Spin, Button, Popover, InputNumber, Space, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { Position, removeLiquidity, claimFee, closePosition, updatePosition } from "../services/meteoraService";
import { getJupiterQuote, executeJupiterSwap, QuoteResponse } from "../services/jupiterService";
import { SOL_MINT, fetchTokenBalance } from "../services/walletService";
import notification from "../utils/notification";
import { InfoCircleOutlined } from "@ant-design/icons";

interface PositionTableProps {
  positions: (Position & {
    xDecimals: number;
    yDecimals: number;
    xMint?: string;
    yMint?: string;
    xTokenName?: string;
    yTokenName?: string;
  })[];
  loading: boolean;
  poolAddress: string;
}

interface PositionWithSolFees extends Position {
  xDecimals: number;
  yDecimals: number;
  xMint?: string;
  yMint?: string;
  xTokenName?: string;
  yTokenName?: string;
  totalSolFees?: number;
  totalAmountInSol?: number;
  feesLoading?: boolean;
  amountLoading?: boolean;
}

const PositionTable = ({
  positions,
  poolAddress,
}: PositionTableProps) => {
  const [positionsWithFees, setPositionsWithFees] = useState<
    PositionWithSolFees[]
  >([]);
  const [removingPosition, setRemovingPosition] = useState<string | null>(null);
  const [swappingPosition, setSwappingPosition] = useState<string | null>(null);
  const [claimingPosition, setClaimingPosition] = useState<string | null>(null);
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [swapSlippageBps, setSwapSlippageBps] = useState<number>(100); // Default 1% slippage
  const [currentSwapQuote, setCurrentSwapQuote] = useState<QuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionWithSolFees | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [expectedOutput, setExpectedOutput] = useState<number | null>(null);

  useEffect(() => {
    if (positions.length === 0) {
      setPositionsWithFees([]);
      return;
    }

    // Preserve previous values for positions that already exist
    setPositionsWithFees(prevPositions => {
      // Create a map of previous positions for quick lookup
      const prevPositionsMap = new Map(
        prevPositions.map(pos => [pos.publicKey, pos])
      );
      
      return positions.map(position => {
        const prevPosition = prevPositionsMap.get(position.publicKey);
        
        // If position already exists, preserve calculated values while updating base data
        if (prevPosition && !prevPosition.feesLoading && !prevPosition.amountLoading) {
          return {
            ...position,
            totalSolFees: prevPosition.totalSolFees,
            totalAmountInSol: prevPosition.totalAmountInSol,
            feesLoading: false,
            amountLoading: false,
          };
        }
        
        // For new positions, set loading state
        return {
          ...position,
          feesLoading: true,
          amountLoading: true,
        };
      });
    });

    const calculateValues = async () => {
      const updatedPositions = await Promise.all(
        positions.map(async (position) => {
          try {
            let totalSolFees = 0;
            let totalAmountInSol = 0;

            // Calculate Y amount in SOL (already in SOL)
            const yAmount =
              parseFloat(position.totalYAmount) /
              Math.pow(10, position.yDecimals);
            totalAmountInSol += yAmount;

            if (position.xMint && position.yMint) {
              // Calculate fees in SOL
              if (parseFloat(position.feeX) > 0) {
                const feeXAmount =
                  parseFloat(position.feeXExcludeTransferFee) /
                  Math.pow(10, position.xDecimals);

                if (feeXAmount > 0) {
                  const quoteParams = {
                    inputMint: position.xMint,
                    outputMint: position.yMint,
                    amount: Math.floor(
                      parseFloat(position.feeXExcludeTransferFee)
                    ).toString(), // Use raw amount for API
                    slippageBps: 50, // 0.5% slippage
                  };

                  const quote = await getJupiterQuote(quoteParams);

                  if (quote) {
                    // Calculate SOL value of X token fees
                    const feeXInSol =
                      parseFloat(quote.outAmount) /
                      Math.pow(10, position.yDecimals);
                    totalSolFees = feeXInSol;
                  }
                }
              }

              // Calculate total X amount in SOL
              if (parseFloat(position.totalXAmount) > 0) {
                const totalXAmountParams = {
                  inputMint: position.xMint,
                  outputMint: position.yMint,
                  amount: Math.floor(
                    parseFloat(position.totalXAmount)
                  ).toString(), // Use raw amount for API
                  slippageBps: 50, // 0.5% slippage
                };

                const totalXQuote = await getJupiterQuote(totalXAmountParams);

                if (totalXQuote) {
                  // Calculate SOL value of total X amount
                  const xAmountInSol =
                    parseFloat(totalXQuote.outAmount) /
                    Math.pow(10, position.yDecimals);
                  totalAmountInSol += xAmountInSol;
                }
              }
            }

            // Add Y fees to total fees in SOL
            const feeSol =
              parseFloat(position.feeYExcludeTransferFee) /
              Math.pow(10, position.yDecimals);
            totalSolFees += feeSol;

            return {
              ...position,
              totalSolFees,
              totalAmountInSol,
              feesLoading: false,
              amountLoading: false,
            };
          } catch (error) {
            console.error("Error calculating values:", error);

            // Return original position with just Y values in case of error
            const feeSol =
              parseFloat(position.feeYExcludeTransferFee) /
              Math.pow(10, position.yDecimals);
            const yAmount =
              parseFloat(position.totalYAmount) /
              Math.pow(10, position.yDecimals);

            return {
              ...position,
              totalSolFees: feeSol,
              totalAmountInSol: yAmount,
              feesLoading: false,
              amountLoading: false,
            };
          }
        })
      );

      setPositionsWithFees(updatedPositions);
    };

    calculateValues();
  }, [positions]);

  const handleRemoveLiquidity = async (position: Position) => {
    setRemovingPosition(position.publicKey);

    try {
      const result = await removeLiquidity(
        poolAddress,
        position.publicKey,
        position.lowerBinId,
        position.upperBinId
      );

      if (result) {
        notification.success(`流动性已移除，交易ID: ${result.txId}`);
      }
    } catch (error) {
      console.error("Error removing liquidity:", error);
      notification.error("移除流动性失败");
    } finally {
      setRemovingPosition(null);
    }
  };

  const handleClaimFee = async (position: Position) => {
    setClaimingPosition(position.publicKey);

    try {
      const result = await claimFee(poolAddress, position.publicKey);

      if (result) {
        notification.success(`手续费已领取，交易ID: ${result.txId}`);
      }
    } catch (error) {
      console.error("Error claiming fee:", error);
      notification.error("领取手续费失败");
    } finally {
      setClaimingPosition(null);
    }
  };

  // Handler for slippage change
  const handleSlippageChange = (value: number | null, position: PositionWithSolFees) => {
    if (value !== null) {
      // Convert percentage to basis points
      const newSlippageBps = value * 100;
      setSwapSlippageBps(newSlippageBps);
      
      // Re-fetch quote with new slippage - pass the new value directly
      if (position) {
        fetchSwapQuote(position, newSlippageBps);
      }
    }
  };

  // Function to fetch quote for a position
  const fetchSwapQuote = async (position: PositionWithSolFees, customSlippageBps?: number) => {
    if (!position.xMint) return;
    
    setLoadingQuote(true);
    
    try {
      // Check token balance if not already fetched
      let balance = tokenBalance;
      if (selectedPosition?.publicKey !== position.publicKey || balance <= 0) {
        balance = await fetchTokenBalance(position.xMint);
        setTokenBalance(balance);
      }
      
      if (balance <= 0) {
        notification.warning("钱包中没有可交换的X代币");
        setLoadingQuote(false);
        return;
      }
      
      // Use custom slippage if provided, otherwise use the state value
      const slippageToUse = customSlippageBps !== undefined ? customSlippageBps : swapSlippageBps;
      
      // Prepare the swap quote
      const quoteParams = {
        inputMint: position.xMint,
        outputMint: SOL_MINT,
        amount: Math.floor(balance * Math.pow(10, position.xDecimals)).toString(),
        slippageBps: slippageToUse,
      };
      
      // Get the quote
      const quote = await getJupiterQuote(quoteParams);
      if (quote) {
        setCurrentSwapQuote(quote);
        // Calculate expected output - SOL has 9 decimals
        const output = parseInt(quote.outAmount) / 1e9; // Use parseInt instead of parseFloat for precise handling
        setExpectedOutput(output);
      } else {
        setCurrentSwapQuote(null);
        setExpectedOutput(null);
      }
    } catch (error) {
      console.error("Error fetching swap quote:", error);
      setCurrentSwapQuote(null);
      setExpectedOutput(null);
    } finally {
      setLoadingQuote(false);
    }
  };

  // Handler for opening the swap popover
  const handleSwapPopoverOpen = (open: boolean, position: PositionWithSolFees) => {
    if (open) {
      setSelectedPosition(position);
      fetchSwapQuote(position);
    } else {
      setSelectedPosition(null);
      setCurrentSwapQuote(null);
      setExpectedOutput(null);
    }
  };

  const handleSwapXToSol = async (position: PositionWithSolFees) => {
    if (!position.xMint) {
      notification.warning("找不到X代币的铸币地址");
      return;
    }

    setSwappingPosition(position.publicKey);

    try {
      // Use existing quote if available
      if (currentSwapQuote && selectedPosition?.publicKey === position.publicKey) {
        // Execute the swap with current quote
        const swapResult = await executeJupiterSwap(currentSwapQuote);
        if (swapResult) {
          notification.success(
            `交换成功，交易ID: ${swapResult.signature}`
          );
        } else {
          notification.error("交换失败");
        }
      } else {
        // Fetch new quote and execute
        // First check if we have any X tokens to swap
        const balance = await fetchTokenBalance(position.xMint);
        if (balance <= 0) {
          notification.warning("钱包中没有可交换的X代币");
          setSwappingPosition(null);
          return;
        }

        // Prepare the swap quote
        const quoteParams = {
          inputMint: position.xMint,
          outputMint: SOL_MINT,
          amount: Math.floor(balance * Math.pow(10, position.xDecimals)).toString(),
          slippageBps: swapSlippageBps,
        };

        // Get the quote
        const quote = await getJupiterQuote(quoteParams);
        if (!quote) {
          notification.error("无法获取交换报价");
          setSwappingPosition(null);
          return;
        }

        // Execute the swap
        const swapResult = await executeJupiterSwap(quote);
        if (swapResult) {
          notification.success(
            `交换成功，交易ID: ${swapResult.signature}`
          );
        } else {
          notification.error("交换失败");
        }
      }
    } catch (error) {
      console.error("Error swapping X to SOL:", error);
      notification.error("交换X代币到SOL失败");
    } finally {
      setSwappingPosition(null);
      setCurrentSwapQuote(null);
      setExpectedOutput(null);
      setSelectedPosition(null);
    }
  };

  const handleClosePosition = async (position: PositionWithSolFees) => {
    setClosingPosition(position.publicKey);

    try {
      const result = await closePosition(poolAddress, position.publicKey);

      if (result) {
        // Calculate profit, profit rate, and fees for update
        const totalValue = (position.totalAmountInSol || 0) + (position.totalSolFees || 0);
        const openValue = position.openValue || 0;
        const profit = totalValue - openValue;
        const profitRate = openValue > 0 ? ((totalValue - openValue) / openValue) * 100 : 0;
        const fees = position.totalSolFees || 0;

        // Update position data
        await updatePosition(position.publicKey, {
          profit: profit,
          profit_rate: profitRate,
          fees: fees,
        });

        notification.success(`头寸已关闭，交易ID: ${result.txId}`);
      }
    } catch (error) {
      console.error("Error closing position:", error);
      notification.error("关闭头寸失败");
    } finally {
      setClosingPosition(null);
    }
  };

  return (
    <Table
      dataSource={positionsWithFees}
      columns={[
        {
          title: "Open Value",
          dataIndex: "openValue",
          key: "openValue",
          ellipsis: true,
          render: (value: number) =>
            `${value} ${positionsWithFees[0]?.yTokenName || 'SOL'}`,
        },
        {
          title: () => `${positionsWithFees[0]?.xTokenName || 'X'} Amount`,
          dataIndex: "totalXAmount",
          key: "totalXAmount",
          render: (value: string, record: PositionWithSolFees) => (
            <span>
              {(parseFloat(value) / Math.pow(10, record.xDecimals)).toFixed(6)} {record.xTokenName || ''}
            </span>
          ),
        },
        {
          title: () => `${positionsWithFees[0]?.yTokenName || 'Y'} Amount`,
          dataIndex: "totalYAmount",
          key: "totalYAmount",
          render: (value: string, record: PositionWithSolFees) => (
            <span>
              {(parseFloat(value) / Math.pow(10, record.yDecimals)).toFixed(6)} {record.yTokenName || ''}
            </span>
          ),
        },
        {
          title: () => `Total Amount in ${positionsWithFees[0]?.yTokenName || 'SOL'}`,
          key: "totalAmount",
          render: (_: unknown, record: PositionWithSolFees) =>
            record.amountLoading ? (
              <Spin size="small" />
            ) : (
              <span>
                {record.totalAmountInSol?.toFixed(6) || "0.000000"} {record.yTokenName || 'SOL'}
              </span>
            ),
        },
        {
          title: () => `Total Fee in ${positionsWithFees[0]?.yTokenName || 'SOL'}`,
          key: "fees",
          render: (_: unknown, record: PositionWithSolFees) =>
            record.feesLoading ? (
              <Spin size="small" />
            ) : (
              <span>{record.totalSolFees?.toFixed(6) || "0.000000"} {record.yTokenName || 'SOL'}</span>
            ),
        },
        {
          title: () => `Total Value (${positionsWithFees[0]?.yTokenName || 'SOL'})`,
          key: "totalValue",
          render: (_: unknown, record: PositionWithSolFees) =>
            record.feesLoading || record.amountLoading ? (
              <Spin size="small" />
            ) : (
              <span>
                {((record.totalAmountInSol || 0) + (record.totalSolFees || 0)).toFixed(6)} {record.yTokenName || 'SOL'}
              </span>
            ),
        },
        {
          title: "收益",
          key: "profit",
          render: (_: unknown, record: PositionWithSolFees) => {
            if (record.feesLoading || record.amountLoading) {
              return <Spin size="small" />;
            }
            
            const totalValue = (record.totalAmountInSol || 0) + (record.totalSolFees || 0);
            const openValue = record.openValue || 0;
            const profit = totalValue - openValue;
            const isPositive = profit >= 0;
            
            return (
              <span style={{ color: isPositive ? '#52c41a' : '#f5222d' }}>
                {profit.toFixed(6)} {record.yTokenName || 'SOL'}
              </span>
            );
          },
        },
        {
          title: "收益率",
          key: "profitRate",
          render: (_: unknown, record: PositionWithSolFees) => {
            if (record.feesLoading || record.amountLoading) {
              return <Spin size="small" />;
            }
            
            const totalValue = (record.totalAmountInSol || 0) + (record.totalSolFees || 0);
            const openValue = record.openValue || 0;
            
            // Avoid division by zero
            if (openValue === 0) {
              return <span>-</span>;
            }
            
            const profitRate = ((totalValue - openValue) / openValue) * 100;
            const isPositive = profitRate >= 0;
            
            return (
              <span style={{ color: isPositive ? '#52c41a' : '#f5222d' }}>
                {profitRate.toFixed(2)}%
              </span>
            );
          },
        },
        {
          title: "Last Updated",
          dataIndex: "lastUpdatedAt",
          key: "lastUpdatedAt",
          render: (timestamp: string) =>
            new Date(parseInt(timestamp) * 1000).toLocaleString(),
        },
        {
          title: "操作",
          key: "action",
          render: (_: unknown, record: PositionWithSolFees) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Popover
                content={
                  <div>
                    <p>确认要移除该流动性吗？</p>
                    <Button 
                      type="primary" 
                      size="small" 
                      onClick={() => {
                        handleRemoveLiquidity(record);
                      }}
                    >
                      确认
                    </Button>
                  </div>
                }
                title="确认操作"
                trigger="click"
                placement="left"
              >
                <Button
                  type="primary"
                  loading={removingPosition === record.publicKey}
                >
                  移除流动性
                </Button>
              </Popover>
              
              <Popover
                content={
                  <div>
                    <p>确认要将所有{record.xTokenName || 'X'}代币兑换为{record.yTokenName || 'SOL'}吗？</p>
                    <div style={{ marginBottom: 12 }}>
                      <Space>
                        <span>滑点容差:</span>
                        <InputNumber
                          min={0.01}
                          max={10}
                          step={0.01}
                          value={swapSlippageBps / 100} // Convert from bp to percentage
                          onChange={(value) => handleSlippageChange(value, record)}
                          formatter={(value) => `${value}%`}
                          parser={(value) => value ? parseFloat(value.replace('%', '')) : 1}
                          style={{ width: 80 }}
                          disabled={loadingQuote || swappingPosition === record.publicKey}
                        />
                        <Tooltip title="滑点容差设置：1 bp = 0.01%">
                          <InfoCircleOutlined />
                        </Tooltip>
                      </Space>
                    </div>
                    
                    {/* Show quote information */}
                    {loadingQuote && selectedPosition?.publicKey === record.publicKey && (
                      <div style={{ marginBottom: 12 }}>
                        <Spin size="small" /> 正在获取报价...
                      </div>
                    )}
                    
                    {expectedOutput !== null && !loadingQuote && selectedPosition?.publicKey === record.publicKey && (
                      <div style={{ marginBottom: 12 }}>
                        <p>预计获得: {expectedOutput.toFixed(6)} {record.yTokenName || 'SOL'}</p>
                        {currentSwapQuote && (
                          <p>价格影响: {parseFloat(currentSwapQuote.priceImpactPct).toFixed(4)}%</p>
                        )}
                      </div>
                    )}
                    
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={() => {
                        handleSwapXToSol(record);
                      }}
                      loading={swappingPosition === record.publicKey}
                      disabled={loadingQuote || (!currentSwapQuote && selectedPosition?.publicKey === record.publicKey)}
                    >
                      确认
                    </Button>
                  </div>
                }
                title="确认操作"
                trigger="click"
                placement="left"
                onOpenChange={(open) => handleSwapPopoverOpen(open, record)}
              >
                <Button
                  type="default"
                  loading={swappingPosition === record.publicKey}
                  disabled={!record.xMint}
                >
                  兑换
                </Button>
              </Popover>

              <Popover
                content={
                  <div>
                    <p>确认要领取该仓位的手续费吗？</p>
                    <Button 
                      type="primary" 
                      size="small" 
                      onClick={() => {
                        handleClaimFee(record);
                      }}
                    >
                      确认
                    </Button>
                  </div>
                }
                title="确认操作"
                trigger="click"
                placement="left"
              >
                <Button
                  type="default"
                  loading={claimingPosition === record.publicKey}
                  disabled={(record.totalSolFees || 0) <= 0}
                >
                  领取手续费
                </Button>
              </Popover>
              
              <Popover
                content={
                  <div>
                    <p>确认要关闭该头寸吗？关闭后将无法再添加流动性。</p>
                    <Button 
                      type="primary" 
                      size="small" 
                      onClick={() => {
                        handleClosePosition(record);
                      }}
                    >
                      确认
                    </Button>
                  </div>
                }
                title="确认操作"
                trigger="click"
                placement="left"
              >
                <Button
                  type="default"
                  danger
                  loading={closingPosition === record.publicKey}
                >
                  关闭头寸
                </Button>
              </Popover>
            </div>
          ),
        },
      ]}
      rowKey="publicKey"
      pagination={false}
      loading={false}
    />
  );
};

export default PositionTable;
