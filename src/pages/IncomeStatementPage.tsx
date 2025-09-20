import React from 'react';
import Header from '../components/Header';
import IncomeStatementTable from '../components/IncomeStatementTable';
import {
  formatCurrency, formatMonth
} from '../utils/formatters';
import { AccountRow } from '../components/tables/AccountRow';
import { useFinancials } from '../contexts/FinancialDataContext';

const SectionCard: React.FC<{
  title: string;
  children: React.ReactNode
}> = ({
  title,
  children
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="p-4 border-b bg-slate-100">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
    </div>
    {children}
  </div>
);


const SummarySection: React.FC<{
  months: [string, string | null];
}> = ({
  months,
}) => {
  const { statement } = useFinancials();
  const { calculatedData } = statement;
  const validMonths = months.filter(Boolean) as string[];
  const summaryItems = [{
    label: '총 매출',
    getValue: (monthData: any) => monthData.revenue
  }, {
    label: '매출원가',
    getValue: (monthData: any) => monthData.cogs,
    isCost: true
  }, {
    label: '매출총이익',
    getValue: (monthData: any) => monthData.grossProfit,
    isBold: true
  }, {
    label: '판매비와 관리비',
    getValue: (monthData: any) => monthData.totalSga,
    isCost: true
  }, {
    label: '영업이익',
    getValue: (monthData: any) => monthData.operatingProfit,
    isBold: true
  }, ];

  return (
    <SectionCard title="손익 요약">
      <table className="w-full">
        <tbody>
          {summaryItems.map(item => (
            <tr key={item.label} className={`border-b border-gray-200 last:border-b-0 ${item.isBold ? 'font-bold bg-slate-50' : ''}`}>
              <td className={`py-3 px-4 text-base ${item.isBold ? 'text-gray-800' : 'text-gray-600'}`}>
                {item.label}
              </td>
              {validMonths.map(m => {
                const monthData = calculatedData[m];
                if (!monthData) return <td key={m} className="py-3 px-4 text-right text-base">...</td>;

                const value = item.getValue(monthData);
                const isLoss = !item.isCost && value < 0;
                
                return (
                  <td key={m} className={`py-3 px-4 text-base text-right ${(item.isCost || isLoss) ? 'text-red-600' : ''}`}>
                    {formatCurrency(value, { alwaysParentheses: item.isCost || isLoss })}
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

const FixedCostsSummary: React.FC<{ months: [string, string | null]; }> = ({ months }) => {
  const { fixed } = useFinancials();
  const { accounts: fixedAccounts } = fixed;
  const validMonths = months.filter(Boolean) as string[];

  return (
    <SectionCard title="월별 고정비">
      <div className="p-4">
        <table className="w-full border-collapse">
          <thead className="border-b-2 border-slate-300">
            <tr>
              <th className="py-3 px-4 text-left text-base font-bold text-slate-800">계정</th>
              {validMonths.map(month => (
                <th key={month} className="py-3 px-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  {formatMonth(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixedAccounts.map(acc => (
              <AccountRow
                key={acc.id}
                account={acc}
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
        title="매입매출 정산"
        description="월별 손익 관리 시스템"
        showMonthSelector={true}
        currentMonths={currentMonths}
        setCurrentMonths={setCurrentMonths}
      />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
            <SectionCard title="매출 내역">
              <IncomeStatementTable
                months={currentMonths}
                display="revenue"
              />
            </SectionCard>

            <SectionCard title="매출원가">
              <IncomeStatementTable
                months={currentMonths}
                display="cogs"
              />
            </SectionCard>

            <SectionCard title="변동 판매비와 관리비">
              <IncomeStatementTable
                months={currentMonths}
                display="sga"
              />
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
