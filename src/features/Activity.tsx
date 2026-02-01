import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import {
    Activity as ActivityIcon,
    User,
    FileText,
    Trash2,
    Edit,
    Plus,
    Clock,
    Cpu,
    Fingerprint,
    History,
    ShieldCheck,
    RefreshCw,
    Search,
    Filter
} from 'lucide-react';
import { Card, Badge, Button, Pagination } from '../components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const ActivityPage: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission } = usePermissions();
    const [filter, setFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const activities = useLiveQuery(async () => {
        let query = db.activity_logs.orderBy('timestamp').reverse();

        if (filter !== 'all') {
            return await query.filter(a => a.entity === filter).limit(500).toArray();
        }

        return await query.limit(500).toArray();
    }, [filter]);

    const paginatedActivities = useMemo(() => {
        if (!activities) return [];
        const from = (currentPage - 1) * itemsPerPage;
        return activities.slice(from, from + itemsPerPage);
    }, [activities, currentPage]);

    if (!hasPermission('canViewReports')) return <Navigate to="/" replace />;

    const getActionIcon = (action: string) => {
        const a = action.toLowerCase();
        if (a.includes('crear') || a.includes('agreg')) return <Plus size={16} />;
        if (a.includes('editar') || a.includes('actualiz')) return <Edit size={16} />;
        if (a.includes('elimin')) return <Trash2 size={16} />;
        return <ActivityIcon size={16} />;
    };

    const getActionColor = (action: string) => {
        const a = action.toLowerCase();
        if (a.includes('crear') || a.includes('agreg')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        if (a.includes('editar') || a.includes('actualiz')) return 'bg-blue-50 text-blue-600 border-blue-100';
        if (a.includes('elimin')) return 'bg-red-50 text-red-600 border-red-100';
        return 'bg-gray-50 text-gray-500 border-gray-100';
    };

    const getEntityBadge = (entity: string) => {
        const colors: Record<string, string> = {
            order: 'brand',
            client: 'emerald',
            user: 'purple',
            inventory: 'amber',
            expense: 'red',
            settings: 'slate',
            sync: 'blue'
        };
        return colors[entity] || 'slate';
    };

    if (!activities) return <div className="p-20 text-center animate-pulse text-xs font-black text-gray-400 uppercase tracking-widest">{t('activity.reading_blackbox')}</div>;

    return (
        <div className="space-y-8 animate-in pb-20">
            {/* Premium Header */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-none shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
                        <Fingerprint className="text-[#1a73e8]" size={32} />
                        {t('activity.audit_history')}
                    </h1>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
                        {t('activity.audit_subtitle')}
                    </p>
                </div>
                <div className="flex gap-4 relative z-10">
                    <div className="flex gap-8 border-r border-gray-100 pr-8">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('activity.records')}</p>
                            <p className="text-2xl font-black text-[#1a73e8]">{activities.length}</p>
                        </div>
                    </div>
                    <Button variant="outline" className="rounded-none px-6 py-4 font-black uppercase text-[10px] tracking-widest border-gray-200" leftIcon={<RefreshCw size={18} />} onClick={() => window.location.reload()}>{t('activity.real_frequency')}</Button>
                </div>
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-50 dark:bg-blue-900/10 rounded-none blur-3xl opacity-30"></div>
            </header>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-3">
                {[
                    { id: 'all', label: t('activity.filters.all_system'), icon: History },
                    { id: 'sync', label: 'Sincronización Firebase', icon: RefreshCw },
                    { id: 'order', label: t('activity.filters.workshop_orders'), icon: Cpu },
                    { id: 'client', label: t('activity.filters.client_portfolio'), icon: User },
                    { id: 'user', label: t('activity.filters.staff_control'), icon: ShieldCheck },
                    { id: 'inventory', label: t('activity.filters.stock_warehouse'), icon: FileText },
                    { id: 'expense', label: t('activity.filters.accounting_book'), icon: Trash2 }
                ].map(f => {
                    const Icon = f.icon;
                    return (
                        <button
                            key={f.id}
                            onClick={() => { setFilter(f.id); setCurrentPage(1); }}
                            className={`px-6 py-3.5 rounded-none text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-black/5 flex items-center gap-2 border-2 ${filter === f.id ? 'bg-[#1a73e8] text-white border-transparent' : 'bg-white dark:bg-[#1a1c1e] text-[#5f6368] border-transparent hover:border-blue-100'}`}
                        >
                            <Icon size={14} />
                            {f.label}
                        </button>
                    );
                })}
            </div>

            {/* Audit Timeline */}
            <Card className="p-0 rounded-none overflow-hidden shadow-2xl shadow-black/5 border-[#f1f3f4] dark:border-white/5 bg-white">
                {activities.length === 0 ? (
                    <div className="py-40 flex flex-col items-center justify-center">
                        <History size={64} className="text-gray-100 mb-6" />
                        <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest">{t('activity.empty_title')}</h3>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-white/5">
                        {paginatedActivities.map((activity) => (
                            <div key={activity.id} className="p-8 hover:bg-blue-50/20 transition-all flex items-start gap-8 group">
                                <div className={`w-14 h-14 rounded-none flex items-center justify-center border-2 shrink-0 transition-transform group-hover:scale-105 ${getActionColor(activity.action)}`}>
                                    {getActionIcon(activity.action)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                                        <div className="space-y-1">
                                            <p className="text-base font-black text-[#202124] dark:text-white uppercase tracking-tight leading-none">
                                                {activity.action}
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <Badge variant={getEntityBadge(activity.entity) as any} size="xs" className="px-3 py-0.5 font-black uppercase tracking-widest shadow-sm">
                                                    {activity.entity}
                                                </Badge>
                                                {activity.details && (
                                                    <span className="text-xs font-medium text-gray-500 truncate max-w-md">
                                                        {activity.details}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                                <User size={12} />
                                                Auth: {activity.userName}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                                <Clock size={12} />
                                                {new Date(activity.timestamp).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil((activities?.length || 0) / itemsPerPage)}
                onPageChange={setCurrentPage}
                totalItems={activities?.length || 0}
                itemsPerPage={itemsPerPage}
            />
        </div>
    );
};

export default ActivityPage;
