import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CostingLayout from '../../layouts/CostingLayout';
import CostingBasePage from './CostingBasePage';
import CostingProceduresPage from './CostingProceduresPage';
import CostingResultsPage from './CostingResultsPage';

const CostingRouter: React.FC = () => (
  <CostingLayout>
    <Routes>
      <Route path="" element={<Navigate to="base" replace />} />
      <Route path="base" element={<CostingBasePage />} />
      <Route path="procedures" element={<CostingProceduresPage />} />
      <Route path="results" element={<CostingResultsPage />} />
      <Route path="*" element={<Navigate to="base" replace />} />
    </Routes>
  </CostingLayout>
);

export default CostingRouter;
