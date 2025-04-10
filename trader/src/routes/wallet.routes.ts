import express, { Router, RequestHandler } from 'express';
import * as walletController from '../controllers/wallet.controller';

const router: Router = express.Router();

// 获取钱包公钥
router.get('/', walletController.getWalletPublicKey as RequestHandler);

// 获取钱包余额
router.get('/balance', walletController.getBalance as RequestHandler);

// 获取代币精度
router.get('/decimals', walletController.getTokenDecimals as RequestHandler);

export default router; 