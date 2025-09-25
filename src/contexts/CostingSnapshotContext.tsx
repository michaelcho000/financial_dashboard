import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  SnapshotSummary,
  SnapshotDetail,
  SnapshotCreatePayload,
  SnapshotUpdatePayload,
} from '../services/costing/types';
import { useCostingServices } from './CostingServicesContext';

interface CostingSnapshotContextValue {
  snapshots: SnapshotSummary[];
  selectedSnapshotId: string | null;
  selectedSnapshot: SnapshotDetail | null;
  loading: boolean;
  error: string | null;
  refreshSnapshots: () => Promise<void>;
  selectSnapshot: (id: string | null) => void;
  createSnapshot: (payload: SnapshotCreatePayload) => Promise<SnapshotDetail>;
  updateSnapshot: (id: string, payload: SnapshotUpdatePayload) => Promise<SnapshotDetail>;
}

const CostingSnapshotContext = createContext<CostingSnapshotContextValue | null>(null);

interface CostingSnapshotProviderProps {
  children: React.ReactNode;
}

export const CostingSnapshotProvider: React.FC<CostingSnapshotProviderProps> = ({ children }) => {
  const services = useCostingServices();
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await services.snapshotService.listSnapshots();
      setSnapshots(list);
      if (list.length === 0) {
        setSelectedSnapshotId(null);
        setSelectedSnapshot(null);
        return;
      }
      const current = list.find(item => item.id === selectedSnapshotId) ?? list[0];
      setSelectedSnapshotId(current.id);
    } catch (err) {
      console.error('[Costing] Failed to load snapshots', err);
      setError(err instanceof Error ? err.message : '기준월을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [services.snapshotService, selectedSnapshotId]);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedSnapshotId) {
        setSelectedSnapshot(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const detail = await services.snapshotService.getSnapshot(selectedSnapshotId);
        setSelectedSnapshot(detail);
      } catch (err) {
        console.error('[Costing] Failed to load snapshot detail', err);
        setError(err instanceof Error ? err.message : '기준월 상세 정보를 불러오지 못했습니다.');
        setSelectedSnapshot(null);
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [selectedSnapshotId, services.snapshotService]);

  const selectSnapshot = useCallback((id: string | null) => {
    setSelectedSnapshotId(id);
  }, []);

  const createSnapshot = useCallback(async (payload: SnapshotCreatePayload) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await services.snapshotService.createSnapshot(payload);
      await refreshSnapshots();
      setSelectedSnapshotId(detail.id);
      return detail;
    } catch (err) {
      console.error('[Costing] Failed to create snapshot', err);
      setError(err instanceof Error ? err.message : '기준월을 생성하지 못했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [services.snapshotService, refreshSnapshots]);

  const updateSnapshot = useCallback(async (id: string, payload: SnapshotUpdatePayload) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await services.snapshotService.updateSnapshot(id, payload);
      await refreshSnapshots();
      setSelectedSnapshotId(detail.id);
      return detail;
    } catch (err) {
      console.error('[Costing] Failed to update snapshot', err);
      setError(err instanceof Error ? err.message : '기준월을 업데이트하지 못했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [services.snapshotService, refreshSnapshots]);

  const value = useMemo<CostingSnapshotContextValue>(() => ({
    snapshots,
    selectedSnapshotId,
    selectedSnapshot,
    loading,
    error,
    refreshSnapshots,
    selectSnapshot,
    createSnapshot,
    updateSnapshot,
  }), [snapshots, selectedSnapshotId, selectedSnapshot, loading, error, refreshSnapshots, selectSnapshot, createSnapshot, updateSnapshot]);

  return (
    <CostingSnapshotContext.Provider value={value}>
      {children}
    </CostingSnapshotContext.Provider>
  );
};

export const useCostingSnapshots = (): CostingSnapshotContextValue => {
  const context = useContext(CostingSnapshotContext);
  if (context === null) {
    throw new Error('CostingSnapshotContext is not available. CostingSnapshotProvider가 필요합니다.');
  }
  return context;
};

