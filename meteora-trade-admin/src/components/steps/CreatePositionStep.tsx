import { Typography, Button } from "antd";
import { PoolItem } from "../../services/poolService";

const { Title, Text } = Typography;

export interface CreatePositionStepProps {
  selectedPool?: PoolItem;
  solAmount: number | null;
  setCurrentStep: (step: number) => void;
  currentStep: number;
  setIsExecuting: (executing: boolean) => void;
}

const CreatePositionStep = ({
  selectedPool,
  solAmount,
  setCurrentStep,
  currentStep,
  setIsExecuting
}: CreatePositionStepProps) => {
  return (
    <div>
      <Title level={5}>Creating Position</Title>
      <div>
        <Text>Pool: {selectedPool?.poolName}</Text>
        <br />
        <Text>Position Amount: {solAmount} SOL</Text>
        <br />
        <Text>Bin Step: {selectedPool?.binStep}</Text>
        <br />
        <Text>Status: Processing...</Text>
      </div>
      <div style={{ marginTop: 16 }}>
        <Button 
          type="primary" 
          onClick={() => setCurrentStep(currentStep + 1)}
        >
          Next Step (Simulating success)
        </Button>
        <Button 
          style={{ marginLeft: 8 }}
          onClick={() => setIsExecuting(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default CreatePositionStep; 