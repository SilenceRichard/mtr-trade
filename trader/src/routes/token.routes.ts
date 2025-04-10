import express, { Router, RequestHandler } from 'express';
import * as tokenController from '../controllers/token.controller';

const router: Router = express.Router();

// 获取代币信息
router.get('/info', tokenController.getTokenInformation as RequestHandler);

// 获取池子名称
router.get('/poolname', tokenController.getTokenPairName as RequestHandler);

export default router; 