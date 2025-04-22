import { toggleMonitoring as toggleMonitoringService, getMonitoringStatus as getMonitoringStatusService } from '../services/agent.service';

/**
 * Controller function to toggle monitoring status
 */
export const toggleMonitoring = async (active: boolean) => {
  return await toggleMonitoringService(active);
};

/**
 * Controller function to get monitoring status
 */
export const getMonitoringStatus = () => {
  return getMonitoringStatusService();
};