import React from 'react';
import { CostingBaselineProvider } from '../contexts/CostingBaselineContext';

const CostingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <CostingBaselineProvider>
      <div className="space-y-6">
        {children}
      </div>
    </CostingBaselineProvider>
  );
};

export default CostingLayout;



