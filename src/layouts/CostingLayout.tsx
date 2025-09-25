import React from 'react';
import { CostingSnapshotProvider } from '../contexts/CostingSnapshotContext';

const CostingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <CostingSnapshotProvider>
      <div className="space-y-6">
        {children}
      </div>
    </CostingSnapshotProvider>
  );
};

export default CostingLayout;



