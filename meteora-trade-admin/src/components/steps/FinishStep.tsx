import { Typography, Button } from "antd";
import { PoolItem } from "../../services/poolService";

const { Title, Text } = Typography;

export interface FinishStepProps {
  selectedPool?: PoolItem;
  solAmount: number | null;
  handleOk: () => void;
}

const FinishStep = ({
  selectedPool,
  solAmount,
  handleOk
}: FinishStepProps) => {
  return (
    <div>
      <Title level={5}>Position Created Successfully</Title>
      <div>
        <Text>Pool: {selectedPool?.poolName}</Text>
        <br />
        <Text>Position Amount: {solAmount} SOL</Text>
        <br />
        <Text>Creation Time: {new Date().toLocaleString()}</Text>
      </div>
      <div style={{ marginTop: 16 }}>
        <Button 
          type="primary" 
          onClick={() => {
            // Just transition to positions view without closing modal directly
            handleOk();
          }}
        >
          View Positions
        </Button>
      </div>
    </div>
  );
};

export default FinishStep; 