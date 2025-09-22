import React from 'react';
import Header from '../components/Header';
import IncomeStatementTable from '../components/IncomeStatementTable';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { AccountRow } from '../components/tables/AccountRow';
import { useFinancials } from '../contexts/FinancialDataContext';

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="p-4 border-b bg-slate-100">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
    </div>
    {children}
  </div>
);

const SummarySection: React.FC<{ months: [string, string | null] }> = ({ months }) => {
  const { statement } = useFinancials();
  const { calculatedData } = statement;
  const validMonths = months.filter(Boolean) as string[];

  const summaryItems = [
    { label: '총매출', key: 'totalRevenue', isCost: false, isBold: true },
    { label: '변동비 합계', key: 'variableExpense', isCost: true, isBold: false },
    { label: '고정비 합계', key: 'fixedExpense', isCost: true, isBold: false },
    { label: '총비용', key: 'totalExpense', isCost: true, isBold: true },
    { label: '영업이익', key: 'operatingIncome', isCost: false, isBold: true },
  ] as const;

  return (
    <SectionCard title="손익 요약">
      <table className="w-full">
        <tbody>
          {summaryItems.map(item => (
            <tr
              key={item.key}
              className={`border-b border-gray-200 last:border-b-0 ${item.isBold ? 'font-semibold bg-slate-50' : ''}`}
            >
              <td className={`py-3 px-4 text-base ${item.isBold ? 'text-slate-800' : 'text-slate-600'}`}>
                {item.label}
              </td>
              {validMonths.map(month => {
                const monthData = calculatedData[month];
                if (!monthData) {
                  return (
                    <td key={month} className="py-3 px-4 text-right text-base text-gray-400">
                      —
                    </td>
                  );
                }

                const value = monthData[item.key as keyof typeof monthData] as number;
                const displayAsNegative = item.isCost || value < 0;

                return (
                  <td
                    key={month}
                    className={`py-3 px-4 text-base text-right ${displayAsNegative ? 'text-red-600' : 'text-slate-800'}`}
                  >
                    {formatCurrency(value, { alwaysParentheses: item.isCost || value < 0 })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
};

const FixedCostsSummary: React.FC<{ months: [string, string | null] }> = ({ months }) => {
  const { fixed } = useFinancials();
  const { accounts: fixedAccounts } = fixed;
  const validMonths = months.filter(Boolean) as string[];

  if (fixedAccounts.length === 0) {
    return (
      <SectionCard title="월별 고정비">
        <div className="p-4 text-sm text-gray-500">고정비 계정이 설정되지 않았습니다.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="월별 고정비">
      <div className="p-4">
        <table className="w-full border-collapse">
          <thead className="border-b-2 border-slate-300">
            <tr>
              <th className="py-3 px-4 text-left text-base font-semibold text-slate-800">계정</th>
              {validMonths.map(month => (
                <th key={month} className="py-3 px-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  {formatMonth(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixedAccounts.map(account => (
              <AccountRow
                key={account.id}
                account={account}
                months={validMonths}
                isSubItem={false}
                disableEditing
              />
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

const IncomeStatementPage: React.FC = () => {
  const { currentMonths, setCurrentMonths } = useFinancials();

  return (
    <>
      <Header
        title="손익 관리"
        description="월별 손익 흐름과 고정비 현황을 한 화면에서 확인하세요."
        showMonthSelector
        currentMonths={currentMonths}
        setCurrentMonths={setCurrentMonths}
      />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <SectionCard title="매출 내역">
            <IncomeStatementTable months={currentMonths} display="revenue" />
          </SectionCard>

          <SectionCard title="변동비 내역">
            <IncomeStatementTable months={currentMonths} display="expense" costBehaviorFilter="variable" />
          </SectionCard>

          <SummarySection months={currentMonths} />
        </div>
        <div className="lg:col-span-1 space-y-8">
          <FixedCostsSummary months={currentMonths} />
        </div>
      </div>
    </>
  );
};

export default IncomeStatementPage;
