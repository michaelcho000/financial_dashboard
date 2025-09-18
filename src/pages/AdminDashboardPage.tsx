import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DatabaseService from '../services/DatabaseService';
import { User, Tenant } from '../types';
import Header from '../components/Header';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users, AlertTriangle, UserCheck, Eye } from 'lucide-react';

interface DashboardMetrics {
    totalTenants: number;
    totalUsers: number;
    activeUsers: number;
    newTenantsThisMonth: number;
    tenantsWithoutUsers: number;
    usersWithMultipleTenants: number;
}

interface TenantHealthInfo {
    tenant: Tenant;
    assignedUsers: User[];
    lastDataMonth: string | null;
    hasFixedCosts: boolean;
}

const AdminDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { setActiveTenantId } = useAuth();
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        totalTenants: 0,
        totalUsers: 0,
        activeUsers: 0,
        newTenantsThisMonth: 0,
        tenantsWithoutUsers: 0,
        usersWithMultipleTenants: 0
    });
    const [tenantHealthData, setTenantHealthData] = useState<TenantHealthInfo[]>([]);
    const [alerts, setAlerts] = useState<string[]>([]);
    const [currentMonths, setCurrentMonths] = useState<[string, string | null]>(['', null]);
    const [users, setUsers] = useState<User[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = () => {
        // Load basic metrics
        const tenants = DatabaseService.getTenants();
        const users = DatabaseService.getUsers();

        // Set state for use in components
        setTenants(tenants);
        setUsers(users);

        // Calculate metrics
        const generalAdmins = users.filter(u => u.role === 'generalAdmin');
        const activeUserCount = generalAdmins.filter(u => u.tenantIds && u.tenantIds.length > 0).length;
        const tenantsWithoutUsersCount = tenants.filter(t =>
            !users.some(u => u.tenantIds?.includes(t.id))
        ).length;
        const usersWithMultipleTenantsCount = users.filter(u =>
            u.tenantIds && u.tenantIds.length > 1
        ).length;

        setMetrics({
            totalTenants: tenants.length,
            totalUsers: users.length,
            activeUsers: activeUserCount,
            newTenantsThisMonth: 0, // Will need timestamp data
            tenantsWithoutUsers: tenantsWithoutUsersCount,
            usersWithMultipleTenants: usersWithMultipleTenantsCount
        });

        // Load tenant health data
        const healthData: TenantHealthInfo[] = tenants.map(tenant => {
            const assignedUsers = users.filter(u => u.tenantIds?.includes(tenant.id));
            const financials = DatabaseService.getFinancials(tenant.id);

            // Find last month with data
            let lastDataMonth = null;
            if (financials.transactionData) {
                const months = Object.keys(financials.transactionData).sort().reverse();
                lastDataMonth = months[0] || null;
            }

            // Check if has fixed costs
            const hasFixedCosts = financials.fixedCostLedger && financials.fixedCostLedger.length > 0;

            return {
                tenant,
                assignedUsers,
                lastDataMonth,
                hasFixedCosts
            };
        });

        setTenantHealthData(healthData);

        // Generate alerts
        const newAlerts: string[] = [];

        if (tenantsWithoutUsersCount > 0) {
            newAlerts.push(`${tenantsWithoutUsersCount}개 병원에 담당자가 배정되지 않았습니다.`);
        }

        const usersWithoutTenants = generalAdmins.filter(u => !u.tenantIds || u.tenantIds.length === 0);
        if (usersWithoutTenants.length > 0) {
            newAlerts.push(`${usersWithoutTenants.length}명의 담당자가 병원에 배정되지 않았습니다.`);
        }

        // Check for tenants without recent data
        const tenantsWithoutRecentData = healthData.filter(h => !h.lastDataMonth).length;
        if (tenantsWithoutRecentData > 0) {
            newAlerts.push(`${tenantsWithoutRecentData}개 병원에 재무 데이터가 없습니다.`);
        }

        setAlerts(newAlerts);
    };

    const handleEnterHospitalManagement = (tenantId: string) => {
        // SuperAdmin이 병원을 선택하고 실제 GeneralAdmin 페이지로 이동
        setActiveTenantId(tenantId);
        navigate('/dashboard');
    };

    return (
        <>
            <Header
                title="대시보드"
                description="전체 시스템 현황을 한눈에 확인하세요"
                currentMonths={currentMonths}
                setCurrentMonths={setCurrentMonths}
                showMonthSelector={false}
            />

            {/* Key Metrics Cards */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">전체 병원</p>
                            <p className="text-2xl font-bold text-gray-900 mt-2">{metrics.totalTenants}</p>
                        </div>
                        <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">전체 사용자</p>
                            <p className="text-2xl font-bold text-gray-900 mt-2">{metrics.totalUsers}</p>
                            <p className="text-xs text-gray-500 mt-1">활성: {metrics.activeUsers}명</p>
                        </div>
                        <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <Users className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">미배정 병원</p>
                            <p className="text-2xl font-bold text-orange-600 mt-2">{metrics.tenantsWithoutUsers}</p>
                            <p className="text-xs text-gray-500 mt-1">담당자 필요</p>
                        </div>
                        <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-orange-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">다중 담당</p>
                            <p className="text-2xl font-bold text-gray-900 mt-2">{metrics.usersWithMultipleTenants}</p>
                            <p className="text-xs text-gray-500 mt-1">복수 병원 관리</p>
                        </div>
                        <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <UserCheck className="h-6 w-6 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts Section */}
            {alerts.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">알림 및 주의사항</h2>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <ul className="space-y-2">
                            {alerts.map((alert, index) => (
                                <li key={index} className="flex items-start">
                                    <span className="text-yellow-600 mr-2">•</span>
                                    <span className="text-sm text-gray-700">{alert}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* User Assignment Map */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Unassigned Users */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-md font-semibold text-gray-900 mb-4">병원 미배정 담당자</h3>
                    <div className="space-y-2">
                        {(() => {
                            const unassignedUsers = users.filter(u => u.role === 'generalAdmin' && (!u.tenantIds || u.tenantIds.length === 0));
                            if (unassignedUsers.length === 0) {
                                return <p className="text-sm text-gray-500">모든 담당자가 배정되었습니다</p>;
                            }
                            return unassignedUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                                    <div>
                                        <span className="text-sm font-medium text-gray-900">{user.name}</span>
                                        <span className="text-xs text-gray-500 ml-2">({user.email})</span>
                                    </div>
                                    <button className="text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700">
                                        병원 배정
                                    </button>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* Multi-Tenant Users */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-md font-semibold text-gray-900 mb-4">복수 병원 담당자</h3>
                    <div className="space-y-2">
                        {(() => {
                            const multiTenantUsers = users.filter(u => u.tenantIds && u.tenantIds.length > 1);
                            if (multiTenantUsers.length === 0) {
                                return <p className="text-sm text-gray-500">복수 병원 담당자가 없습니다</p>;
                            }
                            return multiTenantUsers.map(user => {
                                const userTenants = tenants.filter(t => user.tenantIds?.includes(t.id));
                                return (
                                    <div key={user.id} className="p-2 bg-purple-50 rounded">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-900">{user.name}</span>
                                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                                                {user.tenantIds?.length}개 병원
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1">
                                            {userTenants.map(t => t.name).join(', ')}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>

            {/* Tenant Health Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">병원 운영 현황</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    병원명
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    담당자
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    최근 데이터
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    고정비 등록
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    상태
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    관리
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tenantHealthData.map((health) => (
                                <tr key={health.tenant.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {health.tenant.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-600">
                                            {health.assignedUsers.length > 0 ? (
                                                <div>
                                                    {health.assignedUsers.map(u => u.name).join(', ')}
                                                    <span className="text-xs text-gray-500 ml-1">
                                                        ({health.assignedUsers.length}명)
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-red-600">미배정</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-600">
                                            {health.lastDataMonth || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                            health.hasFixedCosts
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {health.hasFixedCosts ? '등록' : '미등록'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                            health.assignedUsers.length > 0 && health.lastDataMonth
                                                ? 'bg-green-100 text-green-800'
                                                : health.assignedUsers.length > 0
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {health.assignedUsers.length > 0 && health.lastDataMonth
                                                ? '정상'
                                                : health.assignedUsers.length > 0
                                                ? '데이터 필요'
                                                : '담당자 필요'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => handleEnterHospitalManagement(health.tenant.id)}
                                            className="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            병원 관리
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default AdminDashboardPage;