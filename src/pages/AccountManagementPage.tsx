import React, { useCallback, useEffect, useState } from 'react';
import { Account, AccountCategory } from '../types';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { useFinancials } from '../contexts/FinancialDataContext';
import Header from '../components/Header';

interface AccountRowEditorProps {
    account: Account;
    onRename: (accountId: string, name: string) => void;
    onRemove: (accountId: string) => void;
}

const AccountRowEditor: React.FC<AccountRowEditorProps> = ({ account, onRename, onRemove }) => {
    const [name, setName] = useState(account.name);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };

    const handleNameBlur = () => {
        if (name.trim() && name.trim() !== account.name) {
            onRename(account.id, name.trim());
        } else {
            setName(account.name);
        }
    };

    const handleDelete = () => {
        onRemove(account.id);
        setIsConfirmingDelete(false);
    }
    
    return (
        <>
            <div className="flex items-center justify-between p-2 pl-8 border-t border-gray-200 hover:bg-gray-50 group">
                <input 
                    type="text"
                    value={name}
                    onChange={handleNameChange}
                    onBlur={handleNameBlur}
                    className="text-base bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm px-1"
                />
                {account.isDeletable && (
                    <button 
                        onClick={() => setIsConfirmingDelete(true)}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${account.name}`}
                    >
                        &times;
                    </button>
                )}
            </div>
             {isConfirmingDelete && (
                <ConfirmationModal
                    isOpen={isConfirmingDelete}
                    title="계정 삭제 확인"
                    message={`'${account.name}' 계정을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
                    onConfirm={handleDelete}
                    onCancel={() => setIsConfirmingDelete(false)}
                />
            )}
        </>
    );
};


interface GroupEditorProps {
    groupName: string;
    accounts: Account[];
    type: 'revenue' | 'expense';
    category: AccountCategory;
    onAddAccount: (category: AccountCategory, group: string, name: string) => void;
    onRemoveAccount: (category: AccountCategory, accountId: string) => void;
    onRenameAccount: (category: AccountCategory, accountId: string, name: string) => void;
    onRemoveGroup: (groupName: string, type: 'revenue' | 'expense') => void;
}

const GroupEditor: React.FC<GroupEditorProps> = ({
    groupName,
    accounts,
    type,
    category,
    onAddAccount,
    onRemoveAccount,
    onRenameAccount,
    onRemoveGroup,
}) => {
    const [newAccountName, setNewAccountName] = useState('');
    const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    
    const handleAddAccount = () => {
        if (newAccountName.trim()) {
            onAddAccount(category, groupName, newAccountName.trim());
            setNewAccountName('');
            setIsAddingAccount(false);
        }
    };
    
    const handleDeleteGroup = () => {
        if (accounts.length > 0) {
            alert('그룹에 속한 계정과목이 있어 삭제할 수 없습니다. 먼저 계정과목을 다른 그룹으로 이동하거나 삭제해주세요.');
            setIsConfirmingDelete(false);
            return;
        }
        onRemoveGroup(groupName, type);
        setIsConfirmingDelete(false);
    };

    return (
        <div className="bg-white rounded-md border border-gray-200 mb-4">
            <div className="flex items-center justify-between p-3 bg-slate-100 font-semibold text-slate-800 text-base">
                <span>{groupName}</span>
                <button 
                    onClick={() => setIsConfirmingDelete(true)}
                    className="text-xs text-gray-500 hover:text-red-500"
                >
                    그룹 삭제
                </button>
            </div>
            <div>
                {accounts.map(acc => (
                    <AccountRowEditor
                        key={acc.id}
                        account={acc}
                        onRename={(accountId, updatedName) => onRenameAccount(category, accountId, updatedName)}
                        onRemove={(accountId) => onRemoveAccount(category, accountId)}
                    />
                ))}
            </div>
            <div className="p-2 pl-8 border-t">
                {isAddingAccount ? (
                    <input
                        type="text"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="새 계정 이름"
                        autoFocus
                        onBlur={handleAddAccount}
                        onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                        className="text-base border-b-2 border-blue-400 focus:outline-none bg-transparent"
                    />
                ) : (
                    <button onClick={() => setIsAddingAccount(true)} className="text-base text-blue-600 hover:text-blue-800">
                        + 계정 추가
                    </button>
                )}
            </div>
            {isConfirmingDelete && (
                <ConfirmationModal
                    isOpen={isConfirmingDelete}
                    title="그룹 삭제 확인"
                    message={`'${groupName}' 그룹을 정말 삭제하시겠습니까?`}
                    onConfirm={handleDeleteGroup}
                    onCancel={() => setIsConfirmingDelete(false)}
                />
            )}
        </div>
    );
};


