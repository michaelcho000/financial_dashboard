


import React, { useState } from 'react';
import { Account, AccountCategory } from '../../types';
import { useFinancials } from '../../contexts/FinancialDataContext';

export const AddAccountRow: React.FC<{
  category: AccountCategory;
  group: string;
  colSpan: number;
}> = ({
  category,
  group,
  colSpan
}) => {
  const { variable, statement } = useFinancials();
  const { addAccount } = variable;
  const allAccounts: Account[] = [
    ...statement.accounts.revenue,
    ...statement.accounts.cogs,
    ...statement.accounts.sgaFixed,
    ...statement.accounts.sgaVariable,
  ];
  const [name, setName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [suggestions, setSuggestions] = useState<Account[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (value) {
      const filtered = allAccounts.filter(acc =>
        acc.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleAdd = () => {
    const trimmedName = name.trim();
    if (trimmedName) {
      const exists = allAccounts.some(acc => acc.name.toLowerCase() === trimmedName.toLowerCase());
      if (exists) {
        alert('이미 존재하는 계정입니다.');
      } else {
        addAccount(trimmedName, category, group);
      }
      setName('');
      setSuggestions([]);
      setIsEditing(false);
    } else {
      setIsEditing(false);
    }
  };

  const handleSuggestionClick = (suggestionName: string) => {
    setName(suggestionName);
    setSuggestions([]);
    // Focus input or trigger add, depending on desired UX
  };

  if (!isEditing) {
    return (
      <tr className="border-b border-gray-200">
        <td className="py-2 px-4 text-base text-gray-500 pl-8">
          <button onClick={() => setIsEditing(true)} className="hover:text-blue-600">
            +항목 추가
          </button>
        </td>
        <td colSpan={colSpan - 1}></td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-200">
      <td className="py-2 px-4 pl-8 relative">
        <div className="flex items-center">
          <input type="text"
            value={name}
            onChange={handleInputChange}
            placeholder="항목 이름 입력"
            className="w-48 text-base border-b-2 border-blue-400 focus:outline-none bg-transparent"
            autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            onBlur={handleAdd}
          />
        </div>
        {suggestions.length > 0 && (
          <div className="absolute z-10 w-48 bg-white border border-gray-300 rounded-md shadow-lg mt-1">
            <ul>
              {suggestions.map(acc => (
                <li key={acc.id}
                  className="px-3 py-2 text-base cursor-pointer hover:bg-gray-100"
                  onMouseDown={() => handleSuggestionClick(acc.name)}>
                  {acc.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </td>
      <td colSpan={colSpan - 1}></td>
    </tr>
  );
};
