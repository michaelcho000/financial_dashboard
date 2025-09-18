import React, { useState, useEffect } from 'react';
import { User, Tenant } from '../types';
import DatabaseService from '../services/DatabaseService';
import Header from '../components/Header';
import NotificationModal from '../components/common/NotificationModal';
import ConfirmationModal from '../components/common/ConfirmationModal';

const AdminUsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Form states for add/edit
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        email: '',
        password: '',
        role: 'generalAdmin' as 'superAdmin' | 'generalAdmin',
        tenantIds: [] as string[]
    });

    const [currentMonths, setCurrentMonths] = useState<[string, string | null]>(['', null]);
    const [notification, setNotification] = useState({ isOpen: false, message: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setUsers(DatabaseService.getUsers());
        setTenants(DatabaseService.getTenants());
    };

    const resetForm = () => {
        setFormData({
            id: '',
            name: '',
            email: '',
            password: '',
            role: 'generalAdmin',
            tenantIds: []
        });
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.id || !formData.name || !formData.email || !formData.password) {
            setNotification({ isOpen: true, message: '모든 필수 항목을 입력해주세요.' });
            return;
        }

        const newUser: User = {
            id: formData.id,
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            tenantIds: formData.tenantIds,
        };

        const success = DatabaseService.addUser(newUser);
        if (success) {
            loadData();
            setIsAddModalOpen(false);
            resetForm();
            setNotification({ isOpen: true, message: '사용자가 성공적으로 추가되었습니다.' });
        } else {
            setNotification({ isOpen: true, message: '사용자 ID 또는 이메일이 이미 존재합니다.' });
        }
    };

    const handleEditUser = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedUser || !formData.name || !formData.email) {
            setNotification({ isOpen: true, message: '모든 필수 항목을 입력해주세요.' });
            return;
        }

        const updates: Partial<User> = {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            tenantIds: formData.tenantIds,
        };

        // If password is provided, update it
        if (formData.password) {
            updates.password = formData.password;
        }

        const success = DatabaseService.updateUser(selectedUser.id, updates);
        if (success) {
            loadData();
            setIsEditModalOpen(false);
            resetForm();
            setSelectedUser(null);
            setNotification({ isOpen: true, message: '사용자 정보가 성공적으로 수정되었습니다.' });
        } else {
            setNotification({ isOpen: true, message: '사용자 정보 수정에 실패했습니다.' });
        }
    };

    const handleDeleteUser = () => {
        if (!selectedUser) return;

        // Prevent deleting superAdmin
        if (selectedUser.role === 'superAdmin') {
            setNotification({ isOpen: true, message: '슈퍼 관리자는 삭제할 수 없습니다.' });
            setShowDeleteModal(false);
            return;
        }

        const success = DatabaseService.deleteUser(selectedUser.id);
        if (success) {
            loadData();
            setShowDeleteModal(false);
            setSelectedUser(null);
            setNotification({ isOpen: true, message: '사용자가 성공적으로 삭제되었습니다.' });
        } else {
            setNotification({ isOpen: true, message: '사용자 삭제에 실패했습니다.' });
        }
    };

    const openEditModal = (user: User) => {
        setSelectedUser(user);
        setFormData({
            id: user.id,
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            tenantIds: user.tenantIds || []
        });
        setIsEditModalOpen(true);
    };

    const openDeleteModal = (user: User) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
    };

    const handleTenantToggle = (tenantId: string) => {
        setFormData(prev => ({
            ...prev,
            tenantIds: prev.tenantIds.includes(tenantId)
                ? prev.tenantIds.filter(id => id !== tenantId)
                : [...prev.tenantIds, tenantId]
        }));
    };

    return (
        <>
            <Header
                title="사용자 관리"
                description="병원 담당자 계정을 생성하고 관리합니다."
                actions={
                    <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                        + 사용자 추가
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
                            <th className="p-4 text-left font-semibold text-slate-600">사용자 ID</th>
                            <th className="p-4 text-left font-semibold text-slate-600">이름</th>
                            <th className="p-4 text-left font-semibold text-slate-600">이메일</th>
                            <th className="p-4 text-left font-semibold text-slate-600">역할</th>
                            <th className="p-4 text-left font-semibold text-slate-600">담당 병원</th>
                            <th className="p-4 text-left font-semibold text-slate-600">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b last:border-0">
                                <td className="p-4">{user.id}</td>
                                <td className="p-4">{user.name}</td>
                                <td className="p-4">{user.email}</td>
                                <td className="p-4">
                                    {user.role === 'superAdmin' ? '슈퍼 관리자' : '일반 관리자'}
                                </td>
                                <td className="p-4">
                                    {user.tenantIds && user.tenantIds.length > 0
                                        ? user.tenantIds.map(tid => tenants.find(t => t.id === tid)?.name).filter(Boolean).join(', ')
                                        : '-'
                                    }
                                </td>
                                <td className="p-4 space-x-3">
                                    {user.role !== 'superAdmin' && (
                                        <>
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                수정
                                            </button>
                                            <button
                                                onClick={() => openDeleteModal(user)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                삭제
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add User Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleAddUser}>
                            <div className="p-6 border-b">
                                <h3 className="text-xl font-bold">새 사용자 추가</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">사용자 ID *</label>
                                    <input
                                        type="text"
                                        value={formData.id}
                                        onChange={e => setFormData({...formData, id: e.target.value})}
                                        required
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">이름 *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        required
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">이메일 *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        required
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">비밀번호 *</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        required
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">담당 병원 (복수 선택 가능)</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3">
                                        {tenants.map(tenant => (
                                            <label key={tenant.id} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.tenantIds.includes(tenant.id)}
                                                    onChange={() => handleTenantToggle(tenant.id)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">{tenant.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {formData.tenantIds.length === 0 && (
                                        <p className="text-xs text-gray-500 mt-1">최소 하나 이상의 병원을 선택해주세요.</p>
                                    )}
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAddModalOpen(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    추가
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {isEditModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setIsEditModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleEditUser}>
                            <div className="p-6 border-b">
                                <h3 className="text-xl font-bold">사용자 정보 수정</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">사용자 ID</label>
                                    <input
                                        type="text"
                                        value={formData.id}
                                        disabled
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">이름 *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        required
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">이메일 *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        required
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">새 비밀번호 (변경시에만 입력)</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        placeholder="변경하지 않으려면 비워두세요"
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">담당 병원 (복수 선택 가능)</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3">
                                        {tenants.map(tenant => (
                                            <label key={tenant.id} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.tenantIds.includes(tenant.id)}
                                                    onChange={() => handleTenantToggle(tenant.id)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">{tenant.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {formData.tenantIds.length === 0 && (
                                        <p className="text-xs text-gray-500 mt-1">최소 하나 이상의 병원을 선택해주세요.</p>
                                    )}
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setSelectedUser(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    수정
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedUser && (
                <ConfirmationModal
                    isOpen={showDeleteModal}
                    onCancel={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteUser}
                    title="사용자 삭제 확인"
                    message={`정말로 "${selectedUser.name}" 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
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

export default AdminUsersPage;