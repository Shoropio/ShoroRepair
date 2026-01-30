import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { Part } from '../types';
import {
  Plus,
  Search,
  Package,
  Trash2,
  Edit2,
  AlertCircle,
  Archive,
  ArrowRight,
  TrendingUp,
  LayoutGrid,
  List,
  Printer,
  Download,
  QrCode,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../utils/format/formatUtils';
import { handlePrint } from '../utils/print/printUtils';
import { jsPDF } from 'jspdf';
import { Button, Input, Card, Modal, Badge, TableSkeleton } from '../components';
import { usePermissions } from '../hooks/usePermissions';

const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('inventory_view_mode') as 'grid' | 'list') || 'grid';
  });

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    quantity: 0,
    price: 0,
    minStock: 2
  });

  const parts = useLiveQuery(() =>
    db.inventory
      .filter(p => p.deleted === 0 && (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())))
      .reverse()
      .sortBy('updatedAt')
    , [search]);

  const stats = useMemo(() => {
    if (!parts) return { total: 0, lowStock: 0, value: 0 };
    return {
      total: parts.reduce((acc, p) => acc + p.quantity, 0),
      lowStock: parts.filter(p => p.quantity <= (p.minStock || 2)).length,
      value: parts.reduce((acc, p) => acc + (p.price * p.quantity), 0)
    };
  }, [parts]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.quantity < 0 || formData.price < 0) {
      toast.error(t('common.required_fields'));
      return;
    }

    try {
      const finalSku = formData.sku || `SKU-${Date.now().toString().slice(-6)}`;
      if (editingPart) {
        await db.inventory.update(editingPart.id!, {
          name: formData.name,
          sku: finalSku,
          quantity: formData.quantity,
          price: formData.price,
          minStock: formData.minStock,
          updatedAt: Date.now(),
          synced: 0
        });
        toast.success(t('messages.updated'));
      } else {
        await db.inventory.add({
          name: formData.name,
          sku: finalSku,
          quantity: formData.quantity,
          price: formData.price,
          minStock: formData.minStock || 2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          synced: 0,
          deleted: 0
        } as Part);
        toast.success(`${t('messages.created')} (SKU: ${finalSku})`);
      }
      closeModal();
    } catch (error) {
      toast.error(t('messages.error'));
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingPart(null);
    setFormData({ name: '', sku: '', quantity: 0, price: 0, minStock: 2 });
  };

  const openEdit = (part: Part) => {
    setEditingPart(part);
    setFormData({
      name: part.name,
      sku: part.sku || '',
      quantity: part.quantity,
      price: part.price,
      minStock: part.minStock || 2
    });
    setShowAddModal(true);
  };

  const deletePart = async (id: number) => {
    if (confirm(t('inventory.delete_confirm'))) {
      await db.inventory.update(id, { deleted: 1, synced: 0 });
      toast.success(t('messages.deleted'));
    }
  };

  const generateTag = async (part: Part, action: 'print' | 'download') => {
    try {
      const doc = new jsPDF({ unit: 'mm', format: [50, 30] });
      doc.setFontSize(8);
      doc.text(t('inventory.label_tag'), 5, 5);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(part.name.toUpperCase(), 5, 12);
      doc.setFontSize(7);
      doc.text(`SKU: ${part.sku}`, 5, 18);
      doc.text(`${t('inventory.price')}: ${formatCurrency(part.price)}`, 5, 23);
      doc.text(`${t('common.date')}: ${formatDate(Date.now())}`, 5, 27);

      if (action === 'download') {
        doc.save(`QR_${part.sku}.pdf`);
        toast.success(t('messages.document_generated'));
      } else {
        await handlePrint(doc, `QR_${part.sku}.pdf`, { autoPrint: true });
        toast.success(t('messages.printing_queue'));
      }
    } catch (e) {
      toast.error(t('messages.printing_failed'));
    }
  };

  if (!parts) return <TableSkeleton columns={5} rows={8} title={t('inventory.title')} />;

  return (
    <div className="space-y-6 lg:space-y-8 animate-in pb-12 lg:pb-20">
      {/* High-Fidelity Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-[#1a1c1e] p-6 lg:p-8 rounded-none shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
            <Archive className="text-[#1a73e8]" size={28} />
            {t('inventory.title')}
          </h1>
          <p className="text-xs lg:text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1 font-medium max-w-md">
            {t('inventory.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:gap-8 relative z-10">
          <div className="flex gap-4">
            <div className="text-center px-4 lg:px-6 border-r border-[#f1f3f4] dark:border-white/10">
              <p className="text-[9px] font-black text-[#5f6368] uppercase tracking-widest mb-1">{t('inventory.stock')}</p>
              <p className="text-xl font-bold text-[#1a73e8]">{stats.total}</p>
            </div>
            <div className="text-center px-4 lg:px-6 border-r border-[#f1f3f4] dark:border-white/10">
              <p className="text-[9px] font-black text-[#5f6368] uppercase tracking-widest mb-1">{t('inventory.critical')}</p>
              <p className="text-xl font-bold text-red-500">{stats.lowStock}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-[9px] font-black text-[#5f6368] uppercase tracking-widest mb-1">{t('inventory.value')}</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.value)}</p>
            </div>
          </div>
          {hasPermission('canManageInventory') && (
            <Button
              variant="primary"
              className="rounded-none px-6 py-2.5 font-bold uppercase tracking-widest text-[10px]"
              leftIcon={<Plus size={18} />}
              onClick={() => setShowAddModal(true)}
            >
              {t('inventory.new')}
            </Button>
          )}
        </div>
      </header>

      {/* Browser & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#1a73e8] transition-colors" size={18} />
          <input
            type="text"
            placeholder={t('inventory.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3.5 bg-white dark:bg-[#1a1c1e] rounded-none outline-none border-2 border-transparent focus:border-[#1a73e8]/20 shadow-xl shadow-black/5 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex bg-white dark:bg-[#1a1c1e] p-1.5 rounded-none shadow-xl shadow-black/5 border border-[#f1f3f4] dark:border-white/5">
          <button
            onClick={() => { setViewMode('grid'); localStorage.setItem('inventory_view_mode', 'grid'); }}
            className={`px-4 py-2 rounded-none transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${viewMode === 'grid' ? 'bg-[#1a73e8] text-white shadow-md' : 'text-[#5f6368] hover:bg-gray-50'}`}
          >
            <LayoutGrid size={14} /> {t('common.grid')}
          </button>
          <button
            onClick={() => { setViewMode('list'); localStorage.setItem('inventory_view_mode', 'list'); }}
            className={`px-4 py-2 rounded-none transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${viewMode === 'list' ? 'bg-[#1a73e8] text-white shadow-md' : 'text-[#5f6368] hover:bg-gray-50'}`}
          >
            <List size={14} /> {t('common.list')}
          </button>
        </div>
      </div>

      {/* Parts Display */}
      {parts.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#1a1c1e] rounded-none border-2 border-dashed border-[#dadce0] dark:border-white/10">
          <Package className="w-16 h-16 text-gray-200 mb-6" />
          <h3 className="text-lg font-bold text-[#202124] dark:text-white uppercase tracking-tight">{t('inventory.empty_catalog_title')}</h3>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-2">{t('inventory.empty_catalog_subtitle')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {parts.map(part => (
            <Card key={part.id} className="p-5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-none group border-[#f1f3f4] dark:border-white/5 bg-white dark:bg-[#202124]">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-none ${part.quantity <= (part.minStock || 2) ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                  <Package size={20} />
                </div>
                {part.quantity <= (part.minStock || 2) && <Badge variant="error" size="xs" className="animate-pulse">{t('inventory.critical_stock')}</Badge>}
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="text-sm font-bold text-[#202124] dark:text-white uppercase tracking-tight truncate group-hover:text-[#1a73e8] transition-colors">{part.name}</h3>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{part.sku}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('inventory.in_stock')}</p>
                  <p className={`text-lg font-black ${part.quantity <= (part.minStock || 2) ? 'text-red-600' : 'text-[#3c4043] dark:text-white'}`}>{part.quantity}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('inventory.unit_price')}</p>
                  <p className="text-lg font-black text-emerald-600">{formatCurrency(part.price)}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#f1f3f4] dark:border-white/5 flex gap-2">
                <button onClick={() => openEdit(part)} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-[#1a73e8] rounded-none text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors">{t('common.edit')}</button>
                <button onClick={() => generateTag(part, 'print')} className="p-2 bg-gray-50 dark:bg-white/5 text-gray-600 rounded-none hover:bg-gray-100 transition-colors"><Tag size={14} /></button>
                {hasPermission('canManageInventory') && (
                  <button onClick={() => deletePart(part.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-none transition-colors"><Trash2 size={14} /></button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-none overflow-hidden border-[#f1f3f4] dark:border-white/5 shadow-2xl shadow-black/5 bg-white dark:bg-[#1a1c1e]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('inventory.table.component')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest text-center">{t('inventory.table.sku')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest text-center">{t('inventory.table.stock')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest text-right">{t('inventory.table.price')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
                {parts.map(part => (
                  <tr key={part.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-6 py-4 font-bold uppercase text-xs">{part.name}</td>
                    <td className="px-6 py-4 text-center font-black text-[10px] text-gray-500">{part.sku}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-black text-sm ${part.quantity <= (part.minStock || 2) ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>{part.quantity}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-xs text-emerald-600">{formatCurrency(part.price)}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1.5 opacity-25 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(part)} className="p-2 bg-blue-50 text-blue-600 rounded-none"><Edit2 size={14} /></button>
                        <button onClick={() => generateTag(part, 'print')} className="p-2 bg-gray-50 text-gray-600 rounded-none"><Tag size={14} /></button>
                        <button onClick={() => deletePart(part.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-none"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeModal}
        title={editingPart ? t('inventory.update_component') : t('inventory.register_part')}
        size="lg"
        allowFullscreen={true}
      >
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div className="md:col-span-2">
              <Input label={t('inventory.fields.part_name')} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder={t('inventory.fields.part_name_placeholder')} />
            </div>
            <Input label={t('inventory.fields.sku_optional')} value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder={t('inventory.fields.sku_placeholder')} />
            <Input label={t('inventory.fields.min_stock_alert')} type="number" value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: parseInt(e.target.value) })} />
            <Input label={t('inventory.fields.initial_quantity')} type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })} required />
            <Input label={t('inventory.fields.sale_price')} type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} required />
          </div>
          <div className="pt-4 border-t border-[#f1f3f4] dark:border-white/5 flex justify-end gap-3">
            <Button variant="ghost" className="rounded-none px-6 py-2.5 font-bold uppercase text-[10px]" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" className="rounded-none px-8 py-3 shadow-lg shadow-blue-500/10 font-bold uppercase tracking-widest text-[10px]">{t('common.confirm_entry')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;
