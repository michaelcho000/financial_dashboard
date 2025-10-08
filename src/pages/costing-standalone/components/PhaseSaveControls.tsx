import React, { useEffect, useMemo, useState } from 'react';
import { CostingPhaseId } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';

interface PhaseSaveControlsProps {
  phaseId: CostingPhaseId;
  className?: string;
}

const statusLabelMap: Record<string, string> = {
  saving: '저장 중...',
  success: '저장 완료!',
  error: '저장 실패',
};

const PhaseSaveControls: React.FC<PhaseSaveControlsProps> = ({ phaseId, className }) => {
  const { phaseProgress, savePhase } = useStandaloneCosting();
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const progress = phaseProgress[phaseId];
  const isDirty = progress?.isDirty ?? true;
  const lastSavedLabel = useMemo(() => {
    if (!progress?.lastSavedAt) {
      return '저장 이력 없음';
    }
    const savedDate = new Date(progress.lastSavedAt);
    if (Number.isNaN(savedDate.getTime())) {
      return '저장 이력 없음';
    }
    return `마지막 저장: ${savedDate.toLocaleString('ko-KR')}`;
  }, [progress]);

  useEffect(() => {
    if (status === 'success') {
      const timeout = window.setTimeout(() => setStatus('idle'), 2000);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [status]);

  const handleSave = async () => {
    if (status === 'saving') {
      return;
    }
    setStatus('saving');
    try {
      await savePhase(phaseId);
      setStatus('success');
    } catch (error) {
      console.error('[PhaseSaveControls] save failed', error);
      setStatus('error');
    }
  };

  const badgeClasses = isDirty ? 'bg-red-100 text-red-600 border-red-200' : 'bg-green-100 text-green-600 border-green-200';

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ''}`}>
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${badgeClasses}`}
      >
        <span className={`h-2 w-2 rounded-full ${isDirty ? 'bg-red-500' : 'bg-green-500'}`} aria-hidden />
        {isDirty ? '변경 사항 있음' : '저장 완료'}
      </span>
      <span className="text-xs text-gray-500">{status === 'saving' ? statusLabelMap.saving : lastSavedLabel}</span>
      <div className="ml-auto flex items-center gap-2">
        {status === 'error' && <span className="text-xs text-red-600">{statusLabelMap.error}</span>}
        {status === 'success' && <span className="text-xs text-green-600">{statusLabelMap.success}</span>}
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500"
          disabled={!isDirty && status !== 'error'}
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default PhaseSaveControls;
