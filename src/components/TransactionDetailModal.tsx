import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatMonth } from '../utils/formatters';
import ConfirmationModal from './common/ConfirmationModal';
import { EditIcon } from './common/EditIcon';
import { useFinancials } from '../contexts/FinancialDataContext';

interface TransactionDetailModalProps {
  month: string;
  accountId: string;
  accountName: string;
  onClose: () => void;
}

const extractDigits = (value: string): string => value.replace(/[^0-9]/g, '');

const formatDigits = (digits: string): string => {
  if (!digits) {
    return '';
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const parseDigits = (digits: string): number => {
  const normalized = extractDigits(digits);
  if (!normalized) {
    return 0;
  }
  return parseInt(normalized, 10) || 0;
};

const TransactionRow: React.FC<{
  transaction: Transaction;
  onRemove: () => void;
  onUpdate: (updates: Partial<Omit<Transaction, 'id'>>) => void;
}> = ({ transaction, onRemove, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftDescription, setDraftDescription] = useState(transaction.description);
  const [draftAmountDigits, setDraftAmountDigits] = useState(String(transaction.amount ?? ''));
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setDraftDescription(transaction.description);
    setDraftAmountDigits(String(transaction.amount ?? ''));
  }, [transaction]);

  const handleSave = () => {
    const trimmedDescription = draftDescription.trim();
    const numericAmount = parseDigits(draftAmountDigits);

    if (!trimmedDescription && numericAmount === transaction.amount) {
      setIsEditing(false);
      return;
    }

    onUpdate({
      description: trimmedDescription || transaction.description,
      amount: numericAmount,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftDescription(transaction.description);
    setDraftAmountDigits(String(transaction.amount ?? ''));
    setIsEditing(false);
  };

  const handleDelete = () => {
    onRemove();
    setIsConfirmingDelete(false);
  };

  if (isEditing) {
    return (
      <tr className="border-b border-gray-100 bg-blue-50">
        <td className="py-3 px-2">
          <input
            type="text"
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            className="w-full px-2 py-1 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </td>
        <td className="text-right px-2">
          <input
            type="text"
            value={formatDigits(draftAmountDigits)}
            onChange={(e) => setDraftAmountDigits(extractDigits(e.target.value))}
            className="w-32 text-right px-2 py-1 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </td>
        <td className="text-center px-2">
          <div className="flex justify-end gap-2">
            <button onClick={handleSave} className="text-sm text-blue-600 hover:text-blue-800">저장</button>
            <button onClick={handleCancel} className="text-sm text-gray-500 hover:text-gray-700">취소</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 group">
        <td className="py-3 px-2 text-sm text-slate-700 break-words">{transaction.description}</td>
        <td className="text-right px-2 text-sm text-slate-800">{formatCurrency(transaction.amount)}</td>
        <td className="text-center px-2">
          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-blue-500" aria-label="거래 수정">
              <EditIcon />
            </button>
            <button onClick={() => setIsConfirmingDelete(true)} className="text-gray-400 hover:text-red-500" aria-label="거래 삭제">
              &times;
            </button>
          </div>
        </td>
      </tr>
      {isConfirmingDelete && (
        <ConfirmationModal
          isOpen={isConfirmingDelete}
          title="거래 삭제 확인"
          message={`'${transaction.description}' 거래를 삭제하시겠습니까?`}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </>
  );
};

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ month, accountId, accountName, onClose }) => {
  const { variable, statement } = useFinancials();
  const { transactionData, addTransaction, removeTransaction, updateTransaction, updateAccount } = variable;

  const transactions = transactionData[month]?.[accountId] ?? [];
  const allAccounts = useMemo(() => ([
    ...statement.accounts.revenue,
    ...statement.accounts.expense,
  ]), [statement.accounts.expense, statement.accounts.revenue]);

  const currentAccount = allAccounts.find(acc => acc.id === accountId);
  const currentAccountName = currentAccount ? currentAccount.name : accountName;

  const [description, setDescription] = useState(currentAccountName);
  const [amountDigits, setAmountDigits] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [accountNameDraft, setAccountNameDraft] = useState(currentAccountName);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    setAccountNameDraft(currentAccountName);
    setDescription(currentAccountName);
  }, [currentAccountName]);

  const handleTitleUpdate = () => {
    const trimmed = accountNameDraft.trim();
    if (!trimmed || trimmed === currentAccountName) {
      setAccountNameDraft(currentAccountName);
      setIsEditingTitle(false);
      return;
    }
    updateAccount(accountId, { name: trimmed });
    setIsEditingTitle(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = parseDigits(amountDigits);
    if (numericAmount <= 0) {
      return;
    }
    const detail = description.trim() || currentAccountName;
    addTransaction(month, accountId, { description: detail, amount: numericAmount });
    setDescription(currentAccountName);
    setAmountDigits('');
  };

  const totalAmount = transactions.reduce((sum, txn) => sum + txn.amount, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 group">
                {isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={accountNameDraft}
                    onChange={(e) => setAccountNameDraft(e.target.value)}
                    onBlur={handleTitleUpdate}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleUpdate()}
                    className="text-xl font-bold text-slate-900 border border-blue-400 rounded-md px-2 py-1 focus:outline-none"
                  />
                ) : (
                  <h2 id="transaction-modal-title" className="text-xl font-bold text-slate-900">
                    {currentAccountName} · {formatMonth(month)} 거래 상세
                  </h2>
                )}
                {!isEditingTitle && (
                  <EditIcon onClick={() => setIsEditingTitle(true)} className="text-gray-400 hover:text-blue-500" />
                )}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                거래 금액은 상세 화면에서만 입력하거나 수정할 수 있습니다. 설명을 비워두면 계정명이 자동으로 채워집니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-2xl text-gray-400 hover:text-gray-600"
              aria-label="모달 닫기"
            >
              &times;
            </button>
          </div>
          <div className="mt-4 text-sm text-slate-600">
            총 합계: <span className="font-semibold text-slate-900">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600">
                <th className="text-left font-semibold p-2">설명</th>
                <th className="text-right font-semibold p-2">금액</th>
                <th className="w-20 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-gray-500">
                    등록된 거래가 없습니다. 하단에서 새 거래를 추가하세요.
                  </td>
                </tr>
              ) : (
                transactions.map(transaction => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onRemove={() => removeTransaction(month, accountId, transaction.id)}
                    onUpdate={(updates) => updateTransaction(month, accountId, transaction.id, updates)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleSubmit} className="p-6 border-t border-gray-200 bg-slate-50 space-y-4">
          <h3 className="text-base font-semibold text-slate-800">새 거래 추가</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">설명</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`${currentAccountName} 관련 거래`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">금액</label>
              <input
                type="text"
                value={formatDigits(amountDigits)}
                onChange={(e) => setAmountDigits(extractDigits(e.target.value))}
                placeholder="예: 1,500,000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">
              설명을 비워두면 '{currentAccountName}'가 자동 입력되고, 금액은 숫자만 입력하면 됩니다.
            </span>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              거래 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
