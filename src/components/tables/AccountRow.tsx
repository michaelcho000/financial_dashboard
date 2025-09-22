


import React, { useEffect, useRef, useState } from 'react';
import { Account, AccountCategory } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { EditIcon } from '../common/EditIcon';
import ConfirmationModal from '../common/ConfirmationModal';
import { useFinancials } from '../../contexts/FinancialDataContext';

interface AccountRowProps {
  account: Account;
  months: string[];
  onShowDetails?: (month: string, accountId: string, accountName: string) => void;
  isSubItem?: boolean;
  disableEditing?: boolean;
}

export const AccountRow: React.FC<AccountRowProps> = ({
  account,
  months,
  onShowDetails,
  isSubItem = false,
  disableEditing = false,
}) => {
  const { statement, variable } = useFinancials();
  const { accountValues } = statement;
  const {
    updateManualAccountValue,
    removeAccount,
    setTransactionAccountTotal,
    updateAccount,
  } = variable;
  const [isEditingName, setIsEditingName] = useState(false);
  const [accountName, setAccountName] = useState(account.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
    }
  }, [isEditingName]);

  useEffect(() => {
    setAccountName(account.name);
  }, [account.name]);

  const handleNameUpdate = () => {
    if (accountName.trim() && accountName !== account.name) {
      updateAccount(account.id, {
        name: accountName.trim()
      });
    } else {
      setAccountName(account.name);
    }
    setIsEditingName(false);
  };

  const isFixedExpense = account.category === AccountCategory.EXPENSE && account.costBehavior === 'fixed';

  const handleValueChange = (month: string, value: string) => {
    if (disableEditing || isFixedExpense) {
      return;
    }
    const numericValue = parseInt(value.replace(/,/g, ''), 10) || 0;
    if (account.entryType === 'manual') {
      updateManualAccountValue(month, account.id, numericValue);
    } else {
      setTransactionAccountTotal(month, account.id, numericValue, account.name);
    }
  };
  
  const handleDelete = () => {
    removeAccount(account.id);
    setIsConfirmingDelete(false);
  };

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50 group">
        <td className={`py-3 px-4 text-base text-gray-700 ${isSubItem ? 'pl-8' : ''}`}>
          <div className="flex items-center">
            {isEditingName ? (
              <input ref={nameInputRef}
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                onBlur={handleNameUpdate}
                onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate()}
                className="w-full text-base bg-white border border-blue-400 rounded px-2 py-1 focus:outline-none"
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span>{account.name}</span>
                </div>
                {!disableEditing && (
                  <EditIcon onClick={() => setIsEditingName(true)} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </>
            )}
            {account.isDeletable && !disableEditing && (
              <button onClick={() => setIsConfirmingDelete(true)}
                className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${account.name}`}>
                &times;
              </button>
            )}
          </div>
        </td>
        {months.map(month => (
          <td key={month} className="py-3 px-4 text-base text-right">
            <div className="flex items-center justify-end space-x-2">
              <input
                type="text"
                value={formatCurrency(accountValues[month]?.[account.id] || 0)}
                onChange={(e) => handleValueChange(month, e.target.value)}
                disabled={disableEditing || isFixedExpense}
                className={`w-full text-right bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm px-1 ${disableEditing || isFixedExpense ? 'cursor-default text-gray-500' : ''}`}
              />
              {account.entryType === 'transaction' && onShowDetails && !disableEditing && !isFixedExpense && (
                <button onClick={() => onShowDetails(month, account.id, account.name)}
                  className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 whitespace-nowrap">
                  상세
                </button>
              )}
            </div>
          </td>
        ))}
      </tr>
      {isConfirmingDelete && (
          <ConfirmationModal
              isOpen={isConfirmingDelete}
              title="계정 삭제 확인"
              message={`'${account.name}' 계정을 정말 삭제하시겠습니까? 관련된 모든 데이터가 삭제됩니다.`}
              onConfirm={handleDelete}
              onCancel={() => setIsConfirmingDelete(false)}
          />
      )}
    </>
  );
};



