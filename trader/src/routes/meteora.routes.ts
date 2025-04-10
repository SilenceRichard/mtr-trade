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
router.post('/positions/create', meteoraController.createPosition as RequestHandler);

// 获取用户在所有池中的仓位
router.get('/positions/all', meteoraController.getAllUserPositions as RequestHandler);

export default router; 