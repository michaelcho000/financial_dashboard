import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon } from './icons/HomeIcon';
import { ChartIcon } from './icons/ChartIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';
import { UsersIcon } from './icons/UsersIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { useAuth } from '../contexts/AuthContext';
import HospitalSwitcher from './HospitalSwitcher';

const Sidebar: React.FC = () => {
    const { currentUser, activeTenantId, availableTenants, setActiveTenantId, logout, exitHospitalManagement, isInHospitalManagementMode } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTenantId = e.target.value;
        if (newTenantId && newTenantId !== activeTenantId) {
            setActiveTenantId(newTenantId);
            // Reload the page to refresh all data with new tenant
            window.location.reload();
        }
    };

    const staffNavItems = [
        { icon: <HomeIcon />, label: '홈', path: '/dashboard' },
        { icon: <ChartIcon />, label: '손익', path: '/income-statement' },
        { icon: <DocumentIcon />, label: '고정비', path: '/fixed-costs' },
        { icon: <ClipboardListIcon />, label: '계정 관리', path: '/account-management' },
        { icon: <DocumentIcon />, label: '월별 리포트', path: '/reports' },
    ];

    const adminNavItems = [
        { icon: <HomeIcon />, label: '대시보드', path: '/admin/dashboard' },
        { icon: <DocumentIcon />, label: '병원 관리', path: '/admin/tenants' },
        { icon: <UsersIcon />, label: '사용자 관리', path: '/admin/users' },
        { icon: <SettingsIcon />, label: '설정', path: '/admin/settings' },
    ];

    // SuperAdmin 병원 관리 모드에서는 GeneralAdmin 메뉴 표시
    const getNavItems = () => {
        if (currentUser?.role === 'superAdmin' && isInHospitalManagementMode) {
            return staffNavItems; // GeneralAdmin 메뉴 그대로 사용
        }
        return currentUser?.role === 'superAdmin' ? adminNavItems : staffNavItems;
    };

    const navItems = getNavItems();
    const activeTenant = availableTenants.find(t => t.id === activeTenantId);

    const handleExitHospitalManagement = () => {
        exitHospitalManagement();
        navigate('/admin/dashboard');
    };

    return (
        <aside className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col justify-between">
            <div>
                <div className="p-3 mb-6 font-bold text-xl">
                    Financial Manager
                </div>

                {/* Hospital Selector for Multi-Hospital Users */}
                {currentUser?.role === 'generalAdmin' && availableTenants.length > 1 && (
                    <div className="px-3 pb-4 mb-4 border-b border-gray-200">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            관리 병원 선택
                        </label>
                        <select
                            value={activeTenantId || ''}
                            onChange={handleTenantChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {availableTenants.map(tenant => (
                                <option key={tenant.id} value={tenant.id}>
                                    {tenant.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* SuperAdmin Hospital Switcher in Management Mode */}
                {currentUser?.role === 'superAdmin' && isInHospitalManagementMode && (
                    <div className="px-3 pb-4 mb-4 border-b border-gray-200">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            병원 관리 모드
                        </label>
                        <HospitalSwitcher />
                        <button
                            onClick={handleExitHospitalManagement}
                            className="w-full mt-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md border border-gray-300"
                        >
                            관리 콘솔로 돌아가기
                        </button>
                    </div>
                )}

                <nav>
                    <ul>
                        {navItems.map(item => (
                            <li key={item.label}>
                                <Link
                                    to={item.path}
                                    className={`flex items-center p-3 my-1 rounded-lg transition-colors ${
                                        location.pathname === item.path
                                            ? 'bg-gray-200 text-gray-900 font-semibold'
                                            : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    {item.icon}
                                    <span className="ml-4">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>

            <div className="mt-auto p-3 border-t border-gray-200">
                {currentUser && (
                    <>
                        <p className="text-sm font-semibold text-gray-800">
                            {currentUser.role === 'superAdmin'
                                ? (isInHospitalManagementMode ? `관리: ${activeTenant?.name}` : '시스템 관리자')
                                : activeTenant?.name || '병원 미할당'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{currentUser.name}님</p>
                        {currentUser.role === 'generalAdmin' && availableTenants.length === 1 && (
                            <p className="text-xs text-gray-400 mt-1">담당: {activeTenant?.name}</p>
                        )}
                        {currentUser.role === 'superAdmin' && isInHospitalManagementMode && (
                            <p className="text-xs text-blue-600 mt-1">병원 관리 모드</p>
                        )}
                        <button
                            onClick={handleLogout}
                            className="w-full mt-4 px-3 py-2 text-sm text-left text-gray-600 hover:bg-gray-100 rounded-md"
                        >
                            로그아웃
                        </button>
                    </>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;