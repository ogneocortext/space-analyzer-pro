// Custom hook for backend health checking
import { useState, useCallback, useEffect } from "react";
import { ConfigService } from "../services/ConfigService";

export const useBackendHealth = () => {
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkBackend = useCallback(async () => {
    try {
      const response = await fetch(`${ConfigService.API_BASE_URL}/health`);
      const isOnline = response.ok;
      setIsBackendOnline(isOnline);
      setLastChecked(new Date());
      return isOnline;
    } catch (e) {
      setIsBackendOnline(false);
      setLastChecked(new Date());
      return false;
    }
  }, []);

  // Check backend on mount and set up interval (reduced from 5s to 30s for better performance)
  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  return {
    isBackendOnline,
    lastChecked,
    checkBackend,
  };
};
