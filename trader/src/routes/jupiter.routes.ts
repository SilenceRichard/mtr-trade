import express, { Router, RequestHandler } from 'express';
import * as jupiterController from '../controllers/jupiter.controller';

const router: Router = express.Router();

// 获取Jupiter交易报价
router.get('/quote', jupiterController.getJupiterQuote as RequestHandler);

// 执行Jupiter交易
router.post('/swap', jupiterController.executeJupiterSwap as RequestHandler);

export default router; 