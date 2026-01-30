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
  Edit2,
  LayoutGrid,
  List,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Calendar,
  DollarSign
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
    ctx.strokeStyle = '#202124';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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
    e.preventDefault(); // Prevent scrolling while signing
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
    <div className="space-y-3">
      <div className="border-2 border-dashed border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#1a1c1e] rounded-2xl overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={500}
          height={200}
          className="w-full h-[150px] cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button type="button" onClick={clear} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline px-4">Limpiar firma</button>
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
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
    if (!formData.clientId || !formData.brand || !formData.model) {
      toast.error("Complete los campos obligatorios");
      return;
    }

    const toastId = toast.loading('Registrando ingreso técnico...');

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
          note: 'Orden recibida en laboratorio'
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

      toast.success("Orden registrada con éxito", { id: toastId });
    } catch (err) {
      console.error("Error creating order", err);
      toast.error("Error al registrar la orden", { id: toastId });
    }
  };

  const handleDeleteOrder = async (order: ServiceOrder) => {
    if (!order.id) return;
    if (confirm(`¿Estás seguro de eliminar permanentemente la orden ${order.orderNumber}?`)) {
      try {
        if (order.parts && order.parts.length > 0) {
          for (const part of order.parts) {
            const invPart = await db.inventory.get(part.partId);
            if (invPart) {
              await db.inventory.update(part.partId, { quantity: invPart.quantity + part.quantity });
            }
          }
        }
        await db.orders.update(order.id, { deleted: 1, synced: 0 });
        toast.success("Orden eliminada del sistema");
        setShowDetailModal(null);
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
    toast.info("Redirigiendo a WhatsApp...");
  };

  const updateOrder = async (order: ServiceOrder) => {
    const toastId = toast.loading('Actualizando expediente técnico...');
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
          if (newQuantity < 0) throw new Error(`Stock insuficiente para: ${part.name}`);
          await db.inventory.update(partId, { quantity: newQuantity });
        }
      }

      let logs = order.logs || [];
      if (oldOrder && oldOrder.status !== order.status) {
        logs.push({
          timestamp: Date.now(),
          status: order.status,
          technicianId: order.technicianId,
          note: `Expediente actualizado a estado: ${order.status}`
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
      toast.success("Expediente técnico sincronizado", { id: toastId });
    } catch (err: any) {
      console.error("Error updating order", err);
      toast.error(err.message || "Error al actualizar", { id: toastId });
    }
  };

  const addPartToOrder = async (order: ServiceOrder, partId: number) => {
    const invPart = await db.inventory.get(partId);
    if (!invPart || invPart.quantity <= 0) {
      toast.error("Sin stock disponible");
      return;
    }
    const newPart = { partId, name: invPart.name, quantity: 1, price: invPart.price };
    const updatedOrder = { ...order, parts: [...(order.parts || []), newPart] };

    const partsTotal = updatedOrder.parts.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const subtotal = (updatedOrder.laborCost || 0) + partsTotal;
    const tax = subtotal * (updatedOrder.taxRate / 100);
    updatedOrder.total = subtotal + tax;

    setShowDetailModal(updatedOrder);
    toast.info("Repuesto vinculado al expediente");
  };

  if (!orders || !clients || !technicians || !inventory) {
    return <TableSkeleton columns={5} rows={8} title="Service Center" />;
  }

  return (
    <div className="space-y-8 animate-in pb-20">
      {/* Header section with Stats or controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-[#1a1c1e] p-8 rounded-[2.5rem] shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5">
        <div>
          <h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
            <Wrench className="text-[#1a73e8]" size={28} />
            {t('orders.title')}
          </h1>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium">
            {orders.length} órdenes registradas • <span className="text-emerald-600 font-bold">{orders.filter(o => o.status === OrderStatus.READY).length} listos</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#f1f3f4] dark:bg-white/5 p-1 rounded-2xl">
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-md' : 'text-[#5f6368]'}`}><List size={18} /></button>
            <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-md' : 'text-[#5f6368]'}`}><LayoutGrid size={18} /></button>
          </div>
          {hasPermission('canEditOrders') && (
            <Button variant="primary" className="rounded-2xl px-6 py-4 shadow-lg shadow-blue-500/20 font-bold" leftIcon={<Plus size={18} />} onClick={() => setShowModal(true)}>
              {t('orders.new')}
            </Button>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 bg-white dark:bg-[#1a1c1e] p-4 rounded-3xl border border-[#f1f3f4] dark:border-white/5 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#1a73e8] transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar por #Orden, Marca, Modelo o Cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-6 py-3.5 bg-[#f1f3f4] dark:bg-white/5 rounded-2xl outline-none focus:bg-white dark:focus:bg-[#1a1c1e] border-2 border-transparent focus:border-[#1a73e8]/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {['all', OrderStatus.RECEIVED, OrderStatus.IN_REPAIR, OrderStatus.READY, OrderStatus.DELIVERED].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-2 ${filterStatus === s
                ? 'bg-[#1a73e8] text-white border-transparent shadow-lg shadow-blue-500/20'
                : 'bg-white dark:bg-white/5 text-[#5f6368] dark:text-[#9aa0a6] border-[#f1f3f4] dark:border-white/10 hover:border-[#1a73e8]/30'
                }`}
            >
              {s === 'all' ? t('common.all') : s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table/Grid */}
      {orders.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center bg-white dark:bg-[#1a1c1e] rounded-[3rem] border-2 border-dashed border-[#dadce0] dark:border-white/10">
          <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-3xl flex items-center justify-center text-blue-200 mb-6 drop-shadow-sm">
            <Wrench size={48} />
          </div>
          <h3 className="text-xl font-bold text-[#202124] dark:text-white uppercase tracking-tighter">Sin movimientos registrados</h3>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium">Utiliza el botón de nueva recepción para empezar.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
                  <th className="px-8 py-5 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('orders.table.service_client')}</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('orders.table.device')}</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('orders.table.status')}</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
                {orders.map(order => {
                  const client = clients?.find(c => c.id === order.clientId);
                  return (
                    <tr key={order.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="shrink-0 w-12 h-12 bg-[#1a73e8] text-white rounded-2xl flex items-center justify-center font-black text-xs shadow-lg shadow-blue-500/10 group-hover:scale-105 transition-transform">
                            #{order.orderNumber.slice(-4)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-[#202124] dark:text-white uppercase tracking-tight truncate">{order.orderNumber}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <User size={12} className="text-[#1a73e8]" />
                              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-bold truncate max-w-[140px]">{client?.name || 'S/N'}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Smartphone size={14} className="text-[#1a73e8]" />
                            <p className="text-sm font-bold text-[#3c4043] dark:text-[#bdc1c6] truncate max-w-[180px]">{order.brand} {order.model}</p>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-[#5f6368] font-bold uppercase tracking-wider">
                            <Calendar size={12} /> {formatDate(order.createdAt)}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-2">
                          <Badge
                            variant={order.status === OrderStatus.READY ? 'success' : (order.status === OrderStatus.IN_REPAIR || order.status === OrderStatus.DIAGNOSTIC) ? 'warning' : 'brand'}
                            size="xs"
                            className="w-fit"
                          >
                            {order.status}
                          </Badge>
                          {order.priority === Priority.HIGH && (
                            <span className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase animate-pulse"><Zap size={10} fill="currentColor" /> Prioridad Crítica</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setShowDetailModal(order)} className="p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 rounded-xl hover:bg-blue-100 transition-colors" title="Gestionar Expediente"><Edit2 size={16} /></button>
                          <button onClick={() => generateInvoice(order, 'print')} className="p-2.5 bg-gray-50 text-gray-600 dark:bg-white/5 rounded-xl hover:bg-gray-100 transition-colors"><Printer size={16} /></button>
                          <button onClick={() => generateEntryTicket(order)} className="p-2.5 bg-gray-50 text-gray-600 dark:bg-white/5 rounded-xl hover:bg-gray-100 transition-colors" title="Ticket de Ingreso"><FileText size={16} /></button>
                          <button onClick={() => notifyWhatsApp(order)} className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 rounded-xl hover:bg-emerald-100 transition-colors"><MessageSquare size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map(order => {
            const client = clients?.find(c => c.id === order.clientId);
            return (
              <Card key={order.id} className="p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-[2rem] group border-[#f1f3f4] dark:border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs">
                      {order.brand.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm tracking-tight">#{order.orderNumber}</h4>
                      <p className="text-[10px] text-[#5f6368] font-bold uppercase">{client?.name || 'Cliente'}</p>
                    </div>
                  </div>
                  <Badge variant={order.status === OrderStatus.READY ? 'success' : 'brand'} size="xs">{order.status.split(' ')[0]}</Badge>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-2">
                    < स्मार्टफोन size={16} className="text-[#1a73e8]" />
                    <p className="text-sm font-black text-[#202124] dark:text-white truncate">{order.brand} {order.model}</p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#5f6368]">
                    <div className="flex items-center gap-1.5"><Clock size={12} /> {formatDate(order.createdAt)}</div>
                    <div className="flex items-center gap-1.5 text-emerald-600"><DollarSign size={12} /> {formatCurrency(order.total)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-4 border-t border-[#f1f3f4] dark:border-white/5">
                  <Button variant="tonal" size="sm" className="rounded-xl font-bold uppercase text-[9px]" onClick={() => setShowDetailModal(order)}>Workbench</Button>
                  <Button variant="ghost" size="sm" className="rounded-xl font-bold uppercase text-[9px]" onClick={() => notifyWhatsApp(order)}>Notificar</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Workbench Modal (Order Detail) */}
      <Modal
        isOpen={!!showDetailModal}
        onClose={() => setShowDetailModal(null)}
        title={showDetailModal ? `Workcenter #${showDetailModal.orderNumber}` : 'Workcenter'}
        subtitle="Laboratorio de Reparación ShoroRepair"
        size="5xl"
        allowFullscreen={true}
      >
        {showDetailModal && (
          <div className="flex flex-col h-full space-y-8 animate-in pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Technical Workspace */}
              <div className="lg:col-span-8 space-y-10">
                {/* Workflow Progress */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs font-black text-[#1a73e8] uppercase tracking-[0.2em]">
                      <Activity size={16} /> <span>Flujo del Dispositivo</span>
                    </div>
                    <Badge variant="brand" size="xs">Estado: {showDetailModal.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {Object.values(OrderStatus).map(s => (
                      <button
                        key={s}
                        onClick={() => setShowDetailModal({ ...showDetailModal, status: s })}
                        className={`px-3 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-wider border-2 transition-all ${showDetailModal.status === s
                          ? 'bg-[#1a73e8] text-white border-transparent shadow-lg shadow-blue-500/20'
                          : 'bg-white dark:bg-white/5 text-[#5f6368] dark:text-[#9aa0a6] border-[#f1f3f4] dark:border-white/10 hover:border-[#1a73e8]/30 flex flex-col items-center gap-1.5'
                          }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Technical Log */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs font-black text-[#1a73e8] uppercase tracking-[0.2em]">
                      <FileText size={16} /> <span>Bitácora de Laboratorio</span>
                    </div>
                    <Select
                      className="w-48 h-10 text-[10px] font-bold"
                      value={showDetailModal.technicianId || ''}
                      onChange={e => setShowDetailModal({ ...showDetailModal, technicianId: parseInt(e.target.value) || undefined })}
                    >
                      <option value="">Técnico Responsable</option>
                      {technicians?.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </Select>
                  </div>
                  <div className="relative group">
                    <textarea
                      className="w-full p-8 bg-[#f8f9fa] dark:bg-white/5 dark:text-white border-2 border-transparent focus:border-[#1a73e8]/30 rounded-[2rem] focus:bg-white outline-none transition-all text-sm font-medium min-h-[180px] leading-relaxed shadow-inner"
                      placeholder="Ingresa diagnósticos, mediciones y pasos de reparación..."
                      value={showDetailModal.technicalDiagnosis || ''}
                      onChange={e => setShowDetailModal({ ...showDetailModal, technicalDiagnosis: e.target.value })}
                    />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <Badge variant="slate" size="xs" className="opacity-50 group-focus-within:opacity-100">Autosave Active</Badge>
                    </div>
                  </div>
                </div>

                {/* Parts & Components */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs font-black text-[#1a73e8] uppercase tracking-[0.2em]">
                      <Package size={16} /> <span>Gestión de Repuestos</span>
                    </div>
                    <Select
                      className="w-64 h-10 text-[10px] font-bold"
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        if (id) addPartToOrder(showDetailModal, id);
                        e.target.value = "";
                      }}
                    >
                      <option value="">+ Vincular Repuesto</option>
                      {inventory?.map(i => <option key={i.id} value={i.id}>{i.name} (₡{i.price})</option>)}
                    </Select>
                  </div>

                  {(showDetailModal.parts || []).length === 0 ? (
                    <div className="p-10 border-2 border-dashed border-[#f1f3f4] dark:border-white/5 rounded-[2rem] text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">Sin repuestos instalados</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {showDetailModal.parts.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 border border-[#f1f3f4] dark:border-white/10 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-[10px]">{p.quantity}x</div>
                            <span className="text-sm font-bold text-[#3c4043] dark:text-white">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-[#1a73e8]">{formatCurrency(p.price * p.quantity)}</span>
                            <button
                              onClick={() => {
                                const newParts = showDetailModal.parts?.filter((_, i) => i !== idx);
                                setShowDetailModal({ ...showDetailModal, parts: newParts || [] });
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Sidebar */}
              <div className="lg:col-span-4 space-y-6">
                <Card variant="tonal" className="p-8 bg-[#1a73e8] text-white rounded-[2.5rem] shadow-2xl shadow-blue-500/30 overflow-hidden relative">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                  <h3 className="font-black text-blue-100 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
                    <DollarSign size={14} /> Liquidación Económica
                  </h3>
                  <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-center group">
                      <span className="text-blue-100 text-sm font-bold flex items-center gap-2">Mano de Obra <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></span>
                      <input
                        type="number"
                        className="w-28 text-right bg-white/10 hover:bg-white/20 transition-all border-none rounded-xl p-2 text-md font-black text-white outline-none"
                        value={showDetailModal.laborCost}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          const pts = (showDetailModal.parts || []).reduce((a, p) => a + (p.price * p.quantity), 0);
                          const sub = val + pts;
                          setShowDetailModal({ ...showDetailModal, laborCost: val, total: sub * (1 + (showDetailModal.taxRate || 15) / 100) });
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100 text-sm font-bold">Repuestos</span>
                      <span className="font-black text-md">{formatCurrency((showDetailModal.parts || []).reduce((a, p) => a + (p.price * p.quantity), 0))}</span>
                    </div>
                    <div className="pt-6 border-t border-white/20 space-y-1">
                      <div className="flex justify-between items-center text-xs font-black text-blue-200 uppercase tracking-widest">
                        <span>Importe Total</span>
                        <span>INC. IVA</span>
                      </div>
                      <h2 className="text-5xl font-black tracking-tighter drop-shadow-lg">{formatCurrency(showDetailModal.total).split(',')[0]}</h2>
                    </div>
                  </div>
                </Card>

                <div className="space-y-3">
                  <Button variant="primary" className="w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/10" leftIcon={<Save size={20} />} onClick={() => updateOrder(showDetailModal)}>Sincronizar Expediente</Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="rounded-2xl py-4 h-auto flex flex-col items-center gap-2 font-bold text-[10px] uppercase border-[#f1f3f4] dark:border-white/10" onClick={() => generateInvoice(showDetailModal, 'print')}>
                      <Printer size={20} className="text-[#1a73e8]" />
                      <span>Factura</span>
                    </Button>
                    <Button variant="outline" className="rounded-2xl py-4 h-auto flex flex-col items-center gap-2 font-bold text-[10px] uppercase border-[#f1f3f4] dark:border-white/10" onClick={() => generateEntryTicket(showDetailModal)}>
                      <FileText size={20} className="text-[#1a73e8]" />
                      <span>Ticket</span>
                    </Button>
                  </div>

                  <button
                    onClick={() => notifyWhatsApp(showDetailModal)}
                    className="w-full py-4 bg-[#25d366] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#128c7e] transition-all shadow-lg shadow-emerald-500/10"
                  >
                    <MessageSquare size={18} /> Enviar Actualización WA
                  </button>

                  <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl mt-4 font-bold uppercase text-[9px] tracking-widest" onClick={() => handleDeleteOrder(showDetailModal)}>Eliminar Registro Permanentemente</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* New Order Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={t('orders.new')}
        subtitle="Registro de Ingreso a Laboratorio ShoroRepair"
        size="5xl"
        allowFullscreen={true}
        footer={<div className="flex gap-3 px-8 pb-6"><Button variant="ghost" className="rounded-2xl px-8" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button><Button variant="primary" className="rounded-2xl px-12 shadow-xl shadow-blue-500/20 font-black uppercase tracking-widest text-[11px]" onClick={handleSubmit}>{t('orders.formalize')}</Button></div>}
      >
        <form onSubmit={handleSubmit} className="space-y-12 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Column 1: Equipment & Client */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-xs font-black text-[#1a73e8] uppercase tracking-[0.2em]">
                  <Smartphone size={18} /> <span>Anatomía del Equipo</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Select
                    label={t('orders.fields.client')}
                    required
                    onChange={e => setFormData({ ...formData, clientId: parseInt(e.target.value) })}
                  >
                    <option value="">{t('orders.fields.select_client')}</option>
                    {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <Select
                    label={t('orders.fields.device_type')}
                    required
                    value={formData.deviceType}
                    onChange={e => setFormData({ ...formData, deviceType: e.target.value as DeviceType })}
                  >
                    {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Input label={t('orders.fields.brand')} required placeholder="Apple, Samsung..." value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
                  <Input label={t('orders.fields.model')} required placeholder="iPhone 15 Pro..." value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
                  <Select
                    label="Prioridad"
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                  >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <Input label={t('orders.fields.serial')} placeholder="IMEI o S/N..." value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} />
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 text-xs font-black text-[#1a73e8] uppercase tracking-[0.2em]">
                  <AlertCircle size={18} /> <span>Falla Reportada</span>
                </div>
                <textarea
                  required
                  className="w-full p-8 bg-[#f8f9fa] dark:bg-white/5 dark:text-white border-2 border-transparent focus:border-[#1a73e8]/30 rounded-[2rem] focus:bg-white outline-none transition-all text-sm font-medium min-h-[160px] leading-relaxed shadow-inner"
                  placeholder="Describe el problema técnico reportado por el cliente..."
                  value={formData.issueDescription}
                  onChange={e => setFormData({ ...formData, issueDescription: e.target.value })}
                />
              </div>
            </div>

            {/* Column 2: Evidence & Legal */}
            <div className="lg:col-span-12 xl:col-span-5 space-y-10">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-black text-[#1a73e8] uppercase tracking-[0.2em]">
                    <Camera size={18} /> <span>Evidencia Visual</span>
                  </div>
                  <Badge variant="slate" size="xs">Opcional</Badge>
                </div>
                <div className="p-6 bg-[#f8f9fa] dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-[#dadce0] dark:border-white/10 group hover:border-[#1a73e8]/30 transition-colors">
                  <div className="flex flex-wrap gap-4 min-h-[100px] items-center justify-center">
                    {formData.photos?.map((p, i) => (
                      <div key={i} className="relative group/photo w-24 h-24 rounded-2xl overflow-hidden shadow-md border-4 border-white">
                        <img src={p} alt="Evidencia" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePhoto(i, true)} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                          <Trash2 size={24} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => document.getElementById('new-order-photos')?.click()}
                      className="w-24 h-24 rounded-2xl bg-white dark:bg-white/5 border-2 border-[#dadce0] dark:border-white/10 hover:border-[#1a73e8] hover:text-[#1a73e8] transition-all flex flex-col items-center justify-center text-[#5f6368] shadow-sm active:scale-95"
                    >
                      <Plus size={32} strokeWidth={1} />
                      <span className="text-[9px] font-black uppercase mt-1 tracking-widest">Subir</span>
                    </button>
                    <input id="new-order-photos" type="file" multiple className="hidden" accept="image/*" onChange={e => handleFileChange(e, true)} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-black text-[#1a73e8] uppercase tracking-[0.2em]">
                    <ShieldCheck size={18} /> <span>Autorización Legal</span>
                  </div>
                  <Badge variant="brand" size="xs">Certificado</Badge>
                </div>
                <div className="bg-[#f8f9fa] dark:bg-[#111] p-1 rounded-[2rem] border border-[#dadce0] dark:border-white/5 shadow-inner">
                  <SignaturePad
                    onSave={(url) => setFormData(prev => ({ ...prev, customerSignature: url }))}
                    onClear={() => setFormData(prev => ({ ...prev, customerSignature: '' }))}
                  />
                </div>
                <div className="p-6 bg-amber-50 dark:bg-amber-900/5 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                  <p className="text-[10px] text-amber-700 dark:text-amber-500/80 font-bold leading-relaxed">
                    Al estampar su firma aquí, el cliente confirma la veracidad de los datos suministrados y acepta las políticas de diagnóstico técnico, pérdida de garantía original del fabricante y tiempos estipulados de retiro para el ShoroRepair Center.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Orders;
