import winston from "winston";
import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom timestamp format for UTC+8
const utcPlusEightTimestamp = winston.format((info) => {
  const date = new Date();
  // Adjust to UTC+8
  date.setHours(date.getHours() + 8);
  info.timestamp = date.toISOString();
  return info;
});

// Setup Winston logger
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    utcPlusEightTimestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'pools-monitoring.log') }),
    // 专门用于错误日志的传输
    new winston.transports.File({ 
      filename: path.join(logsDir, 'pools-monitoring-error.log'),
      level: 'error' 
    }),
  ],
});

// 设置交易日志记录器
export const tradingLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    utcPlusEightTimestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'trading-log.log') }),
  ],
}); 