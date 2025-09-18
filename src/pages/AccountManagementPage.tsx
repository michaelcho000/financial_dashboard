import React, { useState } from 'react';
import { Account, AccountCategory } from '../types';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { useFinancials } from '../contexts/FinancialDataContext';
import Header from '../components/Header';

interface AccountRowEditorProps {
    account: Account;
}

const AccountRowEditor: React.FC<AccountRowEditorProps> = ({ account }) => {
    const { updateAccount, removeAccount } = useFinancials();
    const [name, setName] = useState(account.name);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };

    const handleNameBlur = () => {
        if (name.trim() && name.trim() !== account.name) {
            updateAccount(account.id, { name: name.trim() });
        } else {
            setName(account.name);
        }
    };

    const handleDelete = () => {
        removeAccount(account.id, account.category);
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
    type: 'revenue' | 'cogs' | 'sga';
    categoryForAdding: AccountCategory;
}

const GroupEditor: React.FC<GroupEditorProps> = ({ groupName, accounts, type, categoryForAdding}) => {
    const { addAccount, removeAccountGroup } = useFinancials();
    const [newAccountName, setNewAccountName] = useState('');
    const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    
    const handleAddAccount = () => {
        if (newAccountName.trim()) {
            addAccount(newAccountName.trim(), categoryForAdding, groupName);
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
        removeAccountGroup(groupName, type);
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
                {accounts.map(acc => <AccountRowEditor key={acc.id} account={acc} />)}
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
    type: 'revenue' | 'cogs' | 'sga';
    groups: string[];
    allAccounts: Account[];
    categoryForAdding: AccountCategory;
}
const SectionEditor: React.FC<SectionEditorProps> = ({ title, type, groups, allAccounts, categoryForAdding }) => {
    const { addAccountGroup } = useFinancials();
    const [newGroupName, setNewGroupName] = useState('');
    const [isAddingGroup, setIsAddingGroup] = useState(false);

    const handleAddGroup = () => {
        if (newGroupName.trim()) {
            addAccountGroup(newGroupName.trim(), type);
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
                    categoryForAdding={categoryForAdding}
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
    const { accounts, accountGroups, currentMonths, setCurrentMonths } = useFinancials();
    const allSgaAccounts = [...accounts.sgaFixed, ...accounts.sgaVariable];

    return (
        <>
            <Header
                title="계정 관리"
                description="손익계산서에 사용될 계정과목의 구조를 설정합니다."
                showMonthSelector={false}
                currentMonths={currentMonths}
                setCurrentMonths={setCurrentMonths}
            />

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                <SectionEditor
                    title="매출 계정"
                    type="revenue"
                    groups={accountGroups.revenue}
                    allAccounts={accounts.revenue}
                    categoryForAdding={AccountCategory.REVENUE}
                />
                <SectionEditor
                    title="매출원가 계정"
                    type="cogs"
                    groups={accountGroups.cogs}
                    allAccounts={accounts.cogs}
                    categoryForAdding={AccountCategory.COGS}
                />
                <SectionEditor
                    title="판매비와 관리비 계정"
                    type="sga"
                    groups={accountGroups.sga}
                    allAccounts={allSgaAccounts}
                    categoryForAdding={AccountCategory.SGA_VARIABLE}
                />
            </div>
        </>
    );
};

export default AccountManagementPage;