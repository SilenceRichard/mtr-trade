import { Button, Spin } from "antd";
import { Position, closePosition, updatePosition } from "../../services/meteoraService";
import notification from "../../utils/notification";

interface ClosePositionStepProps {
  position: Position & {
    xDecimals: number;
    yDecimals: number;
    xMint?: string;
    yMint?: string;
    xTokenName?: string;
    yTokenName?: string;
    totalSolFees?: number;
    totalAmountInSol?: number;
  };
  poolAddress: string;
  onSuccess: (txId: string) => void;
  onError: (error: unknown) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const ClosePositionStep: React.FC<ClosePositionStepProps> = ({
  position,
  poolAddress,
  onSuccess,
  onError,
  loading,
  setLoading,
}) => {
  const handleClosePosition = async () => {
    setLoading(true);

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
        onSuccess(result.txId);
      }
    } catch (error) {
      console.error("Error closing position:", error);
      notification.error("关闭头寸失败");
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <p>点击下方按钮关闭当前头寸（完成后将无法再次添加流动性）</p>
      <Button
        type="primary"
        onClick={handleClosePosition}
        loading={loading}
        disabled={loading}
      >
        {loading ? <Spin size="small" /> : "关闭头寸"}
      </Button>
    </div>
  );
};

export default ClosePositionStep; 