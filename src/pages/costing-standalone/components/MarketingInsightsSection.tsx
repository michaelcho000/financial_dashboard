import React from 'react';
import NotificationModal from '../../../components/common/NotificationModal';

const MarketingInsightsSection: React.FC = () => {
  const [isInfoOpen, setInfoOpen] = React.useState(false);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">마케팅 인사이트 (준비 중)</h2>
          <p className="mt-1 text-sm text-gray-600">
            월 마케팅비와 시술별 목표 건수를 입력해 ROI, ROAS, CAC 등 핵심 지표를 확인하고 GPT 분석 리포트를
            받아볼 수 있는 페이지입니다. 현재는 설계 단계로, 곧 업데이트될 예정입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          용어 설명 보기
        </button>
      </header>

      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium text-gray-800">향후 제공 예정 기능</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>시술별 목표 건수와 마케팅비 배분 시뮬레이션</li>
          <li>ROI(투자수익률), ROAS(광고 투자 수익), CAC(고객 획득 비용) 자동 계산</li>
          <li>GPT 기반 매출 극대화 전략 제안 (장비/인력/Bed 증설 등)</li>
          <li>마케팅 예산 증액/감액 시나리오 비교 및 리포트 다운로드</li>
        </ul>
      </div>

      <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">진행 노트</p>
        <p className="mt-1">
          페이지 구조와 계산 로직을 우선 확정한 뒤 GPT 분석을 연결할 예정입니다. API 키 전달 및 프롬프트 설계가
          완료되면 자동 인사이트 영역이 활성화됩니다.
        </p>
      </div>

      <NotificationModal
        isOpen={isInfoOpen}
        onClose={() => setInfoOpen(false)}
        title="마케팅 지표 용어 정리"
        message={['ROI(투자수익률): 순이익 ÷ 투자비용 × 100', 'ROAS(광고 투자 수익): 광고로 발생한 매출 ÷ 광고비용 × 100', 'CAC(고객 획득 비용): 마케팅비 총액 ÷ 확보 고객 수'].join('\n')}
      />
    </section>
  );
};

export default MarketingInsightsSection;
