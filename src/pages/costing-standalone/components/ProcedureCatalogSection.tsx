import React, { useMemo, useState } from 'react';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { ProcedureFormValues } from '../../../services/standaloneCosting/types';
import { generateId } from '../../../utils/id';
import ProcedureCard from './ProcedureCard';

interface ProcedureCatalogSectionProps {
  onEdit: (procedureId: string) => void;
}

const ProcedureCatalogSection: React.FC<ProcedureCatalogSectionProps> = ({ onEdit }) => {
  const { state, upsertProcedure } = useStandaloneCosting();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'margin' | 'marginRate'>('name');
  const [filterBy, setFilterBy] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const proceduresWithBreakdowns = useMemo(() => {
    return state.procedures.map(procedure => ({
      procedure,
      breakdown: state.breakdowns.find(b => b.procedureId === procedure.id) || null,
    }));
  }, [state.procedures, state.breakdowns]);

  const filteredProcedures = useMemo(() => {
    let filtered = proceduresWithBreakdowns;

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ procedure }) =>
        procedure.name.toLowerCase().includes(query)
      );
    }

    // 마진율 필터
    if (filterBy !== 'all') {
      filtered = filtered.filter(({ breakdown }) => {
        if (!breakdown) return false;
        const rate = breakdown.marginRate;
        if (filterBy === 'high') return rate >= 40;
        if (filterBy === 'medium') return rate >= 30 && rate < 40;
        if (filterBy === 'low') return rate < 30;
        return true;
      });
    }

    // 정렬
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.procedure.name.localeCompare(b.procedure.name);
      }
      if (sortBy === 'price') {
        return b.procedure.price - a.procedure.price;
      }
      if (sortBy === 'margin') {
        return (b.breakdown?.margin || 0) - (a.breakdown?.margin || 0);
      }
      if (sortBy === 'marginRate') {
        return (b.breakdown?.marginRate || 0) - (a.breakdown?.marginRate || 0);
      }
      return 0;
    });

    return filtered;
  }, [proceduresWithBreakdowns, searchQuery, filterBy, sortBy]);

  const handleEdit = (procedure: ProcedureFormValues) => {
    onEdit(procedure.id);
  };

  const handleDuplicate = (procedure: ProcedureFormValues) => {
    const duplicated: ProcedureFormValues = {
      ...procedure,
      id: generateId(),
      name: `${procedure.name} (복사)`,
    };
    upsertProcedure(duplicated);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">시술 카탈로그</h2>
            <p className="mt-1 text-sm text-gray-600">
              등록된 시술의 원가와 마진을 확인하세요.
            </p>
          </div>
        </div>

        {/* 필터 및 정렬 */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* 검색 */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="시술명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* 마진율 필터 */}
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">전체</option>
            <option value="high">마진율 양호 (40% 이상)</option>
            <option value="medium">마진율 보통 (30-40%)</option>
            <option value="low">마진율 주의 (30% 미만)</option>
          </select>

          {/* 정렬 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="name">이름순</option>
            <option value="price">가격 높은 순</option>
            <option value="margin">마진 큰 순</option>
            <option value="marginRate">마진율 높은 순</option>
          </select>
        </div>
      </header>

      {/* 카드 그리드 */}
      {filteredProcedures.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          {searchQuery || filterBy !== 'all'
            ? '검색 조건에 맞는 시술이 없습니다.'
            : '등록된 시술이 없습니다. 시술 관리 탭에서 시술을 추가해보세요.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProcedures.map(({ procedure, breakdown }) => (
            <ProcedureCard
              key={procedure.id}
              procedure={procedure}
              breakdown={breakdown}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProcedureCatalogSection;
