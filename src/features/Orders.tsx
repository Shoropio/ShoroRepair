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
  MoreVertical,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
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
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL());
    toast.success(t('orders.signature_captured'));
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="space-y-4">
      <div className="relative border-2 border-dashed border-[#dadce0] dark:border-white/10 rounded-none bg-white dark:bg-[#1a1c1e] overflow-hidden group">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-[200px] cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <div className="absolute top-4 right-4 flex gap-2">
          <Button variant="outline" size="sm" className="rounded-none px-4 py-2 font-bold uppercase text-[10px]" onClick={handleClear}>{t('common.clear')}</Button>
          <Button variant="primary" size="sm" className="rounded-none px-4 py-2 font-bold uppercase text-[10px]" onClick={handleSave}>{t('common.save')}</Button>
        </div>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-none opacity-40">
          <AlertCircle size={14} />
          <p className="text-[10px] font-bold uppercase">{t('orders.client_sign_accept')}</p>
        </div>
      </div>
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case OrderStatus.RECEIVED: return t('orders.status.received');
      case OrderStatus.DIAGNOSTIC: return t('orders.status.diagnostic');
      case OrderStatus.IN_REPAIR: return t('orders.status.in_repair');
      case OrderStatus.READY: return t('orders.status.ready');
      case OrderStatus.DELIVERED: return t('orders.status.delivered');
      case OrderStatus.CANCELLED: return t('orders.status.cancelled');
      default: return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case Priority.LOW: return t('common.low');
      case Priority.MEDIUM: return t('common.medium');
      case Priority.HIGH: return t('common.high');
      case Priority.URGENT: return t('common.critical');
      default: return priority;
    }
  };

  const getDeviceTypeLabel = (type: string) => {
    switch (type) {
      case DeviceType.PHONE: return t('orders.fields.device_type_phone') || 'Phone';
      case DeviceType.COMPUTER: return t('orders.fields.device_type_computer') || 'Computer';
      case DeviceType.APPLIANCE: return t('orders.fields.device_type_appliance') || 'Appliance';
      case DeviceType.ELECTRONICS: return t('orders.fields.device_type_electronics') || 'Electronics';
      case DeviceType.OTHER: return t('orders.fields.device_type_other') || 'Other';
      default: return type;
    }
  };

  const orders = useLiveQuery(async () => {
    const collection = db.orders.orderBy('createdAt').reverse();
    const result = await collection.toArray();
    return result.filter(order => {
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
            loading: t('orders.uploading_images'),
            success: (urls) => {
              if (isNewOrder) {
                setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), ...urls] }));
              } else if (showDetailModal) {
                setShowDetailModal({ ...showDetailModal, photos: [...(showDetailModal.photos || []), ...urls] });
              }
              return t('orders.images_ready');
            },
            error: t('orders.images_error')
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
      toast.error(t('common.required_fields'));
      return;
    }

    const toastId = toast.loading(t('orders.registering_intake'));

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
          note: t('orders.received_in_lab')
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

      toast.success(t('orders.os_recorded'), { id: toastId });
    } catch (err) {
      console.error("Error creating order", err);
      toast.error(t('messages.error'), { id: toastId });
    }
  };

  const handleDeleteOrder = async (order: ServiceOrder) => {
    if (!order.id) return;
    if (confirm(`${t('messages.confirm_delete')} ${order.orderNumber}?`)) {
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
        toast.success(t('messages.deleted'));
        setShowDetailModal(null);
      } catch (err) {
        toast.error(t('messages.error'));
      }
    }
  };

  const notifyWhatsApp = async (order: ServiceOrder) => {
    const client = await db.clients.get(order.clientId);
    if (!client || !client.phone) {
      toast.error(t('orders.no_phone_registered'));
      return;
    }

    const message = `${t('orders.whatsapp_header')}\n\n${t('orders.whatsapp_body', { name: client.name, brand: order.brand, model: order.model, number: order.orderNumber, status: order.status.toUpperCase() })}\n\n${order.status === OrderStatus.READY ? t('orders.whatsapp_ready', { total: order.total.toFixed(2) }) : t('orders.whatsapp_not_ready')}\n\n${t('dashboard.welcome')}`;

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
    toast.info(t('orders.redirecting_whatsapp'));
  };

  const updateOrder = async (order: ServiceOrder) => {
    const toastId = toast.loading(t('orders.syncing_record'));
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
          if (newQuantity < 0) throw new Error(`${t('orders.insufficient_stock_for', { name: part.name })}`);
          await db.inventory.update(partId, { quantity: newQuantity });
        }
      }

      let logs = order.logs || [];
      if (oldOrder && oldOrder.status !== order.status) {
        logs.push({
          timestamp: Date.now(),
          status: order.status,
          technicianId: order.technicianId,
          note: t('orders.log_status_updated', { status: order.status })
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
      toast.success(t('orders.os_sync_success'), { id: toastId });
    } catch (err: any) {
      console.error("Error updating order", err);
      toast.error(err.message || t('messages.error'), { id: toastId });
    }
  };

  const addPartToOrder = async (order: ServiceOrder, partId: number) => {
    const invPart = await db.inventory.get(partId);
    if (!invPart || invPart.quantity <= 0) {
      toast.error(t('orders.out_of_stock'));
      return;
    }
    const newPart = { partId, name: invPart.name, quantity: 1, price: invPart.price };
    const updatedOrder = { ...order, parts: [...(order.parts || []), newPart] };

    const partsTotal = updatedOrder.parts.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const subtotal = (updatedOrder.laborCost || 0) + partsTotal;
    const tax = subtotal * (updatedOrder.taxRate / 100);
    updatedOrder.total = subtotal + tax;

    setShowDetailModal(updatedOrder);
    toast.info(t('orders.linked_part'));
  };

  if (!orders || !clients || !technicians || !inventory) {
    return <TableSkeleton columns={5} rows={8} title="Service Center" />;
  }

  return (
    <div className="space-y-6 lg:space-y-8 animate-in pb-12 lg:pb-20">
      {/* Header section with Stats or controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-[#1a1c1e] p-6 lg:p-8 rounded-none shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
            <Wrench className="text-[#1a73e8]" size={24} />
            {t('orders.title')}
          </h1>
          <p className="text-xs lg:text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1 font-medium">
            {t('orders.tracked_count', { count: orders.length })} • <span className="text-emerald-600 font-bold">{t('orders.ready_count', { count: orders.filter(o => o.status === OrderStatus.READY).length })}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#f1f3f4] dark:bg-white/5 p-1 rounded-none">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-none transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368] hover:bg-gray-50'}`}><List size={16} /></button>
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-none transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368] hover:bg-gray-50'}`}><LayoutGrid size={16} /></button>
          </div>
          {hasPermission('canEditOrders') && (
            <Button variant="primary" className="rounded-none px-4 lg:px-6 py-2.5 font-bold uppercase tracking-widest text-[10px]" onClick={() => setShowModal(true)} leftIcon={<Plus size={18} />}>
              {t('orders.new')}
            </Button>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 bg-white dark:bg-[#1a1c1e] p-4 rounded-none border border-[#f1f3f4] dark:border-white/5 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#1a73e8] transition-colors" size={18} />
          <input
            type="text"
            placeholder={t('orders.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-[#f1f3f4] dark:bg-white/5 rounded-none outline-none focus:bg-white dark:focus:bg-[#1a1c1e] border-2 border-transparent focus:border-[#1a73e8]/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {['all', OrderStatus.RECEIVED, OrderStatus.IN_REPAIR, OrderStatus.READY, OrderStatus.DELIVERED].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 lg:px-5 py-2 rounded-none text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-2 ${filterStatus === s
                ? 'bg-[#1a73e8] text-white border-transparent shadow-lg shadow-blue-500/20'
                : 'bg-white dark:bg-white/5 text-[#5f6368] dark:text-[#9aa0a6] border-[#f1f3f4] dark:border-white/10 hover:border-[#1a73e8]/30'
                }`}
            >
              {s === 'all' ? t('common.all') : getStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table/Grid */}
      {orders.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#1a1c1e] rounded-none border-2 border-dashed border-[#dadce0] dark:border-white/10">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/10 rounded-none flex items-center justify-center text-blue-200 mb-6 drop-shadow-sm">
            <Wrench size={40} />
          </div>
          <h3 className="text-lg font-bold text-[#202124] dark:text-white uppercase tracking-tighter">{t('orders.empty_movements')}</h3>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium">{t('orders.empty_movements_subtitle')}</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-white/5 rounded-none overflow-hidden shadow-2xl shadow-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('orders.table.service_client')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('orders.table.device')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">{t('orders.table.status')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#5f6368] uppercase tracking-widest text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
                {orders.map(order => {
                  const client = clients?.find(c => c.id === order.clientId);
                  return (
                    <tr key={order.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="shrink-0 w-10 h-10 bg-[#1a73e8] text-white rounded-none flex items-center justify-center font-black text-[10px] shadow-lg shadow-blue-500/10 transition-transform">
                            #{order.orderNumber.slice(-4)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#202124] dark:text-white uppercase tracking-tight truncate">{order.orderNumber}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <User size={10} className="text-[#1a73e8]" />
                              <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] font-bold truncate max-w-[140px] uppercase tracking-tight">{client?.name || t('common.none')}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <Smartphone size={14} className="text-[#1a73e8]" />
                            <p className="text-sm font-bold text-[#3c4043] dark:text-[#bdc1c6] truncate max-w-[180px]">{order.brand} {order.model}</p>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-[#5f6368] font-bold uppercase tracking-wider">
                            <Calendar size={12} /> {formatDate(order.createdAt)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <Badge
                            variant={order.status === OrderStatus.READY ? 'success' : (order.status === OrderStatus.IN_REPAIR || order.status === OrderStatus.DIAGNOSTIC) ? 'warning' : 'brand'}
                            size="xs"
                            className="w-fit scale-90 origin-left"
                          >
                            {getStatusLabel(order.status)}
                          </Badge>
                          {order.priority === Priority.HIGH && (
                            <span className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase animate-pulse"><Zap size={10} fill="currentColor" /> {t('orders.priority_critical')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5 opacity-25 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setShowDetailModal(order)} className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 rounded-none hover:bg-blue-100 transition-colors" title={t('orders.manage_file')}><Edit2 size={14} /></button>
                          <button onClick={() => generateInvoice(order, 'print')} className="p-2 bg-gray-50 text-gray-600 dark:bg-white/5 rounded-none hover:bg-gray-100 transition-colors"><Printer size={14} /></button>
                          <button onClick={() => generateEntryTicket(order)} className="p-2 bg-gray-50 text-gray-600 dark:bg-white/5 rounded-none hover:bg-gray-100 transition-colors" title={t('orders.entry_ticket')}><FileText size={14} /></button>
                          <button onClick={() => notifyWhatsApp(order)} className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 rounded-none hover:bg-emerald-100 transition-colors"><MessageSquare size={14} /></button>
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
              <Card key={order.id} className="p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-none group border border-[#f1f3f4] dark:border-white/5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-none flex items-center justify-center font-black text-xs">
                      {order.brand.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm tracking-tight text-[#202124] dark:text-white uppercase">#{order.orderNumber.slice(-6)}</h4>
                      <p className="text-[10px] text-[#5f6368] font-black uppercase tracking-tight">{client?.name || t('orders.fields.client')}</p>
                    </div>
                  </div>
                  <Badge variant={order.status === OrderStatus.READY ? 'success' : 'brand'} size="xs" className="scale-90">{getStatusLabel(order.status)}</Badge>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2">
                    <Smartphone size={14} className="text-[#1a73e8]" />
                    <p className="text-sm font-bold text-[#202124] dark:text-white truncate uppercase tracking-tight">{order.brand} {order.model}</p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-[#5f6368] uppercase tracking-widest">
                    <div className="flex items-center gap-1.5"><Clock size={12} /> {formatDate(order.createdAt)}</div>
                    <div className="flex items-center gap-1.5 text-emerald-600 font-black tracking-tighter"><DollarSign size={12} /> {formatCurrency(order.total)}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-[#f1f3f4] dark:border-white/5">
                  <Button variant="outline" size="sm" className="flex-1 rounded-none text-[10px] font-bold uppercase py-2" onClick={() => setShowDetailModal(order)}>{t('orders.manage_file')}</Button>
                  <Button variant="outline" size="sm" className="rounded-none p-2" onClick={() => notifyWhatsApp(order)}><MessageSquare size={14} /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Order Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={t('orders.new')}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <Select
              label={t('orders.table.service_client')}
              value={formData.clientId?.toString() || ''}
              onChange={e => setFormData({ ...formData, clientId: parseInt(e.target.value) })}
              required
            >
              <option value="">{t('orders.fields.select_client')}</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('orders.fields.brand')} value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} required />
              <Input label={t('orders.fields.model')} value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} required />
            </div>
            <Input label={t('orders.fields.serial')} value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} />
            <Select label={t('common.priority')} value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}>
              <option value={Priority.LOW}>{t('common.low')}</option>
              <option value={Priority.MEDIUM}>{t('common.medium')}</option>
              <option value={Priority.HIGH}>{t('common.high')}</option>
            </Select>
          </div>
          <Input label={t('orders.fields.issue')} value={formData.issueDescription} onChange={e => setFormData({ ...formData, issueDescription: e.target.value })} required />
          <div className="pt-4 border-t border-[#f1f3f4] dark:border-white/5 flex justify-end gap-3">
            <Button variant="ghost" className="rounded-none px-6 py-2.5 font-bold uppercase text-[10px]" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" className="rounded-none px-10 py-3 shadow-lg shadow-blue-500/10 font-bold uppercase tracking-widest text-[10px]">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail / Workbench Modal */}
      <Modal
        isOpen={!!showDetailModal}
        onClose={() => setShowDetailModal(null)}
        title={showDetailModal ? t('orders.workbench_title', { number: showDetailModal.orderNumber }) : ''}
        size="4xl"
      >
        {showDetailModal && (
          <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-200px)] overflow-hidden">
            {/* Sidebar info */}
            <div className="lg:col-span-4 bg-[#f8f9fa] dark:bg-[#1a1c1e] p-6 lg:p-8 border-r border-[#f1f3f4] dark:border-white/5 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="p-5 bg-white dark:bg-[#202124] rounded-none shadow-sm border border-[#f1f3f4] dark:border-white/5">
                  <div className="flex items-center gap-3 text-[#1a73e8] mb-3">
                    <Smartphone size={20} />
                    <h4 className="font-black text-xs uppercase tracking-widest">{t('orders.device_info')}</h4>
                  </div>
                  <p className="text-sm font-black text-[#202124] dark:text-white uppercase truncate">{showDetailModal.brand} {showDetailModal.model}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">SN/IMEI: {showDetailModal.serialNumber || t('common.none')}</p>
                </div>

                <div className="p-5 bg-white dark:bg-[#202124] rounded-none shadow-sm border border-[#f1f3f4] dark:border-white/5">
                  <div className="flex items-center gap-3 text-amber-600 mb-3">
                    <AlertCircle size={20} />
                    <h4 className="font-black text-xs uppercase tracking-widest">{t('orders.failure_report')}</h4>
                  </div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 italic line-clamp-3">"{showDetailModal.issueDescription}"</p>
                </div>
              </div>

              {/* Photos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-[10px] uppercase tracking-widest text-[#5f6368]">{t('orders.photo_record')}</h4>
                  <label className="cursor-pointer p-2 bg-blue-50 text-blue-600 rounded-none hover:bg-blue-100 transition-colors">
                    <Camera size={14} />
                    <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleFileChange(e, false)} />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {showDetailModal.photos?.map((url, i) => (
                    <div key={i} className="relative group aspect-square rounded-none overflow-hidden shadow-md">
                      <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(i, false)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-none opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main workshop flow */}
            <div className="lg:col-span-8 p-6 lg:p-10 overflow-y-auto space-y-8 bg-white dark:bg-[#1a1c1e]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#f1f3f4] dark:border-white/5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('orders.repair_status')}</label>
                  <div className="flex flex-wrap gap-2">
                    {[OrderStatus.RECEIVED, OrderStatus.DIAGNOSTIC, OrderStatus.IN_REPAIR, OrderStatus.READY, OrderStatus.DELIVERED].map(s => (
                      <button
                        key={s}
                        onClick={() => setShowDetailModal({ ...showDetailModal, status: s })}
                        className={`px-4 py-2 rounded-none text-[9px] font-bold uppercase tracking-widest transition-all border-2 ${showDetailModal.status === s ? 'bg-[#1a73e8] text-white border-transparent' : 'text-gray-400 border-gray-100 hover:border-blue-200'}`}
                      >
                        {getStatusLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-indigo-600">
                    <User size={18} />
                    <h4 className="font-black text-xs uppercase tracking-widest">{t('orders.responsible_tech')}</h4>
                  </div>
                  <Select value={showDetailModal.technicianId?.toString() || ''} onChange={e => setShowDetailModal({ ...showDetailModal, technicianId: parseInt(e.target.value) })}>
                    <option value="">{t('orders.link_technician')}</option>
                    {technicians?.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                  </Select>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-emerald-600">
                    <Package size={18} />
                    <h4 className="font-black text-xs uppercase tracking-widest">{t('orders.parts_supplies')}</h4>
                  </div>
                  <Select value="" onChange={e => addPartToOrder(showDetailModal, parseInt(e.target.value))}>
                    <option value="">{t('orders.add_component')}</option>
                    {inventory?.filter(p => !showDetailModal.parts?.some(op => op.partId === p.id)).map(p => <option key={p.id} value={p.id}>{p.name} (₡{p.price})</option>)}
                  </Select>
                </div>
              </div>

              {showDetailModal.parts && showDetailModal.parts.length > 0 && (
                <div className="bg-[#f8f9fa] dark:bg-white/5 rounded-none p-6 border border-[#f1f3f4] dark:border-white/5">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#5f6368] font-black uppercase tracking-widest">
                        <th className="pb-4 text-left">{t('orders.table.component')}</th>
                        <th className="pb-4 text-center">{t('orders.table.quantity')}</th>
                        <th className="pb-4 text-right">{t('orders.table.amount')}</th>
                        <th className="pb-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dadce0] dark:divide-white/5">
                      {showDetailModal.parts.map((p, i) => (
                        <tr key={i}>
                          <td className="py-3 font-bold uppercase">{p.name}</td>
                          <td className="py-3 text-center">{p.quantity}</td>
                          <td className="py-3 text-right font-black">₡{p.price}</td>
                          <td className="py-3 text-right">
                            <button onClick={() => {
                              const newParts = [...showDetailModal.parts!];
                              newParts.splice(i, 1);
                              setShowDetailModal({ ...showDetailModal, parts: newParts });
                            }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-none"><X size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-8 border-t border-[#f1f3f4] dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-20">
                <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-none">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{t('orders.estimated_total')}</p>
                  <p className="text-2xl font-black text-blue-800 dark:text-blue-100">{formatCurrency(showDetailModal.total || 0)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" className="rounded-none px-10 py-3 font-black uppercase text-[10px]" onClick={() => setShowDetailModal(null)}>{t('common.discard')}</Button>
                  <Button variant="danger" className="rounded-none px-4 lg:px-6 py-3 font-black uppercase text-[10px]" onClick={() => handleDeleteOrder(showDetailModal)}>{t('common.delete')}</Button>
                  <Button variant="primary" className="rounded-none px-10 py-3 shadow-lg shadow-blue-500/10 font-black uppercase tracking-widest text-[10px]" onClick={() => updateOrder(showDetailModal)}>{t('orders.update_os')}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
