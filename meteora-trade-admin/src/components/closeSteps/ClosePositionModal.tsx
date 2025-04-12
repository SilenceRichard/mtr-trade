import { useState, useEffect } from "react";
import { Modal, Steps, Button } from "antd";
import type { StepProps } from "antd";
import { 
  RemoveLiquidityStep, 
  ClaimFeeStep, 
  SwapToSolStep, 
  ClosePositionStep 
} from "./index";
import { Position, updatePosition as updatePositionService } from "../../services/meteoraService";
import { 
  CheckCircleOutlined, 
  DeleteOutlined, 
  DollarCircleOutlined, 
  SwapOutlined, 
  CloseCircleOutlined 
} from "@ant-design/icons";

// Interface for profit data
interface ProfitData {
  profit: number;
  profitRate: number;
  fees: number;
}

interface ClosePositionModalProps {
  open: boolean;
  onCancel: () => void;
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
  onComplete: () => void;
  profitData?: ProfitData | null;
}

const ClosePositionModal: React.FC<ClosePositionModalProps> = ({
  open,
  onCancel,
  position,
  poolAddress,
  onComplete,
  profitData,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  // Reset steps when modal opens or position changes
  useEffect(() => {
    if (open) {
      // Check if any steps are already completed (can be implemented later to check status)
      setCurrentStep(0);
      setCompletedSteps({});
    }
  }, [open, position.publicKey]);

  const handleStepSelect = (step: number) => {
    if (!loading) {
      setCurrentStep(step);
    }
  };

  const handleStepSuccess = (txId: string) => {
    // We don't need the txId but we'll receive it from the step components
    void txId;
    
    // Mark current step as completed
    setCompletedSteps((prev) => ({
      ...prev,
      [currentStep]: true,
    }));
  };

  const handleStepError = (error: unknown) => {
    console.error(`Error in step ${currentStep}:`, error);
    // We don't advance the step on error
    setLoading(false);
  };

  // Handle final step completion
  useEffect(() => {
    if (Object.keys(completedSteps).length === 4) {
      // All steps are complete
      // Update position data with profit information if profit data is available
      if (profitData) {
        updatePositionService(position.publicKey, {
          profit: profitData.profit,
          profit_rate: profitData.profitRate,
          fees: profitData.fees,
          close_time: new Date().toISOString(),
        });
      }
      
      setTimeout(() => {
        onComplete();
        onCancel();
      }, 1500);
    }
  }, [completedSteps, onComplete, onCancel, position.publicKey, profitData]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <RemoveLiquidityStep
            position={position}
            poolAddress={poolAddress}
            onSuccess={handleStepSuccess}
            onError={handleStepError}
            loading={loading}
            setLoading={setLoading}
          />
        );
      case 1:
        return (
          <ClaimFeeStep
            position={position}
            poolAddress={poolAddress}
            onSuccess={handleStepSuccess}
            onError={handleStepError}
            loading={loading}
            setLoading={setLoading}
          />
        );
      case 2:
        return (
          <SwapToSolStep
            position={position}
            onSuccess={handleStepSuccess}
            onError={handleStepError}
            loading={loading}
            setLoading={setLoading}
          />
        );
      case 3:
        return (
          <ClosePositionStep
            position={position}
            poolAddress={poolAddress}
            onSuccess={handleStepSuccess}
            onError={handleStepError}
            loading={loading}
            setLoading={setLoading}
          />
        );
      case 4:
        return (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />
            <h3>完成!</h3>
            <p>头寸已完全关闭，将自动关闭此窗口</p>
            
            {profitData && (
              <div style={{ marginTop: 16, textAlign: "left", background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
                <h4>位置关闭时的数据:</h4>
                <p>收益: <span style={{ color: profitData.profit >= 0 ? '#52c41a' : '#f5222d' }}>
                  {profitData.profit.toFixed(6)} {position.yTokenName || 'SOL'}
                </span></p>
                <p>收益率: <span style={{ color: profitData.profitRate >= 0 ? '#52c41a' : '#f5222d' }}>
                  {profitData.profitRate.toFixed(2)}%
                </span></p>
                <p>累计手续费: <span>
                  {profitData.fees.toFixed(6)} {position.yTokenName || 'SOL'}
                </span></p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const steps = [
    {
      title: "移除流动性",
      status: completedSteps[0] ? "finish" : currentStep === 0 ? "process" : "wait",
      icon: <DeleteOutlined />,
      disabled: loading
    },
    {
      title: "领取手续费",
      status: completedSteps[1] ? "finish" : currentStep === 1 ? "process" : "wait",
      icon: <DollarCircleOutlined />,
      disabled: loading
    },
    {
      title: "兑换到SOL",
      status: completedSteps[2] ? "finish" : currentStep === 2 ? "process" : "wait",
      icon: <SwapOutlined />,
      disabled: loading
    },
    {
      title: "关闭头寸",
      status: completedSteps[3] ? "finish" : currentStep === 3 ? "process" : "wait",
      icon: <CloseCircleOutlined />,
      disabled: loading
    },
  ] as StepProps[];

  const allStepsCompleted = Object.keys(completedSteps).length === 4;

  return (
    <Modal
      title="关闭头寸"
      open={open}
      onCancel={onCancel}
      width={600}
      footer={null}
      maskClosable={false}
      closable={!loading && !allStepsCompleted}
    >
      <Steps
        current={currentStep}
        onChange={handleStepSelect}
        items={steps}
        style={{ marginBottom: 20 }}
      />

      {renderStepContent()}

      {!allStepsCompleted && !loading && (
        <div style={{ marginTop: 20, textAlign: "right" }}>
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default ClosePositionModal; 