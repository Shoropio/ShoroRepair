import { UserRole } from './enums';

export interface RolePermissions {
    canViewReports: boolean;
    canManageInventory: boolean;
    canManageUsers: boolean;
    canEditOrders: boolean;
    canDeleteData: boolean;
    canManageExpenses: boolean;
    canManageClients: boolean;
}

export const ROLES_CONFIG: Record<UserRole, RolePermissions> = {
    Admin: {
        canViewReports: true,
        canManageInventory: true,
        canManageUsers: true,
        canEditOrders: true,
        canDeleteData: true,
        canManageExpenses: true,
        canManageClients: true
    },
    Technician: {
        canViewReports: false,
        canManageInventory: true,
        canManageUsers: false,
        canEditOrders: true,
        canDeleteData: false,
        canManageExpenses: false,
        canManageClients: true
    },
    Receptionist: {
        canViewReports: false,
        canManageInventory: false,
        canManageUsers: false,
        canEditOrders: true,
        canDeleteData: false,
        canManageExpenses: false,
        canManageClients: true
    }
};
