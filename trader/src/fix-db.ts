import { fixTableStructure } from './db/migration';
import { config } from 'dotenv';

// 加载环境变量
config();

/**
 * 修复数据库结构的独立脚本
 */
async function main() {
  try {
    console.log('开始修复数据库表结构...');
    await fixTableStructure();
    console.log('数据库表结构修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('修复数据库表结构时出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main(); 