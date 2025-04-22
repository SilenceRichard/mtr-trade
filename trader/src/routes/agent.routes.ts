import express, { Request, Response } from 'express';
import { toggleMonitoring, getMonitoringStatus } from '../controllers/agent.controller';

const router = express.Router();

// Toggle monitoring status
router.post('/toggle-monitoring', async (req: Request, res: Response) => {
  try {
    const { active } = req.body;
    const result = await toggleMonitoring(active);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error toggling monitoring:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle monitoring',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get current monitoring status
router.get('/monitoring-status', (req: Request, res: Response) => {
  const status = getMonitoringStatus();
  res.status(200).json(status);
});

export default router; 