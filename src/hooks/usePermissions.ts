
import { useAuth } from './useAuth';
import { ROLES_CONFIG, RolePermissions } from '../types';

export const usePermissions = () => {
    const { user } = useAuth();

    const getRoleConfig = () => {
        const customConfig = localStorage.getItem('custom_roles_config');
        if (customConfig) {
            try {
                const parsed = JSON.parse(customConfig);
                return parsed[user?.role || 'Technician'] || ROLES_CONFIG[user?.role || 'Technician'];
            } catch (_e) {
                return ROLES_CONFIG[user?.role || 'Technician'];
            }
        }
        return ROLES_CONFIG[user?.role || 'Technician'];
    };

    const hasPermission = (permission: keyof RolePermissions): boolean => {
        if (!user) return false;
        const config = getRoleConfig();
        return config ? config[permission] : false;
    };

    const isAdmin = user?.role === 'Admin';
    const isTechnician = user?.role === 'Technician';
    const isReceptionist = user?.role === 'Receptionist';

    return {
        hasPermission,
        isAdmin,
        isTechnician,
        isReceptionist,
        role: user?.role,
        permissions: user ? getRoleConfig() : null
    };
};
