import { Button, Spin } from "antd";
import { Position, claimFee } from "../../services/meteoraService";
import notification from "../../utils/notification";

interface ClaimFeeStepProps {
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

const ClaimFeeStep: React.FC<ClaimFeeStepProps> = ({
  position,
  poolAddress,
  onSuccess,
  onError,
  loading,
  setLoading,
}) => {
  const handleClaimFee = async () => {
    setLoading(true);

    try {
      const result = await claimFee(poolAddress, position.publicKey);

      if (result) {
        notification.success(`手续费已领取，交易ID: ${result.txId}`);
        onSuccess(result.txId);
      } else {
        // If no result but no error, consider it successful with no fees
        notification.success("操作成功完成");
        onSuccess("processed");
      }
    } catch (error) {
      console.error("Error claiming fee:", error);
      notification.error("领取手续费失败");
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <p>点击下方按钮领取当前头寸的手续费</p>
      <Button
        type="primary"
        onClick={handleClaimFee}
        loading={loading}
        disabled={loading}
      >
        {loading ? <Spin size="small" /> : "领取手续费"}
      </Button>
    </div>
  );
};

export default ClaimFeeStep; 