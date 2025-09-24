import React, { useEffect, useMemo, useState } from 'react';
import {
  Account,
  AccountCategory,
  CostBehavior,
  FixedCostTemplate,
  FixedCostType,
  SystemSettings,
} from '../types';
import DatabaseService from '../services/DatabaseService';

const COST_BEHAVIOR_LABEL: Record<CostBehavior, string> = {
  variable: '변동비',
  fixed: '고정비',
};

const COST_TYPE_LABEL: Record<FixedCostType, string> = {
  OPERATING_SERVICE: '운영 서비스',
  ASSET_FINANCE: '자산·리스',
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneTemplate = (template: SystemSettings['tenantTemplate']) => (
  JSON.parse(JSON.stringify(template)) as SystemSettings['tenantTemplate']
);

type TemplateState = SystemSettings['tenantTemplate'] | null;

type GroupType = 'revenue' | 'expense';

interface GroupEditorProps {
  categoryType: GroupType;
  groupName: string;
  accounts: Account[];
  onRenameGroup: (nextName: string) => void;
  onDeleteGroup: () => void;
  onAddAccount: (name: string, costBehavior?: CostBehavior) => void;
  onRenameAccount: (accountId: string, nextName: string) => void;
  onChangeBehavior: (accountId: string, behavior: CostBehavior) => void;
  onDeleteAccount: (accountId: string) => void;
}

const GroupEditor: React.FC<GroupEditorProps> = ({
  categoryType,
  groupName,
  accounts,
  onRenameGroup,
  onDeleteGroup,
  onAddAccount,
  onRenameAccount,
  onChangeBehavior,
  onDeleteAccount,
}) => {
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState(groupName);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newBehavior, setNewBehavior] = useState<CostBehavior>('variable');

  useEffect(() => {
    setGroupDraft(groupName);
  }, [groupName]);

  const commitGroupName = () => {
    const trimmed = groupDraft.trim();
    if (!trimmed || trimmed === groupName) {
      setGroupDraft(groupName);
    } else {
      onRenameGroup(trimmed);
    }
    setIsEditingGroup(false);
  };

  const handleAddAccount = () => {
    const trimmed = newAccountName.trim();
    if (!trimmed) {
      return;
    }
    onAddAccount(trimmed, categoryType === 'expense' ? newBehavior : undefined);
    setNewAccountName('');
    setNewBehavior('variable');
    setIsAddingAccount(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-100 border-b border-gray-200">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
          {isEditingGroup ? (
            <input
              type="text"
              value={groupDraft}
              onChange={(e) => setGroupDraft(e.target.value)}
              onBlur={commitGroupName}
              onKeyDown={(e) => e.key === 'Enter' && commitGroupName()}
              className="px-2 py-1 rounded-md border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              autoFocus
            />
          ) : (
            <span>{groupName}</span>
          )}
          {!isEditingGroup && (
            <button
              type="button"
              onClick={() => setIsEditingGroup(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              이름 수정
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDeleteGroup}
          className="text-sm text-red-600 hover:text-red-700"
        >
          그룹 삭제
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {accounts.length === 0 && (
          <div className="px-4 py-4 text-sm text-gray-500">등록된 계정이 없습니다.</div>
        )}
        {accounts.map(account => (
          <div key={account.id} className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-3">
              <input
                type="text"
                value={account.name}
                onChange={(e) => onRenameAccount(account.id, e.target.value)}
                onBlur={(e) => onRenameAccount(account.id, e.target.value)}
                className="flex-1 px-2 py-1 text-base rounded-md border border-transparent focus:border-blue-400 focus:outline-none"
              />
              {categoryType === 'expense' && (
                <select
                  value={account.costBehavior === 'fixed' ? 'fixed' : 'variable'}
                  onChange={(e) => onChangeBehavior(account.id, e.target.value as CostBehavior)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="variable">변동비</option>
                  <option value="fixed">고정비</option>
                </select>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDeleteAccount(account.id)}
              disabled={!account.isDeletable}
              className={`px-3 py-1 text-sm rounded-md border ${account.isDeletable ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 bg-slate-50 border-t border-gray-200">
        {isAddingAccount ? (
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
              placeholder="계정명"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
            {categoryType === 'expense' && (
              <select
                value={newBehavior}
                onChange={(e) => setNewBehavior(e.target.value as CostBehavior)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="variable">변동비</option>
                <option value="fixed">고정비</option>
              </select>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddAccount}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                추가
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingAccount(false);
                  setNewAccountName('');
                  setNewBehavior('variable');
                }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingAccount(true)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + 계정 추가
          </button>
        )}
      </div>
    </div>
  );
};

const FixedCostTemplateEditor: React.FC<{
  templates: FixedCostTemplate[];
  accounts: Account[];
  onAdd: (payload: { serviceName: string; accountId: string; costType: FixedCostType; vendor?: string; monthlyCost?: number; paymentDate?: string }) => void;
  onUpdate: (id: string, updates: Partial<FixedCostTemplate>) => void;
  onDelete: (id: string) => void;
}> = ({ templates, accounts, onAdd, onUpdate, onDelete }) => {
  const [form, setForm] = useState({
    serviceName: '',
    accountId: accounts[0]?.id ?? '',
    costType: 'OPERATING_SERVICE' as FixedCostType,
    vendor: '',
    monthlyCost: '',
    paymentDate: '',
  });

  useEffect(() => {
    if (!form.accountId && accounts.length > 0) {
      setForm(prev => ({ ...prev, accountId: accounts[0].id }));
    }
  }, [accounts, form.accountId]);

  const handleSubmit = () => {
    const trimmed = form.serviceName.trim();
    if (!trimmed || !form.accountId) {
      return;
    }
    onAdd({
      serviceName: trimmed,
      accountId: form.accountId,
      costType: form.costType,
      vendor: form.vendor.trim() || undefined,
      monthlyCost: form.monthlyCost ? Number(form.monthlyCost.replace(/,/g, '')) : undefined,
      paymentDate: form.paymentDate.trim() || undefined,
    });
    setForm({
      serviceName: '',
      accountId: accounts[0]?.id ?? '',
      costType: 'OPERATING_SERVICE',
      vendor: '',
      monthlyCost: '',
      paymentDate: '',
    });
  };

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <div className="text-sm text-gray-500">등록된 고정비 템플릿이 없습니다. 아래에서 새 템플릿을 추가하세요.</div>
      ) : (
        <table className="w-full border-collapse">
          <thead className="bg-slate-100">
            <tr className="text-left text-sm text-slate-700">
              <th className="px-3 py-2">서비스명</th>
              <th className="px-3 py-2">연결 계정</th>
              <th className="px-3 py-2">비용 유형</th>
              <th className="px-3 py-2">월 청구액</th>
              <th className="px-3 py-2">납부일</th>
              <th className="px-3 py-2">공급사</th>
              <th className="px-3 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {templates.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.serviceName}
                    onChange={(e) => onUpdate(item.id, { serviceName: e.target.value })}
                    className="w-full px-2 py-1 border border-transparent focus:border-blue-400 focus:outline-none rounded-md"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={item.accountId}
                    onChange={(e) => onUpdate(item.id, { accountId: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.group ? `${acc.group} · ${acc.name}` : acc.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={item.costType}
                    onChange={(e) => onUpdate(item.id, { costType: e.target.value as FixedCostType })}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {Object.entries(COST_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.monthlyCost ?? 0}
                    onChange={(e) => onUpdate(item.id, { monthlyCost: Number(e.target.value || 0) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.paymentDate ?? ''}
                    onChange={(e) => onUpdate(item.id, { paymentDate: e.target.value })}
                    placeholder="예: 매월 10일"
                    className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.vendor ?? ''}
                    onChange={(e) => onUpdate(item.id, { vendor: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="border border-dashed border-gray-300 rounded-md p-4 bg-gray-50">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">새 고정비 템플릿 추가</h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            value={form.serviceName}
            onChange={(e) => setForm(prev => ({ ...prev, serviceName: e.target.value }))}
            placeholder="서비스명"
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <select
            value={form.accountId}
            onChange={(e) => setForm(prev => ({ ...prev, accountId: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="" disabled>연결할 계정</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.group ? `${acc.group} · ${acc.name}` : acc.name}</option>
            ))}
          </select>
          <select
            value={form.costType}
            onChange={(e) => setForm(prev => ({ ...prev, costType: e.target.value as FixedCostType }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {Object.entries(COST_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            value={form.monthlyCost}
            onChange={(e) => setForm(prev => ({ ...prev, monthlyCost: e.target.value }))}
            placeholder="월 청구액"
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <input
            type="text"
            value={form.paymentDate}
            onChange={(e) => setForm(prev => ({ ...prev, paymentDate: e.target.value }))}
            placeholder="납부일"
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={form.vendor}
            onChange={(e) => setForm(prev => ({ ...prev, vendor: e.target.value }))}
            placeholder="공급사"
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!form.serviceName.trim() || !form.accountId}
              className={`px-4 py-2 text-sm text-white rounded-md ${form.serviceName.trim() && form.accountId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
            >
              템플릿 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DataTemplateEditor: React.FC = () => {
  const [template, setTemplate] = useState<TemplateState>(null);
  const [originalTemplate, setOriginalTemplate] = useState<TemplateState>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const settings = DatabaseService.getSettings();
      const currentTemplate = cloneTemplate(settings.tenantTemplate);
      setTemplate(currentTemplate);
      setOriginalTemplate(cloneTemplate(settings.tenantTemplate));
    } catch (err) {
      console.error(err);
      setError('템플릿을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplate = (updater: (draft: SystemSettings['tenantTemplate']) => void) => {
    let mutated = false;
    setTemplate(prev => {
      if (!prev) return prev;
      const next = cloneTemplate(prev);
      updater(next);
      mutated = true;
      return next;
    });
    if (mutated) {
      setIsDirty(true);
    }
  };

  const handleAddGroup = (type: GroupType, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !template) {
      return;
    }
    if (template.accountGroups[type].includes(trimmed)) {
      alert('이미 존재하는 그룹 이름입니다.');
      return;
    }
    updateTemplate(draft => {
      draft.accountGroups[type] = [...draft.accountGroups[type], trimmed];
    });
  };

  const handleRenameGroup = (type: GroupType, groupName: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === groupName) {
      return;
    }
    updateTemplate(draft => {
      draft.accountGroups[type] = draft.accountGroups[type].map(name => (name === groupName ? trimmed : name));
      const targetAccounts = type === 'revenue' ? draft.accounts.revenue : draft.accounts.expense;
      targetAccounts.forEach(acc => {
        if (acc.group === groupName) {
          acc.group = trimmed;
        }
      });
    });
  };

  const handleDeleteGroup = (type: GroupType, groupName: string) => {
    if (!template) return;
    const hasAccounts = (type === 'revenue' ? template.accounts.revenue : template.accounts.expense)
      .some(acc => acc.group === groupName);
    if (hasAccounts) {
      alert('그룹에 연결된 계정이 있어 삭제할 수 없습니다. 먼저 계정을 다른 그룹으로 이동하거나 삭제하세요.');
      return;
    }
    if (!window.confirm(`'${groupName}' 그룹을 삭제하시겠습니까?`)) {
      return;
    }
    updateTemplate(draft => {
      draft.accountGroups[type] = draft.accountGroups[type].filter(name => name !== groupName);
    });
  };

  const handleAddAccount = (type: GroupType, groupName: string, name: string, costBehavior?: CostBehavior) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    updateTemplate(draft => {
      const account: Account = {
        id: createId(type === 'revenue' ? 'rev' : 'exp'),
        name: trimmed,
        category: type === 'revenue' ? AccountCategory.REVENUE : AccountCategory.EXPENSE,
        group: groupName,
        costBehavior: type === 'expense' ? (costBehavior === 'fixed' ? 'fixed' : 'variable') : undefined,
        isDeletable: true,
        entryType: type === 'expense' && costBehavior === 'fixed' ? 'manual' : 'transaction',
      };
      draft.accounts[type] = [...draft.accounts[type], account];
    });
  };

  const handleRenameAccount = (accountId: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }
    updateTemplate(draft => {
      const buckets: Array<Account[]> = [draft.accounts.revenue, draft.accounts.expense];
      buckets.forEach(bucket => {
        const index = bucket.findIndex(acc => acc.id === accountId);
        if (index !== -1) {
          bucket[index].name = trimmed;
        }
      });
    });
  };

  const handleChangeBehavior = (accountId: string, behavior: CostBehavior) => {
    updateTemplate(draft => {
      const account = draft.accounts.expense.find(acc => acc.id === accountId);
      if (!account) {
        return;
      }
      account.costBehavior = behavior;
      account.entryType = behavior === 'fixed' ? 'manual' : 'transaction';
    });
  };

  const handleDeleteAccount = (accountId: string) => {
    if (!window.confirm('이 계정을 삭제하시겠습니까? 관련 고정비 템플릿도 함께 정리됩니다.')) {
      return;
    }
    updateTemplate(draft => {
      let removed: Account | undefined;
      (['revenue', 'expense'] as const).forEach(type => {
        const index = draft.accounts[type].findIndex(acc => acc.id === accountId);
        if (index !== -1) {
          removed = draft.accounts[type][index];
          draft.accounts[type] = draft.accounts[type].filter(acc => acc.id !== accountId);
        }
      });

      if (removed && removed.category === AccountCategory.EXPENSE) {
        const removedTemplateIds = new Set<string>();
        draft.fixedCostTemplates = draft.fixedCostTemplates.filter(template => {
          if (template.accountId === accountId) {
            removedTemplateIds.add(template.id);
            return false;
          }
          return true;
        });
        if (draft.fixedCostActualDefaults) {
          draft.fixedCostActualDefaults = draft.fixedCostActualDefaults.filter(actual => !removedTemplateIds.has(actual.templateId));
        }
      }
    });
  };

  const handleAddFixedTemplate = (payload: { serviceName: string; accountId: string; costType: FixedCostType; vendor?: string; monthlyCost?: number; paymentDate?: string }) => {
    updateTemplate(draft => {
      const newTemplate: FixedCostTemplate = {
        id: createId('fct'),
        accountId: payload.accountId,
        costType: payload.costType,
        serviceName: payload.serviceName,
        vendor: payload.vendor,
        monthlyCost: payload.monthlyCost ?? 0,
        paymentDate: payload.paymentDate,
      };
      draft.fixedCostTemplates = [...draft.fixedCostTemplates, newTemplate];
    });
  };

  const handleUpdateFixedTemplate = (id: string, updates: Partial<FixedCostTemplate>) => {
    updateTemplate(draft => {
      const index = draft.fixedCostTemplates.findIndex(item => item.id === id);
      if (index === -1) return;
      draft.fixedCostTemplates[index] = {
        ...draft.fixedCostTemplates[index],
        ...updates,
      };
    });
  };

  const handleDeleteFixedTemplate = (id: string) => {
    if (!window.confirm('해당 고정비 템플릿을 삭제하시겠습니까?')) {
      return;
    }
    updateTemplate(draft => {
      draft.fixedCostTemplates = draft.fixedCostTemplates.filter(item => item.id !== id);
      if (draft.fixedCostActualDefaults) {
        draft.fixedCostActualDefaults = draft.fixedCostActualDefaults.filter(actual => actual.templateId !== id);
      }
    });
  };

  const handleSave = () => {
    if (!template) {
      return;
    }
    setSaving(true);
    try {
      DatabaseService.saveSettings({ tenantTemplate: template });
      setOriginalTemplate(cloneTemplate(template));
      setIsDirty(false);
      alert('대표 계정 템플릿이 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalTemplate) {
      return;
    }
    if (!window.confirm('변경 내역을 모두 취소하고 마지막 저장 상태로 되돌리시겠습니까?')) {
      return;
    }
    setTemplate(cloneTemplate(originalTemplate));
    setIsDirty(false);
  };

  const fixedExpenseAccounts = useMemo(
    () => template?.accounts.expense.filter(acc => acc.costBehavior === 'fixed') ?? [],
    [template],
  );

  if (loading) {
    return <div className="text-sm text-gray-600">템플릿을 불러오는 중입니다...</div>;
  }

  if (error || !template) {
    return <div className="text-sm text-red-600">{error || '템플릿 데이터를 찾을 수 없습니다.'}</div>;
  }

  const renderGroupColumn = (type: GroupType, title: string) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-slate-800">{title}</h4>
        <button
          type="button"
          onClick={() => {
            const name = prompt(`${title}에 추가할 그룹 이름을 입력하세요.`);
            if (name) {
              handleAddGroup(type, name);
            }
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + 그룹 추가
        </button>
      </div>
      {template.accountGroups[type].length === 0 && (
        <div className="text-sm text-gray-500">그룹을 먼저 추가해 주세요.</div>
      )}
      {template.accountGroups[type].map(groupName => (
        <GroupEditor
          key={groupName}
          categoryType={type}
          groupName={groupName}
          accounts={template.accounts[type].filter(acc => acc.group === groupName)}
          onRenameGroup={(nextName) => handleRenameGroup(type, groupName, nextName)}
          onDeleteGroup={() => handleDeleteGroup(type, groupName)}
          onAddAccount={(name, behavior) => handleAddAccount(type, groupName, name, behavior)}
          onRenameAccount={(accountId, nextName) => handleRenameAccount(accountId, nextName)}
          onChangeBehavior={(accountId, behavior) => handleChangeBehavior(accountId, behavior)}
          onDeleteAccount={(accountId) => handleDeleteAccount(accountId)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">대표 계정 템플릿</h3>
          <p className="text-sm text-slate-600">모든 병원이 공유하는 기본 계정 구조를 정의합니다. 각 병원은 이 템플릿을 기준으로 세부 계정을 추가하게 됩니다.</p>
          <p className="text-xs text-slate-500 mt-1">현재 버전: {template.version}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty}
            className={`px-4 py-2 text-sm rounded-md border ${isDirty ? 'text-gray-700 border-gray-300 hover:bg-gray-100' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
          >
            변경 취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`px-4 py-2 text-sm text-white rounded-md ${isDirty && !saving ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
          >
            {saving ? '저장 중...' : '템플릿 저장'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderGroupColumn('revenue', '매출 그룹')}
        {renderGroupColumn('expense', '지출 그룹')}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">고정비 템플릿</h3>
          <p className="text-sm text-slate-600">고정비는 별도 화면에서 관리되므로, 이 템플릿은 초기 병원 생성 시 제공할 기본 항목만 정의합니다.</p>
        </div>
        {fixedExpenseAccounts.length === 0 ? (
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-4">
            고정비로 지정된 지출 계정이 없습니다. 지출 그룹에서 고정비 계정을 먼저 정의하면 템플릿을 연결할 수 있습니다.
          </div>
        ) : (
          <FixedCostTemplateEditor
            templates={template.fixedCostTemplates}
            accounts={fixedExpenseAccounts}
            onAdd={handleAddFixedTemplate}
            onUpdate={handleUpdateFixedTemplate}
            onDelete={handleDeleteFixedTemplate}
          />
        )}
      </div>
    </div>
  );
};

export default DataTemplateEditor;
