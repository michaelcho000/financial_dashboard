

import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { EditIcon } from './common/EditIcon';
import ConfirmationModal from './common/ConfirmationModal';
import { useFinancials } from '../contexts/FinancialDataContext';

interface TransactionDetailModalProps {
  month: string;
  accountId: string;
  accountName: string;
  onClose: () => void;
}

const TransactionRow: React.FC<{
    transaction: Transaction;
    onRemove: () => void;
    onUpdate: (updates: Partial<Omit<Transaction, 'id'>>) => void;
}> = ({ transaction, onRemove, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [description, setDescription] = useState(transaction.description);
    const [amount, setAmount] = useState(formatCurrency(transaction.amount));
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    useEffect(() => {
        setDescription(transaction.description);
        setAmount(formatCurrency(transaction.amount));
    }, [transaction]);

    const handleSave = () => {
        const numericAmount = parseInt(amount.replace(/,/g, ''), 10) || 0;
        if (description.trim() && (description.trim() !== transaction.description || numericAmount !== transaction.amount)) {
            onUpdate({ description: description.trim(), amount: numericAmount });
        }
        setIsEditing(false);
    };
    
    const handleCancel = () => {
        setDescription(transaction.description);
        setAmount(formatCurrency(transaction.amount));
        setIsEditing(false);
    }

    const handleDelete = () => {
        onRemove();
        setIsConfirmingDelete(false);
    }

    if (isEditing) {
        return (
             <tr className="border-b border-gray-100 bg-blue-50">
                <td className="py-3 px-2">
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-2 py-1 border rounded-md" />
                </td>
                <td className="text-right px-2">
                    <input type="text" value={amount} onChange={e => setAmount(formatCurrency(parseInt(e.target.value.replace(/,/g, ''), 10) || 0))} className="w-32 text-right px-2 py-1 border rounded-md" />
                </td>
                <td className="text-center px-2">
                    <div className="flex space-x-2">
                        <button onClick={handleSave} className="text-blue-600 hover:text-blue-800">✓</button>
                        <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">&times;</button>
                    </div>
                </td>
            </tr>
        )
    }

    return (
        <>
            <tr className="border-b border-gray-100 hover:bg-gray-50 group">
                <td className="py-3 px-2">{transaction.description}</td>
                <td className="text-right px-2">{formatCurrency(transaction.amount)}</td>
                <td className="text-center px-2">
                     <div className="flex space-x-2 opacity-0 group-hover:opacity-100">
                        <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button onClick={() => setIsConfirmingDelete(true)} className="text-gray-400 hover:text-red-500">&times;</button>
                    </div>
                </td>
            </tr>
            {isConfirmingDelete && (
                <ConfirmationModal
                    isOpen={isConfirmingDelete}
                    title="내역 삭제 확인"
                    message={`'${transaction.description}' 내역을 정말 삭제하시겠습니까?`}
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
  const transactions = transactionData[month]?.[accountId] || [];
  const allAccounts = [
    ...statement.accounts.revenue,
    ...statement.accounts.cogs,
    ...statement.accounts.sgaFixed,
    ...statement.accounts.sgaVariable,
  ];

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  
  const currentAccount = allAccounts.find(acc => acc.id === accountId);
  const currentAccountName = currentAccount ? currentAccount.name : accountName;
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newAccountName, setNewAccountName] = useState(currentAccountName);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if(isEditingTitle) {
        titleInputRef.current?.focus();
    }
  }, [isEditingTitle]);
  
  const handleTitleUpdate = () => {
    if (newAccountName.trim() && newAccountName.trim() !== currentAccountName) {
        updateAccount(accountId, { name: newAccountName.trim() });
    } else {
        setNewAccountName(currentAccountName);
    }
    setIsEditingTitle(false);
  };


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = parseInt(amount.replace(/,/g, ''), 10);
    if (description.trim() && !isNaN(numericAmount)) {
      addTransaction(month, accountId, { description: description.trim(), amount: numericAmount });
      setDescription('');
      setAmount('');
    }
  };

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 group">
            <div className="flex items-center">
             {isEditingTitle ? (
                 <input 
                    ref={titleInputRef}
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    onBlur={handleTitleUpdate}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleUpdate()}
                    className="text-xl font-bold text-gray-800 bg-white border border-blue-400 rounded-md px-2 py-1 focus:outline-none"
                 />
             ) : (
                <h2 id="transaction-modal-title" className="text-xl font-bold text-gray-800">
                    {currentAccountName} - {formatMonth(month)} 상세 내역
                </h2>
             )}
             <EditIcon onClick={() => setIsEditingTitle(true)} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isEditingTitle ? 'hidden':''}`}/>
            </div>
           <p className="text-sm text-gray-500 mt-1">항목별 상세 내역을 추가하고 관리합니다.</p>
        </div>
        
        <div className="p-6 max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-gray-50">
                        <th className="text-left font-semibold text-gray-600 p-2">설명</th>
                        <th className="text-right font-semibold text-gray-600 p-2">금액</th>
                        <th className="w-20 p-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map(t => (
                       <TransactionRow 
                            key={t.id}
                            transaction={t}
                            onRemove={() => removeTransaction(month, accountId, t.id)}
                            onUpdate={(updates) => updateTransaction(month, accountId, t.id, updates)}
                       />
                    ))}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={3} className="text-center py-8 text-gray-400">내역이 없습니다.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="내역 설명"
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              value={amount}
              onChange={e => setAmount(formatCurrency(parseInt(e.target.value.replace(/,/g, ''), 10) || 0))}
              placeholder="금액"
              className="w-40 px-3 py-2 border border-gray-300 rounded-md text-right focus:ring-blue-500 focus:border-blue-500"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">추가</button>
          </form>
        </div>

        <div className="flex justify-between items-center p-6 border-t bg-white rounded-b-xl">
            <div className="text-lg font-bold">
                합계: {formatCurrency(totalAmount)}
            </div>
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">닫기</button>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
