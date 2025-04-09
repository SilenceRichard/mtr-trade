import { Connection, PublicKey } from '@solana/web3.js';

/**
 * 获取代币的小数位数
 */
export const fetchDecimal = async (
  connection: Connection,
  mintAddress: string
): Promise<number> => {
  try {
    const res = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
    if (!res.value) {
      return 0;
    }
    return (res.value.data as any).parsed.info.decimals;
  } catch (error) {
    console.error('Error fetching token decimals:', error);
    return 0;
  }
}; 