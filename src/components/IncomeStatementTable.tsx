



import React, { useState } from 'react';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { AccountCategory } from '../types';
import TransactionDetailModal from './TransactionDetailModal';
import { EditableGroupName } from './tables/EditableGroupName';
import { AccountRow } from './tables/AccountRow';
import { AddAccountRow } from './tables/AddAccountRow';
import { useFinancials } from '../contexts/FinancialDataContext';

// --- Main Table Component ---

interface IncomeStatementTableProps {
  months: [string, string | null];
  display: 'revenue' | 'cogs' | 'sga';
}

const IncomeStatementTable: React.FC<IncomeStatementTableProps> = ({
  months,
  display
}) => {
  const {
    accounts,
    calculatedData,
    accountGroups,
    allAccounts
  } = useFinancials();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    month?: string;
    accountId?: string;
    accountName?: string;
  }>({
    isOpen: false
  });

  const validMonths = months.filter(Boolean) as string[];

  const showDetails = (month: string, accountId: string, accountName: string) => {
    setModalState({
      isOpen: true,
      month,
      accountId,
      accountName
    });
  };
  const hideDetails = () => setModalState({
    isOpen: false
  });

  const getGroupProps = () => {
    switch (display) {
      case 'revenue':
        return {
          groups: accountGroups.revenue,
          allAccounts: accounts.revenue,
          category: AccountCategory.REVENUE,
          groupType: 'revenue' as 'revenue',
          isNegative: false,
        };
      case 'cogs':
        return {
          groups: accountGroups.cogs,
          allAccounts: accounts.cogs,
          category: AccountCategory.COGS,
          groupType: 'cogs' as 'cogs',
          isNegative: true,
        };
      case 'sga': // Now only handles variable SG&A
        return {
          groups: accountGroups.sga,
          allAccounts: accounts.sgaVariable, // Only variable accounts
          category: AccountCategory.SGA_VARIABLE,
          groupType: 'sga' as 'sga',
          isNegative: true,
        };
    }
  };

  const { groups, allAccounts: groupAllAccounts, category, groupType, isNegative } = getGroupProps();

  return (
    <>
      <div className="space-y-6 p-4">
        {groups.map(groupName => {
          const groupAccounts = groupAllAccounts.filter(acc => acc.group === groupName);

          // Do not render the group if it's for SGA and has no variable accounts
          if (display === 'sga' && groupAccounts.length === 0) {
            return null;
          }

          return (
            <table key={groupName} className="w-full border-collapse">
              <thead className="border-b-2 border-slate-300">
                <tr>
                  <th className="py-3 px-4 text-left text-base font-bold text-slate-800">
                     <EditableGroupName
                        groupName={groupName}
                        type={groupType}
                      />
                  </th>
                  {validMonths.map(month => (
                    <th key={month} className="py-3 px-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wider">
                      {formatMonth(month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupAccounts.map(acc => (
                  <AccountRow
                    key={acc.id}
                    account={acc}
                    months={validMonths}
                    onShowDetails={showDetails}
                    isSubItem
                  />
                ))}
                 <AddAccountRow
                    category={category}
                    group={groupName}
                    colSpan={validMonths.length + 1}
                  />
              </tbody>
              <tfoot className="border-t-2 border-slate-300">
                 <tr className="font-semibold bg-slate-50">
                    <td className="py-3 px-4 text-base pl-8 text-slate-800">{groupName} 소계</td>
                     {validMonths.map(m => (
                        <td key={m} className={`py-3 px-4 text-base text-right ${isNegative ? 'text-red-600' : ''}`}>
                             {isNegative
                                ? formatCurrency(calculatedData[m]?.groupSubtotals?.[groupName] || 0, { alwaysParentheses: true })
                                : formatCurrency(calculatedData[m]?.groupSubtotals?.[groupName] || 0)
                             }
                        </td>
                     ))}
                 </tr>
              </tfoot>
            </table>
          );
        })}
      </div>
      {modalState.isOpen && modalState.month && modalState.accountId && (
        <TransactionDetailModal
          month={modalState.month}
          accountId={modalState.accountId}
          accountName={modalState.accountName || ''}
          onClose={hideDetails}
        />
      )}
    </>
  );
};

export default IncomeStatementTable;