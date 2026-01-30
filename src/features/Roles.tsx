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
    UserCheck,
    Cpu,
    Zap,
    Key,
    Activity,
    LockKeyhole,
    Fingerprint
} from 'lucide-react';
import { Card, Button, Badge } from '../components';
import { ROLES_CONFIG, RolePermissions, UserRole } from '../types';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

const Roles: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission } = usePermissions();

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

    if (!hasPermission('canManageUsers')) return <Navigate to="/" replace />;

    const handleToggle = (role: UserRole, permission: keyof RolePermissions) => {
        if (role === 'Admin') return;

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
        toast.success(t('roles.protocols_updated'));
        setTimeout(() => window.location.reload(), 800);
    };

    const handleReset = () => {
        if (confirm(t('roles.confirm_reset'))) {
            localStorage.removeItem('custom_roles_config');
            setConfig(ROLES_CONFIG);
            setIsDirty(false);
            toast.success(t('roles.config_reset'));
            setTimeout(() => window.location.reload(), 800);
        }
    };

    const permissionList: { key: keyof RolePermissions; label: string; icon: any; category: string }[] = [
        { key: 'canViewReports', label: t('roles.intel_biz'), icon: Eye, category: t('roles.categories.data') },
        { key: 'canManageInventory', label: t('roles.asset_management'), icon: Package, category: t('roles.categories.operations') },
        { key: 'canManageUsers', label: t('roles.operator_control'), icon: UsersIcon, category: t('roles.categories.security') },
        { key: 'canEditOrders', label: t('roles.service_mod'), icon: FileEdit, category: t('roles.categories.workshop') },
        { key: 'canDeleteData', label: t('roles.record_purge'), icon: Trash2, category: t('roles.categories.security') },
        { key: 'canManageExpenses', label: t('roles.expense_book'), icon: DollarSign, category: t('roles.categories.finances') },
        { key: 'canManageClients', label: t('roles.portfolio_management'), icon: UserCheck, category: t('roles.categories.operations') },
    ];

    const roles: UserRole[] = ['Admin', 'Technician', 'Receptionist'];

    return (
        <div className="space-y-8 animate-in pb-20">
            {/* Premium Header */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-none shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
                        <LockKeyhole className="text-[#1a73e8]" size={32} />
                        {t('roles.access_protocols')}
                    </h1>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
                        {t('roles.access_subtitle')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    <Button variant="outline" className="rounded-none px-6 py-4 font-black uppercase text-[10px] tracking-widest border-gray-200" leftIcon={<RefreshCcw size={18} />} onClick={handleReset}>{t('common.reset')}</Button>
                    <Button
                        variant="primary"
                        className={`rounded-none px-10 py-4 shadow-lg font-black uppercase tracking-widest text-[11px] transition-all ${isDirty ? 'shadow-blue-500/20' : 'opacity-50 cursor-not-allowed'}`}
                        disabled={!isDirty}
                        leftIcon={<Save size={20} />}
                        onClick={handleSave}
                    >
                        {t('roles.sync_permissions')}
                    </Button>
                </div>
            </header>

            {/* Warning Message */}
            <div className="p-6 bg-amber-50 dark:bg-amber-900/5 rounded-none border border-amber-100 dark:border-amber-900/20 flex gap-4 items-center">
                <ShieldAlert className="text-amber-500 shrink-0" size={24} />
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 leading-tight">
                    {t('roles.warning_text')}
                </p>
            </div>

            {/* Roles Matrix Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {roles.map(role => (
                    <Card key={role} className="p-8 rounded-none shadow-2xl shadow-black/5 border-[#f1f3f4] dark:border-white/5 relative overflow-hidden group bg-white">
                        <div className="flex items-center gap-4 mb-10">
                            <div className={`p-4 rounded-none shadow-lg ${role === 'Admin' ? 'bg-blue-50 text-blue-600 shadow-blue-500/10' : role === 'Technician' ? 'bg-amber-50 text-amber-600 shadow-amber-500/10' : 'bg-emerald-50 text-emerald-600 shadow-emerald-500/10'}`}>
                                {role === 'Admin' ? <ShieldCheck size={28} /> : role === 'Technician' ? <Fingerprint size={28} /> : <UserCheck size={28} />}
                            </div>
                            <div>
                                <h3 className="font-black text-xl text-[#202124] dark:text-white uppercase tracking-tight leading-none">{t(`users.roles.${role.toLowerCase()}`)}</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">{t('roles.security_level')} {role === 'Admin' ? '01' : role === 'Technician' ? '02' : '03'}</p>
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
                                        className={`flex items-center justify-between p-4 rounded-none border-2 transition-all group/item ${isLocked ? 'cursor-default' : 'cursor-pointer hover:border-blue-100'} ${isEnabled ? 'bg-white border-[#f1f3f4] dark:bg-white/5' : 'bg-gray-50/50 border-transparent opacity-50 grayscale'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-none transition-colors ${isEnabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                                                <perm.icon size={16} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{perm.category}</span>
                                                <span className="text-xs font-black text-[#202124] dark:text-white uppercase tracking-tight">{perm.label}</span>
                                            </div>
                                        </div>
                                        {isLocked ? (
                                            <Lock size={14} className="text-gray-200" />
                                        ) : (
                                            <div className={`w-10 h-6 rounded-none relative transition-colors duration-300 ${isEnabled ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-none transition-all duration-300 ${isEnabled ? 'left-5' : 'left-1'}`} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {role === 'Admin' && <div className="absolute inset-0 bg-blue-50/5 pointer-events-none flex items-center justify-center -rotate-12 select-none"><span className="text-blue-100 text-7xl font-black uppercase opacity-20">LOCKED</span></div>}
                    </Card>
                ))}
            </div>

            {/* Comparison Matrix - Simplified & High Fidelity */}
            <Card className="p-10 rounded-none shadow-2xl shadow-black/10 border-[#f1f3f4] dark:border-white/5" header={<h3 className="text-lg font-black text-[#202124] dark:text-white uppercase tracking-[0.1em] mb-10 flex items-center gap-3"><Activity size={24} className="text-[#1a73e8]" /> {t('roles.privilege_matrix')}</h3>}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#f8f9fa] dark:bg-white/[0.02]">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest rounded-none">{t('roles.system_module')}</th>
                                {roles.map(r => (
                                    <th key={r} className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">{t(`users.roles.${r.toLowerCase()}`)}</th>
                                ))}
                                <th className="rounded-none"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
                            {permissionList.map(perm => (
                                <tr key={perm.key} className="hover:bg-blue-50/20 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-none text-gray-400"><perm.icon size={16} /></div>
                                            <span className="text-sm font-black text-[#202124] dark:text-white uppercase tracking-tight">{perm.label}</span>
                                        </div>
                                    </td>
                                    {roles.map(role => (
                                        <td key={role} className="px-8 py-6 text-center">
                                            <div className="flex justify-center">
                                                {config[role][perm.key] ? (
                                                    <div className="w-8 h-8 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-none shadow-sm border border-emerald-100"><Check size={18} strokeWidth={4} /></div>
                                                ) : (
                                                    <div className="w-8 h-8 bg-red-50 text-red-600 flex items-center justify-center rounded-none shadow-sm border border-red-100"><X size={18} strokeWidth={4} /></div>
                                                )}
                                            </div>
                                        </td>
                                    ))}
                                    <td></td>
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
