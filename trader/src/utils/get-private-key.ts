import { Keypair } from "@solana/web3.js";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { config } from "dotenv";

config({
  path: "../../.env"
});

export function getPrivateKeyFromMnemonic(): string {
  const mnemonic = process.env.MNEMONIC;
  const walletIndex = process.env.WALLET_INDEX;
  if (!mnemonic || !walletIndex) {
    throw new Error(
      "MNEMONIC or WALLET_INDEX not found in environment variables"
    );
  }
  try {
    // 验证助记词
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error("Invalid mnemonic");
    }

    // 使用 BIP44 标准的路径
    const path = `m/44'/501'/${walletIndex}'/0'`;

    // 从助记词生成种子
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    // 从种子导出密钥对
    const derivedKey = derivePath(path, seed.toString("hex")).key;

    // 创建 Solana 密钥对
    const keypair = Keypair.fromSeed(derivedKey);
    console.log("keypair", Buffer.from(keypair.secretKey).toString("base64"));
    console.log("get:", Buffer.from(keypair.secretKey).toString("base64"));
    // 返回私钥的 Base58 格式
    return Buffer.from(keypair.secretKey).toString("base64");
  } catch (error) {
    console.error("获取私钥失败:", error);
    throw error;
  }
}

getPrivateKeyFromMnemonic();
