import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, AuthContextType } from '../types';
import DatabaseService from '../services/DatabaseService';

const AuthContext = createContext<AuthContextType | null>(null);

const CURRENT_USER_KEY = 'financial_app_current_user';
const ACTIVE_TENANT_KEY = 'financial_app_active_tenant';
const SUPERADMIN_HOSPITAL_KEY = 'superadmin_selected_hospital';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
    const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        DatabaseService.init();
        try {
            const storedUser = localStorage.getItem(CURRENT_USER_KEY);
            if (storedUser) {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);

                // Load available tenants for the user
                if (user.role === 'superAdmin') {
                    // SuperAdmin can access all hospitals
                    const allTenants = DatabaseService.getTenants();
                    setAvailableTenants(allTenants);

                    // Load SuperAdmin's selected hospital
                    const selectedHospital = localStorage.getItem(SUPERADMIN_HOSPITAL_KEY);
                    if (selectedHospital && allTenants.find(t => t.id === selectedHospital)) {
                        setActiveTenantIdState(selectedHospital);
                    }
                } else if (user.tenantIds && user.tenantIds.length > 0) {
                    const tenants = user.tenantIds
                        .map((id: string) => DatabaseService.getTenant(id))
                        .filter((t: Tenant | null) => t !== null) as Tenant[];
                    setAvailableTenants(tenants);

                    // Load saved active tenant or default to first tenant
                    const savedActiveTenant = localStorage.getItem(ACTIVE_TENANT_KEY);
                    if (savedActiveTenant && user.tenantIds.includes(savedActiveTenant)) {
                        setActiveTenantIdState(savedActiveTenant);
                    } else if (user.tenantIds.length > 0) {
                        setActiveTenantIdState(user.tenantIds[0]);
                        localStorage.setItem(ACTIVE_TENANT_KEY, user.tenantIds[0]);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load user from localStorage', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const login = async (id: string, password?: string): Promise<User | null> => {
        const user = DatabaseService.login(id, password);
        if (user) {
            setCurrentUser(user);
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

            // Set up available tenants and active tenant
            if (user.role === 'superAdmin') {
                // SuperAdmin can access all hospitals
                const allTenants = DatabaseService.getTenants();
                setAvailableTenants(allTenants);
                // SuperAdmin doesn't have a default hospital selected
            } else if (user.tenantIds && user.tenantIds.length > 0) {
                const tenants = user.tenantIds
                    .map(tenantId => DatabaseService.getTenant(tenantId))
                    .filter(t => t !== null) as Tenant[];
                setAvailableTenants(tenants);

                // Set first tenant as active by default
                setActiveTenantIdState(user.tenantIds[0]);
                localStorage.setItem(ACTIVE_TENANT_KEY, user.tenantIds[0]);
            }
        }
        return user;
    };

    const logout = () => {
        setCurrentUser(null);
        setActiveTenantIdState(null);
        setAvailableTenants([]);
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem(ACTIVE_TENANT_KEY);
    };

    const setActiveTenantId = (tenantId: string) => {
        if (currentUser?.role === 'superAdmin') {
            // SuperAdmin can access any hospital
            setActiveTenantIdState(tenantId);
            localStorage.setItem(SUPERADMIN_HOSPITAL_KEY, tenantId);
        } else {
            // Verify the user has access to this tenant
            if (currentUser?.tenantIds?.includes(tenantId)) {
                setActiveTenantIdState(tenantId);
                localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
            }
        }
    };

    const exitHospitalManagement = () => {
        if (currentUser?.role === 'superAdmin') {
            setActiveTenantIdState(null);
            localStorage.removeItem(SUPERADMIN_HOSPITAL_KEY);
        }
    };

    const isInHospitalManagementMode = currentUser?.role === 'superAdmin' && activeTenantId !== null;

    const value = {
        currentUser,
        activeTenantId,
        loading,
        login,
        logout,
        setActiveTenantId,
        availableTenants,
        exitHospitalManagement,
        isInHospitalManagementMode
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === null) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};