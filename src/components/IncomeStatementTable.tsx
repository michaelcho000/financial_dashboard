import React, { useMemo, useRef, useState } from 'react';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { Account, AccountCategory } from '../types';
import TransactionDetailModal from './TransactionDetailModal';
import { useFinancials } from '../contexts/FinancialDataContext';
import { EditIcon } from './common/EditIcon';
import ConfirmationModal from './common/ConfirmationModal';

interface IncomeStatementTableProps {
  months: [string, string | null];
  display: 'revenue' | 'cogs' | 'sga';
}

interface RowAccount {
  account: Account;
  availability: Set<string>;
}

interface StatementAccountRowProps {
  row: RowAccount;
  months: string[];
  values: Record<string, number>;
  isNegative: boolean;
  onValueChange: (month: string, rawValue: string) => void;
  onShowDetails?: (month: string, accountId: string, accountName: string) => void;
  onRemoveTemporary?: () => void;
  onRenameTemporary?: (nextName: string) => void;
}

const StatementAccountRow: React.FC<StatementAccountRowProps> = ({
  row,
  months,
  values,
  isNegative,
  onValueChange,
  onShowDetails,
  onRemoveTemporary,
  onRenameTemporary,
}) => {
  const { account, availability } = row;
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(account.name);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraftName(account.name);
  }, [account.name]);

  React.useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
    }
  }, [isEditingName]);

  const handleNameCommit = () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === account.name) {
      setDraftName(account.name);
    } else if (onRenameTemporary) {
      onRenameTemporary(trimmed);
    }
    setIsEditingName(false);
  };

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50">
        <td className="py-3 px-4 text-base text-gray-700 pl-8">
          <div className="flex items-center gap-2">
            {onRenameTemporary ? (
              <>
                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={handleNameCommit}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameCommit()}
                    className="w-full text-base bg-white border border-blue-400 rounded px-2 py-1 focus:outline-none"
                  />
                ) : (
                  <span>{account.name}</span>
                )}
                <div className="flex items-center gap-1">
                  <EditIcon onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-blue-500" />
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="text-gray-400 hover:text-red-500"
                    aria-label={`${account.name} 삭제`}
                  >
                    &times;
                  </button>
                </div>
              </>
            ) : (
              <span>{account.name}</span>
            )}
          </div>
        </td>
        {months.map(month => {
          if (!availability.has(month)) {
            return (
              <td key={month} className="py-3 px-4 text-base text-right text-gray-400">
                —
              </td>
            );
          }

          const value = values[month] ?? 0;

          return (
            <td key={month} className="py-3 px-4 text-base text-right">
              <div className="flex items-center justify-end gap-2">
                <input
                  type="text"
                  value={formatCurrency(value)}
                  onChange={(e) => onValueChange(month, e.target.value)}
                  className={`w-full text-right bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm px-1 ${isNegative ? 'text-red-600' : ''}`}
                />
                {onShowDetails && (
                  <button
                    type="button"
                    onClick={() => onShowDetails(month, account.id, account.name)}
                    className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 whitespace-nowrap"
                  >
                    상세
                  </button>
                )}
              </div>
            </td>
          );
        })}
      </tr>
      {isConfirmingDelete && onRemoveTemporary && (
        <ConfirmationModal
          isOpen={isConfirmingDelete}
          title="임시 계정 삭제 확인"
          message={`'${account.name}' 계정을 해당 월에서 삭제하시겠습니까?`}
          onConfirm={() => {
            onRemoveTemporary();
            setIsConfirmingDelete(false);
          }}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </>
  );
};

