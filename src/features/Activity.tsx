import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { Activity, User, FileText, Trash2, Edit, Plus, Clock } from 'lucide-react';
import { Card, Badge } from '../components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const ActivityPage: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission } = usePermissions();
    const [filter, setFilter] = useState<string>('all');

    const activities = useLiveQuery(async () => {
        let query = db.activity_logs.orderBy('timestamp').reverse();

        if (filter !== 'all') {
            return await query.filter(a => a.entity === filter).limit(100).toArray();
        }

        return await query.limit(100).toArray();
    }, [filter]);

    if (!hasPermission('canViewReports')) {
        return <Navigate to="/" replace />;
    }

    const getActionIcon = (action: string) => {
        if (action.includes('crear') || action.includes('agreg')) return <Plus size={14} />;
        if (action.includes('editar') || action.includes('actualiz')) return <Edit size={14} />;
        if (action.includes('elimin')) return <Trash2 size={14} />;
        return <Activity size={14} />;
    };

    const getActionColor = (action: string) => {
        if (action.includes('crear') || action.includes('agreg')) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
        if (action.includes('editar') || action.includes('actualiz')) return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
        if (action.includes('elimin')) return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        return 'text-slate-600 bg-slate-50 dark:bg-slate-900/20';
    };

    const getEntityBadge = (entity: string) => {
        const colors: Record<string, string> = {
            order: 'brand',
            client: 'emerald',
            user: 'purple',
            inventory: 'amber',
            expense: 'red',
            settings: 'slate'
        };
        return colors[entity] || 'slate';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <Activity size={28} className="text-brand-600" />
                        {t('activity.title')}
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {t('activity.subtitle')}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {['all', 'order', 'client', 'user', 'inventory', 'expense'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${filter === f
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        {f === 'all' ? t('activity.filters.all') : f === 'order' ? t('activity.filters.orders') : f === 'client' ? t('activity.filters.clients') : f === 'user' ? t('activity.filters.users') : f === 'inventory' ? t('activity.filters.inventory') : t('activity.filters.expenses')}
                    </button>
                ))}
            </div>

            {/* Activity Timeline */}
            <Card>
                {!activities || activities.length === 0 ? (
                    <div className="text-center py-16">
                        <Activity size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">{t('activity.empty')}</h3>
                        <p className="text-sm text-slate-400 mt-2">{t('activity.empty_subtitle')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {activities.map((activity, index) => (
                            <div
                                key={activity.id}
                                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-4"
                            >
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-none flex items-center justify-center shrink-0 ${getActionColor(activity.action)}`}>
                                    {getActionIcon(activity.action)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4 mb-1">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                {activity.action}
                                            </p>
                                            {activity.details && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {activity.details}
                                                </p>
                                            )}
                                        </div>
                                        <Badge variant={getEntityBadge(activity.entity) as any}>
                                            {activity.entity}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                                        <span className="flex items-center gap-1">
                                            <User size={10} />
                                            {activity.userName}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={10} />
                                            {new Date(activity.timestamp).toLocaleString('es', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ActivityPage;
