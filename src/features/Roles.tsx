import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    Save,
    RefreshCcw,
    Check,
    X,
    Lock,
    Eye,
    Package,
    Users as UsersIcon,
    FileEdit,
    Trash2,
    DollarSign,
    UserCheck
} from 'lucide-react';
import { Card, Button, Badge } from '../components';
import { ROLES_CONFIG, RolePermissions, UserRole } from '../types';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

const Roles: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission } = usePermissions();

    // State for current permissions config
    const [config, setConfig] = useState<Record<UserRole, RolePermissions>>(ROLES_CONFIG);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('custom_roles_config');
        if (saved) {
            try {
                setConfig(JSON.parse(saved));
            } catch (e) {
                setConfig(ROLES_CONFIG);
            }
        }
    }, []);

    if (!hasPermission('canManageUsers')) {
        return <Navigate to="/" replace />;
    }

    const handleToggle = (role: UserRole, permission: keyof RolePermissions) => {
        if (role === 'Admin') return; // Admin permissions are locked

        const newConfig = {
            ...config,
            [role]: {
                ...config[role],
                [permission]: !config[role][permission]
            }
        };
        setConfig(newConfig);
        setIsDirty(true);
    };

    const handleSave = () => {
        localStorage.setItem('custom_roles_config', JSON.stringify(config));
        setIsDirty(false);
        toast.success(t('roles.save_success'));
        // Reload to apply changes globally
        setTimeout(() => window.location.reload(), 1000);
    };

    const handleReset = () => {
        if (confirm(t('common.confirm_reset', '¿Restablecer permisos predeterminados?'))) {
            localStorage.removeItem('custom_roles_config');
            setConfig(ROLES_CONFIG);
            setIsDirty(false);
            toast.success(t('roles.reset_success'));
            setTimeout(() => window.location.reload(), 1000);
        }
    };

    const permissionList: { key: keyof RolePermissions; label: string; icon: any }[] = [
        { key: 'canViewReports', label: t('roles.permissions.view_reports'), icon: Eye },
        { key: 'canManageInventory', label: t('roles.permissions.manage_inventory'), icon: Package },
        { key: 'canManageUsers', label: t('roles.permissions.manage_users'), icon: UsersIcon },
        { key: 'canEditOrders', label: t('roles.permissions.edit_orders'), icon: FileEdit },
        { key: 'canDeleteData', label: t('roles.permissions.delete_data'), icon: Trash2 },
        { key: 'canManageExpenses', label: t('roles.permissions.manage_expenses'), icon: DollarSign },
        { key: 'canManageClients', label: t('roles.permissions.manage_clients'), icon: UserCheck },
    ];

    const roles: UserRole[] = ['Admin', 'Technician', 'Receptionist'];

    const getRoleIcon = (role: UserRole) => {
        switch (role) {
            case 'Admin': return <ShieldCheck size={24} className="text-[#1a73e8]" />;
            case 'Technician': return <Shield size={24} className="text-[#f9ab00]" />;
            case 'Receptionist': return <Shield size={24} className="text-[#1e8e3e]" />;
        }
    };

    return (
        <div className="space-y-8 animate-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">
                        {t('roles.title')}
                    </h1>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">
                        {t('roles.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        leftIcon={<RefreshCcw size={18} />}
                        onClick={handleReset}
                    >
                        {t('common.reset', 'Restablecer')}
                    </Button>
                    <Button
                        variant="primary"
                        leftIcon={<Save size={18} />}
                        onClick={handleSave}
                        disabled={!isDirty}
                    >
                        {t('common.save')}
                    </Button>
                </div>
            </div>

            {/* Warning Card */}
            <Card variant="tonal" className="bg-[#fef7e0] dark:bg-[#fbbc04]/10 border-[#f9ab00]/20 p-4 flex items-start gap-3">
                <ShieldAlert className="text-[#f9ab00] shrink-0 mt-0.5" size={20} />
                <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                    {t('roles.warning')}
                </p>
            </Card>

            {/* Roles Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {roles.map(role => (
                    <Card key={role} className="relative overflow-hidden group">
                        <div className="flex items-center gap-3 mb-6">
                            {getRoleIcon(role)}
                            <div>
                                <h3 className="font-bold text-[#202124] dark:text-white">{t(`users.roles.${role.toLowerCase()}`)}</h3>
                                <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] uppercase font-black tracking-widest">
                                    {role === 'Admin' ? 'Acceso Total' : 'Acceso Restringido'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {permissionList.map(perm => {
                                const isEnabled = config[role][perm.key];
                                const isLocked = role === 'Admin';

                                return (
                                    <div
                                        key={perm.key}
                                        onClick={() => !isLocked && handleToggle(role, perm.key)}
                                        className={`
                      flex items-center justify-between p-3 rounded-none border transition-all
                      ${isLocked ? 'cursor-default' : 'cursor-pointer'}
                      ${isEnabled
                                                ? 'bg-white dark:bg-[#1a1c1e] border-[#f1f3f4] dark:border-[#3c4043] shadow-sm'
                                                : 'bg-[#f8f9fa] dark:bg-white/5 border-transparent opacity-60'}
                      ${!isLocked && 'hover:border-[#1a73e8]/30 hover:shadow-md'}
                    `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-none ${isEnabled ? 'text-[#1a73e8]' : 'text-[#5f6368]'}`}>
                                                <perm.icon size={16} />
                                            </div>
                                            <span className="text-xs font-medium text-[#3c4043] dark:text-[#e8eaed]">{perm.label}</span>
                                        </div>
                                        {isLocked ? (
                                            <Lock size={14} className="text-[#dadce0]" />
                                        ) : (
                                            <div className={`
                        w-8 h-4 rounded-full relative transition-colors duration-200
                        ${isEnabled ? 'bg-[#1a73e8]' : 'bg-[#dadce0] dark:bg-[#3c4043]'}
                      `}>
                                                <div className={`
                          absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-200
                          ${isEnabled ? 'left-[17px]' : 'left-0.5'}
                        `} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                ))}
            </div>

            {/* Comparison Matrix */}
            <Card header={<div className="flex items-center gap-2 font-bold text-sm text-[#3c4043] dark:text-white"><ShieldCheck size={16} className="text-[#1a73e8]" /> {t('roles.matrix')}</div>}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[#f1f3f4] dark:border-[#3c4043]">
                                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('roles.module')}</th>
                                {roles.map(r => (
                                    <th key={r} className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-center">{t(`users.roles.${r.toLowerCase()}`)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
                            {permissionList.map(perm => (
                                <tr key={perm.key} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <perm.icon size={14} className="text-[#5f6368]" />
                                            <span className="text-sm font-medium text-[#202124] dark:text-white">{perm.label}</span>
                                        </div>
                                    </td>
                                    {roles.map(role => (
                                        <td key={role} className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                {config[role][perm.key] ? (
                                                    <div className="w-6 h-6 bg-[#e6f4ea] text-[#1e8e3e] flex items-center justify-center rounded-full">
                                                        <Check size={14} strokeWidth={3} />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 bg-[#fce8e6] text-[#ea4335] flex items-center justify-center rounded-full">
                                                        <X size={14} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
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

export default Roles;
