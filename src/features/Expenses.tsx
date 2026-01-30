import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { Expense } from '../types';
import {
    Plus,
    Trash2,
    Search,
    DollarSign,
    Calendar,
    Tag,
    CreditCard,
    TrendingDown,
    LayoutGrid,
    List,
    Receipt,
    Wallet,
    ArrowUpRight,
    Filter,
    MoreVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../utils/format/formatUtils';
import { Modal, Button, Input, Card, Badge, TableSkeleton, Select } from '../components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const Expenses: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission } = usePermissions();
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        return (localStorage.getItem('expenses_view_mode') as 'grid' | 'list') || 'grid';
    });

    const [formData, setFormData] = useState<Partial<Expense>>({
        description: '',
        amount: 0,
        category: 'Operativo',
        paymentMethod: 'Efectivo',
        date: Date.now()
    });

    const getCategoryLabel = (cat: string) => {
        switch (cat) {
            case 'Alquiler': return t('expenses.categories.rent');
            case 'Servicios Públicos': return t('expenses.categories.utilities');
            case 'Suministros Taller': return t('expenses.categories.supplies');
            case 'Salarios': return t('expenses.categories.salaries');
            case 'Marketing': return t('expenses.categories.marketing');
            case 'Mantenimiento': return t('expenses.categories.maintenance');
            case 'Otros': return t('expenses.categories.other');
            default: return cat;
        }
    };

    const getPaymentMethodLabel = (pm: string) => {
        switch (pm) {
            case 'Efectivo': return t('expenses.payment_methods.cash');
            case 'Tarjeta': return t('expenses.payment_methods.card');
            case 'Transferencia': return t('expenses.payment_methods.transfer');
            case 'Cheque': return t('expenses.payment_methods.check');
            default: return pm;
        }
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

    const stats = useMemo(() => {
        if (!expenses) return { total: 0, count: 0, avg: 0 };
        const total = expenses.reduce((sum, e) => sum + e.amount, 0);
        return {
            total,
            count: expenses.length,
            avg: total / (expenses.length || 1)
        };
    }, [expenses]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) {
            toast.error(t('common.required_fields'));
            return;
        }

        await db.expenses.add({
            ...(formData as Expense),
            date: Date.now(),
            deleted: 0,
            synced: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
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

    if (!expenses) return <div className="p-10 animate-pulse text-center text-xs font-black text-gray-400 uppercase tracking-widest">{t('messages.loading')}</div>;

    if (!hasPermission('canManageExpenses')) return <Navigate to="/" replace />;

    return (
        <div className="space-y-8 animate-in pb-20">
            {/* Premium Header */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-[2.5rem] shadow-xl shadow-red-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
                        <Wallet className="text-[#ea4335]" size={32} />
                        {t('expenses.title')}
                    </h1>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
                        {t('expenses.subtitle')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-8 relative z-10">
                    <div className="hidden sm:flex gap-6 border-r border-gray-100 pr-8">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('common.total')}</p>
                            <p className="text-2xl font-black text-red-600">{formatCurrency(stats.total).split(',')[0]}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('activity.records')}</p>
                            <p className="text-2xl font-black text-gray-800 dark:text-white">{stats.count}</p>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        className="rounded-2xl px-10 py-4 shadow-lg shadow-red-500/20 font-black uppercase tracking-widest text-[11px] bg-[#ea4335] hover:bg-[#d93025]"
                        leftIcon={<Plus size={20} />}
                        onClick={() => setShowModal(true)}
                    >
                        {t('expenses.new')}
                    </Button>
                </div>
                <div className="absolute -right-10 -top-10 w-48 h-48 bg-red-50 dark:bg-red-900/10 rounded-full blur-3xl opacity-50"></div>
            </header>

            {/* Browser & Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#ea4335] transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder={t('expenses.search_placeholder') || "Search..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-white dark:bg-[#1a1c1e] rounded-[1.5rem] outline-none border-2 border-transparent focus:border-red-500/20 shadow-xl shadow-black/5 transition-all text-sm font-medium"
                    />
                </div>
                <div className="flex bg-white dark:bg-[#1a1c1e] p-2 rounded-[1.5rem] shadow-xl shadow-black/5 border border-[#f1f3f4] dark:border-white/5">
                    <button
                        onClick={() => { setViewMode('grid'); localStorage.setItem('expenses_view_mode', 'grid'); }}
                        className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${viewMode === 'grid' ? 'bg-[#ea4335] text-white shadow-lg' : 'text-[#5f6368] hover:bg-gray-50'}`}
                    >
                        <LayoutGrid size={16} /> {t('common.grid')}
                    </button>
                    <button
                        onClick={() => { setViewMode('list'); localStorage.setItem('expenses_view_mode', 'list'); }}
                        className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${viewMode === 'list' ? 'bg-[#ea4335] text-white shadow-lg' : 'text-[#5f6368] hover:bg-gray-50'}`}
                    >
                        <List size={16} /> {t('common.list')}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {expenses.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center bg-white dark:bg-[#1a1c1e] rounded-[3rem] border-2 border-dashed border-[#dadce0] dark:border-white/10">
                    <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-3xl flex items-center justify-center text-red-200 mb-6 shadow-sm">
                        <Receipt size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-[#202124] dark:text-white uppercase tracking-tighter">{t('expenses.empty')}</h3>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium">{t('expenses.empty_subtitle')}</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {expenses.map(e => (
                        <Card key={e.id} className="group p-8 rounded-[2.5rem] transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden border-[#f1f3f4] dark:border-white/5 bg-white">
                            <div className="flex justify-between items-start mb-8">
                                <div className="p-4 bg-red-50 text-[#ea4335] rounded-2xl shadow-sm group-hover:bg-red-100 transition-colors">
                                    <Tag size={24} />
                                </div>
                                <button onClick={() => deleteExpense(e.id!)} className="p-3 bg-red-50/50 text-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"><Trash2 size={16} /></button>
                            </div>

                            <div className="space-y-1 mb-8">
                                <h3 className="font-black text-xl text-[#202124] dark:text-white tracking-tight truncate uppercase leading-none">{e.description}</h3>
                                <div className="flex items-center gap-2">
                                    <Badge variant="slate" size="xs" className="px-3 py-1 font-black opacity-60 uppercase">{getCategoryLabel(e.category)}</Badge>
                                    <Badge variant="brand" size="xs" className="px-3 py-1 font-black uppercase bg-gray-100 text-gray-500">{getPaymentMethodLabel(e.paymentMethod)}</Badge>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-6 bg-red-50/30 rounded-[2rem] border border-dashed border-red-100">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">{t('expenses.fields.amount')}</span>
                                    <span className="text-3xl font-black text-red-600 tracking-tighter">{formatCurrency(e.amount).split(',')[0]}</span>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                                        <Calendar size={14} /> {formatDate(e.date)}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-white/5 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
                                    <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('common.date')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('expenses.table.description')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('expenses.table.category')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('expenses.table.amount')}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em] text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
                                {expenses.map(e => (
                                    <tr key={e.id} className="hover:bg-red-50/20 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase">
                                                <Calendar size={14} className="text-red-400" /> {formatDate(e.date)}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm font-black text-[#202124] dark:text-white uppercase tracking-tight">{e.description}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <Badge variant="slate" size="xs" className="px-3 font-black uppercase">{getCategoryLabel(e.category)}</Badge>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-base font-black text-red-600">{formatCurrency(e.amount)}</span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button onClick={() => deleteExpense(e.id!)} className="p-2.5 bg-red-50 text-red-600 rounded-xl opacity-20 group-hover:opacity-100 transition-all hover:bg-red-100"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL EGRESO */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={t('expenses.new')}
                subtitle={t('expenses.subtitle')}
                size="2xl"
                footer={<div className="flex gap-4 px-8 pb-6"><Button variant="ghost" className="rounded-2xl px-8" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button><Button variant="primary" className="rounded-2xl px-12 shadow-xl shadow-red-500/20 font-black uppercase tracking-widest text-[11px] bg-[#ea4335] hover:bg-[#d93025]" onClick={handleSubmit}>{t('expenses.save')}</Button></div>}
            >
                <form onSubmit={handleSubmit} className="space-y-8 py-6">
                    <Input label={t('expenses.fields.description')} placeholder={t('expenses.fields.description') + "..."} value={formData.description} onChange={v => setFormData({ ...formData, description: v.target.value })} required />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label={t('expenses.fields.amount')} type="number" step="0.01" placeholder="0.00" value={formData.amount?.toString()} onChange={v => setFormData({ ...formData, amount: parseFloat(v.target.value) })} required />
                        <Select label={t('expenses.fields.category')} value={formData.category} onChange={v => setFormData({ ...formData, category: v.target.value })}>
                            <option value="Alquiler">{t('expenses.categories.rent')}</option>
                            <option value="Servicios Públicos">{t('expenses.categories.utilities')}</option>
                            <option value="Suministros Taller">{t('expenses.categories.supplies')}</option>
                            <option value="Salarios">{t('expenses.categories.salaries')}</option>
                            <option value="Marketing">{t('expenses.categories.marketing')}</option>
                            <option value="Mantenimiento">{t('expenses.categories.maintenance')}</option>
                            <option value="Otros">{t('expenses.categories.other')}</option>
                        </Select>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Expenses;
