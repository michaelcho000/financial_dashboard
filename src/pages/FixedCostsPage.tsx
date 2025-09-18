import React, { useState, useMemo } from 'react';
import { FixedCostLedgerItem, FixedCostType } from '../types';
import { formatCurrency } from '../utils/formatters';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { useFinancials } from '../contexts/FinancialDataContext';
import Header from '../components/Header';

const FixedCostLedgerModal: React.FC<{
    item?: FixedCostLedgerItem | null;
    onClose: () => void;
    onSave: (item: Omit<FixedCostLedgerItem, 'id'> | FixedCostLedgerItem) => void;
}> = ({ item, onClose, onSave }) => {
    const { accounts } = useFinancials();
    const [costType, setCostType] = useState<FixedCostType>(item?.costType || 'OPERATING_SERVICE');
    
    const defaultServiceName = item ? item.serviceName : (accounts.sgaFixed.find(acc => acc.id === item?.accountId)?.name || '');

    const isDirectInputPaymentDate = !([...Array(31).keys()].map(i => `${i + 1}일`).concat('말일').includes(item?.paymentDate || ''));

    const [formData, setFormData] = useState({
        accountId: item?.accountId || '',
        vendor: item?.vendor || '',
        serviceName: defaultServiceName,
        monthlyCost: item?.monthlyCost || 0,
        paymentDate: isDirectInputPaymentDate ? '직접 입력' : (item?.paymentDate || '1일'),
        customPaymentDate: isDirectInputPaymentDate ? item?.paymentDate : '',
        // Operating Service
        contractDetails: item?.contractDetails || '',
        renewalDate: item?.renewalDate || '',
        // Asset Finance
        leaseTermMonths: item?.leaseTermMonths || undefined,
        contractStartDate: item?.contractStartDate || '',
        contractEndDate: item?.contractEndDate || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const account = accounts.sgaFixed.find(acc => acc.id === formData.accountId);
        if (!account || !formData.vendor) {
            alert('계정과목과 업체명을 모두 입력해주세요.');
            return;
        }
        
        const finalPaymentDate = formData.paymentDate === '직접 입력' ? formData.customPaymentDate : formData.paymentDate;

        const finalData = {
            ...formData,
            paymentDate: finalPaymentDate,
            costType,
            serviceName: account.name,
        };

        if (item) {
            onSave({ ...item, ...finalData });
        } else {
            onSave(finalData as Omit<FixedCostLedgerItem, 'id'>);
        }
    };
    
    const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { name, value } = e.target;
      const accountName = accounts.sgaFixed.find(acc => acc.id === value)?.name || '';
      setFormData(prev => ({...prev, [name]: value, serviceName: accountName }));
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value }));
    };

    const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numericValue = parseInt(e.target.value.replace(/,/g, ''), 10) || 0;
        setFormData(prev => ({...prev, monthlyCost: numericValue}));
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b">
                        <h3 className="text-xl font-bold">{item ? '고정 지출 수정' : '고정 지출 추가'}</h3>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">지출 유형</label>
                             <select value={costType} onChange={(e) => setCostType(e.target.value as FixedCostType)} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                                <option value="OPERATING_SERVICE">운영 서비스 계약</option>
                                <option value="ASSET_FINANCE">리스/금융 자산</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">서비스/자산명 (계정과목)</label>
                            <select name="accountId" value={formData.accountId} onChange={handleAccountChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md">
                                <option value="" disabled>계정과목 선택</option>
                                {accounts.sgaFixed.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.group})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">업체명</label>
                            <input type="text" name="vendor" value={formData.vendor} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">월 납입액/사용료</label>
                            <input type="text" name="monthlyCost" value={formatCurrency(formData.monthlyCost)} onChange={handleCostChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-right" />
                        </div>
                        <div className="flex items-end space-x-2">
                            <div className="flex-grow">
                                <label className="block text-sm font-medium text-gray-700 mb-1">출금일</label>
                                <select name="paymentDate" value={formData.paymentDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                                    {[...Array(31).keys()].map(i => <option key={i} value={`${i+1}일`}>{i+1}일</option>)}
                                    <option value="말일">말일</option>
                                    <option value="직접 입력">직접 입력</option>
                                </select>
                            </div>
                            {formData.paymentDate === '직접 입력' && (
                                <div className="flex-grow">
                                    <input type="text" name="customPaymentDate" value={formData.customPaymentDate} onChange={handleChange} placeholder="예: 매주 금요일" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                                </div>
                            )}
                        </div>
                        
                        {costType === 'ASSET_FINANCE' && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">계약 시작일</label>
                                    <input type="date" name="contractStartDate" value={formData.contractStartDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">만기일자</label>
                                    <input type="date" name="contractEndDate" value={formData.contractEndDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">계약 기간 (개월)</label>
                                <input type="number" name="leaseTermMonths" value={formData.leaseTermMonths || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                          </>
                        )}
                        {costType === 'OPERATING_SERVICE' && (
                          <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">갱신 예정일</label>
                                <input type="date" name="renewalDate" value={formData.renewalDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">계약 현황</label>
                                <textarea name="contractDetails" value={formData.contractDetails} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
                            </div>
                           </>
                        )}
                    </div>
                    <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">취소</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const FixedCostsPage: React.FC = () => {
    const { fixedCostLedger, addFixedCostLedgerItem, updateFixedCostLedgerItem, removeFixedCostLedgerItem, currentMonths, setCurrentMonths } = useFinancials();
    const [activeTab, setActiveTab] = useState<FixedCostType>('ASSET_FINANCE');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FixedCostLedgerItem | null>(null);
    const [deletionTarget, setDeletionTarget] = useState<FixedCostLedgerItem | null>(null);

    const filteredLedger = useMemo(() => fixedCostLedger.filter(item => item.costType === activeTab), [fixedCostLedger, activeTab]);

    const handleSave = (itemData: Omit<FixedCostLedgerItem, 'id'> | FixedCostLedgerItem) => {
        if ('id' in itemData) {
            updateFixedCostLedgerItem(itemData.id, itemData);
        } else {
            addFixedCostLedgerItem(itemData);
        }
        setIsModalOpen(false);
        setEditingItem(null);
    };
    
    const handleEdit = (item: FixedCostLedgerItem) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };
    
    const handleDelete = () => {
        if (deletionTarget) {
            removeFixedCostLedgerItem(deletionTarget.id);
            setDeletionTarget(null);
        }
    };
    
    const getRemainingMonths = (endDate: string) => {
        if (!endDate) return { months: Infinity, text: '-' };
        const end = new Date(endDate);
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of day
        if (isNaN(end.getTime())) return { months: Infinity, text: '-' };
        if (end < now) return { months: 0, text: '만료' };
        
        const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
        return { months, text: `${months}개월 남음` };
    };

    const getStatusBadge = (remainingMonths: number) => {
        if (remainingMonths <= 0) return <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">만료</span>;
        if (remainingMonths <= 3) return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">만료 임박</span>;
        if (remainingMonths === Infinity) return null;
        return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">진행중</span>;
    };


    const serviceHeaders = ['서비스명', '업체명', '계약 현황', '출금일', '갱신 예정일', '월 사용료 (원)', '관리'];

    return (
        <>
            <Header
                title="고정비 및 계약 관리"
                description="리스, 금융 자산 및 운영 서비스 계약 정보를 관리합니다."
                actions={
                    <button onClick={handleAddNew} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                        + 고정 지출 추가
                    </button>
                }
                showMonthSelector={false}
                currentMonths={currentMonths}
                setCurrentMonths={setCurrentMonths}
            />
            
            <div className="mt-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('ASSET_FINANCE')} className={`py-3 px-1 border-b-2 font-semibold text-base ${activeTab === 'ASSET_FINANCE' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        리스/금융 자산
                    </button>
                     <button onClick={() => setActiveTab('OPERATING_SERVICE')} className={`py-3 px-1 border-b-2 font-semibold text-base ${activeTab === 'OPERATING_SERVICE' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        운영 서비스 계약
                    </button>
                </nav>
            </div>


            <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {activeTab === 'ASSET_FINANCE' ? (
                                <>
                                    <TableHead>자산명</TableHead>
                                    <TableHead>업체명</TableHead>
                                    <TableHead>만기일자</TableHead>
                                    <TableHead>계약기간</TableHead>
                                    <TableHead>남은 기간</TableHead>
                                    <TableHead className="text-right">월 납입액 (원)</TableHead>
                                    <TableHead className="text-center">상태</TableHead>
                                    <TableHead className="text-center">관리</TableHead>
                                </>
                            ) : (
                                serviceHeaders.map(header => (
                                    <TableHead key={header} className={
                                        header.includes('(원)') ? 'text-right' : 
                                        ['관리', '갱신 예정일', '출금일'].includes(header) ? 'text-center' : ''
                                    }>
                                        {header}
                                    </TableHead>
                                ))
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLedger.map(item => {
                           const remaining = getRemainingMonths(item.contractEndDate || '');
                           return (
                            <TableRow key={item.id} className="group">
                                {activeTab === 'ASSET_FINANCE' ? (
                                    <>
                                        <TableCell className="font-medium">{item.serviceName}</TableCell>
                                        <TableCell>{item.vendor}</TableCell>
                                        <TableCell>{item.contractEndDate || '-'}</TableCell>
                                        <TableCell className="w-32">{item.leaseTermMonths ? `${item.leaseTermMonths}개월` : '-'}</TableCell>
                                        <TableCell className="w-32">{remaining.text}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.monthlyCost)}</TableCell>
                                        <TableCell className="text-center">{getStatusBadge(remaining.months)}</TableCell>
                                        <TableCell className="text-center w-24">
                                            <div className="flex justify-center space-x-2 opacity-0 group-hover:opacity-100">
                                                <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                </button>
                                                <button onClick={() => setDeletionTarget(item)} className="text-gray-400 hover:text-red-500 text-xl font-bold">&times;</button>
                                            </div>
                                        </TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell className="font-medium">{item.serviceName}</TableCell>
                                        <TableCell>{item.vendor}</TableCell>
                                        <TableCell>{item.contractDetails}</TableCell>
                                        <TableCell className="text-center">{item.paymentDate}</TableCell>
                                        <TableCell className="text-center">{item.renewalDate}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.monthlyCost)}</TableCell>
                                        <TableCell className="text-center w-24">
                                             <div className="flex justify-center space-x-2 opacity-0 group-hover:opacity-100">
                                                <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                </button>
                                                <button onClick={() => setDeletionTarget(item)} className="text-gray-400 hover:text-red-500 text-xl font-bold">&times;</button>
                                            </div>
                                        </TableCell>
                                    </>
                                )}
                            </TableRow>
                           );
                        })}
                    </TableBody>
                </Table>
                 {filteredLedger.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        해당 유형의 고정 지출 내역이 없습니다.
                    </div>
                )}
            </div>
            
            {isModalOpen && (
                <FixedCostLedgerModal 
                    item={editingItem}
                    onClose={() => {setIsModalOpen(false); setEditingItem(null);}}
                    onSave={handleSave}
                />
            )}
            {deletionTarget && (
                <ConfirmationModal
                    isOpen={!!deletionTarget}
                    title="고정 지출 삭제 확인"
                    message={`'${deletionTarget.serviceName}' 항목을 정말 삭제하시겠습니까?`}
                    onConfirm={handleDelete}
                    onCancel={() => setDeletionTarget(null)}
                />
            )}
        </>
    );
};

export default FixedCostsPage;