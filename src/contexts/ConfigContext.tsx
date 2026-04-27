import React, { createContext, useContext, useState, ReactNode } from "react";

interface Config {
  theme: "light" | "dark";
  language: string;
  apiEndpoint: string;
  enableAnalytics: boolean;
  enablePerformanceMonitoring: boolean;
}

interface ConfigContextType {
  config: Config;
  updateConfig: (updates: Partial<Config>) => void;
  resetConfig: () => void;
}

const defaultConfig: Config = {
  theme: "light",
  language: "en",
  apiEndpoint: "http://localhost:8082/api",
  enableAnalytics: true,
  enablePerformanceMonitoring: true,
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<Config>(defaultConfig);

  const updateConfig = (updates: Partial<Config>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
  };

  const value = {
    config,
    updateConfig,
    resetConfig,
  };

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};

export default ConfigContext;
