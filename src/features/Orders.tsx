import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import {
  ServiceOrder,
  OrderStatus,
  Priority,
  DeviceType,
  PaymentMethod,
  PaymentStatus,
  Client,
  OrderPart,
  MessageLog
} from '../types';
import {
  Plus,
  Search,
  User,
  Wrench,
  Printer,
  MessageSquare,
  Smartphone,
  Download,
  X,
  Camera,
  History as HistoryIcon,
  Package,
  Save,
  FileText,
  Zap,
  Trash2,
  ShieldCheck,
  ChevronDown,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { handlePrint } from '../utils/print/printUtils';
import { generateEntryTicket, generateInvoice } from '../utils/print/invoiceUtils';
import { formatCurrency, formatDate } from '../utils/format/formatUtils';
import { useDebounce } from '../hooks/useDebounce';
import { TableSkeleton, Button, Input, Badge, Card, Modal, Select } from '../components';
import { uploadImage, compressImage } from '../services/upload.service';
import { usePermissions } from '../hooks/usePermissions';

const SignaturePad: React.FC<{ onSave: (data: string) => void, onClear: () => void }> = ({ onSave, onClear }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e: any) => {
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const data = canvasRef.current?.toDataURL('image/png');
    if (data) {
      onSave(data);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-[120px] cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button type="button" onClick={clear} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline">Limpiar firma</button>
    </div>
  );
};

const Orders: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<ServiceOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const orders = useLiveQuery(async () => {
    const collection = db.orders.orderBy('createdAt').reverse();
    const filteredCollection = collection.filter(order => {
      if (order.deleted === 1) return false;
      if (filterStatus !== 'all' && order.status !== filterStatus) return false;
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return (
        (order.orderNumber && order.orderNumber.toLowerCase().includes(q)) ||
        (order.brand && order.brand.toLowerCase().includes(q)) ||
        (order.model && order.model.toLowerCase().includes(q))
      );
    });
    return filteredCollection.limit(50).toArray();
  }, [filterStatus, debouncedSearch]);

  const clients = useLiveQuery(() => db.clients.toArray());
  const technicians = useLiveQuery(() => db.users.where('role').equals('Technician').toArray());
  const inventory = useLiveQuery(() => db.inventory.toArray());

  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    deviceType: DeviceType.PHONE,
    priority: Priority.MEDIUM,
    status: OrderStatus.RECEIVED,
    laborCost: 0,
    parts: [],
    photos: [],
    taxRate: 15,
    paymentMethod: PaymentMethod.CASH,
    paymentStatus: PaymentStatus.PENDING,
    customerApproved: false,
    brand: '',
    model: '',
    serialNumber: '',
    issueDescription: ''
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isNewOrder: boolean) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      try {
        toast.promise(
          (async () => {
            const compressed = await Promise.all(files.map(f => compressImage(f)));
            const uploadedUrls = await Promise.all(compressed.map((img, i) => {
              const path = `temp/photos/${Date.now()}_${i}.jpg`;
              return uploadImage(img, path);
            }));
            return uploadedUrls;
          })(),
          {
            loading: 'Subiendo imágenes...',
            success: (urls) => {
              if (isNewOrder) {
                setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), ...urls] }));
              } else if (showDetailModal) {
                setShowDetailModal({ ...showDetailModal, photos: [...(showDetailModal.photos || []), ...urls] });
              }
              return 'Imágenes listas';
            },
            error: 'Error al procesar imágenes'
          }
        );
      } catch (err) {
        console.error("Error processing files", err);
      }
    }
  };

  const removePhoto = (index: number, isNewOrder: boolean) => {
    if (isNewOrder) {
      setFormData(prev => ({ ...prev, photos: prev.photos?.filter((_, i) => i !== index) }));
    } else if (showDetailModal) {
      setShowDetailModal({ ...showDetailModal, photos: showDetailModal.photos?.filter((_, i) => i !== index) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.brand || !formData.model) return;

    const toastId = toast.loading('Guardando orden localmente...');

    try {
      const settings = (await db.settings.toArray())[0];
      const taxRate = settings?.defaultTaxRate || 13;
      const orderNumber = `OS-${Date.now().toString().slice(-6)}`;

      const newOrder: ServiceOrder = {
        ...(formData as ServiceOrder),
        orderNumber,
        taxRate,
        total: (formData.laborCost || 0) * (1 + taxRate / 100),
        customerApproved: false,
        logs: [{
          timestamp: Date.now(),
          status: OrderStatus.RECEIVED,
          note: 'Orden recibida (Modo Local)'
        }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: 0
      };

      await db.orders.add(newOrder);
      setShowModal(false);
      setFormData({
        deviceType: DeviceType.PHONE,
        priority: Priority.MEDIUM,
        status: OrderStatus.RECEIVED,
        laborCost: 0,
        parts: [],
        photos: [],
        taxRate: 15,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PENDING,
        brand: '',
        model: '',
        serialNumber: '',
        issueDescription: ''
      });

      toast.success("Orden guardada localmente", { id: toastId });
    } catch (err) {
      console.error("Error creating order", err);
      toast.error("Error al registrar la orden", { id: toastId });
    }
  };

  const handleDeleteOrder = async (order: ServiceOrder) => {
    if (!order.id) return;
    if (confirm(`¿Estás seguro de eliminar permanentemente la orden ${order.orderNumber}? Esta acción no se puede deshacer y devolverá los repuestos al inventario.`)) {
      try {
        if (order.parts && order.parts.length > 0) {
          for (const part of order.parts) {
            const invPart = await db.inventory.get(part.partId);
            if (invPart) {
              await db.inventory.update(part.partId, { quantity: invPart.quantity + part.quantity });
            }
          }
        }
        await db.orders.delete(order.id);
        toast.success("Orden eliminada y repuestos devueltos");
      } catch (err) {
        toast.error("Error al eliminar la orden");
      }
    }
  };

  const notifyWhatsApp = async (order: ServiceOrder) => {
    const client = await db.clients.get(order.clientId);
    if (!client || !client.phone) {
      toast.error("El cliente no tiene teléfono registrado.");
      return;
    }

    const message = `*ShoroRepair - Actualización de Servicio*\n\nHola ${client.name}, te informamos que tu equipo *${order.brand} ${order.model}* (Orden ${order.orderNumber}) ha cambiado al estado: *${order.status.toUpperCase()}*.
\n${order.status === OrderStatus.READY ? `Total a pagar: ₡${order.total.toFixed(2)}\nYa puedes pasar a retirarlo.` : 'Te avisaremos cuando esté listo.'}\n\n¡Gracias por tu confianza!`;

    const newLog: MessageLog = {
      timestamp: Date.now(),
      type: 'WhatsApp',
      content: message,
      status: 'Sent',
      recipient: client.phone
    };

    const currentLogs = order.messageLogs || [];
    await db.orders.update(order.id!, {
      messageLogs: [...currentLogs, newLog],
      updatedAt: Date.now(),
      synced: 0
    });

    const cleanPhone = client.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    toast.info("Abriendo WhatsApp y registrando notificación...");
  };

  const updateOrder = async (order: ServiceOrder) => {
    const toastId = toast.loading('Guardando cambios localmente...');
    try {
      let invoiceNumber = order.invoiceNumber;
      if ((order.status === OrderStatus.READY || order.status === OrderStatus.DELIVERED) && !invoiceNumber) {
        const settings = (await db.settings.toArray())[0];
        if (settings) {
          invoiceNumber = `${settings.invoicePrefix}-${settings.nextInvoiceNumber.toString().padStart(5, '0')}`;
          await db.settings.update(settings.id!, { nextInvoiceNumber: settings.nextInvoiceNumber + 1 });
        }
      }

      const oldOrder = await db.orders.get(order.id!);
      const partDiff = new Map<number, number>();

      if (oldOrder && oldOrder.parts) {
        oldOrder.parts.forEach(p => {
          const current = partDiff.get(p.partId) || 0;
          partDiff.set(p.partId, current - p.quantity);
        });
      }

      if (order.parts) {
        order.parts.forEach(p => {
          const current = partDiff.get(p.partId) || 0;
          partDiff.set(p.partId, current + p.quantity);
        });
      }

      for (const [partId, change] of partDiff.entries()) {
        if (change === 0) continue;
        const part = await db.inventory.get(partId);
        if (part) {
          const newQuantity = part.quantity - change;
          if (newQuantity < 0) throw new Error(`Inventario insuficiente para: ${part.name}`);
          await db.inventory.update(partId, { quantity: newQuantity });
        }
      }

      let logs = order.logs || [];
      if (oldOrder && oldOrder.status !== order.status) {
        logs.push({
          timestamp: Date.now(),
          status: order.status,
          technicianId: order.technicianId,
          note: `Estado cambiado a ${order.status}`
        });
      }

      let warrantyExpiration = order.warrantyExpiration;
      if (order.status === OrderStatus.DELIVERED && order.warrantyDays && !warrantyExpiration) {
        warrantyExpiration = Date.now() + (order.warrantyDays * 24 * 60 * 60 * 1000);
      }

      const partsTotal = (order.parts || []).reduce((acc, p) => acc + (p.price * p.quantity), 0);
      const subtotal = (order.laborCost || 0) + partsTotal;
      const tax = subtotal * (order.taxRate / 100);
      const total = subtotal + tax;

      const updatedLocal = {
        ...order,
        total,
        invoiceNumber,
        logs,
        warrantyExpiration,
        updatedAt: Date.now(),
        synced: 0
      };

      await db.orders.update(order.id!, updatedLocal);
      setShowDetailModal(null);
      toast.success("Trabajo actualizado localmente", { id: toastId });
    } catch (err: any) {
      console.error("Error updating order", err);
      toast.error(err.message || "Error al actualizar la orden", { id: toastId });
    }
  };

  const addPartToOrder = async (order: ServiceOrder, partId: number) => {
    const invPart = await db.inventory.get(partId);
    if (!invPart || invPart.quantity <= 0) {
      alert("No hay existencias de este repuesto.");
      return;
    }
    const newPart = { partId, name: invPart.name, quantity: 1, price: invPart.price };
    const updatedOrder = { ...order, parts: [...order.parts, newPart] };
    const partsTotal = updatedOrder.parts.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const subtotal = (updatedOrder.laborCost || 0) + partsTotal;
    const tax = subtotal * (updatedOrder.taxRate / 100);
    updatedOrder.total = subtotal + tax;
    setShowDetailModal(updatedOrder);
    toast.info("Repuesto añadido (Guardar para confirmar)");
  };

  if (!orders || !clients || !technicians || !inventory) {
    return <TableSkeleton columns={5} rows={8} title="Órdenes de Servicio" />;
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('orders.title')}</h1>
            <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">{t('orders.subtitle')}</p>
          </div>
          {hasPermission('canEditOrders') && (
            <Button variant="primary" leftIcon={<Plus size={18} />} onClick={() => setShowModal(true)}>
              {t('orders.new')}
            </Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6]" size={18} />
            <input
              type="text"
              placeholder="Número de orden, marca o modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-[#f1f3f4] dark:bg-[#2d2f31] border-none rounded-none outline-none focus:bg-white dark:focus:bg-[#1a1c1e] shadow-sm focus:ring-2 focus:ring-[#1a73e8]/20 transition-all placeholder:text-[#5f6368]"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {['all', OrderStatus.RECEIVED, OrderStatus.IN_REPAIR, OrderStatus.READY].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-none text-xs font-bold whitespace-nowrap transition-all border ${filterStatus === s
                  ? 'bg-[#1a73e8] text-white border-transparent'
                  : 'bg-white dark:bg-[#1a1c1e] text-[#5f6368] dark:text-[#9aa0a6] border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-white/5'
                  }`}
              >
                {s === 'all' ? t('common.all') : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-[#3c4043] rounded-none overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#f1f3f4] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124]">
                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('orders.table.service_client')}</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('orders.table.device')}</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('orders.table.status')}</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-right">{t('orders.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
              {orders.map(order => {
                const client = clients?.find(c => c.id === order.clientId);
                return (
                  <tr key={order.id} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[#e8f0fe] text-[#1a73e8] rounded-none mt-1">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#202124] dark:text-white uppercase tracking-tight">#{order.orderNumber}</p>
                          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-medium">{client?.name || 'Cliente sin nombre'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Smartphone size={14} className="text-[#5f6368] dark:text-[#9aa0a6]" />
                        <p className="text-xs font-semibold text-[#3c4043] dark:text-[#bdc1c6] truncate max-w-[150px]">{order.brand} {order.model}</p>
                      </div>
                      <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mt-1 font-medium italic">{formatDate(order.createdAt)}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <Badge
                          variant={order.status === OrderStatus.READY ? 'success' : (order.status === OrderStatus.IN_REPAIR || order.status === OrderStatus.DIAGNOSTIC) ? 'warning' : 'slate'}
                          size="xs"
                        >
                          {order.status}
                        </Badge>
                        {order.priority === Priority.HIGH && (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-[#ea4335] uppercase"><Zap size={10} /> Prioridad Alta</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setShowDetailModal(order)} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all"><Edit2 size={16} /></button>
                        <button onClick={async () => {
                          toast.info("Generando comprobante...");
                          generateInvoice(order, 'print');
                        }} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all"><Printer size={16} /></button>
                        <button onClick={async () => {
                          toast.info("Generando comprobante...");
                          generateInvoice(order, 'download');
                        }} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all"><Download size={16} /></button>
                        <button onClick={() => generateEntryTicket(order)} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all" title="Ticket de Ingreso"><FileText size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={!!showDetailModal}
        onClose={() => setShowDetailModal(null)}
        title={showDetailModal ? `Workbench #${showDetailModal.orderNumber}` : 'Workbench'}
        subtitle="Terminal de Reparación Avanzada"
        size="4xl"
        allowFullscreen={true}
      >
        {showDetailModal && (
          <div className="flex-1 overflow-y-auto p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-12 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-xs font-bold text-[#1a73e8] uppercase tracking-wide">
                      <Zap size={14} /> <span>Estado del Proceso</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.values(OrderStatus).map(s => (
                        <button
                          key={s}
                          onClick={() => setShowDetailModal({ ...showDetailModal, status: s })}
                          className={`px-4 py-2.5 rounded-none text-[10px] font-bold uppercase tracking-wide border transition-all ${showDetailModal.status === s
                            ? 'bg-[#1a73e8] text-white border-transparent'
                            : 'bg-white dark:bg-[#1a1c1e] text-[#5f6368] dark:text-[#9aa0a6] border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-white/5'
                            }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Select
                      label="Técnico Responsable"
                      value={showDetailModal.technicianId || ''}
                      onChange={e => setShowDetailModal({ ...showDetailModal, technicianId: parseInt(e.target.value) || undefined })}
                      leftIcon={<User size={14} />}
                    >
                      <option value="">Sin Asignar</option>
                      {technicians?.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-xs font-bold text-[#1a73e8] uppercase tracking-wide">
                      <FileText size={14} /> <span>Diagnóstico Técnico</span>
                    </div>
                    <textarea
                      className="w-full p-6 bg-[#f8f9fa] dark:bg-neutral-800/50 dark:text-white border-none rounded-none focus:bg-white focus:ring-2 focus:ring-[#1a73e8]/20 outline-none transition-all text-sm font-medium min-h-[120px]"
                      placeholder="Describe los hallazgos técnicos aquí..."
                      value={showDetailModal.technicalDiagnosis || ''}
                      onChange={e => setShowDetailModal({ ...showDetailModal, technicalDiagnosis: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <Card variant="tonal" className="p-6 bg-[#e8f0fe] dark:bg-[#1a73e8]/5">
                    <h3 className="font-bold text-[#1a73e8] text-sm uppercase mb-4 flex items-center gap-2">
                      <Package size={18} /> Resumen de Costos
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#5f6368] dark:text-[#9aa0a6] font-medium">Mano de Obra</span>
                        <input
                          type="number"
                          className="w-24 text-right bg-white dark:bg-neutral-800 border-none rounded-none p-2 text-sm font-bold"
                          value={showDetailModal.laborCost}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const pts = showDetailModal.parts.reduce((a, p) => a + (p.price * p.quantity), 0);
                            const sub = val + pts;
                            setShowDetailModal({ ...showDetailModal, laborCost: val, total: sub * (1 + showDetailModal.taxRate / 100) });
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#5f6368] dark:text-[#9aa0a6] font-medium">Partes / Repuestos</span>
                        <span className="font-bold">{formatCurrency((showDetailModal.parts || []).reduce((a, p) => a + (p.price * p.quantity), 0))}</span>
                      </div>
                      <div className="pt-4 border-t border-[#1a73e8]/10 flex justify-between items-end">
                        <span className="text-xs font-bold text-[#1a73e8] uppercase">Inversión Total</span>
                        <span className="text-3xl font-bold text-[#1a73e8]">{formatCurrency(showDetailModal.total)}</span>
                      </div>
                    </div>
                  </Card>

                  <Button variant="primary" className="w-full py-4 text-xs font-bold uppercase tracking-widest" onClick={() => updateOrder(showDetailModal)}>Actualizar Expediente</Button>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => {
                        toast.info("Generando comprobante...");
                        generateInvoice(showDetailModal, 'print');
                      }} leftIcon={<Printer size={16} />}>Imprimir</Button>
                      <Button variant="outline" className="flex-1" onClick={() => {
                        toast.info("Generando comprobante...");
                        generateInvoice(showDetailModal, 'download');
                      }} leftIcon={<Download size={16} />}>Descargar</Button>
                    </div>
                    <button
                      onClick={() => notifyWhatsApp(showDetailModal)}
                      className="w-full py-3 bg-[#25d366]/10 text-[#128c7e] dark:bg-[#25d366]/5 dark:text-[#25d366] rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#25d366]/20 transition-all border border-[#25d366]/20"
                    >
                      <MessageSquare size={16} /> Notificar por WhatsApp
                    </button>
                  </div>
                  <Button variant="ghost" className="w-full text-[#ea4335] hover:bg-[#fce8e6]" onClick={() => handleDeleteOrder(showDetailModal)}>Eliminar Orden</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={t('orders.new')}
        subtitle={t('orders.new_subtitle')}
        size="4xl"
        allowFullscreen={true}
        footer={<>
          <Button variant="ghost" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit}>{t('orders.formalize')}</Button>
        </>}
      >
        <form onSubmit={handleSubmit} className="space-y-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1a73e8] uppercase tracking-wider">
                <Smartphone size={16} /> Datos del Equipo
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Select
                    label={t('orders.fields.client')}
                    required
                    onChange={e => setFormData({ ...formData, clientId: parseInt(e.target.value) })}
                  >
                    <option value="">{t('orders.fields.select_client')}</option>
                    {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Select
                    label={t('orders.fields.device_type')}
                    required
                    value={formData.deviceType}
                    onChange={e => setFormData({ ...formData, deviceType: e.target.value as DeviceType })}
                  >
                    {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('orders.fields.brand')} required placeholder="Ej: Apple" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
                <Input label={t('orders.fields.model')} required placeholder="Ej: iPhone 15" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('orders.fields.serial')} placeholder="Opcional" value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} />
                <div className="flex flex-col space-y-1.5">
                  <Select
                    label="Prioridad"
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                  >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#5f6368] ml-4 text-left block">{t('orders.fields.issue')}</label>
                <textarea
                  required
                  className="w-full p-6 bg-[#f8f9fa] dark:bg-neutral-800 rounded-none focus:bg-white focus:ring-2 focus:ring-[#1a73e8]/20 outline-none text-sm min-h-[120px] transition-all"
                  placeholder="Describe la falla detalladamente..."
                  value={formData.issueDescription}
                  onChange={e => setFormData({ ...formData, issueDescription: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1a73e8] uppercase tracking-wider">
                <Camera size={16} /> Registro y Consentimiento
              </div>
              <div className="space-y-3">
                <label className="text-xs font-semibold text-[#5f6368] ml-4 text-left block">Fotografías de Recepción</label>
                <div className="flex flex-wrap gap-3 p-4 bg-[#f8f9fa] dark:bg-neutral-800 rounded-none min-h-[100px]">
                  {formData.photos?.map((p, i) => (
                    <div key={i} className="relative group w-20 h-20 bg-white rounded-none overflow-hidden shadow-sm border border-neutral-200">
                      <img src={p} alt="Evidencia" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i, true)} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => document.getElementById('new-order-photos')?.click()}
                    className="w-20 h-20 rounded-none border-2 border-dashed border-[#dadce0] hover:border-[#1a73e8] hover:bg-[#e8f0fe] transition-all flex flex-col items-center justify-center text-[#5f6368] hover:text-[#1a73e8]"
                  >
                    <Plus size={20} />
                    <span className="text-[10px] font-bold mt-1 uppercase">Añadir</span>
                  </button>
                  <input id="new-order-photos" type="file" multiple className="hidden" accept="image/*" onChange={e => handleFileChange(e, true)} />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-semibold text-[#5f6368] ml-4 text-left block">Firma del Cliente</label>
                <div className="bg-[#f8f9fa] dark:bg-neutral-800 p-1 rounded-none border border-[#dadce0] dark:border-neutral-700 overflow-hidden">
                  <SignaturePad
                    onSave={(url) => setFormData(prev => ({ ...prev, customerSignature: url }))}
                    onClear={() => setFormData(prev => ({ ...prev, customerSignature: '' }))}
                  />
                </div>
                <p className="text-[10px] text-[#5f6368] px-4 font-medium leading-tight">
                  Al firmar, el cliente acepta los términos de servicio, diagnóstico preventivo y políticas de garantía de ShoroRepair.
                </p>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Orders;
