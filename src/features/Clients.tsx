import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { Client } from '../types';
import {
  UserPlus,
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Edit2,
  Calendar,
  History,
  TrendingUp,
  LayoutGrid,
  List,
  ChevronRight,
  MessageSquare,
  Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Card, Modal, Badge, TableSkeleton } from '../components';
import { usePermissions } from '../hooks/usePermissions';

const Clients: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: ''
  });

  const clients = useLiveQuery(() =>
    db.clients
      .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
      .reverse()
      .sortBy('updatedAt')
    , [search]);

  const stats = useMemo(() => {
    if (!clients) return { total: 0, recentlyAdded: 0, withOrders: 0 };
    const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return {
      total: clients.length,
      recentlyAdded: clients.filter(c => c.createdAt && c.createdAt > monthAgo).length,
      withOrders: clients.length // Simplified for now
    };
  }, [clients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error(t('common.required_fields'));
      return;
    }

    try {
      if (editingClient) {
        await db.clients.update(editingClient.id!, {
          ...formData,
          updatedAt: Date.now(),
          synced: 0
        });
        toast.success(t('clients.update_success'));
      } else {
        await db.clients.add({
          ...formData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          synced: 0
        } as Client);
        toast.success(t('clients.create_success'));
      }
      closeModal();
    } catch (error) {
      toast.error(t('messages.error'));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({ name: '', email: '', phone: '', address: '', taxId: '' });
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      taxId: client.taxId || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm(t('clients.delete_confirm'))) {
      await db.clients.delete(id);
      toast.success(t('messages.deleted'));
    }
  };

  if (!clients) return <TableSkeleton columns={4} rows={6} title={t('clients.title')} />;

  return (
    <div className="space-y-6 lg:space-y-8 animate-in pb-12 lg:pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-[#1a1c1e] p-6 lg:p-8 rounded-3xl shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
            <Users className="text-[#1a73e8]" size={28} />
            {t('nav.clients')}
          </h1>
          <p className="text-xs lg:text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1 font-medium">
            {t('clients.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#f1f3f4] dark:bg-white/5 p-1 rounded-xl">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}><LayoutGrid size={16} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}><List size={16} /></button>
          </div>
          {hasPermission('canManageClients') && (
            <Button
              variant="primary"
              className="rounded-xl px-4 lg:px-6 py-2.5 font-bold uppercase tracking-widest text-[10px]"
              leftIcon={<UserPlus size={18} />}
              onClick={() => setShowModal(true)}
            >
              {t('clients.new')}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <Card className="p-5 border-none shadow-lg shadow-blue-500/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-600 rounded-xl">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-widest mb-0.5">{t('clients.stats.total')}</p>
              <h3 className="text-xl font-bold text-[#202124] dark:text-white">{stats.total}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-5 border-none shadow-lg shadow-emerald-500/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 rounded-xl">
              <History size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-widest mb-0.5">{t('clients.stats.with_orders')}</p>
              <h3 className="text-xl font-bold text-emerald-600">{stats.withOrders}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-5 border-none shadow-lg shadow-indigo-500/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-widest mb-0.5">{t('clients.stats.new_month')}</p>
              <h3 className="text-xl font-bold text-indigo-600">{stats.recentlyAdded}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative group max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#1a73e8] transition-colors" size={18} />
        <input
          type="text"
          placeholder={t('clients.search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-6 py-3.5 bg-white dark:bg-[#1a1c1e] border-2 border-transparent rounded-2xl outline-none focus:bg-white dark:focus:bg-[#1a1c1e] focus:border-[#1a73e8]/20 shadow-xl shadow-black/5 transition-all text-sm font-medium"
        />
      </div>

      {/* Clients Display */}
      {clients.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#1a1c1e] rounded-3xl border-2 border-dashed border-[#dadce0] dark:border-white/10">
          <Users className="w-16 h-16 text-gray-200 mb-6" />
          <h3 className="text-lg font-bold text-[#202124] dark:text-white uppercase tracking-tight">{t('clients.empty_title')}</h3>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-2">{t('clients.empty_subtitle')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <Card key={client.id} className="p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group rounded-3xl border border-[#f1f3f4] dark:border-white/5 relative bg-white dark:bg-[#202124]">
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-[#1a73e8] rounded-xl flex items-center justify-center font-black text-xs">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(client)} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(client.id!)} className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="text-sm font-bold text-[#202124] dark:text-white uppercase tracking-tight truncate">{client.name}</h3>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{client.taxId || t('common.none')}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <Phone size={14} className="text-[#1a73e8]" />
                  <span className="font-bold">{client.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <Mail size={14} className="text-[#1a73e8]" />
                  <span className="truncate">{client.email || t('common.none')}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f3f4] dark:border-white/5">
                <button className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#1a73e8] hover:translate-x-1 transition-transform">
                  {t('clients.history_btn')} <ChevronRight size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-3xl overflow-hidden border-[#f1f3f4] dark:border-white/5 shadow-2xl shadow-black/5 bg-white dark:bg-[#1a1c1e]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('clients.table.name')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('clients.table.contact')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('clients.table.id')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest text-right">{t('clients.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold uppercase text-xs">{client.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{client.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Phone size={12} className="text-blue-500" /> {client.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-[10px] text-gray-500">{client.taxId || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1.5 opacity-25 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(client)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={14} /></button>
                        <button className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><MessageSquare size={14} /></button>
                        <button onClick={() => handleDelete(client.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Client Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingClient ? t('clients.edit') : t('clients.new')}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div className="md:col-span-2">
              <Input label={t('clients.fields.name')} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <Input label={t('clients.fields.phone')} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
            <Input label={t('clients.fields.email')} type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            <Input label={t('clients.fields.tax_id')} value={formData.taxId} onChange={e => setFormData({ ...formData, taxId: e.target.value })} />
            <div className="md:col-span-2">
              <Input label={t('clients.fields.address')} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
          </div>
          <div className="pt-4 border-t border-[#f1f3f4] dark:border-white/5 flex justify-end gap-3">
            <Button variant="ghost" className="rounded-xl px-6 py-2.5 font-bold uppercase text-[10px]" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" className="rounded-xl px-10 py-3 shadow-lg shadow-blue-500/10 font-bold uppercase tracking-widest text-[10px]">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Clients;
