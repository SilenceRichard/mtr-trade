import express from 'express';
import cors from 'cors';
import walletRoutes from './routes/wallet.routes';
import jupiterRoutes from './routes/jupiter.routes';
import meteoraRoutes from './routes/meteora.routes';

const app = express();
const port = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/wallet', walletRoutes);
app.use('/api/jupiter', jupiterRoutes);
app.use('/api/meteora', meteoraRoutes);

// Start server
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 