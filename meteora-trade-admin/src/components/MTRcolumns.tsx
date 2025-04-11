import { ProColumns } from "@ant-design/pro-components";
import { PoolItem } from "../services";
import { Button, Tag, Tooltip } from "antd";

export const columns: (
  handleCreatePosition: (record: PoolItem) => void,
  showModal: () => void
) => ProColumns<PoolItem>[] = (handleCreatePosition, showModal) => [
  {
    title: "Pool Name",
    dataIndex: "poolName",
    valueType: "text",
    width: 140,
    render: (_, record) => (
      <a href={record.meteoraLink} target="_blank" rel="noopener noreferrer">
        {record.poolName}
      </a>
    ),
  },
  {
    title: "Age",
    dataIndex: "age",
    width: 100,
  },
  {
    title: "Bin Step",
    dataIndex: "binStep",
    valueType: "text",
    width: 100,
    sorter: (a, b) => a.binStep - b.binStep,
  },
  {
    title: "Base Fee",
    dataIndex: "baseFee",
    valueType: "text",
    width: 100,
    sorter: (a, b) => a.baseFee - b.baseFee,
    render: (_, record) => `${record.baseFee}%`,
  },
  {
    title: "Fee Ratio (24h)",
    dataIndex: "feeRatio24h",
    valueType: "text",
    sorter: (a, b) => parseFloat(a.feeRatio24h) - parseFloat(b.feeRatio24h),
  },
  {
    title: "Hourly Rate",
    dataIndex: "hourlyRate30m",
    valueType: "text",
    width: 120,
    sorter: (a, b) => parseFloat(a.hourlyRate30m) - parseFloat(b.hourlyRate30m),
    render: (_, record) => (
      <Tooltip
        title={`24h: ${record.hourlyRate24h}, 1h: ${record.hourlyRate1h}`}
      >
        {record.hourlyRate30m}
      </Tooltip>
    ),
  },
  {
    title: "Change",
    dataIndex: "change30m",
    valueType: "text",
    width: 100,
    sorter: (a, b) => {
      // Parse the percentage values correctly, preserving the sign
      const valueA = parseFloat(a.change30m.replace("%", ""));
      const valueB = parseFloat(b.change30m.replace("%", ""));
      return valueB - valueA; // Descending order (high to low)
    },
    defaultSortOrder: "ascend",
    render: (_, record) => (
      <Tooltip title={`1h Change: ${record.change1h}`}>
        <Tag color={record.change30m.includes("+") ? "green" : "red"}>
          {record.change30m}
        </Tag>
      </Tooltip>
    ),
  },
  {
    title: "Volume (24h)",
    dataIndex: "volume24h",
    valueType: "text",
    sorter: (a, b) =>
      parseFloat(a.volume24h.replace(/[^0-9.-]+/g, "")) -
      parseFloat(b.volume24h.replace(/[^0-9.-]+/g, "")),
  },
  {
    title: "Liquidity",
    dataIndex: "liquidity",
    valueType: "text",
    sorter: (a, b) =>
      parseFloat(a.liquidity.replace(/[^0-9.-]+/g, "")) -
      parseFloat(b.liquidity.replace(/[^0-9.-]+/g, "")),
  },
  {
    title: "Links",
    valueType: "option",
    width: 120,
    render: (_, record) => [
      <a
        key="gmgn"
        href={record.gmgnLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        GMGN
      </a>,
      <a
        key="gecko"
        href={record.geckoTerminalLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        Gecko
      </a>,
    ],
  },
  {
    title: "Actions",
    valueType: "option",
    width: 150,
    render: (_, record) => [
      <Button
        key="createPosition"
        type="primary"
        onClick={() => {
          handleCreatePosition(record);
          showModal();
        }}
      >
        Create Position
      </Button>,
    ],
  },
];
