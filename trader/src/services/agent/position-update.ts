import { logger } from "./logger";
import { positionRepository } from "../../repositories";
import { withTransaction } from "../../db/transaction";
import { Position } from "../../models/position.model";


// 更新头寸参数接口
export interface UpdatePositionParams {
  profit?: number;
  profit_rate?: number;
  fees?: number;
  duration_seconds?: number;
  close_time?: Date | string; // when position was closed
  status?: string;
  error_message?: string;
}

// 头寸返回结果接口，与数据库模型对齐
export interface UpdatePositionResult {
  id: number;
  wallet_address: string;
  pool_address: string;
  pool_name: string;
  position_id: string;
  open_value: number;
  profit: number;
  profit_rate: number;
  fees: number;
  open_time: Date;
  close_time?: Date;
  duration_seconds: number;
  status?: string;
  error_message?: string;
  token_x_mint?: string;
  token_x_amount?: string;
  swap_amount?: string;
}

/**
 * 更新头寸信息
 * @param positionId 头寸ID
 * @param updates 需要更新的字段
 * @returns 更新后的头寸信息或null（如果更新失败）
 */
export const updatePosition = async (
  positionId: string,
  updates: UpdatePositionParams
): Promise<UpdatePositionResult | null> => {
  try {
    // 验证参数是否有效
    if (!positionId) {
      logger.error({
        message: "头寸更新失败：缺少头寸ID",
      });
      return null;
    }
    
    // 检查更新内容是否有效
    if (!updates || Object.keys(updates).length === 0) {
      logger.error({
        message: "头寸更新失败：未提供更新数据",
        positionId,
      });
      return null;
    }

    logger.info({
      message: "准备更新头寸信息",
      positionId,
      updates,
    });

    // 构建符合Position类型的更新对象
    const processedUpdates: Partial<Position> = {};
    
    // 复制基本字段
    if (updates.profit !== undefined) processedUpdates.profit = updates.profit;
    if (updates.profit_rate !== undefined) processedUpdates.profit_rate = updates.profit_rate;
    if (updates.fees !== undefined) processedUpdates.fees = updates.fees;
    
    // 处理日期字段
    if (updates.close_time) {
      processedUpdates.close_time = typeof updates.close_time === 'string' 
        ? new Date(updates.close_time) 
        : updates.close_time;
    }

    // 使用事务更新头寸，确保数据一致性
    let updatedPosition: Position | null = null;
    
    try {
      await withTransaction(async (client) => {
        // 使用存储库更新头寸
        updatedPosition = await positionRepository.updatePositionWithClient(positionId, processedUpdates, client);
        
        if (!updatedPosition) {
          throw new Error(`Position with ID ${positionId} not found`);
        }
        
        logger.info({
          message: "数据库更新头寸成功",
          positionId,
          updatedPosition,
        });
      });
    } catch (dbError) {
      logger.error({
        message: "数据库事务错误",
        positionId,
        error: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      throw dbError;
    }

    if (updatedPosition) {
      logger.info({
        message: "头寸更新成功",
        positionId,
        updatedPosition,
      });
      return updatedPosition as UpdatePositionResult;
    } else {
      logger.error({
        message: "头寸更新失败",
        positionId,
        error: "头寸不存在或更新失败",
      });
      return null;
    }
  } catch (error) {
    logger.error({
      message: "头寸更新错误",
      positionId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}; 