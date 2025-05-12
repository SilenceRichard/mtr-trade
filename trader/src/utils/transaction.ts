import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  Signer,
  Transaction,
} from "@solana/web3.js";

export const buildOptimalTransaction = async (params: {
  transaction: Transaction;
  connection: Connection;
  publicKey: PublicKey;
  signers: Signer[];
  cuBufferMultiplier?: number;
  microLamports?: number;
}) => {
  const { 
    transaction, 
    connection, 
    publicKey, 
    signers, 
    cuBufferMultiplier = 1.2, 
    microLamports = 5000 
  } = params;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  // 1. 清理掉旧的 ComputeBudget 指令
  const filteredInstructions = transaction.instructions.filter(
    (ix) => !ix.programId.equals(ComputeBudgetProgram.programId)
  );

  // 2. 先用旧指令做一次 simulate
  const simMessageV0 = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: blockhash,
    instructions: filteredInstructions,
  }).compileToV0Message();

  const simTxV0 = new VersionedTransaction(simMessageV0);

  simTxV0.sign(signers); // 模拟前签名

  const simResult = await connection.simulateTransaction(simTxV0, {
    sigVerify: true,
  });

  if (simResult.value.err) {
    console.error("Simulation failed:", simResult.value.err);
    throw new Error(`Simulation Error: ${JSON.stringify(simResult.value.err)}`);
  }

  const consumedCU = simResult.value.unitsConsumed || 200_000;
  const optimalUnits = Math.min(Math.ceil(consumedCU * cuBufferMultiplier), 1_400_000);

  // 3. 构建最终含有 ComputeBudget 的指令
  const newComputeLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: optimalUnits,
  });
  const newComputePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports,
  });

  const finalInstructions = [
    newComputeLimitIx,
    newComputePriceIx,
    ...filteredInstructions,
  ];

  const finalTxMessage = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: blockhash,
    instructions: finalInstructions,
  }).compileToV0Message();

  const opTx = new VersionedTransaction(finalTxMessage);

  return { opTx, blockhash, lastValidBlockHeight, optimalUnits };
}; 