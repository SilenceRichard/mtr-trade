import { Table, Spin, Button } from "antd";
import { useEffect, useState } from "react";
import { Position } from "../services/meteoraService";
import notification from "../utils/notification";
import ClosePositionModal from "./closeSteps/ClosePositionModal";
import { getJupiterQuote } from "../services/jupiterService";

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

// Interface for profit data - matches the one in ClosePositionModal
interface ProfitData {
  profit: number;
  profitRate: number;
  fees: number;
}

const PositionTable = ({
  positions,
  poolAddress,
}: PositionTableProps) => {
  const [positionsWithFees, setPositionsWithFees] = useState<
    PositionWithSolFees[]
  >([]);
  
  // New state for close position modal
  const [closeModalVisible, setCloseModalVisible] = useState<boolean>(false);
  const [selectedClosePosition, setSelectedClosePosition] = useState<PositionWithSolFees | null>(null);
  // New state for storing profit information
  const [closingProfitData, setClosingProfitData] = useState<ProfitData | null>(null);

  // Keep the useEffect for calculating position values
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
      // Updated implementation to include X token value using Jupiter API
      const updatedPositions = await Promise.all(
        positions.map(async (position) => {
          try {
            // Calculate Y amount (already in SOL/native token)
            const yAmount = parseFloat(position.totalYAmount) / Math.pow(10, position.yDecimals);
            
            // Calculate fees
            const feeSol = parseFloat(position.feeYExcludeTransferFee) / Math.pow(10, position.yDecimals);
            
            // Get X amount in SOL if x token is not SOL and has a mint address
            let xValueInSol = 0;
            if (position.xMint && position.yMint && position.xMint !== position.yMint) {
              const xAmount = parseFloat(position.totalXAmount);
              if (xAmount > 0) {
                // Call Jupiter API to get quote for X token to SOL conversion
                const quoteResponse = await getJupiterQuote({
                  inputMint: position.xMint,
                  outputMint: position.yMint,
                  amount: (xAmount).toString(),
                });
                
                if (quoteResponse) {
                  xValueInSol = parseFloat(quoteResponse.outAmount) / Math.pow(10, position.yDecimals);
                }
              }
            }
            
            // Total amount includes both Y amount and X amount converted to SOL
            const totalAmount = yAmount + xValueInSol;
            
            return {
              ...position,
              totalSolFees: feeSol,
              totalAmountInSol: totalAmount,
              feesLoading: false,
              amountLoading: false,
            };
          } catch (error) {
            console.error("Error calculating values:", error);
            return {
              ...position,
              totalSolFees: 0,
              totalAmountInSol: 0,
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
  
  // Function for showing the close position modal
  const showClosePositionModal = (position: PositionWithSolFees) => {
    setSelectedClosePosition(position);
    
    // Calculate and store profit data
    const totalValue = (position.totalAmountInSol || 0) + (position.totalSolFees || 0);
    const openValue = position.openValue || 0;
    const profit = totalValue - openValue;
    const profitRate = openValue === 0 ? 0 : ((totalValue - openValue) / openValue) * 100;
    
    setClosingProfitData({
      profit,
      profitRate,
      fees: position.totalSolFees || 0
    });
    
    setCloseModalVisible(true);
  };

  // Handler for when the position closing is complete
  const handleCloseComplete = () => {
    // Refresh data or handle completion
    notification.success("头寸关闭流程已完成");
  };

  return (
    <>
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
                <Button
                  type="primary"
                  danger
                  onClick={() => showClosePositionModal(record)}
                >
                  一键关闭
                </Button>
              </div>
            ),
          },
        ]}
        rowKey="publicKey"
        pagination={false}
        loading={false}
      />

      {/* Add the close position modal */}
      {selectedClosePosition && (
        <ClosePositionModal
          open={closeModalVisible}
          onCancel={() => setCloseModalVisible(false)}
          position={selectedClosePosition}
          poolAddress={poolAddress}
          onComplete={handleCloseComplete}
          profitData={closingProfitData}
        />
      )}
    </>
  );
};

export default PositionTable;
