import { Table, Spin, Button, message } from "antd";
import { useEffect, useState } from "react";
import { Position, removeLiquidity } from "../services/meteoraService";
import { getJupiterQuote } from "../services/jupiterService";

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
  loading,
  poolAddress,
}: PositionTableProps) => {
  const [positionsWithFees, setPositionsWithFees] = useState<
    PositionWithSolFees[]
  >([]);
  const [removingPosition, setRemovingPosition] = useState<string | null>(null);

  useEffect(() => {
    // Initialize with loading state
    setPositionsWithFees(
      positions.map((position) => ({
        ...position,
        feesLoading: true,
        amountLoading: true,
      }))
    );

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

    if (positions.length > 0) {
      calculateValues();
    } else {
      setPositionsWithFees([]);
    }
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
        message.success(`流动性已移除，交易ID: ${result.txId}`);
      }
    } catch (error) {
      console.error("Error removing liquidity:", error);
      message.error("移除流动性失败");
    } finally {
      setRemovingPosition(null);
    }
  };

  const confirmRemove = (position: Position) => {
    handleRemoveLiquidity(position);
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
          title: "Last Updated",
          dataIndex: "lastUpdatedAt",
          key: "lastUpdatedAt",
          render: (timestamp: string) =>
            new Date(parseInt(timestamp) * 1000).toLocaleString(),
        },
        {
          title: "操作",
          key: "action",
          render: (_: unknown, record: Position) => (
            <Button
              type="primary"
              loading={removingPosition === record.publicKey}
              onClick={() => confirmRemove(record)}
            >
              移除流动性
            </Button>
          ),
        },
      ]}
      rowKey="publicKey"
      pagination={false}
      loading={loading}
    />
  );
};

export default PositionTable;
