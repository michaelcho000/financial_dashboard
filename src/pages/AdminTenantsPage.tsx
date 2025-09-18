import React, { useState, useEffect } from 'react';
import DatabaseService from '../services/DatabaseService';
import { Tenant } from '../types';
import Header from '../components/Header';
import NotificationModal from '../components/common/NotificationModal';
import ConfirmationModal from '../components/common/ConfirmationModal';

interface TenantWithUserCount extends Tenant {
    userCount: number;
}

const AdminTenantsPage: React.FC = () => {
    const [tenants, setTenants] = useState<TenantWithUserCount[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<TenantWithUserCount | null>(null);
    const [formData, setFormData] = useState({ name: '' });
    const [currentMonths, setCurrentMonths] = useState<[string, string | null]>(['', null]);
    const [notification, setNotification] = useState({ isOpen: false, message: '' });

    // 테넌트 목록 로드
    const loadTenants = () => {
        const tenantList = DatabaseService.getTenants();
        const tenantsWithUserCount = tenantList.map(tenant => ({
            ...tenant,
            userCount: DatabaseService.getUsersByTenantId(tenant.id).length
        }));
        setTenants(tenantsWithUserCount);
    };

    useEffect(() => {
        loadTenants();
    }, []);

    // 병원 추가 처리
    const handleAddTenant = () => {
        if (!formData.name.trim()) {
            setNotification({ isOpen: true, message: '병원명을 입력해주세요.' });
            return;
        }

        const newTenantId = DatabaseService.addTenant(formData.name.trim());
        if (newTenantId) {
            loadTenants();
            setShowAddModal(false);
            setFormData({ name: '' });
            setNotification({ isOpen: true, message: '새 병원이 성공적으로 추가되었습니다.' });
        } else {
            setNotification({ isOpen: true, message: '동일한 이름의 병원이 이미 존재합니다. 다른 이름을 사용해주세요.' });
        }
    };

    // 병원 정보 수정
    const handleEditTenant = () => {
        if (!selectedTenant || !formData.name.trim()) {
            setNotification({ isOpen: true, message: '병원명을 입력해주세요.' });
            return;
        }

        const success = DatabaseService.updateTenant(selectedTenant.id, { name: formData.name.trim() });
        if (success) {
            loadTenants();
            setShowEditModal(false);
            setSelectedTenant(null);
            setFormData({ name: '' });
            setNotification({ isOpen: true, message: '병원 정보가 성공적으로 수정되었습니다.' });
        } else {
            setNotification({ isOpen: true, message: '병원 정보 수정에 실패했습니다.' });
        }
    };

    // 병원 삭제
    const handleDeleteTenant = () => {
        if (!selectedTenant) return;

        // 사용자 할당 확인
        const assignedUsers = DatabaseService.getUsersByTenantId(selectedTenant.id);
        if (assignedUsers.length > 0) {
            setNotification({ isOpen: true, message: `이 병원에는 ${assignedUsers.length}명의 사용자가 할당되어 있어 삭제할 수 없습니다. 사용자를 먼저 다른 병원으로 재할당하거나 삭제해주세요.` });
            setShowDeleteModal(false);
            return;
        }

        const success = DatabaseService.deleteTenant(selectedTenant.id);
        if (success) {
            loadTenants();
            setShowDeleteModal(false);
            setSelectedTenant(null);
            setNotification({ isOpen: true, message: '병원이 성공적으로 삭제되었습니다.' });
        } else {
            setNotification({ isOpen: true, message: '병원 삭제에 실패했습니다.' });
        }
    };

    // 수정 모달 열기
    const openEditModal = (tenant: TenantWithUserCount) => {
        setSelectedTenant(tenant);
        setFormData({ name: tenant.name });
        setShowEditModal(true);
    };

    // 삭제 모달 열기
    const openDeleteModal = (tenant: TenantWithUserCount) => {
        setSelectedTenant(tenant);
        setShowDeleteModal(true);
    };

    return (
        <>
            <Header
                title="병원 관리"
                description="시스템에 등록된 병원들을 관리합니다."
                actions={
                    <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                        + 새 병원 추가
                    </button>
                }
                currentMonths={currentMonths}
                setCurrentMonths={setCurrentMonths}
                showMonthSelector={false}
            />

            <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 text-left font-semibold text-slate-600">병원명</th>
                            <th className="p-4 text-left font-semibold text-slate-600">할당된 사용자 수</th>
                            <th className="p-4 text-left font-semibold text-slate-600">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tenants.map((tenant) => (
                            <tr key={tenant.id} className="border-b last:border-0">
                                <td className="p-4">{tenant.name}</td>
                                <td className="p-4">{tenant.userCount}명</td>
                                <td className="p-4 space-x-3">
                                    <button
                                        onClick={() => openEditModal(tenant)}
                                        className="text-blue-600 hover:text-blue-900"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(tenant)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {tenants.length === 0 && (
                            <tr>
                                <td colSpan={3} className="p-4 text-center text-gray-500">
                                    등록된 병원이 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* 새 병원 추가 모달 */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">새 병원 추가</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    병원명 *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ name: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="예: 강남 피부과"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setFormData({ name: '' });
                                }}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAddTenant}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 병원 수정 모달 */}
            {showEditModal && selectedTenant && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">병원 정보 수정</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    병원명 *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ name: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedTenant(null);
                                    setFormData({ name: '' });
                                }}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleEditTenant}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                수정
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 삭제 확인 모달 */}
            {showDeleteModal && selectedTenant && (
                <ConfirmationModal
                    isOpen={showDeleteModal}
                    onCancel={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteTenant}
                    title="병원 삭제 확인"
                    message={`정말로 "${selectedTenant.name}" 병원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
                    confirmText="삭제"
                    cancelText="취소"
                />
            )}

            <NotificationModal
                isOpen={notification.isOpen}
                message={notification.message}
                onClose={() => setNotification({ isOpen: false, message: '' })}
            />
        </>
    );
};

export default AdminTenantsPage;