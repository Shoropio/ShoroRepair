import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { Part } from '../types';
import { toast } from 'sonner';
import {
  Package,
  Search,
  Plus,
  Minus,
  AlertTriangle,
  Trash2,
  Save,
  Edit2,
  Printer,
  QrCode,
  List,
  LayoutGrid,
  Archive,
  TrendingDown,
  Activity,
  Box,
  Tag,
  DollarSign,
  MoreVertical
} from 'lucide-react';
import { formatCurrency } from '../utils/format/formatUtils';
import { useDebounce } from '../hooks/useDebounce';
import { Button, Input, Card, Badge, Modal } from '../components';
import { generateBarcode } from '../utils/barcode/barcodeUtils';
import { generateQRCode } from '../utils/barcode/qrUtils';
import { jsPDF } from 'jspdf';
import { handlePrint } from '../utils/print/printUtils';
import { usePermissions } from '../hooks/usePermissions';

const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('inventory_view_mode') as 'grid' | 'list') || 'grid';
  });

  const [formData, setFormData] = useState<Partial<Part>>({
    name: '',
    sku: '',
    quantity: 0,
    price: 0,
    minStock: 2
  });

  const parts = useLiveQuery(async () => {
    const collection = db.inventory.where('deleted').equals(0);
    const filtered = collection.filter(p => {
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
    });
    return (await filtered.toArray()).sort((a, b) => a.name.localeCompare(b.name));
  }, [debouncedSearch]);

  const stats = useMemo(() => {
    if (!parts) return { total: 0, lowStock: 0, value: 0 };
    return {
      total: parts.length,
      lowStock: parts.filter(p => p.quantity <= (p.minStock || 2)).length,
      value: parts.reduce((acc, p) => acc + (p.price * p.quantity), 0)
    };
  }, [parts]);

  React.useEffect(() => {
    if (showAddModal && !editingPart && !formData.sku) {
      setFormData(prev => ({ ...prev, sku: `REP-${Date.now().toString().slice(-6)}` }));
    }
  }, [showAddModal, editingPart]);

  const updateQuantity = async (id: number, delta: number) => {
    const part = await db.inventory.get(id);
    if (part) {
      const newQty = Math.max(0, part.quantity + delta);
      await db.inventory.update(id, { quantity: newQty, updatedAt: Date.now(), synced: 0 });
      toast.success(`${part.name}: ${newQty} unidades`, { id: `stock-${id}` });
    }
  };

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.price === undefined || formData.quantity === undefined) return;

    const finalSku = formData.sku || `REP-${Date.now().toString().slice(-6)}`;

    try {
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
        toast.success("Catálogo actualizado");
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
        toast.success(`Ingresado con SKU: ${finalSku}`);
      }
      closeModal();
    } catch (error) {
      toast.error("Error al procesar el repuesto");
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
      minStock: part.minStock
    });
    setShowAddModal(true);
  };

  const deletePart = async (id: number) => {
    if (confirm("¿Estás seguro de archivar este componente?")) {
      await db.inventory.update(id, { deleted: 1, synced: 0 });
      toast.success("Componente archivado");
    }
  };

  const printQRLabel = async (part: Part, action: 'print' | 'download' = 'print') => {
    if (!part.sku) return;
    const doc = new jsPDF({ unit: 'mm', format: [50, 25] });
    try {
      const pageW = 50, pageH = 25, inset = 2;
      doc.setLineWidth(0.3);
      doc.setDrawColor(200);
      doc.rect(inset, inset, pageW - inset * 2, pageH - inset * 2, 'S');

      const qrSize = 16;
      const qrData = await generateQRCode(part.sku, { width: 1000, margin: 1 });
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(part.name.toUpperCase().substring(0, 35), pageW / 2, inset + 1.5, { align: 'center' });
      doc.addImage(qrData, 'PNG', (pageW - qrSize) / 2, inset + 2.5, qrSize, qrSize);
      doc.setFontSize(7);
      doc.text(`${part.sku} - ${formatCurrency(part.price)}`, pageW / 2, pageH - inset - 1, { align: 'center' });

      if (action === 'download') {
        doc.save(`QR_${part.sku}.pdf`);
        toast.success("Documento generado");
      } else {
        await handlePrint(doc, `QR_${part.sku}.pdf`, { autoPrint: true });
        toast.success("Enviando a cola de impresión...");
      }
    } catch (e) {
      toast.error("Fallo técnico en impresión");
    }
  };

  if (!parts) return (
    <div className="space-y-8 animate-in p-8">
      <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-[2rem] animate-pulse"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse"></div>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in pb-20">
      {/* High-Fidelity Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-[2.5rem] shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
            <Archive className="text-[#1a73e8]" size={32} />
            {t('inventory.title')}
          </h1>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
            Monitoreo de componentes, piezas y consumibles para el taller central ShoroRepair.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 relative z-10">
          <div className="flex gap-4">
            <div className="text-center px-6 border-r border-[#f1f3f4] dark:border-white/10">
              <p className="text-[10px] font-black text-[#5f6368] uppercase tracking-widest mb-1">Stock</p>
              <p className="text-2xl font-black text-[#1a73e8]">{stats.total}</p>
            </div>
            <div className="text-center px-6 border-r border-[#f1f3f4] dark:border-white/10">
              <p className="text-[10px] font-black text-[#5f6368] uppercase tracking-widest mb-1">Crítico</p>
              <p className="text-2xl font-black text-red-500">{stats.lowStock}</p>
            </div>
            <div className="text-center px-6">
              <p className="text-[10px] font-black text-[#5f6368] uppercase tracking-widest mb-1">Valor</p>
              <p className="text-2xl font-black text-emerald-600">{formatCurrency(stats.value).split(',')[0]}</p>
            </div>
          </div>
          {hasPermission('canManageInventory') && (
            <Button
              variant="primary"
              className="rounded-2xl px-10 py-4 shadow-lg shadow-blue-500/20 font-black uppercase tracking-widest text-[11px]"
              leftIcon={<Plus size={20} />}
              onClick={() => setShowAddModal(true)}
            >
              {t('inventory.new')}
            </Button>
          )}
        </div>
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-50"></div>
      </header>

      {/* Browser & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#1a73e8] transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre de componente o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white dark:bg-[#1a1c1e] rounded-[1.5rem] outline-none border-2 border-transparent focus:border-[#1a73e8]/20 shadow-xl shadow-black/5 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex bg-white dark:bg-[#1a1c1e] p-2 rounded-[1.5rem] shadow-xl shadow-black/5 border border-[#f1f3f4] dark:border-white/5">
          <button
            onClick={() => { setViewMode('grid'); localStorage.setItem('inventory_view_mode', 'grid'); }}
            className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${viewMode === 'grid' ? 'bg-[#1a73e8] text-white shadow-lg' : 'text-[#5f6368] hover:bg-gray-50'}`}
          >
            <LayoutGrid size={16} /> Grid
          </button>
          <button
            onClick={() => { setViewMode('list'); localStorage.setItem('inventory_view_mode', 'list'); }}
            className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${viewMode === 'list' ? 'bg-[#1a73e8] text-white shadow-lg' : 'text-[#5f6368] hover:bg-gray-50'}`}
          >
            <List size={16} /> Lista
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {parts.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center bg-white dark:bg-[#1a1c1e] rounded-[3rem] border-2 border-dashed border-[#dadce0] dark:border-white/10">
          <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-3xl flex items-center justify-center text-blue-200 mb-6 shadow-sm">
            <Box size={40} />
          </div>
          <h3 className="text-xl font-bold text-[#202124] dark:text-white uppercase tracking-tighter">Inventario Vacío</h3>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium">Registra piezas o repuestos para comenzar el control.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {parts.map(part => {
            const lowStock = part.quantity <= (part.minStock || 2);
            return (
              <Card key={part.id} className={`group p-8 rounded-[2.5rem] transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden border-[#f1f3f4] dark:border-white/5 ${lowStock ? 'bg-red-50/10 border-red-100 animate-pulse-slow' : 'bg-white'}`}>
                <div className="flex justify-between items-start mb-8">
                  <div className={`p-4 rounded-2xl shadow-sm ${lowStock ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'}`}>
                    <Tag size={24} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(part)} className="p-3 bg-white dark:bg-white/5 shadow-sm rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all"><Edit2 size={16} /></button>
                    <button onClick={() => printQRLabel(part)} className="p-3 bg-white dark:bg-white/5 shadow-sm rounded-xl text-gray-500 hover:text-[#1a73e8] hover:bg-blue-50 transition-all"><QrCode size={16} /></button>
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <h3 className="font-black text-xl text-[#202124] dark:text-white tracking-tight truncate uppercase">{part.name}</h3>
                  <div className="flex items-center gap-3">
                    <Badge variant="slate" size="xs" className="px-3 border-none font-black opacity-60 uppercase">{part.sku}</Badge>
                    {lowStock && <Badge variant="warning" size="xs" className="px-3 animate-bounce">Reabastecer</Badge>}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-8 p-4 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Precio Unitario</p>
                    <div className="text-2xl font-black text-emerald-600">{formatCurrency(part.price)}</div>
                  </div>
                  <div className="text-right space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Disponibilidad</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(part.id!, -1)} className="w-8 h-8 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-gray-500 hover:text-blue-600 active:scale-90 transition-all border border-gray-100"><Minus size={14} /></button>
                      <span className={`text-xl font-black w-8 text-center ${lowStock ? 'text-red-600' : 'text-[#1a73e8]'}`}>{part.quantity}</span>
                      <button onClick={() => updateQuantity(part.id!, 1)} className="w-8 h-8 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-gray-500 hover:text-blue-600 active:scale-90 transition-all border border-gray-100"><Plus size={14} /></button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" size="sm" className="rounded-xl font-black uppercase text-[9px] tracking-widest py-3 border-[#f1f3f4]" onClick={() => printQRLabel(part, 'print')}>Imprimir Etiqueta</Button>
                  <Button variant="ghost" size="sm" className="rounded-xl font-black uppercase text-[9px] tracking-widest py-3 text-red-500 hover:bg-red-50" onClick={() => deletePart(part.id!)}>Archivar</Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-white/5 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
                  <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('inventory.table.part')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('inventory.fields.sku')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('inventory.table.price')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('inventory.table.stock')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em] text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
                {parts.map(part => {
                  const lowStock = part.quantity <= (part.minStock || 2);
                  return (
                    <tr key={part.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black ${lowStock ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-[#1a73e8] dark:bg-blue-900/20'} shadow-sm`}>
                            <Box size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#202124] dark:text-white uppercase tracking-tight">{part.name}</p>
                            {lowStock && <Badge variant="warning" size="xs" className="mt-1">Reabastecer Pronto</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Badge variant="slate" size="xs" className="px-3 border-none opacity-60 font-black">{part.sku}</Badge>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-black text-emerald-600">{formatCurrency(part.price)}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 w-fit p-1 rounded-xl border border-gray-100 dark:border-white/10">
                          <button onClick={() => updateQuantity(part.id!, -1)} className="p-1.5 hover:bg-white rounded-lg shadow-sm transition-all text-[#5f6368]"><Minus size={14} /></button>
                          <span className={`text-sm font-black w-8 text-center ${lowStock ? 'text-red-500' : 'text-[#1a73e8]'}`}>{part.quantity}</span>
                          <button onClick={() => updateQuantity(part.id!, 1)} className="p-1.5 hover:bg-white rounded-lg shadow-sm transition-all text-[#5f6368]"><Plus size={14} /></button>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(part)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"><Edit2 size={16} /></button>
                          <button onClick={() => printQRLabel(part)} className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-all"><QrCode size={16} /></button>
                          <button onClick={() => deletePart(part.id!)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      <Modal
        isOpen={showAddModal}
        onClose={closeModal}
        title={editingPart ? "Editar Componente" : "Nuevo Componente"}
        subtitle="Registro Maestro de Inventario ShoroRepair"
        size="2xl"
        footer={<div className="flex gap-3 px-8 pb-6"><Button variant="ghost" className="rounded-2xl px-8" onClick={closeModal}>{t('common.cancel')}</Button><Button variant="primary" className="rounded-2xl px-12 shadow-xl shadow-blue-500/20 font-black uppercase tracking-widest text-[11px]" onClick={handleSavePart}>{t('inventory.save')}</Button></div>}
      >
        <form onSubmit={handleSavePart} className="space-y-8 py-4">
          <Input label="Nombre del Repuesto o Componente" placeholder="Ej: Pantalla iPhone 15 Pro Original" value={formData.name} onChange={v => setFormData({ ...formData, name: v.target.value })} required />
          <div className="grid grid-cols-2 gap-6">
            <Input label="Código Único (SKU)" placeholder="AUTO-GEN" value={formData.sku} onChange={v => setFormData({ ...formData, sku: v.target.value })} />
            <Input label="Precio Unitario" type="number" placeholder="0.00" value={formData.price} onChange={v => setFormData({ ...formData, price: parseFloat(v.target.value) })} required />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Input label="Sotck Inicial" type="number" placeholder="0" value={formData.quantity} onChange={v => setFormData({ ...formData, quantity: parseInt(v.target.value) })} required />
            <Input label="Alerta de Stock Mínimo" type="number" placeholder="2" value={formData.minStock} onChange={v => setFormData({ ...formData, minStock: parseInt(v.target.value) })} />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;
