import { Keypair } from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "dotenv";

config();

const SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * 获取 Solana 钱包 Keypair
 */
export async function getWallet(): Promise<Keypair> {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Private key not found in environment variables");
    }

    // 从 base64 格式的私钥创建 Keypair
    const decodedKey = Buffer.from(privateKey, 'base64');
    const keypair = Keypair.fromSecretKey(decodedKey);
    return keypair;
  } catch (error) {
    console.error("获取钱包失败:", error);
    throw error;
  }
}

/**
 * 获取钱包中代币余额
 */
export const getWalletBalance = async ({
  mintAddress,
  connection,
  publicKey,
}: {
  mintAddress: string;
  connection: Connection;
  publicKey: PublicKey;
}): Promise<number> => {
  // 判断是否为 SOL 代币（即原生代币）
  const isSol = mintAddress === SOL_MINT;

  if (isSol) {
    // 如果是原生 SOL，使用 getBalance 查询
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9; // 将 Lamports 转换为 SOL
  } else {
    // 如果是 SPL Token，使用 getTokenAccountsByOwner 查询
    const tokenMint = new PublicKey(mintAddress);

    const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
      mint: tokenMint,
    });

    if (tokenAccounts.value.length === 0) {
      return 0;
    }

    const tokenAccount = tokenAccounts.value[0];
    const balance = await connection.getTokenAccountBalance(
      tokenAccount.pubkey
    );

    return balance.value.uiAmount || 0;
  }
}; 