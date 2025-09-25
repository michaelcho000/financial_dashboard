import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BaselineSummary,
  BaselineDetail,
  BaselineCreatePayload,
  BaselineUpdatePayload,
} from '../services/costing/types';
import { useCostingServices } from './CostingServicesContext';

interface CostingBaselineContextValue {
  baselines: BaselineSummary[];
  selectedBaselineId: string | null;
  selectedBaseline: BaselineDetail | null;
  loading: boolean;
  error: string | null;
  refreshBaselines: () => Promise<void>;
  selectBaseline: (id: string | null) => void;
  createBaseline: (payload: BaselineCreatePayload) => Promise<BaselineDetail>;
  updateBaseline: (id: string, payload: BaselineUpdatePayload) => Promise<BaselineDetail>;
}

const CostingBaselineContext = createContext<CostingBaselineContextValue | null>(null);

interface CostingBaselineProviderProps {
  children: React.ReactNode;
}

export const CostingBaselineProvider: React.FC<CostingBaselineProviderProps> = ({ children }) => {
  const services = useCostingServices();
  const [baselines, setBaselines] = useState<BaselineSummary[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(null);
  const [selectedBaseline, setSelectedBaseline] = useState<BaselineDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBaselines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await services.baselineService.listBaselines();
      setBaselines(list);
      if (list.length === 0) {
        setSelectedBaselineId(null);
        setSelectedBaseline(null);
        return;
      }
      const current = list.find(item => item.id === selectedBaselineId) ?? list[0];
      setSelectedBaselineId(current.id);
    } catch (err) {
      console.error('[Costing] Failed to load baselines', err);
      setError(err instanceof Error ? err.message : '기준월을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [services.baselineService, selectedBaselineId]);

  useEffect(() => {
    refreshBaselines();
  }, [refreshBaselines]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedBaselineId) {
        setSelectedBaseline(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const detail = await services.baselineService.getBaseline(selectedBaselineId);
        setSelectedBaseline(detail);
      } catch (err) {
        console.error('[Costing] Failed to load baseline detail', err);
        setError(err instanceof Error ? err.message : '기준월 상세 정보를 불러오지 못했습니다.');
        setSelectedBaseline(null);
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [selectedBaselineId, services.baselineService]);

  const selectBaseline = useCallback((id: string | null) => {
    setSelectedBaselineId(id);
  }, []);

  const createBaseline = useCallback(async (payload: BaselineCreatePayload) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await services.baselineService.createBaseline(payload);
      await refreshBaselines();
      setSelectedBaselineId(detail.id);
      return detail;
    } catch (err) {
      console.error('[Costing] Failed to create baseline', err);
      setError(err instanceof Error ? err.message : '기준월을 생성하지 못했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [services.baselineService, refreshBaselines]);

  const updateBaseline = useCallback(async (id: string, payload: BaselineUpdatePayload) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await services.baselineService.updateBaseline(id, payload);
      await refreshBaselines();
      setSelectedBaselineId(detail.id);
      return detail;
    } catch (err) {
      console.error('[Costing] Failed to update baseline', err);
      setError(err instanceof Error ? err.message : '기준월을 업데이트하지 못했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [services.baselineService, refreshBaselines]);

  const value = useMemo<CostingBaselineContextValue>(() => ({
    baselines,
    selectedBaselineId,
    selectedBaseline,
    loading,
    error,
    refreshBaselines,
    selectBaseline,
    createBaseline,
    updateBaseline,
  }), [baselines, selectedBaselineId, selectedBaseline, loading, error, refreshBaselines, selectBaseline, createBaseline, updateBaseline]);

  return (
    <CostingBaselineContext.Provider value={value}>
      {children}
    </CostingBaselineContext.Provider>
  );
};

export const useCostingBaselines = (): CostingBaselineContextValue => {
  const context = useContext(CostingBaselineContext);
  if (context === null) {
    throw new Error('CostingBaselineContext is not available. CostingBaselineProvider가 필요합니다.');
  }
  return context;
};

