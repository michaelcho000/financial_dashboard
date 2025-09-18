import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DatabaseService from '../services/DatabaseService';
import { ChevronDown, Building2, Search } from 'lucide-react';

const HospitalSwitcher: React.FC = () => {
    const { activeTenantId, setActiveTenantId } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const tenants = DatabaseService.getTenants();
    const filteredTenants = tenants.filter(tenant =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleTenantSelect = (tenantId: string) => {
        if (tenantId !== activeTenantId) {
            setActiveTenantId(tenantId);
            navigate('/dashboard');
        }
        setIsOpen(false);
        setSearchTerm('');
    };

    const currentTenant = tenants.find(t => t.id === activeTenantId);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                    {currentTenant ? currentTenant.name : '병원 선택'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="병원 검색..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredTenants.map((tenant) => (
                            <button
                                key={tenant.id}
                                onClick={() => handleTenantSelect(tenant.id)}
                                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                    tenant.id === activeTenantId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm font-medium">{tenant.name}</span>
                                    {tenant.id === activeTenantId && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">현재</span>
                                    )}
                                </div>
                            </button>
                        ))}
                        {filteredTenants.length === 0 && (
                            <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                검색 결과가 없습니다
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                        setIsOpen(false);
                        setSearchTerm('');
                    }}
                />
            )}
        </div>
    );
};

export default HospitalSwitcher;