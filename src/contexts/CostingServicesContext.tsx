import React, { createContext, useContext, useMemo } from 'react';
import { featureFlags } from '../config/featureFlags';
import { CostingServicesBundle, createCostingServices } from '../services/costing/factory';

const CostingServicesContext = createContext<CostingServicesBundle | null>(null);

interface CostingServicesProviderProps {
  children: React.ReactNode;
}

export const CostingServicesProvider: React.FC<CostingServicesProviderProps> = ({ children }) => {
  if (!featureFlags.costingModule) {
    return <>{children}</>;
  }

  const services = useMemo(() => createCostingServices(), []);

  return (
    <CostingServicesContext.Provider value={services}>
      {children}
    </CostingServicesContext.Provider>
  );
};

export const useCostingServices = (): CostingServicesBundle => {
  const context = useContext(CostingServicesContext);
  if (context === null) {
    throw new Error('Costing services are not available. Ensure CostingServicesProvider is mounted and the feature flag is enabled.');
  }
  return context;
};
