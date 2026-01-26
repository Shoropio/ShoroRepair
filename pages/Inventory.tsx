import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Part } from '../types';
import { toast } from 'sonner';
import { Package, Search, Plus, Minus, AlertTriangle, Trash2, Save, Edit2, Printer, QrCode, List, LayoutGrid } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { useDebounce } from '../hooks/useDebounce';
import { Button, Input, Card, Badge, Modal } from '../src/components';
import { generateBarcode } from '../src/utils/barcodeUtils';
import { generateQRCode } from '../src/utils/qrUtils';
import { jsPDF } from 'jspdf';
import { handlePrint } from '../utils/printUtils';
import { usePermissions } from '../hooks/usePermissions';

// Helper component to display QR code on cards
const QRPreview: React.FC<{ text: string }> = ({ text }) => {
  const [qr, setQr] = useState<string>('');
  React.useEffect(() => {
    generateQRCode(text, { width: 100, margin: 0 }).then(setQr);
  }, [text]);
  return qr ? <img src={qr} alt="QR" className="w-12 h-12 opacity-50 hover:opacity-100 transition-opacity" /> : null;
};

// Skeleton for Inventory page
const InventorySkeleton: React.FC = () => (
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

const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('inventory_view_mode') as 'grid' | 'list') || 'list';
  });

  const [formData, setFormData] = useState<Partial<Part>>({
    name: '',
    sku: '',
    quantity: 0,
    price: 0,
    minStock: 2
  });

  // --- AUTO GENERATE SKU FOR NEW ITEMS ---
  React.useEffect(() => {
    if (showAddModal && !editingPart && !formData.sku) {
      setFormData(prev => ({ ...prev, sku: `REP-${Date.now().toString().slice(-6)}` }));
    }
  }, [showAddModal, editingPart]);

  const parts = useLiveQuery(async () => {
    const collection = db.inventory.where('deleted').equals(0);
    const filtered = collection.filter(p => {
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
    });
    return (await filtered.toArray()).sort((a, b) => a.name.localeCompare(b.name));
  }, [debouncedSearch]);

  const updateQuantity = async (id: number, delta: number) => {
    const part = await db.inventory.get(id);
    if (part) {
      const newQty = Math.max(0, part.quantity + delta);
      await db.inventory.update(id, { quantity: newQty });
      toast.success(`${part.name}: ${newQty} en stock`, { id: `stock-${id}` });
    }
  };

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.price === undefined || formData.quantity === undefined) return;

    // --- AUTO GENERATE SKU ---
    const finalSku = formData.sku || `REP-${Date.now().toString().slice(-6)}`;

    try {
      if (editingPart) {
        await db.inventory.update(editingPart.id!, {
          name: formData.name,
          sku: finalSku,
          quantity: formData.quantity,
          price: formData.price,
          minStock: formData.minStock
        });
        toast.success("Repuesto actualizado correctamente");
      } else {
        await db.inventory.add({
          name: formData.name,
          sku: finalSku,
          quantity: formData.quantity,
          price: formData.price,
          minStock: formData.minStock || 2
        } as Part);
        toast.success(`Repuesto añadido con SKU: ${finalSku}`);
      }
      closeModal();
    } catch (error) {
      toast.error("Error al guardar repuesto");
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
    if (confirm(t('inventory.delete_confirm'))) {
      await db.inventory.update(id, { deleted: 1, synced: 0 });
      toast.success(t('messages.deleted'));
    }
  };

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('inventory_view_mode', mode);
  };

  const printLabel = async (part: Part) => {
    if (!part.sku) return;

    // Label size for thermal printers (50mm x 25mm common size)
    const doc = new jsPDF({
      unit: 'mm',
      format: [50, 25]
    });

    try {
      const barcodeData = generateBarcode(part.sku, { height: 60, displayValue: true, fontSize: 18 });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(part.name.substring(0, 25), 25, 5, { align: 'center' });
      doc.addImage(barcodeData, 'PNG', 5, 6, 40, 15);
      doc.text(formatCurrency(part.price), 25, 23, { align: 'center' });

      await handlePrint(doc, `Label_${part.sku}.pdf`);
      toast.success("Generando etiqueta de barras...");
    } catch (e) {
      console.error("Error generating label", e);
      toast.error("Error al generar etiqueta");
    }
  };

  const printQRLabel = async (part: Part) => {
    if (!part.sku) return;

    // 50x25 mm Label
    const doc = new jsPDF({
      unit: 'mm',
      format: [50, 25]
    });

    try {
      // Improved QR Params to avoid cutting off
      const qrSize = 18; // mm
      const qrData = await generateQRCode(part.sku, { width: 300, margin: 1 });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');

      // Top: Name
      doc.text(part.name.toUpperCase().substring(0, 30), 25, 5, { align: 'center' });

      // Center: QR Code (Larger and better centered)
      const xPos = (50 - qrSize) / 2;
      doc.addImage(qrData, 'PNG', xPos, 6, qrSize, qrSize);

      // Bottom: SKU or Price
      doc.setFontSize(8);
      doc.text(`${part.sku} - ${formatCurrency(part.price)}`, 25, 23.5, { align: 'center' });

      await handlePrint(doc, `QR_${part.sku}.pdf`);
      toast.success("Generando etiqueta QR...");
    } catch (e) {
      console.error("Error generating QR label", e);
      toast.error("Error al generar etiqueta QR");
    }
  };

  if (!parts) return <InventorySkeleton />;

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('inventory.title')}</h1>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">{t('inventory.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggles - Google Style */}
          <div className="flex bg-[#f1f3f4] dark:bg-[#2d2f31] p-1 rounded-none">
            <button
              onClick={() => toggleViewMode('grid')}
              className={`p-1.5 rounded-none transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => toggleViewMode('list')}
              className={`p-1.5 rounded-none transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}
            >
              <List size={18} />
            </button>
          </div>

          {hasPermission('canManageInventory') && (
            <Button
              variant="primary"
              leftIcon={<Plus size={18} />}
              onClick={() => setShowAddModal(true)}
            >
              {t('inventory.new')}
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

      {/* Content Area */}
      {parts.length === 0 ? (
        <Card className="text-center py-20 rounded-none border-dashed">
          <div className="w-20 h-20 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none mx-auto flex items-center justify-center mb-6">
            <Package size={32} className="text-[#5f6368]" />
          </div>
          <h3 className="text-lg font-semibold text-[#202124] dark:text-white">{t('inventory.empty')}</h3>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 max-w-xs mx-auto">{t('inventory.empty_subtitle')}</p>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {parts.map(part => {
            const lowStock = part.quantity <= (part.minStock || 2);
            return (
              <Card key={part.id} variant="outlined" className={`group relative transition-all ${lowStock ? 'border-[#fde2e2] bg-[#fdf2f2]/20' : ''}`}>
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-none ${lowStock ? 'bg-[#fce8e6] text-[#d93025]' : 'bg-[#e8f0fe] text-[#1a73e8]'}`}>
                    <Package size={24} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {hasPermission('canManageInventory') && (
                      <button onClick={() => openEdit(part)} className="p-2 text-[#5f6368] hover:bg-white rounded-none transition-all shadow-sm"><Edit2 size={16} /></button>
                    )}
                    <button onClick={() => printQRLabel(part)} className="p-2 text-[#5f6368] hover:bg-white rounded-none transition-all shadow-sm"><QrCode size={16} /></button>
                  </div>
                </div>

                <div className="space-y-1 mb-6">
                  <h3 className="font-semibold text-lg text-[#202124] dark:text-white truncate">{part.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{part.sku}</p>
                    {lowStock && <Badge variant="warning" size="xs">{t('inventory.low_stock')}</Badge>}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-8">
                  <div className="text-2xl font-bold text-[#1a73e8] dark:text-[#8ab4f8]">{formatCurrency(part.price)}</div>
                  <div className="flex items-center bg-[#f1f3f4] dark:bg-white/5 p-1 rounded-none">
                    <button onClick={() => updateQuantity(part.id!, -1)} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-none transition-all text-[#5f6368]"><Minus size={16} /></button>
                    <span className="px-4 font-bold text-[#202124] dark:text-white">{part.quantity}</span>
                    <button onClick={() => updateQuantity(part.id!, 1)} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-none transition-all text-[#5f6368]"><Plus size={16} /></button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-[10px] font-bold" onClick={() => printLabel(part)}>Etiqueta Lineal</Button>
                  <Button variant="outline" className="flex-1 text-[10px] font-bold" onClick={() => printQRLabel(part)}>Código QR</Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1c1e] border border-[#dadce0] dark:border-[#3c4043] rounded-none overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f1f3f4] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124]">
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('inventory.table.part')}</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('inventory.fields.sku')}</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('inventory.table.price')}</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('inventory.table.stock')}</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-right">{t('inventory.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
                {parts.map(part => {
                  const lowStock = part.quantity <= (part.minStock || 2);
                  return (
                    <tr key={part.id} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-none ${lowStock ? 'bg-[#fce8e6] text-[#d93025]' : 'bg-[#e8f0fe] text-[#1a73e8]'}`}><Package size={16} /></div>
                          <div>
                            <p className="text-sm font-semibold text-[#202124] dark:text-white">{part.name}</p>
                            {lowStock && <p className="text-[9px] font-bold text-[#d93025] uppercase tracking-tight">{t('inventory.low_stock')}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{part.sku}</span></td>
                      <td className="px-6 py-4"><span className="text-sm font-bold text-[#1a73e8]">{formatCurrency(part.price)}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => updateQuantity(part.id!, -1)} className="p-1 hover:bg-[#f1f3f4] rounded transition-all text-[#5f6368]"><Minus size={14} /></button>
                          <span className={`text-sm font-bold w-8 text-center ${lowStock ? 'text-[#d93025]' : 'text-[#202124] dark:text-white'}`}>{part.quantity}</span>
                          <button onClick={() => updateQuantity(part.id!, 1)} className="p-1 hover:bg-[#f1f3f4] rounded transition-all text-[#5f6368]"><Plus size={14} /></button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {hasPermission('canManageInventory') && (
                            <button onClick={() => openEdit(part)} className="p-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-none transition-all"><Edit2 size={16} /></button>
                          )}
                          <button onClick={() => printQRLabel(part)} className="p-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-none transition-all"><QrCode size={16} /></button>
                          {hasPermission('canManageInventory') && (
                            <button onClick={() => deletePart(part.id!)} className="p-2 text-[#ea4335] hover:bg-[#fce8e6] rounded-none transition-all"><Trash2 size={16} /></button>
                          )}
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
        title={editingPart ? t('inventory.edit') : t('inventory.new')}
        subtitle={t('inventory.subtitle')}
        footer={<>
          <Button variant="ghost" onClick={closeModal}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSavePart}>{t('inventory.save')}</Button>
        </>}
      >
        <form onSubmit={handleSavePart} className="space-y-6">
          <Input label={t('inventory.fields.name')} value={formData.name} onChange={v => setFormData({ ...formData, name: v.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inventory.fields.sku')} value={formData.sku} onChange={v => setFormData({ ...formData, sku: v.target.value })} />
            <Input label={t('inventory.fields.price')} type="number" value={formData.price} onChange={v => setFormData({ ...formData, price: parseFloat(v.target.value) })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inventory.fields.quantity')} type="number" value={formData.quantity} onChange={v => setFormData({ ...formData, quantity: parseInt(v.target.value) })} required />
            <Input label={t('inventory.fields.min_stock')} type="number" value={formData.minStock} onChange={v => setFormData({ ...formData, minStock: parseInt(v.target.value) })} />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;
