import express, { Router, RequestHandler } from 'express';
import * as meteoraController from '../controllers/meteora.controller';

const router: Router = express.Router();

// 初始化Meteora流动性池
router.get('/pool/:address', meteoraController.initializePool as RequestHandler);

// 获取活跃bin价格
router.get('/pool/:address/price', meteoraController.getActiveBinPrice as RequestHandler);

// 获取用户头寸
router.get('/positions', meteoraController.getUserPositions as RequestHandler);

// 创建流动性头寸
router.post('/positions', meteoraController.createPosition as RequestHandler);

// 获取创建头寸的报价
router.post('/positions/quote', meteoraController.getPositionQuote as RequestHandler);

// 获取用户在所有池中的仓位
router.get('/positions/all', meteoraController.getAllUserPositions as RequestHandler);

// 移除流动性
router.post('/positions/remove', meteoraController.removeLiquidity as RequestHandler);

// 关闭头寸
router.post('/positions/close', meteoraController.closePosition as RequestHandler);

// 领取手续费
router.post('/fee/claim', meteoraController.claimFee as RequestHandler);

export default router; 