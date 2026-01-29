import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { Client } from '../types';
import {
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Edit2,
  User,
  LayoutGrid,
  List,
  MoreVertical,
  History,
  TrendingUp,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../hooks/useDebounce';
import {
  Button,
  Input,
  Card,
  Modal,
  Badge,
  SkeletonStatCard,
  SkeletonListItem,
  SkeletonPage
} from '../components';
import { usePermissions } from '../hooks/usePermissions';

const Clients: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('clients_view_mode') as 'grid' | 'list') || 'grid';
  });

  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });

  // Enriched client data
  const clients = useLiveQuery(async () => {
    let collection = db.clients.where('deleted').equals(0);
    const result = await collection.reverse().sortBy('createdAt');

    const filtered = result.filter(c => {
      if (!debouncedSearch) return true;
      const s = debouncedSearch.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.email?.toLowerCase().includes(s);
    });

    return Promise.all(filtered.map(async c => {
      const orderCount = await db.orders.where('clientId').equals(c.id!).count();
      return { ...c, orderCount };
    }));
  }, [debouncedSearch]);

  // Stats calculation
  const stats = useMemo(() => {
    if (!clients) return { total: 0, withOrders: 0, recentlyAdded: 0 };
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    return {
      total: clients.length,
      withOrders: clients.filter(c => c.orderCount > 0).length,
      recentlyAdded: clients.filter(c => c.createdAt > thirtyDaysAgo).length
    };
  }, [clients]);

  const handleSave = async (e: React.FormEvent) => {
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
        toast.success(t('messages.updated'));
      } else {
        await db.clients.add({
          ...formData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deleted: 0,
          synced: 0
        } as Client);
        toast.success(t('messages.created'));
      }
      closeModal();
    } catch (error) {
      toast.error(t('messages.error'));
      console.error(error);
    }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      address: client.address || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', address: '' });
  };

  const handleDelete = async (id: number) => {
    if (confirm(t('clients.delete_confirm'))) {
      await db.clients.update(id, { deleted: 1, synced: 0, updatedAt: Date.now() });
      toast.success(t('messages.deleted'));
    }
  };

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('clients_view_mode', mode);
  };

  if (!clients) return <SkeletonPage />;

  return (
    <div className="space-y-8 animate-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight flex items-center gap-2">
            <Users className="text-[#1a73e8]" size={28} />
            {t('clients.title')}
          </h1>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">
            {t('clients.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#f1f3f4] dark:bg-[#2d2f31] p-1 rounded-xl">
            <button
              onClick={() => toggleViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368] hover:text-[#202124] dark:text-[#9aa0a6]'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => toggleViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368] hover:text-[#202124] dark:text-[#9aa0a6]'}`}
            >
              <List size={18} />
            </button>
          </div>
          {hasPermission('canManageClients') && (
            <Button
              variant="primary"
              leftIcon={<UserPlus size={18} />}
              onClick={() => setShowModal(true)}
            >
              {t('clients.new')}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="tonal" className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-2xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('nav.clients')}</p>
              <h3 className="text-2xl font-bold text-[#202124] dark:text-white">{stats.total}</h3>
            </div>
          </div>
        </Card>
        <Card variant="tonal" className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl">
              <History size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Con Órdenes</p>
              <h3 className="text-2xl font-bold text-emerald-600">{stats.withOrders}</h3>
            </div>
          </div>
        </Card>
        <Card variant="tonal" className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Nuevos (Mes)</p>
              <h3 className="text-2xl font-bold text-indigo-600">{stats.recentlyAdded}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative group max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#1a73e8] transition-colors" size={20} />
        <input
          type="text"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-6 py-4 bg-[#f1f3f4] dark:bg-[#2d2f31] border-2 border-transparent rounded-2xl outline-none focus:bg-white dark:focus:bg-[#1a1c1e] focus:border-[#1a73e8]/20 shadow-sm transition-all text-sm font-medium"
        />
      </div>

      {/* Clients List */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[#f8f9fa] dark:bg-[#1a1c1e] border-2 border-dashed border-[#dadce0] dark:border-[#3c4043] rounded-3xl">
          <div className="w-20 h-20 bg-white dark:bg-[#2d2f31] rounded-2xl shadow-lg flex items-center justify-center mb-6">
            <UserPlus size={32} className="text-[#dadce0]" />
          </div>
          <h3 className="text-lg font-bold text-[#202124] dark:text-white uppercase tracking-tight">{t('clients.empty')}</h3>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 max-w-xs text-center">{t('clients.empty_subtitle')}</p>
          <Button variant="outline" className="mt-8 rounded-xl" onClick={() => setShowModal(true)}>{t('clients.new')}</Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <Card key={client.id} className="p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group rounded-3xl overflow-hidden border-[#f1f3f4] dark:border-white/5 relative">
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  <button onClick={() => openEdit(client)} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(client.id!)} className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-xl hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1a73e8] to-[#1557b0] flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20 shrink-0">
                  {client.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[#202124] dark:text-white truncate text-lg leading-tight">{client.name}</h4>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-[#5f6368] dark:text-[#9aa0a6] font-medium">
                    <Badge variant={client.orderCount > 0 ? 'success' : 'slate'} size="xs">{client.orderCount} órdenes</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-sm text-[#5f6368] dark:text-[#9aa0a6]">
                  <div className="p-2 bg-[#f8f9fa] dark:bg-white/5 rounded-lg"><Phone size={14} /></div>
                  <span className="font-medium">{client.phone}</span>
                </div>
                {client.email && (
                  <div className="flex items-center gap-3 text-sm text-[#5f6368] dark:text-[#9aa0a6]">
                    <div className="p-2 bg-[#f8f9fa] dark:bg-white/5 rounded-lg"><Mail size={14} /></div>
                    <span className="truncate font-medium">{client.email}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-3 text-sm text-[#5f6368] dark:text-[#9aa0a6]">
                    <div className="p-2 bg-[#f8f9fa] dark:bg-white/5 rounded-lg"><MapPin size={14} /></div>
                    <span className="truncate font-medium">{client.address}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-white/5 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('clients.table.name')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('clients.table.contact')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('clients.table.orders')}</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('clients.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-[#1a73e8] flex items-center justify-center font-bold text-sm">
                          {client.name.charAt(0)}
                        </div>
                        <span className="font-bold text-[#202124] dark:text-white">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-sm text-[#202124] dark:text-white">
                          <Phone size={12} className="text-[#1a73e8]" />
                          {client.phone}
                        </div>
                        {client.email && (
                          <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                            <Mail size={12} />
                            {client.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={client.orderCount > 0 ? 'success' : 'slate'} size="xs">
                        {client.orderCount} servicios
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(client)} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 rounded-xl transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(client.id!)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-xl transition-colors"><Trash2 size={16} /></button>
                      </div>
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
        onClose={closeModal}
        title={editingClient ? t('clients.edit') : t('clients.new')}
        subtitle={editingClient ? `ID: ${editingClient.syncId?.substring(0, 8)}` : 'Registra un nuevo contacto en el sistema'}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <Input
            label={t('clients.fields.name')}
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ej: Juan Pérez"
            leftIcon={<User size={18} />}
            required
          />
          <Input
            label={t('clients.fields.phone')}
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="Ej: +506 8888-8888"
            leftIcon={<Phone size={18} />}
            required
          />
          <Input
            label={t('clients.fields.email')}
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="ejemplo@correo.com"
            leftIcon={<Mail size={18} />}
            type="email"
          />
          <Input
            label={t('clients.fields.address')}
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Dirección física..."
            leftIcon={<MapPin size={18} />}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-[#f1f3f4] dark:border-white/5">
            <Button type="button" variant="ghost" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" className="px-8 shadow-lg shadow-blue-500/20">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Clients;
