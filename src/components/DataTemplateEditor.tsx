import React, { useState, useEffect } from 'react';
import { Account, AccountCategory, SystemSettings, FixedCostLedgerItem } from '../types';
import DatabaseService from '../services/DatabaseService';
import ConfirmationModal from './common/ConfirmationModal';

interface TemplateAccountRowEditorProps {
    account: Account;
    onUpdate: (id: string, updates: Partial<Account>) => void;
    onDelete: (id: string) => void;
}

const TemplateAccountRowEditor: React.FC<TemplateAccountRowEditorProps> = ({ account, onUpdate, onDelete }) => {
    const [name, setName] = useState(account.name);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };

    const handleNameBlur = () => {
        if (name.trim() && name.trim() !== account.name) {
            onUpdate(account.id, { name: name.trim() });
        } else {
            setName(account.name);
        }
    };

    const handleDelete = () => {
        onDelete(account.id);
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

interface TemplateGroupEditorProps {
    groupName: string;
    accounts: Account[];
    type: 'revenue' | 'cogs' | 'sga';
    categoryForAdding: AccountCategory;
    onAddAccount: (name: string, category: AccountCategory, group: string) => void;
    onUpdateAccount: (id: string, updates: Partial<Account>) => void;
    onDeleteAccount: (id: string) => void;
    onDeleteGroup: (groupName: string) => void;
}

const TemplateGroupEditor: React.FC<TemplateGroupEditorProps> = ({
    groupName,
    accounts,
    type,
    categoryForAdding,
    onAddAccount,
    onUpdateAccount,
    onDeleteAccount,
    onDeleteGroup
}) => {
    const [newAccountName, setNewAccountName] = useState('');
    const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const handleAddAccount = () => {
        if (newAccountName.trim()) {
            onAddAccount(newAccountName.trim(), categoryForAdding, groupName);
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
        onDeleteGroup(groupName);
        setIsConfirmingDelete(false);
    };

    return (
        <div className="bg-white rounded-md border border-gray-200 mb-4">
            <div className="flex items-center justify-between p-3 bg-slate-100 font-semibold text-slate-800 text-base">
                <span>{groupName}</span>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsAddingAccount(true)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        + 계정 추가
                    </button>
                    <button
                        onClick={() => setIsConfirmingDelete(true)}
                        className="text-sm text-red-600 hover:text-red-800"
                    >
                        그룹 삭제
                    </button>
                </div>
            </div>

            {accounts.map(account => (
                <TemplateAccountRowEditor
                    key={account.id}
                    account={account}
                    onUpdate={onUpdateAccount}
                    onDelete={onDeleteAccount}
                />
            ))}

            {isAddingAccount && (
                <div className="flex items-center justify-between p-2 pl-8 border-t border-gray-200 bg-blue-50">
                    <input
                        type="text"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="새 계정과목 이름"
                        className="text-base bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm px-1 border border-gray-300"
                        autoFocus
                        onKeyPress={(e) => e.key === 'Enter' && handleAddAccount()}
                    />
                    <div className="flex space-x-2">
                        <button
                            onClick={handleAddAccount}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            저장
                        </button>
                        <button
                            onClick={() => {
                                setIsAddingAccount(false);
                                setNewAccountName('');
                            }}
                            className="text-gray-600 hover:text-gray-800"
                        >
                            취소
                        </button>
                    </div>
                </div>
            )}

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

const DataTemplateEditor: React.FC = () => {
    const [template, setTemplate] = useState<SystemSettings['tenantTemplate'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState<'revenue' | 'cogs' | 'sga'>('revenue');
    const [showAddGroup, setShowAddGroup] = useState(false);

    useEffect(() => {
        loadTemplate();
    }, []);

    const loadTemplate = async () => {
        try {
            const settings = DatabaseService.getSettings();
            setTemplate(settings.tenantTemplate);
        } catch (error) {
            console.error('템플릿 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveTemplate = async () => {
        if (!template) return;

        setSaving(true);
        try {
            const success = DatabaseService.saveSettings({ tenantTemplate: template });
            if (success) {
                alert('템플릿이 성공적으로 저장되었습니다.');
            } else {
                alert('템플릿 저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('템플릿 저장 실패:', error);
            alert('템플릿 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const addAccount = (name: string, category: AccountCategory, group: string) => {
        if (!template) return;

        const newAccount: Account = {
            id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            category,
            group,
            isDeletable: true,
            entryType: category === AccountCategory.SGA_FIXED ? 'manual' : 'transaction'
        };

        const updatedTemplate = { ...template };

        if (category === AccountCategory.REVENUE) {
            updatedTemplate.accounts.revenue = [...updatedTemplate.accounts.revenue, newAccount];
        } else if (category === AccountCategory.COGS) {
            updatedTemplate.accounts.cogs = [...updatedTemplate.accounts.cogs, newAccount];
        } else if (category === AccountCategory.SGA_FIXED) {
            updatedTemplate.accounts.sgaFixed = [...updatedTemplate.accounts.sgaFixed, newAccount];
        } else if (category === AccountCategory.SGA_VARIABLE) {
            updatedTemplate.accounts.sgaVariable = [...updatedTemplate.accounts.sgaVariable, newAccount];
        }

        setTemplate(updatedTemplate);
    };

    const updateAccount = (id: string, updates: Partial<Account>) => {
        if (!template) return;

        const updatedTemplate = { ...template };

        // 모든 계정 배열에서 해당 ID의 계정을 찾아 업데이트
        ['revenue', 'cogs', 'sgaFixed', 'sgaVariable'].forEach(key => {
            const accounts = updatedTemplate.accounts[key as keyof typeof updatedTemplate.accounts] as Account[];
            const accountIndex = accounts.findIndex(acc => acc.id === id);
            if (accountIndex !== -1) {
                accounts[accountIndex] = { ...accounts[accountIndex], ...updates };
            }
        });

        setTemplate(updatedTemplate);
    };

    const deleteAccount = (id: string) => {
        if (!template) return;

        const updatedTemplate = { ...template };

        // 모든 계정 배열에서 해당 ID의 계정을 제거
        ['revenue', 'cogs', 'sgaFixed', 'sgaVariable'].forEach(key => {
            const accountsKey = key as keyof typeof updatedTemplate.accounts;
            updatedTemplate.accounts[accountsKey] = updatedTemplate.accounts[accountsKey].filter(acc => acc.id !== id);
        });

        setTemplate(updatedTemplate);
    };

    const addGroup = () => {
        if (!template || !newGroupName.trim()) return;

        const updatedTemplate = { ...template };

        if (!updatedTemplate.accountGroups[newGroupType].includes(newGroupName.trim())) {
            updatedTemplate.accountGroups[newGroupType] = [
                ...updatedTemplate.accountGroups[newGroupType],
                newGroupName.trim()
            ];
        }

        setTemplate(updatedTemplate);
        setNewGroupName('');
        setShowAddGroup(false);
    };

    const deleteGroup = (groupName: string, type: 'revenue' | 'cogs' | 'sga') => {
        if (!template) return;

        const updatedTemplate = { ...template };
        updatedTemplate.accountGroups[type] = updatedTemplate.accountGroups[type].filter(g => g !== groupName);
        setTemplate(updatedTemplate);
    };

    if (loading) {
        return <div className="text-center py-8">템플릿 로딩 중...</div>;
    }

    if (!template) {
        return <div className="text-center py-8 text-red-500">템플릿 로드에 실패했습니다.</div>;
    }

    return (
        <div>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">대표 계정 템플릿 편집</h3>
                    <div className="flex space-x-3">
                        <button
                            onClick={() => setShowAddGroup(true)}
                            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                        >
                            그룹 추가
                        </button>
                        <button
                            onClick={saveTemplate}
                            disabled={saving}
                            className={`px-4 py-2 text-sm text-white rounded-md ${
                                saving
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {saving ? '저장 중...' : '템플릿 저장'}
                        </button>
                    </div>
                </div>

                {/* 대표 계정 템플릿 안내 */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h4 className="text-sm font-medium text-blue-800">대표 계정 템플릿이란?</h4>
                            <div className="mt-1 text-sm text-blue-700">
                                <p className="mb-2">• <strong>범용적 기본 계정</strong>: 모든 병원이 공통으로 사용할 수 있는 대표 계정과목들입니다</p>
                                <p className="mb-2">• <strong>확장 가능한 구조</strong>: 각 병원은 이 대표 계정을 기준으로 세부 계정을 추가할 수 있습니다</p>
                                <p className="mb-1">• <strong>일관성 확보</strong>: 신규 병원들이 동일한 회계 기준으로 시작할 수 있습니다</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 사용 예시 안내 */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">병원별 세부 계정 추가 예시</h4>
                    <div className="text-sm text-gray-600">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <span className="font-medium text-blue-600">매출 계정</span>
                                <ul className="mt-1 space-y-1">
                                    <li>• 비급여 일반수익 → 필러, 보톡스, 레이저</li>
                                    <li>• 멤버십/패키지 → 연간회원권, VIP패키지</li>
                                </ul>
                            </div>
                            <div>
                                <span className="font-medium text-green-600">매출원가</span>
                                <ul className="mt-1 space-y-1">
                                    <li>• 시술 재료비 → 필러원가, 실원가</li>
                                    <li>• 외주/검사비 → 혈액검사, 피부진단</li>
                                </ul>
                            </div>
                            <div>
                                <span className="font-medium text-purple-600">판관비</span>
                                <ul className="mt-1 space-y-1">
                                    <li>• 마케팅/광고비 → SNS광고, 전단지</li>
                                    <li>• 소모품/소모재 → 마스크, 장갑, 소독약</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 그룹 추가 모달 */}
            {showAddGroup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h4 className="text-lg font-medium mb-4">새 그룹 추가</h4>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                그룹 이름
                            </label>
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="그룹 이름 입력"
                                autoFocus
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                카테고리
                            </label>
                            <select
                                value={newGroupType}
                                onChange={(e) => setNewGroupType(e.target.value as 'revenue' | 'cogs' | 'sga')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="revenue">매출</option>
                                <option value="cogs">매출원가</option>
                                <option value="sga">판관비</option>
                            </select>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowAddGroup(false);
                                    setNewGroupName('');
                                }}
                                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={addGroup}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 템플릿 편집 섹션들 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 매출 섹션 */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">매출 계정</h4>
                    {template.accountGroups.revenue.map(groupName => (
                        <TemplateGroupEditor
                            key={groupName}
                            groupName={groupName}
                            accounts={template.accounts.revenue.filter(acc => acc.group === groupName)}
                            type="revenue"
                            categoryForAdding={AccountCategory.REVENUE}
                            onAddAccount={addAccount}
                            onUpdateAccount={updateAccount}
                            onDeleteAccount={deleteAccount}
                            onDeleteGroup={(name) => deleteGroup(name, 'revenue')}
                        />
                    ))}
                </div>

                {/* 매출원가 섹션 */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">매출원가 계정</h4>
                    {template.accountGroups.cogs.map(groupName => (
                        <TemplateGroupEditor
                            key={groupName}
                            groupName={groupName}
                            accounts={template.accounts.cogs.filter(acc => acc.group === groupName)}
                            type="cogs"
                            categoryForAdding={AccountCategory.COGS}
                            onAddAccount={addAccount}
                            onUpdateAccount={updateAccount}
                            onDeleteAccount={deleteAccount}
                            onDeleteGroup={(name) => deleteGroup(name, 'cogs')}
                        />
                    ))}
                </div>

                {/* 판관비 섹션 */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">판관비 계정</h4>
                    {template.accountGroups.sga.map(groupName => (
                        <>
                            <TemplateGroupEditor
                                key={`${groupName}-fixed`}
                                groupName={`${groupName} (고정)`}
                                accounts={template.accounts.sgaFixed.filter(acc => acc.group === groupName)}
                                type="sga"
                                categoryForAdding={AccountCategory.SGA_FIXED}
                                onAddAccount={addAccount}
                                onUpdateAccount={updateAccount}
                                onDeleteAccount={deleteAccount}
                                onDeleteGroup={(name) => deleteGroup(groupName, 'sga')}
                            />
                            <TemplateGroupEditor
                                key={`${groupName}-variable`}
                                groupName={`${groupName} (변동)`}
                                accounts={template.accounts.sgaVariable.filter(acc => acc.group === groupName)}
                                type="sga"
                                categoryForAdding={AccountCategory.SGA_VARIABLE}
                                onAddAccount={addAccount}
                                onUpdateAccount={updateAccount}
                                onDeleteAccount={deleteAccount}
                                onDeleteGroup={(name) => deleteGroup(groupName, 'sga')}
                            />
                        </>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DataTemplateEditor;