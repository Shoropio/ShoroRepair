import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Check, X, Save, RotateCcw } from 'lucide-react';
import { Card, Button, Badge } from '../src/components';
import { UserRole, RolePermissions, ROLES_CONFIG } from '../types';
import { toast } from 'sonner';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const RolesPage: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission } = usePermissions();
    const [roles, setRoles] = useState<Record<UserRole, RolePermissions>>(ROLES_CONFIG);
    const [hasChanges, setHasChanges] = useState(false);

    React.useEffect(() => {
        const custom = localStorage.getItem('custom_roles_config');
        if (custom) {
            try {
                setRoles(JSON.parse(custom));
            } catch (e) {
                console.error("Error loading custom roles", e);
            }
        }
    }, []);

    if (!hasPermission('canManageUsers')) {
        return <Navigate to="/" replace />;
    }

    const togglePermission = (role: UserRole, permission: keyof RolePermissions) => {
        setRoles(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [permission]: !prev[role][permission]
            }
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        localStorage.setItem('custom_roles_config', JSON.stringify(roles));
        toast.success(t('roles.save_success'));
        setHasChanges(false);
    };

    const handleReset = () => {
        setRoles(ROLES_CONFIG);
        localStorage.removeItem('custom_roles_config');
        toast.info(t('roles.reset_success'));
        setHasChanges(false);
    };

    const permissions: Array<{ key: keyof RolePermissions; label: string; description: string }> = [
        { key: 'canViewReports', label: t('roles.permissions.view_reports'), description: 'Acceso a estadísticas e informes financieros' },
        { key: 'canManageInventory', label: t('roles.permissions.manage_inventory'), description: 'Agregar, editar y ver repuestos' },
        { key: 'canManageUsers', label: t('roles.permissions.manage_users'), description: 'Crear, editar y eliminar usuarios' },
        { key: 'canEditOrders', label: t('roles.permissions.edit_orders'), description: 'Modificar órdenes de servicio' },
        { key: 'canDeleteData', label: t('roles.permissions.delete_data'), description: 'Eliminar registros de forma permanente' },
        { key: 'canManageExpenses', label: t('roles.permissions.manage_expenses'), description: 'Registrar y ver egresos operativos' },
        { key: 'canManageClients', label: t('roles.permissions.manage_clients'), description: 'Control de información de clientes' }
    ];

    const roleInfo: Record<UserRole, { color: string; bg: string; description: string }> = {
        Admin: { color: '#d93025', bg: '#fce8e6', description: 'Control de infraestructura y finanzas' },
        Technician: { color: '#1a73e8', bg: '#e8f0fe', description: 'Gestión técnica y de refacciones' },
        Receptionist: { color: '#188038', bg: '#e6f4ea', description: 'Recepción y atención directa' }
    };

    return (
        <div className="space-y-10 animate-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('roles.title')}</h1>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">{t('roles.subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    {hasChanges && (
                        <>
                            <Button variant="ghost" onClick={handleReset} leftIcon={<RotateCcw size={18} />}>
                                {t('common.discard')}
                            </Button>
                            <Button variant="primary" onClick={handleSave} leftIcon={<Save size={18} />}>
                                {t('common.apply')}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Warning Banner */}
            <div className="flex items-start gap-4 p-4 bg-[#fef7e0] dark:bg-[#fbbc04]/10 rounded-none border border-[#fbbc04]/20">
                <Shield size={20} className="text-[#f9ab00] shrink-0" />
                <p className="text-xs font-semibold text-[#f9ab00] leading-normal uppercase tracking-tight">
                    {t('roles.warning')}
                </p>
            </div>

            {/* Grid of Roles */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {(Object.keys(roles) as UserRole[]).map(role => (
                    <Card key={role} variant="outlined" className="group">
                        <div className="mb-6 space-y-2">
                            <div
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-none font-bold text-[11px] uppercase tracking-wider"
                                style={{ backgroundColor: roleInfo[role].bg, color: roleInfo[role].color }}
                            >
                                <Shield size={14} />
                                {role}
                            </div>
                            <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-medium leading-relaxed italic">
                                "{roleInfo[role].description}"
                            </p>
                        </div>

                        <div className="space-y-4">
                            {permissions.map(perm => (
                                <div
                                    key={perm.key}
                                    className="flex items-start gap-3 p-3 bg-[#f8f9fa] dark:bg-[#2d2f31] rounded-none hover:bg-white dark:hover:bg-[#1a1c1e] hover:shadow-sm border border-transparent transition-all cursor-pointer group/item"
                                    onClick={() => togglePermission(role, perm.key)}
                                >
                                    <div className={`w-5 h-5 rounded-none border-2 flex items-center justify-center shrink-0 transition-all ${roles[role][perm.key]
                                        ? 'bg-[#1a73e8] border-[#1a73e8]'
                                        : 'border-[#dadce0] dark:border-[#3c4043]'
                                        }`}>
                                        {roles[role][perm.key] && <Check size={12} className="text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-[#3c4043] dark:text-white group-hover/item:text-[#1a73e8] transition-colors">
                                            {perm.label}
                                        </p>
                                        <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] font-medium leading-[1.4] mt-1">
                                            {perm.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-[#f1f3f4] dark:border-[#3c4043]">
                            <Badge variant="brand" size="xs">
                                {Object.values(roles[role]).filter(Boolean).length} de {permissions.length} Habilitados
                            </Badge>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Visual Consistency Matrix */}
            <Card
                header={<h3 className="text-sm font-bold text-[#3c4043] dark:text-white">{t('roles.matrix')}</h3>}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[#f1f3f4] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124]">
                                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('roles.module')}</th>
                                {(Object.keys(roles) as UserRole[]).map(role => (
                                    <th key={role} className="px-6 py-4 text-center text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">
                                        {role}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
                            {permissions.map(perm => (
                                <tr key={perm.key} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4 text-xs font-semibold text-[#202124] dark:text-white">
                                        {perm.label}
                                    </td>
                                    {(Object.keys(roles) as UserRole[]).map(role => (
                                        <td key={role} className="px-6 py-4 text-center">
                                            {roles[role][perm.key] ? (
                                                <div className="w-6 h-6 bg-[#e6f4ea] text-[#1e8e3e] rounded-none inline-flex items-center justify-center">
                                                    <Check size={14} />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 bg-[#fce8e6] text-[#d93025] rounded-none inline-flex items-center justify-center">
                                                    <X size={14} />
                                                </div>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default RolesPage;
