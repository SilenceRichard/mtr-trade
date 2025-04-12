import { Button, Spin } from "antd";
import { Position, removeLiquidity } from "../../services/meteoraService";
import notification from "../../utils/notification";
import { useEffect } from "react";

interface RemoveLiquidityStepProps {
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

const RemoveLiquidityStep: React.FC<RemoveLiquidityStepProps> = ({
  position,
  poolAddress,
  onSuccess,
  onError,
  loading,
  setLoading,
}) => {
  // Check if both x and y amounts are 0, and auto-skip if true
  useEffect(() => {
    if (Number(position.totalXAmount) === 0 && Number(position.totalYAmount) === 0) {
      // Skip this step since there's no liquidity to remove
      onSuccess("");
    }
  }, [position, onSuccess]);

  const handleRemoveLiquidity = async () => {
    setLoading(true);

    try {
      const result = await removeLiquidity(
        poolAddress,
        position.publicKey,
        position.lowerBinId,
        position.upperBinId
      );

      if (result) {
        notification.success(`流动性已移除，交易ID: ${result.txId}`);
        onSuccess(result.txId);
      }
    } catch (error) {
      console.error("Error removing liquidity:", error);
      notification.error("移除流动性失败");
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  // If there's no liquidity, don't render the step
  if (position.totalXAmount === "0" && position.totalYAmount === "0") {
    return null;
  }

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <p>点击下方按钮移除当前头寸的所有流动性</p>
      <Button
        type="primary"
        onClick={handleRemoveLiquidity}
        loading={loading}
        disabled={loading}
      >
        {loading ? <Spin size="small" /> : "移除流动性"}
      </Button>
    </div>
  );
};

export default RemoveLiquidityStep; 