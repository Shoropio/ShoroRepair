import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Client } from '../types';
import { UserPlus, Search, Phone, Mail, MapPin, Trash2, Edit2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../hooks/useDebounce';
import { Button, Input, Card, Modal, SkeletonListItem, Badge } from '../src/components';
import { usePermissions } from '../hooks/usePermissions';

// Skeleton for Clients page
const ClientsSkeleton: React.FC = () => (
  <div className="space-y-10 animate-in">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />
        <div className="h-4 w-48 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />
      </div>
      <div className="h-10 w-40 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />
    </div>

    <div className="h-12 w-full bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white dark:bg-[#1a1c1e] border border-[#dadce0] dark:border-[#3c4043] rounded-none h-48 animate-pulse" />
      ))}
    </div>
  </div>
);

const Clients: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const clients = useLiveQuery(async () => {
    const collection = db.clients.where('deleted').equals(0).reverse();

    const filtered = collection.filter(c => {
      if (!debouncedSearch) return true;
      const s = debouncedSearch.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.phone.includes(s);
    });

    const result = await filtered.limit(50).toArray();

    // Add operational insights
    const enriched = await Promise.all(result.map(async c => {
      const orderCount = await db.orders.where('clientId').equals(c.id!).count();
      return { ...c, orderCount };
    }));

    return enriched;
  }, [debouncedSearch]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('clients_view_mode') as 'grid' | 'list') || 'list';
  });

  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    try {
      // Check for duplicate phone
      const existingPhone = await db.clients
        .where('phone')
        .equals(formData.phone)
        .first();

      if (existingPhone && (!editingClient || existingPhone.id !== editingClient.id)) {
        toast.error("Ya existe un cliente con ese número de teléfono");
        return;
      }

      // Check for duplicate email (if provided)
      if (formData.email) {
        const existingEmail = await db.clients
          .where('email')
          .equals(formData.email)
          .first();

        if (existingEmail && (!editingClient || existingEmail.id !== editingClient.id)) {
          toast.error("Ya existe un cliente con ese correo electrónico");
          return;
        }
      }

      if (editingClient) {
        await db.clients.update(editingClient.id!, formData);
        toast.success("Cliente actualizado correctamente");
      } else {
        await db.clients.add({ ...formData, createdAt: Date.now() });
        toast.success("Cliente registrado correctamente");
      }
      closeModal();
    } catch (error) {
      toast.error("Error al guardar cliente");
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
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      await db.clients.update(id, { deleted: 1, synced: 0 });
      toast.success('Cliente eliminado');
    }
  };

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('clients_view_mode', mode);
  };

  if (!clients) return <ClientsSkeleton />;

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('clients.title')}</h1>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">{t('clients.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggles - Google Style */}
          <div className="flex bg-[#f1f3f4] dark:bg-[#2d2f31] p-1 rounded-none">
            <button
              onClick={() => toggleViewMode('grid')}
              className={`p-1.5 rounded-none transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </button>
            <button
              onClick={() => toggleViewMode('list')}
              className={`p-1.5 rounded-none transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
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

      {/* Search Bar - Minimalist */}
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

      {/* Clients Content */}
      {clients.length === 0 ? (
        <Card className="text-center py-20 rounded-none border-dashed">
          <div className="w-20 h-20 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none mx-auto flex items-center justify-center mb-6">
            <UserPlus size={32} className="text-[#5f6368]" />
          </div>
          <h3 className="text-lg font-semibold text-[#202124] dark:text-white">{t('clients.empty')}</h3>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 max-w-xs mx-auto">{t('clients.empty_subtitle')}</p>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <Card key={client.id} variant="outlined" className="group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-[#e8f0fe] text-[#1a73e8] rounded-none flex items-center justify-center font-bold text-lg">
                  {client.name.charAt(0)}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(client)} className="p-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-none transition-all"><Edit2 size={16} /></button>
                  {hasPermission('canDeleteData') && (
                    <button onClick={() => handleDelete(client.id!)} className="p-2 text-[#ea4335] hover:bg-[#fce8e6] rounded-none transition-all"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="font-semibold text-lg text-[#202124] dark:text-white truncate">{client.name}</h3>
                <p className="text-sm text-[#1a73e8] dark:text-[#8ab4f8] font-medium">{client.phone}</p>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#f1f3f4] dark:border-[#3c4043]">
                <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6] font-medium">
                  <Mail size={14} className="opacity-60" />
                  <span className="truncate">{client.email || 'Sin correo registrado'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6] font-medium">
                  <MapPin size={14} className="opacity-60" />
                  <span className="truncate">{client.address || 'Sin dirección registrada'}</span>
                </div>
                {(client as any).orderCount > 0 && (
                  <div className="pt-2">
                    <Badge variant="brand" size="xs">{`${(client as any).orderCount} ${t('clients.table.orders')}`}</Badge>
                  </div>
                )}
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
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('clients.table.name')}</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('clients.table.contact')}</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('clients.table.orders')}</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-right">{t('clients.table.actions')}</th>
                </tr >
              </thead >
              <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center font-bold text-xs rounded-none">
                          {client.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-[#202124] dark:text-white text-sm">{client.name}</p>
                          <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] font-medium">{t('common.date')}: {new Date(client.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                          <Phone size={12} className="text-[#1a73e8]" />
                          <span className="font-medium">{client.phone}</span>
                        </div>
                        {client.email && (
                          <div className="flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#9aa0a6] opacity-70">
                            <Mail size={12} />
                            <span>{client.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={(client as any).orderCount > 0 ? 'brand' : 'slate'} size="xs">
                        {(client as any).orderCount} Órdenes
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {hasPermission('canManageClients') && (
                          <button onClick={() => openEdit(client)} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all cursor-pointer"><Edit2 size={16} /></button>
                        )}
                        {hasPermission('canDeleteData') && (
                          <button onClick={() => handleDelete(client.id!)} className="p-2 text-[#ea4335] hover:bg-[#fce8e6] rounded-none transition-all cursor-pointer"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table >
          </div >
        </div >
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingClient ? t('clients.edit') : t('clients.new')}
        subtitle={t('clients.subtitle')}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button variant="primary" leftIcon={<Save size={16} />} onClick={handleSave}>
              {editingClient ? t('common.update') : t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label={t('clients.fields.name')}
            placeholder={t('clients.fields.name')}
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label={t('clients.fields.phone')}
            placeholder="+505 0000-0000"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            required
          />
          <Input
            label={t('clients.fields.email')}
            placeholder="correo@ejemplo.com"
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label={t('clients.fields.address')}
            placeholder={t('clients.fields.address')}
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
          />
        </form>
      </Modal>
    </div >
  );
};

export default Clients;