const MonthlyAccountAdder: React.FC<{
  months: string[];
  onAdd: (month: string, name: string) => void;
}> = ({ months, onAdd }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const targetMonth = months[0];

  const commit = () => {
    const trimmed = name.trim();
    if (!trimmed || !targetMonth) {
      setIsEditing(false);
      setName('');
      return;
    }
    onAdd(targetMonth, trimmed);
    setName('');
    setIsEditing(false);
  };

  if (months.length === 0) {
    return null;
  }

  if (!isEditing) {
    return (
      <tr className="border-b border-gray-200">
        <td className="py-2 px-4 text-base text-gray-500 pl-8">
          <button onClick={() => setIsEditing(true)} className="hover:text-blue-600">
            + 해당 월 전용 항목 추가
          </button>
        </td>
        <td colSpan={months.length}></td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-200">
      <td className="py-2 px-4 pl-8">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder="새 항목 이름"
          className="w-48 text-base border-b-2 border-blue-400 focus:outline-none bg-transparent"
          autoFocus
        />
      </td>
      <td colSpan={months.length}></td>
    </tr>
  );
};

const IncomeStatementTable: React.FC<IncomeStatementTableProps> = ({ months, display }) => {
  const { variable, statement } = useFinancials();
  const { updateManualAccountValue, setTransactionAccountTotal, manualData, transactionData } = variable;
  const { monthlyOverrides, addMonthlyAccount, updateMonthlyAccount, removeMonthlyAccount, accountValues, accounts: statementAccounts } = statement;

  const validMonths = useMemo(() => months.filter(Boolean) as string[], [months]);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    month?: string;
    accountId?: string;
    accountName?: string;
  }>({ isOpen: false });

  const showDetails = (month: string, accountId: string, accountName: string) => {
    setModalState({ isOpen: true, month, accountId, accountName });
  };

  const hideDetails = () => setModalState({ isOpen: false });

  const groupConfig = useMemo(() => {
    switch (display) {
      case 'revenue':
        return {
          groups: variable.accountGroups.revenue,
          baseAccounts: variable.accounts.revenue,
          category: AccountCategory.REVENUE,
          accountKey: 'revenue' as const,
          isNegative: false,
        };
      case 'cogs':
        return {
          groups: variable.accountGroups.cogs,
          baseAccounts: variable.accounts.cogs,
          category: AccountCategory.COGS,
          accountKey: 'cogs' as const,
          isNegative: true,
        };
      case 'sga':
      default:
        return {
          groups: variable.accountGroups.sga,
          baseAccounts: variable.accounts.sgaVariable,
          category: AccountCategory.SGA_VARIABLE,
          accountKey: 'sgaVariable' as const,
          isNegative: true,
        };
    }
  }, [display, variable.accountGroups, variable.accounts]);

  const handleValueChange = (account: Account) => (month: string, rawValue: string) => {
    const numeric = parseInt(rawValue.replace(/[^0-9-]/g, ''), 10) || 0;
    if (account.entryType === 'transaction') {
      setTransactionAccountTotal(month, account.id, numeric, account.name);
    } else {
      updateManualAccountValue(month, account.id, numeric);
    }
  };

  const handleAddTemporaryAccount = (group: string, month: string, name: string, category: AccountCategory) => {
    addMonthlyAccount(month, { name, category, group });
  };

  const tables = groupConfig.groups.map(groupName => {
    const rows: RowAccount[] = [];

    groupConfig.baseAccounts
      .filter(acc => acc.group === groupName)
      .forEach(acc => rows.push({ account: acc, availability: new Set(validMonths) }));

    validMonths.forEach(month => {
      const override = monthlyOverrides[month];
      if (!override) return;
      override.addedAccounts
        ?.filter(acc => acc.group === groupName && acc.category === groupConfig.category)
        .forEach(acc => {
          rows.push({ account: acc, availability: new Set([month]) });
        });
    });

    const archivedCandidates = statementAccounts[groupConfig.accountKey].filter(acc => acc.group === groupName && acc.isArchived);
    archivedCandidates.forEach(acc => {
      const activeMonths = new Set<string>();
      validMonths.forEach(month => {
        const hasManualEntry = Object.prototype.hasOwnProperty.call(manualData[month] || {}, acc.id);
        const hasTransactions = (transactionData[month]?.[acc.id]?.length || 0) > 0;
        const value = accountValues[month]?.[acc.id] ?? 0;
        if (hasManualEntry || hasTransactions || value !== 0) {
          activeMonths.add(month);
        }
      });
      if (activeMonths.size > 0) {
        rows.push({ account: acc, availability: activeMonths });
      }
    });

    if (rows.length === 0) {
      return null;
    }

    const subtotalByMonth = validMonths.map(month => {
      return rows.reduce((sum, row) => {
        if (!row.availability.has(month)) return sum;
        const value = accountValues[month]?.[row.account.id] ?? 0;
        return sum + value;
      }, 0);
    });

    return (
      <table key={groupName} className="w-full border-collapse">
        <thead className="border-b-2 border-slate-300">
          <tr>
            <th className="py-3 px-4 text-left text-base font-bold text-slate-800">
              {groupName}
            </th>
            {validMonths.map(month => (
              <th key={month} className="py-3 px-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wider">
                {formatMonth(month)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const valuesPerMonth: Record<string, number> = {};
            validMonths.forEach(month => {
              valuesPerMonth[month] = accountValues[month]?.[row.account.id] ?? 0;
            });

            const originMonth = row.account.isTemporary ? Array.from(row.availability)[0] : undefined;

            return (
              <StatementAccountRow
                key={row.account.id}
                row={row}
                months={validMonths}
                values={valuesPerMonth}
                isNegative={groupConfig.isNegative}
                onValueChange={handleValueChange(row.account)}
                onShowDetails={row.account.entryType === 'transaction' ? showDetails : undefined}
                onRemoveTemporary={row.account.isTemporary && originMonth ? () => removeMonthlyAccount(originMonth, row.account.id) : undefined}
                onRenameTemporary={row.account.isTemporary && originMonth ? (nextName) => updateMonthlyAccount(originMonth, row.account.id, { name: nextName }) : undefined}
              />
            );
          })}
          <MonthlyAccountAdder
            months={validMonths}
            onAdd={(month, name) => handleAddTemporaryAccount(groupName, month, name, groupConfig.category)}
          />
        </tbody>
        <tfoot className="border-t-2 border-slate-300">
          <tr className="font-semibold bg-slate-50">
            <td className="py-3 px-4 text-base pl-8 text-slate-800">{groupName} 소계</td>
            {validMonths.map((month, idx) => (
              <td key={month} className={`py-3 px-4 text-base text-right ${groupConfig.isNegative ? 'text-red-600' : ''}`}>
                {formatCurrency(subtotalByMonth[idx], { alwaysParentheses: groupConfig.isNegative })}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    );
  }).filter(Boolean);

  return (
    <>
      <div className="space-y-6 p-4">
        {tables.length > 0 ? tables : (
          <div className="text-sm text-gray-500">표시할 항목이 없습니다.</div>
        )}
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
