import React from 'react';

interface CostingPlaceholderProps {
  title: string;
  description: string;
}

const CostingPlaceholder: React.FC<CostingPlaceholderProps> = ({ title, description }) => (
  <section className="space-y-4">
    <header>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </header>
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500 space-y-2">
      <p>세부 화면은 순차적으로 구현될 예정입니다. 기획 문서를 토대로 컴포넌트 구조와 데이터 흐름을 정리하고 있습니다.</p>
      <p className="text-xs text-gray-400">
        현재 단계에서는 브라우저 Local Storage 를 활용해 기준월, 인력, 소모품, 시술 데이터를 저장하며 테스트할 수 있습니다. Supabase 연동은 추후 단계에서 어댑터만 교체하면 됩니다.
      </p>
    </div>
  </section>
);

export default CostingPlaceholder;

