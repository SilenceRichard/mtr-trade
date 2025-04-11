import { Typography, Button } from "antd";
import { PoolItem } from "../../services/poolService";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  
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
            // Close the modal and navigate to positions page
            handleOk();
            navigate('/positions');
          }}
        >
          View Positions
        </Button>
      </div>
    </div>
  );
};

export default FinishStep; 