import { Table, Spin, Button, Popover } from "antd";
import { useEffect, useState } from "react";
import { Position, removeLiquidity, claimFee, closePosition } from "../services/meteoraService";
import { getJupiterQuote, executeJupiterSwap } from "../services/jupiterService";
import { SOL_MINT, fetchTokenBalance } from "../services/walletService";
import notification from "../utils/notification";

interface PositionTableProps {
  positions: (Position & {
    xDecimals: number;
    yDecimals: number;
    xMint?: string;
    yMint?: string;
  })[];
  loading: boolean;
  poolAddress: string;
}

interface PositionWithSolFees extends Position {
  xDecimals: number;
  yDecimals: number;
  xMint?: string;
  yMint?: string;
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

  const handleSwapXToSol = async (position: PositionWithSolFees) => {
    if (!position.xMint) {
      notification.warning("找不到X代币的铸币地址");
      return;
    }

    setSwappingPosition(position.publicKey);

    try {
      // First check if we have any X tokens to swap
      const tokenBalance = await fetchTokenBalance(position.xMint);
      if (tokenBalance <= 0) {
        notification.warning("钱包中没有可交换的X代币");
        setSwappingPosition(null);
        return;
      }

      // Prepare the swap quote
      const quoteParams = {
        inputMint: position.xMint,
        outputMint: SOL_MINT,
        amount: Math.floor(tokenBalance).toString(),
        slippageBps: 50, // 0.5% slippage
      };

      // Get the quote
      const quote = await getJupiterQuote(quoteParams);
      if (!quote) {
        notification.error("无法获取交换报价");
        setSwappingPosition(null);
        return;
      }

      // Calculate expected output
      const expectedOutput = parseFloat(quote.outAmount) / 1e9; // Assuming SOL has 9 decimals
      notification.info(`预计获得: ${expectedOutput.toFixed(6)} SOL`);

      // Execute the swap
      const swapResult = await executeJupiterSwap(quote);
      if (swapResult) {
        notification.success(
          `交换成功，交易ID: ${swapResult.signature}`
        );
      } else {
        notification.error("交换失败");
      }
    } catch (error) {
      console.error("Error swapping X to SOL:", error);
      notification.error("交换X代币到SOL失败");
    } finally {
      setSwappingPosition(null);
    }
  };

  const handleClosePosition = async (position: Position) => {
    setClosingPosition(position.publicKey);

    try {
      const result = await closePosition(poolAddress, position.publicKey);

      if (result) {
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
          title: "Position ID",
          dataIndex: "publicKey",
          key: "publicKey",
          ellipsis: true,
          render: (text: string) =>
            `${text.substring(0, 6)}...${text.substring(text.length - 6)}`,
        },
        {
          title: "X Amount",
          dataIndex: "totalXAmount",
          key: "totalXAmount",
          render: (value: string, record: Position & { xDecimals: number }) =>
            parseFloat(value) / Math.pow(10, record.xDecimals),
        },
        {
          title: "Y Amount",
          dataIndex: "totalYAmount",
          key: "totalYAmount",
          render: (value: string, record: Position & { yDecimals: number }) =>
            parseFloat(value) / Math.pow(10, record.yDecimals),
        },
        {
          title: "Total Amount in SOL",
          key: "totalAmount",
          render: (_: unknown, record: PositionWithSolFees) =>
            record.amountLoading ? (
              <Spin size="small" />
            ) : (
              <span>
                {record.totalAmountInSol?.toFixed(6) || "0.000000"} SOL
              </span>
            ),
        },
        {
          title: "Total fee in SOL",
          key: "fees",
          render: (_: unknown, record: PositionWithSolFees) =>
            record.feesLoading ? (
              <Spin size="small" />
            ) : (
              <span>{record.totalSolFees?.toFixed(6) || "0.000000"} SOL</span>
            ),
        },
        {
          title: "Total Value",
          key: "totalValue",
          render: (_: unknown, record: PositionWithSolFees) =>
            record.feesLoading || record.amountLoading ? (
              <Spin size="small" />
            ) : (
              <span>
                {((record.totalAmountInSol || 0) + (record.totalSolFees || 0)).toFixed(6)} SOL
              </span>
            ),
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
                    <p>确认要将所有X代币兑换为SOL吗？</p>
                    <Button 
                      type="primary" 
                      size="small" 
                      onClick={() => {
                        handleSwapXToSol(record);
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
                  loading={swappingPosition === record.publicKey}
                  disabled={!record.xMint}
                >
                  兑换SOL
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