interface SectionEditorProps {
    title: string;
    type: 'revenue' | 'expense';
    groups: string[];
    allAccounts: Account[];
    category: AccountCategory;
    onAddGroup: (groupName: string, type: 'revenue' | 'expense') => void;
    onRemoveGroup: (groupName: string, type: 'revenue' | 'expense') => void;
    onAddAccount: (category: AccountCategory, groupName: string, name: string) => void;
    onRemoveAccount: (category: AccountCategory, accountId: string) => void;
    onRenameAccount: (category: AccountCategory, accountId: string, name: string) => void;
}
const SectionEditor: React.FC<SectionEditorProps> = ({
    title,
    type,
    groups,
    allAccounts,
    category,
    onAddGroup,
    onRemoveGroup,
    onAddAccount,
    onRemoveAccount,
    onRenameAccount,
}) => {
    const [newGroupName, setNewGroupName] = useState('');
    const [isAddingGroup, setIsAddingGroup] = useState(false);

    const handleAddGroup = () => {
        if (newGroupName.trim()) {
            onAddGroup(newGroupName.trim(), type);
            setNewGroupName('');
            setIsAddingGroup(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
            {groups.map(group => (
                <GroupEditor
                    key={group}
                    groupName={group}
                    accounts={allAccounts.filter(a => a.group === group)}
                    type={type}
                    category={category}
                    onAddAccount={onAddAccount}
                    onRemoveAccount={onRemoveAccount}
                    onRenameAccount={onRenameAccount}
                    onRemoveGroup={onRemoveGroup}
                />
            ))}
            <div className="mt-4">
                {isAddingGroup ? (
                     <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="새 그룹 이름"
                        autoFocus
                        onBlur={handleAddGroup}
                        onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                        className="text-base border-b-2 border-blue-400 focus:outline-none bg-transparent"
                    />
                ) : (
                    <button onClick={() => setIsAddingGroup(true)} className="text-base font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded-md">
                        + 그룹 추가
                    </button>
                )}
            </div>
        </div>
    );
}


const AccountManagementPage: React.FC = () => {
    const { variable, currentMonths, setCurrentMonths, commitDraft } = useFinancials();
    const { accounts, accountGroups, saveStructure } = variable;

    const buildDraftAccounts = useCallback(() => ({
        revenue: accounts.revenue.map(acc => ({ ...acc })),
        expense: accounts.expense.map(acc => ({ ...acc })),
    }), [accounts]);

    const buildDraftGroups = useCallback(() => ({
        revenue: [...accountGroups.revenue],
        expense: [...accountGroups.expense],
    }), [accountGroups]);

    const [draftAccounts, setDraftAccounts] = useState(() => buildDraftAccounts());
    const [draftGroups, setDraftGroups] = useState(() => buildDraftGroups());
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (isDirty) {
            return;
        }
        setDraftAccounts(buildDraftAccounts());
        setDraftGroups(buildDraftGroups());
    }, [buildDraftAccounts, buildDraftGroups, isDirty]);

    const markDirty = useCallback(() => setIsDirty(true), []);

    const updateDraftAccounts = useCallback((category: AccountCategory, updater: (items: Account[]) => Account[]) => {
        setDraftAccounts(prev => {
            const next = { ...prev };
            if (category === AccountCategory.REVENUE) {
                next.revenue = updater(prev.revenue);
            } else {
                next.expense = updater(prev.expense);
            }
            return next;
        });
        markDirty();
    }, [markDirty]);

    const updateDraftGroups = useCallback((type: 'revenue' | 'expense', updater: (groups: string[]) => string[]) => {
        setDraftGroups(prev => ({
            ...prev,
            [type]: updater(prev[type]),
        }));
        markDirty();
    }, [markDirty]);

    const handleAddAccount = useCallback((category: AccountCategory, groupName: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const isExpense = category === AccountCategory.EXPENSE;
        const idPrefix = isExpense ? 'exp' : 'rev';
        const referenceAccount = isExpense ? draftAccounts.expense.find(acc => acc.group === groupName) : undefined;
        const costBehavior = isExpense ? (referenceAccount?.costBehavior ?? 'variable') : undefined;
        const entryType: Account['entryType'] = costBehavior === 'fixed' ? 'manual' : 'transaction';
        const newAccount: Account = {
            id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: trimmed,
            category,
            group: groupName,
            isDeletable: true,
            costBehavior,
            entryType,
        };

        updateDraftAccounts(category, items => [...items, newAccount]);
    }, [draftAccounts, updateDraftAccounts]);

    const handleRemoveAccount = useCallback((category: AccountCategory, accountId: string) => {
        updateDraftAccounts(category, items => items.filter(acc => acc.id !== accountId));
    }, [updateDraftAccounts]);

    const handleRenameAccount = useCallback((category: AccountCategory, accountId: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        updateDraftAccounts(category, items => items.map(acc => (
            acc.id === accountId ? { ...acc, name: trimmed } : acc
        )));
    }, [updateDraftAccounts]);

    const handleAddGroup = useCallback((groupName: string, type: 'revenue' | 'expense') => {
        const trimmed = groupName.trim();
        if (!trimmed) return;
        updateDraftGroups(type, groups => (groups.includes(trimmed) ? groups : [...groups, trimmed]));
    }, [updateDraftGroups]);

    const handleRemoveGroup = useCallback((groupName: string, type: 'revenue' | 'expense') => {
        updateDraftGroups(type, groups => groups.filter(group => group !== groupName));
    }, [updateDraftGroups]);

    const handleSave = useCallback(() => {
        saveStructure({
            accounts: {
                revenue: draftAccounts.revenue.map(acc => ({ ...acc, name: acc.name.trim() })),
                expense: draftAccounts.expense.map(acc => ({ ...acc, name: acc.name.trim() })),
            },
            accountGroups: {
                revenue: [...draftGroups.revenue],
                expense: [...draftGroups.expense],
            },
        });
        setIsDirty(false);
        setTimeout(() => commitDraft(), 0);
    }, [draftAccounts, draftGroups, saveStructure, commitDraft]);

    return (
        <>
            <Header
                title="계정 관리"
                description="손익계산서에 사용될 계정과목의 구조를 설정합니다."
                showMonthSelector={false}
                currentMonths={currentMonths}
                setCurrentMonths={setCurrentMonths}
            />

            <div className="mt-6 flex justify-end">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty}
                    className={`px-4 py-2 rounded-md text-base font-semibold ${isDirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                >
                    변경사항 저장
                </button>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <SectionEditor
                    title="매출 계정"
                    type="revenue"
                    groups={draftGroups.revenue}
                    allAccounts={draftAccounts.revenue}
                    category={AccountCategory.REVENUE}
                    onAddGroup={handleAddGroup}
                    onRemoveGroup={handleRemoveGroup}
                    onAddAccount={handleAddAccount}
                    onRemoveAccount={handleRemoveAccount}
                    onRenameAccount={handleRenameAccount}
                />
                <SectionEditor
                    title="지출 계정"
                    type="expense"
                    groups={draftGroups.expense}
                    allAccounts={draftAccounts.expense}
                    category={AccountCategory.EXPENSE}
                    onAddGroup={handleAddGroup}
                    onRemoveGroup={handleRemoveGroup}
                    onAddAccount={handleAddAccount}
                    onRemoveAccount={handleRemoveAccount}
                    onRenameAccount={handleRenameAccount}
                />
            </div>
        </>
    );
};

export default AccountManagementPage;
