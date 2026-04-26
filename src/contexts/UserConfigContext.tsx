import React, { createContext, useContext, useState } from 'react';

type UserRole = 'executive' | 'admin' | 'security';

interface UserConfig {
  role: UserRole;
  density: 'cozy' | 'compact';
  defaultTab: string;
  showAdvancedMetrics: boolean;
}

const ConfigContext = createContext<{
  config: UserConfig;
  setRole: (role: UserRole) => void;
} | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>('admin');

  // Smart Default Mapping
  const roleDefaults: Record<UserRole, UserConfig> = {
    executive: {
      role: 'executive',
      density: 'cozy',
      defaultTab: 'dashboard',
      showAdvancedMetrics: false
    },
    admin: {
      role: 'admin',
      density: 'compact',
      defaultTab: 'automation',
      showAdvancedMetrics: true
    },
    security: {
      role: 'security',
      density: 'compact',
      defaultTab: 'analysis',
      showAdvancedMetrics: true
    },
  };

  const setRole = (newRole: UserRole) => setRoleState(newRole);

  return (
    <ConfigContext.Provider value={{ config: roleDefaults[role], setRole }}>
      <div className={roleDefaults[role].density === 'compact' ? 'app-compact' : 'app-cozy'}>
        {children}
      </div>
    </ConfigContext.Provider>
  );
};

// Hook for easy usage
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within ConfigProvider');
  return context;
};