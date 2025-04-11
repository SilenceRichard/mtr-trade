import { toast } from 'sonner';

// Define default toast options
const DEFAULT_DURATION = 3000; // milliseconds

const notification = {
  success: (message: string, description?: string) => {
    toast.success(description ? `${message}: ${description}` : message, {
      duration: DEFAULT_DURATION,
    });
  },
  error: (message: string, description?: string) => {
    toast.error(description ? `${message}: ${description}` : message, {
      duration: DEFAULT_DURATION,
    });
  },
  info: (message: string, description?: string) => {
    toast.info(description ? `${message}: ${description}` : message, {
      duration: DEFAULT_DURATION,
    });
  },
  warning: (message: string, description?: string) => {
    toast.warning(description ? `${message}: ${description}` : message, {
      duration: DEFAULT_DURATION,
    });
  },
};

export default notification; 