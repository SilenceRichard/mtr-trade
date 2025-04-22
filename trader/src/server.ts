import express from 'express';
import cors from 'cors';
import walletRoutes from './routes/wallet.routes';
import jupiterRoutes from './routes/jupiter.routes';
import meteoraRoutes from './routes/meteora.routes';
import tokenRoutes from './routes/token.routes';
import agentRoutes from './routes/agent.routes';
// Initialize monitoring system on import
import { monitoringService } from './services/agent';
const app = express();
const port = process.env.PORT || 4001;
console.log("process.env.TOKLEO_SCRAPER_URL", process.env.TOKLEO_SCRAPER_URL);
// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/wallet', walletRoutes);
app.use('/api/jupiter', jupiterRoutes);
app.use('/api/meteora', meteoraRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/agent', agentRoutes);

monitoringService.initialize(); 
// Initialize database
// (async () => {
//   try {
//     await runMigrations();
//   } catch (error) {
//     console.error('Failed to initialize database:', error);
//   }
// })();

// Start server
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 