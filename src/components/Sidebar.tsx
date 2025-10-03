import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon } from './icons/HomeIcon';
import { ChartIcon } from './icons/ChartIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';
import { UsersIcon } from './icons/UsersIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { DollarSignIcon } from './icons/DollarSignIcon';
import { useAuth } from '../contexts/AuthContext';
import HospitalSwitcher from './HospitalSwitcher';
import MonthManagementModal from './modals/MonthManagementModal';
import { featureFlags } from '../config/featureFlags';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

const buildStaffNavItems = (): NavItem[] => {
  const items: NavItem[] = [
    { icon: <HomeIcon />, label: '대시보드', path: '/dashboard' },
    { icon: <ChartIcon />, label: '손익', path: '/income-statement' },
    { icon: <DollarSignIcon />, label: '고정비', path: '/fixed-costs' },
    { icon: <ClipboardListIcon />, label: '계정 관리', path: '/account-management' },
    { icon: <DocumentIcon />, label: '월간 리포트', path: '/reports' },
  ];

  if (featureFlags.costingModule) {
    items.splice(2, 0, { icon: <TrendingUpIcon />, label: '원가 인사이트', path: '/costing' });
  }

  return items;
};

const adminNavItems: NavItem[] = [
  { icon: <HomeIcon />, label: '관리자 대시보드', path: '/admin/dashboard' },
  { icon: <DocumentIcon />, label: '병원 관리', path: '/admin/tenants' },
  { icon: <UsersIcon />, label: '사용자 관리', path: '/admin/users' },
  { icon: <SettingsIcon />, label: '시스템 설정', path: '/admin/settings' },
];

const Sidebar: React.FC = () => {
  const {
    currentUser,
    activeTenantId,
    availableTenants,
    setActiveTenantId,
    logout,
    exitHospitalManagement,
    isInHospitalManagementMode,
  } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleTenantChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newTenantId = event.target.value;
    if (newTenantId && newTenantId !== activeTenantId) {
      setActiveTenantId(newTenantId);
      window.location.reload();
    }
  };

  const staffNavItems = buildStaffNavItems();

  const getNavItems = () => {
    if (currentUser?.role === 'superAdmin' && isInHospitalManagementMode) {
      return staffNavItems;
    }
    return currentUser?.role === 'superAdmin' ? adminNavItems : staffNavItems;
  };

  const navItems = getNavItems();
  const activeTenant = availableTenants.find(tenant => tenant.id === activeTenantId) || null;

  const handleExitHospitalManagement = () => {
    exitHospitalManagement();
    navigate('/admin/dashboard');
  };

  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col justify-between">
        <div>
          <div className="px-3 pb-6 text-2xl font-bold text-gray-800">Financial Manager</div>

          {currentUser?.role === 'generalAdmin' && availableTenants.length > 1 && (
            <div className="px-3 pb-4 mb-4 border-b border-gray-200">
              <label className="block text-xs font-medium text-gray-600 mb-1">운영 병원 선택</label>
              <select
                value={activeTenantId || ''}
                onChange={handleTenantChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableTenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentUser?.role === 'superAdmin' && isInHospitalManagementMode && (
            <div className="px-3 pb-4 mb-4 border-b border-gray-200 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">병원 관리 모드</label>
                <HospitalSwitcher />
              </div>
              <button
                type="button"
                onClick={handleExitHospitalManagement}
                className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md border border-gray-300"
              >
                관리자 화면으로 돌아가기
              </button>
            </div>
          )}

          <nav>
            <ul>
              {navItems.map(item => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center p-3 my-1 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-gray-200 text-gray-900 font-semibold'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {item.icon}
                      <span className="ml-4">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-6 px-3">
            <button
              type="button"
              onClick={() => setIsMonthModalOpen(true)}
              className="w-full px-4 py-2 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              월 관리
            </button>
          </div>
        </div>

        <div className="mt-6 p-3 border-t border-gray-200 text-sm text-gray-700 space-y-2">
          {currentUser && (
            <>
              <div className="font-semibold text-gray-800">
                {currentUser.role === 'superAdmin'
                  ? isInHospitalManagementMode
                    ? activeTenant?.name ?? '병원 선택 필요'
                    : '시스템 관리자'
                  : activeTenant?.name ?? '병원 선택 필요'}
              </div>
              <div className="text-xs text-gray-500">{currentUser.name}</div>
              {currentUser.role === 'generalAdmin' && availableTenants.length === 1 && (
                <div className="text-xs text-gray-400">현재 병원: {activeTenant?.name}</div>
              )}
              {currentUser.role === 'superAdmin' && isInHospitalManagementMode && (
                <div className="text-xs text-blue-600">병원 관리 모드 사용 중</div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full mt-3 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </aside>

      {isMonthModalOpen && (
        <MonthManagementModal
          isOpen={isMonthModalOpen}
          onClose={() => setIsMonthModalOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;

