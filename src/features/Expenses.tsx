import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { Expense } from '../types';
import { Plus, Trash2, Search, DollarSign, Calendar, Tag, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../utils/format/formatUtils';
import { Modal, Button, Input, Card, Badge, TableSkeleton } from '../components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const Expenses: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission } = usePermissions();
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState<Partial<Expense>>({
        description: '',
        amount: 0,
        category: 'Operativo',
        paymentMethod: 'Efectivo',
        date: Date.now()
    });

    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        return (localStorage.getItem('expenses_view_mode') as 'grid' | 'list') || 'list';
    });

    const toggleViewMode = (mode: 'grid' | 'list') => {
        setViewMode(mode);
        localStorage.setItem('expenses_view_mode', mode);
    };

    const expenses = useLiveQuery(async () => {
        const items = await db.expenses.where('deleted').equals(0).reverse().sortBy('date');
        if (!search) return items;
        const q = search.toLowerCase();
        return items.filter(e =>
            e.description.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q)
        );
    }, [search]);

    const stats = useLiveQuery(async () => {
        const items = await db.expenses.where('deleted').equals(0).toArray();
        const total = items.reduce((sum, e) => sum + e.amount, 0);
        return { total };
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) return;

        await db.expenses.add({
            ...(formData as Expense),
            date: Date.now(),
            deleted: 0,
            synced: 0
        });

        setShowModal(false);
        setFormData({ description: '', amount: 0, category: 'Operativo', paymentMethod: 'Efectivo', date: Date.now() });
        toast.success(t('messages.saved'));
    };

    const deleteExpense = async (id: number) => {
        if (confirm(t('expenses.delete_confirm'))) {
            await db.expenses.update(id, { deleted: 1, synced: 0 });
            toast.success(t('messages.deleted'));
        }
    };

    if (!expenses) return <div className="p-8"><TableSkeleton /></div>;

    if (!hasPermission('canManageExpenses')) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="space-y-8 animate-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('expenses.title')}</h1>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">{t('expenses.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-[#f1f3f4] dark:bg-[#2d2f31] p-1 rounded-none">
                        <button
                            onClick={() => toggleViewMode('grid')}
                            className={`p-1.5 rounded-none transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </button>
                        <button
                            onClick={() => toggleViewMode('list')}
                            className={`p-1.5 rounded-none transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </button>
                    </div>
                    <Button
                        variant="primary"
                        leftIcon={<Plus size={18} />}
                        onClick={() => setShowModal(true)}
                    >
                        {t('expenses.new')}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card variant="tonal" className="p-6 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6]">{t('common.total')}</p>
                        <h3 className="text-2xl font-semibold text-[#ea4335]">{formatCurrency(stats?.total || 0)}</h3>
                    </div>
                    <CreditCard size={32} className="text-[#ea4335] opacity-20" />
                </Card>
            </div>

            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6]" size={18} />
                <input
                    type="text"
                    placeholder={t('common.search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-6 py-3 bg-[#f1f3f4] dark:bg-[#2d2f31] border-none rounded-none outline-none focus:bg-white dark:focus:bg-[#1a1c1e] shadow-sm focus:ring-2 focus:ring-[#1a73e8]/20 transition-all placeholder:text-[#5f6368]"
                />
            </div>

            {expenses.length === 0 ? (
                <Card className="text-center py-20 rounded-none border-dashed">
                    <div className="w-20 h-20 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none mx-auto flex items-center justify-center mb-6">
                        <DollarSign size={32} className="text-[#5f6368]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#202124] dark:text-white">{t('expenses.empty')}</h3>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2">{t('expenses.empty_subtitle')}</p>
                </Card>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {expenses.map(e => (
                        <Card key={e.id} variant="outlined" className="group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2.5 bg-[#fce8e6] text-[#ea4335] rounded-none flex items-center justify-center">
                                    <Tag size={18} />
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {hasPermission('canDeleteData') && (
                                        <button onClick={() => deleteExpense(e.id!)} className="p-2 text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#ea4335] rounded-none transition-all cursor-pointer">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1 mb-4">
                                <h3 className="font-semibold text-sm text-[#202124] dark:text-white uppercase truncate">{e.description}</h3>
                                <p className="text-2xl font-bold text-[#ea4335]">{formatCurrency(e.amount)}</p>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-[#f1f3f4] dark:border-[#3c4043]">
                                <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6] font-medium">
                                    <Calendar size={14} className="opacity-60" />
                                    <span>{formatDate(e.date)}</span>
                                </div>
                                <Badge variant="slate" size="xs">{e.category}</Badge>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-[#3c4043] rounded-none overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[#f1f3f4] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124]">
                                    <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('expenses.table.date')}</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('expenses.table.description')}</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('expenses.table.category')}</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('expenses.table.amount')}</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-right">{t('expenses.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
                                {expenses.map(e => (
                                    <tr key={e.id} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4 text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6]">{formatDate(e.date)}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-[#202124] dark:text-white uppercase tracking-tight">{e.description}</td>
                                        <td className="px-6 py-4">
                                            <Badge variant="slate" size="xs">{e.category}</Badge>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-[#ea4335]">{formatCurrency(e.amount)}</td>
                                        <td className="px-6 py-4 text-right">
                                            {hasPermission('canDeleteData') && (
                                                <button onClick={() => deleteExpense(e.id!)} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#fce8e6] hover:text-[#d93025] rounded-none transition-all cursor-pointer">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={t('expenses.new')}
                subtitle={t('expenses.subtitle')}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowModal(false)}>{t('common.close')}</Button>
                        <Button variant="primary" onClick={handleSubmit}>{t('expenses.save')}</Button>
                    </>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label={t('expenses.fields.description')}
                        value={formData.description}
                        onChange={v => setFormData({ ...formData, description: v.target.value })}
                        placeholder={t('expenses.fields.description')}
                        required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label={t('expenses.fields.amount')}
                            type="number"
                            step="0.01"
                            value={formData.amount?.toString()}
                            onChange={v => setFormData({ ...formData, amount: parseFloat(v.target.value) })}
                            required
                        />
                        <div className="flex flex-col space-y-1.5">
                            <label className="text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] ml-4">
                                {t('expenses.fields.category')}
                            </label>
                            <select
                                className="bg-[#f1f3f4] dark:bg-[#1a1c1e] border-2 border-transparent px-4 py-3 text-sm focus:bg-white dark:focus:bg-[#1a1c1e] focus:border-[#1a73e8] rounded-none outline-none dark:text-white transition-all"
                                value={formData.category}
                                onChange={v => setFormData({ ...formData, category: v.target.value })}
                            >
                                <option>{t('expenses.categories.rent')}</option>
                                <option>{t('expenses.categories.utilities')}</option>
                                <option>{t('expenses.categories.supplies')}</option>
                                <option>{t('expenses.categories.salaries')}</option>
                                <option>{t('expenses.categories.marketing')}</option>
                                <option>{t('expenses.categories.maintenance')}</option>
                                <option>{t('expenses.categories.other')}</option>
                            </select>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Expenses;
