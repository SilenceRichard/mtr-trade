import {
  MonitoringStatus,
  MonitoringResponse,
} from "./types";
import { runPoolsCheck } from "./pool-processing";
import { 
  stopPositionMonitoring as stopPosition, 
  stopAllPositionMonitoring as stopAllPositions,
  getPositionMonitoringCount 
} from "./position-monitoring";
import { MONITORING_INTERVAL_MS } from "./constants";

// Configure monitoring variables
let monitoringInterval: NodeJS.Timeout | null = null;
let isMonitoringActive = false; // Default to active

/**
 * Monitoring service functions
 */
export const monitoringService = {
  /**
   * Start the monitoring service
   */
  start: () => {
    if (monitoringInterval) return; // Already running

    // Set up interval for continuous monitoring
    monitoringInterval = setInterval(() => runPoolsCheck(isMonitoringActive), MONITORING_INTERVAL_MS);

    console.log("Automatic monitoring started");
  },

  /**
   * Stop the monitoring service
   */
  stop: () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
      console.log("Monitoring stopped");
    }
    
    // Also stop all position monitoring
    stopAllPositions();
  },

  /**
   * Get the current status of the monitoring service
   */
  getStatus: (): MonitoringStatus => {
    return {
      isActive: isMonitoringActive,
      isRunning: monitoringInterval !== null,
      positionMonitoringCount: getPositionMonitoringCount(),
    };
  },

  /**
   * Initialize monitoring on application startup
   */
  initialize: () => {
    console.log("Initializing monitoring system...");

    if (isMonitoringActive) {
      monitoringService.start();
    } else {
      console.log("Monitoring system initialized but not active");
    }
  },
  
  /**
   * Stop monitoring a specific position
   */
  stopPositionMonitoring: (positionId: string) => {
    stopPosition(positionId);
  },
};

/**
 * Toggle the monitoring status
 */
export const toggleMonitoring = async (
  active: boolean
): Promise<MonitoringResponse> => {
  try {
    if (active === isMonitoringActive) {
      return {
        success: true,
        monitoring: isMonitoringActive,
        message: `Monitoring already ${
          isMonitoringActive ? "active" : "inactive"
        }`,
      };
    }

    isMonitoringActive = active;

    if (isMonitoringActive) {
      monitoringService.start();

      return {
        success: true,
        monitoring: true,
        message: "Monitoring started successfully",
      };
    } else {
      monitoringService.stop();

      return {
        success: true,
        monitoring: false,
        message: "Monitoring stopped successfully",
      };
    }
  } catch (error) {
    console.error("Error toggling monitoring:", error);
    throw error;
  }
};

/**
 * Get current monitoring status
 */
export const getMonitoringStatus = (): MonitoringResponse => {
  return {
    success: true,
    monitoring: isMonitoringActive,
  };
};
