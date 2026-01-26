
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  ServiceOrder,
  OrderStatus,
  Priority,
  DeviceType,
  PaymentMethod,
  PaymentStatus,
  Client,
  OrderPart
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
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { handlePrint } from '../utils/printUtils';
import { formatCurrency, formatDate } from '../utils/formatUtils';

import { useDebounce } from '../hooks/useDebounce';
import TableSkeleton from '../src/components/TableSkeleton';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import Badge from '../src/components/Badge';
import Card from '../src/components/Card';
import Modal from '../src/components/Modal';
import { uploadImage, compressImage, uploadFile } from '../src/utils/storageUtils';
import { generateBarcode } from '../src/utils/barcodeUtils';
import { usePermissions } from '../hooks/usePermissions';
import { MessageLog } from '../types';

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

    // Scale coordinates based on canvas internal size vs display size
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
      toast.promise(
        (async () => {
          const path = `temp/signatures/${Date.now()}.png`;
          const url = await uploadImage(data, path);
          onSave(url);
          return url;
        })(),
        {
          loading: 'Subiendo firma...',
          success: 'Firma vinculada',
          error: 'Error al subir firma'
        }
      );
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

      // --- LOCAL FIRST: Save to Dexie immediately with Base64 ---
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
        synced: 0 // Mark for sync manager
      };

      const localId = await db.orders.add(newOrder);
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

      toast.success("Orden guardada localmente", { id: toastId });

    } catch (err) {
      console.error("Error creating order", err);
      toast.error("Error al registrar la orden", { id: toastId });
    }
  };

  const handleDeleteOrder = async (order: ServiceOrder) => {
    if (!order.id) return;
    if (confirm(`¿Estás seguro de eliminar permanentemente la orden ${order.orderNumber}? Esta acción no se puede deshacer.`)) {
      try {
        await db.orders.delete(order.id);
        toast.success("Orden eliminada correctamente");
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

    const message = `*ShoroRepair - Actualización de Servicio*\n\nHola ${client.name}, te informamos que tu equipo *${order.brand} ${order.model}* (Orden ${order.orderNumber}) ha cambiado al estado: *${order.status.toUpperCase()}*.\n\n${order.status === OrderStatus.READY ? `Total a pagar: ₡${order.total.toFixed(2)}\nYa puedes pasar a retirarlo.` : 'Te avisaremos cuando esté listo.'}\n\n¡Gracias por tu confianza!`;

    // --- LOG MESSAGE TO SYSTEM ---
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

  const generateEntryTicket = async (order: ServiceOrder) => {
    const client = await db.clients.get(order.clientId);
    const settings = (await db.settings.toArray())[0];
    if (!client || !settings) return;

    // Helper to load image for PDF (handles URLs and Base64)
    const loadImage = async (src: string): Promise<string> => {
      if (src.startsWith('data:')) return src;
      const resp = await fetch(src);
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result as string);
      });
    };

    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 200] // Thermal roll width
    }) as any;

    const margin = 5;
    let y = 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.businessName.toUpperCase(), 40, y, { align: 'center' }); y += 7;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Comprobante de Ingreso`, 40, y, { align: 'center' }); y += 5;
    doc.text(`OS: ${order.orderNumber}`, 40, y, { align: 'center' }); y += 5;
    doc.text(`${new Date(order.createdAt).toLocaleString()}`, 40, y, { align: 'center' }); y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text("CLIENTE:", margin, y); y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.name}`, margin, y); y += 4;
    doc.text(`Tel: ${client.phone}`, margin, y); y += 6;

    // --- ADD BARCODE ---
    try {
      const barcodeData = generateBarcode(order.orderNumber, { height: 40, displayValue: false });
      doc.addImage(barcodeData, 'PNG', margin, y, 70, 15);
      y += 18;
    } catch (e) {
      console.error("Error adding barcode to ticket", e);
    }

    doc.setFont('helvetica', 'bold');
    doc.text("EQUIPO:", margin, y); y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`${order.brand} ${order.model}`, margin, y); y += 4;
    doc.text(`Falla: ${order.issueDescription}`, margin, y, { maxWidth: 70 }); y += 12;

    if (order.customerSignature) {
      try {
        const signatureData = await loadImage(order.customerSignature);
        doc.text("FIRMA DEL CLIENTE:", margin, y); y += 2;
        doc.addImage(signatureData, 'PNG', margin, y, 70, 20);
        y += 22;
      } catch (e) {
        console.error("Error adding signature to ticket", e);
      }
    }

    doc.setFontSize(7);
    const footer = "Al dejar su equipo acepta nuestros términos de servicio y diagnóstico inicial.";
    const splitFooter = doc.splitTextToSize(footer, 70);
    doc.text(splitFooter, 40, y, { align: 'center' });

    toast.info("Generando ticket...");

    await handlePrint(doc, `Ticket_${order.orderNumber}.pdf`);
  };

  const updateOrder = async (order: ServiceOrder) => {
    const toastId = toast.loading('Guardando cambios localmente...');

    try {
      // 1. Critical logic and preparation
      let invoiceNumber = order.invoiceNumber;
      if ((order.status === OrderStatus.READY || order.status === OrderStatus.DELIVERED) && !invoiceNumber) {
        const settings = (await db.settings.toArray())[0];
        if (settings) {
          invoiceNumber = `${settings.invoicePrefix}-${settings.nextInvoiceNumber.toString().padStart(5, '0')}`;
          await db.settings.update(settings.id!, { nextInvoiceNumber: settings.nextInvoiceNumber + 1 });
        }
      }

      const oldOrder = await db.orders.get(order.id!);
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

      // --- LOCAL FIRST SAVE ---
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

      toast.success("Trabajo actualizado localmente", { id: toastId });

    } catch (err) {
      console.error("Error updating order", err);
      toast.error("Error al actualizar la orden", { id: toastId });
    }
  };

  const addPartToOrder = async (order: ServiceOrder, partId: number) => {
    const invPart = await db.inventory.get(partId);
    if (!invPart || invPart.quantity <= 0) {
      alert("No hay existencias de este repuesto.");
      return;
    }
    const newPart = { partId, name: invPart.name, quantity: 1, price: invPart.price };
    await db.inventory.update(partId, { quantity: invPart.quantity - 1 });

    // Immediate update in UI
    const updatedOrder = { ...order, parts: [...order.parts, newPart] };
    const partsTotal = updatedOrder.parts.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const subtotal = (updatedOrder.laborCost || 0) + partsTotal;
    const tax = subtotal * (updatedOrder.taxRate / 100);
    updatedOrder.total = subtotal + tax;
    setShowDetailModal(updatedOrder);
    toast.success("Repuesto añadido a la orden");
  };

  const generateInvoice = async (order: ServiceOrder, action: 'download' | 'print' = 'download') => {
    const client = await db.clients.get(order.clientId);
    const settings = (await db.settings.toArray())[0];
    if (!client || !settings) return;

    // Helper to load image for PDF (handles URLs and Base64)
    const loadImage = async (src: string): Promise<string> => {
      if (src.startsWith('data:')) return src;
      const resp = await fetch(src);
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result as string);
      });
    };

    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    const accentColor = settings.accentColor || '#3b82f6';

    // --- PDF DESIGN IMPROVEMENTS ---
    doc.setFillColor(accentColor);
    doc.rect(0, 0, 5, 297, 'F'); // Vertical Accent Bar

    // Header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(5, 0, pageWidth - 5, 50, 'F');

    // Add Logo if exists
    if (settings.logo) {
      try {
        doc.addImage(settings.logo, 'JPEG', margin + 5, 10, 25, 25);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.businessName.toUpperCase(), margin + 35, 25);
      } catch (e) {
        console.error("Error adding logo to PDF", e);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.businessName.toUpperCase(), margin + 5, 25);
      }
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(settings.businessName.toUpperCase(), margin + 5, 25);
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`ID FISCAL: ${settings.taxId}`, margin + 5, 33);
    doc.text(settings.address.toUpperCase(), margin + 5, 38);

    // Invoice Info Box
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(pageWidth - 85, 15, 65, 30, 'F'); // Increased height from 25 to 30
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.rect(pageWidth - 85, 15, 65, 30, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const label = order.invoiceNumber ? "FACTURA" : "COTIZACION";
    doc.text(label, pageWidth - 80, 23);
    doc.setFontSize(11);
    doc.setTextColor(59, 130, 246);
    doc.text(order.invoiceNumber || order.orderNumber, pageWidth - 80, 28);

    // --- ADD BARCODE TO INVOICE ---
    try {
      const barcodeData = generateBarcode(order.orderNumber, { height: 35, displayValue: false, margin: 0 });
      doc.addImage(barcodeData, 'PNG', pageWidth - 80, 29, 55, 8);
    } catch (e) {
      console.error("Error adding barcode to invoice", e);
    }

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.text(`EMISION: ${formatDate(order.createdAt)}`, pageWidth - 80, 42);

    // Customer & Device Section
    let sectionY = 65;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', margin + 5, sectionY);
    doc.text('EQUIPO EN SERVICIO', pageWidth / 2 + 10, sectionY);

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(margin + 5, sectionY + 2, margin + 45, sectionY + 2);
    doc.line(pageWidth / 2 + 10, sectionY + 2, pageWidth / 2 + 50, sectionY + 2);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(client.name.toUpperCase(), margin + 5, sectionY + 10);
    doc.text(`TEL: ${client.phone}`, margin + 5, sectionY + 16);
    doc.text(client.email || 'N/A', margin + 5, sectionY + 22);

    doc.text(`${order.brand} ${order.model}`.toUpperCase(), pageWidth / 2 + 10, sectionY + 10);
    doc.text(`ESTADO: ${order.status.toUpperCase()}`, pageWidth / 2 + 10, sectionY + 16);
    doc.text(`SERIAL/IMEI: ${order.serialNumber || 'N/A'}`, pageWidth / 2 + 10, sectionY + 22);

    // Items Table
    const rows = [
      ['MANO DE OBRA', 'SERVICIO TECNICO', '1', formatCurrency(order.laborCost), formatCurrency(order.laborCost)]
    ];
    (order.parts || []).forEach(p => rows.push([
      p.name.toUpperCase(),
      'REPUESTO',
      p.quantity.toString(),
      formatCurrency(p.price),
      formatCurrency(p.price * p.quantity)
    ]));

    doc.autoTable({
      startY: 105,
      margin: { left: margin + 5 },
      head: [['DESCRIPCION', 'CATEGORIA', 'CANT', 'UNITARIO', 'SUBTOTAL']],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      styles: { fontSize: 8, cellPadding: 4 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Breakdown
    const partsTotal = (order.parts || []).reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const subtotal = (order.laborCost || 0) + partsTotal;
    const tax = subtotal * ((order.taxRate || 13) / 100);

    const calcX = pageWidth - margin - 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`SUBTOTAL: ${formatCurrency(subtotal)}`, calcX, finalY, { align: 'right' });
    doc.text(`IVA (${order.taxRate}%): ${formatCurrency(tax)}`, calcX, finalY + 7, { align: 'right' });

    doc.setFillColor(accentColor);
    doc.rect(pageWidth - margin - 75, finalY + 12, 75, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL NETO: ${formatCurrency(order.total)}`, calcX - 5, finalY + 20, { align: 'right' });

    // Footer Info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`GARANTIA: ${order.warrantyDays || 0} DIAS`, margin + 5, finalY + 10);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text("CLAUSULA: El equipo debe ser retirado en un plazo maximo de 30 dias.", margin + 5, finalY + 18);
    doc.text("ShoroRepair no se responsabiliza por equipos despues de este periodo.", margin + 5, finalY + 23);

    if (settings.legalFooter) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      const footerLines = doc.splitTextToSize(settings.legalFooter, pageWidth - margin * 2 - 10);
      doc.text(footerLines, margin + 5, finalY + 35);
    }

    const pageHeight = doc.internal.pageSize.getHeight();

    // Add Photos if available
    let currentY = finalY + 40;
    if (order.photos && order.photos.length > 0) {
      doc.addPage();
      currentY = 20;

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("REGISTRO FOTOGRAFICO", margin, currentY);
      currentY += 10;

      const imgWidth = 80;
      const imgHeight = 60;
      let xPos = margin;

      for (let index = 0; index < order.photos.length; index++) {
        const photo = order.photos[index];
        if (currentY + imgHeight > pageHeight - margin) {
          doc.addPage();
          currentY = 20;
        }

        try {
          const imgData = await loadImage(photo);
          doc.addImage(imgData, 'JPEG', xPos, currentY, imgWidth, imgHeight);
        } catch (e) {
          console.error("Error adding image to PDF", e);
        }

        if ((index + 1) % 2 === 0) {
          xPos = margin;
          currentY += imgHeight + 10;
        } else {
          xPos += imgWidth + 10;
        }
      }
    }

    if (order.customerSignature) {
      if (currentY + 40 > pageHeight - margin) {
        doc.addPage();
        currentY = 20;
      }
      try {
        const signatureData = await loadImage(order.customerSignature);
        doc.setFontSize(12);
        doc.text("FIRMA DE CONFORMIDAD", margin, currentY);
        doc.addImage(signatureData, 'PNG', margin, currentY + 5, 60, 20);
      } catch (e) {
        console.error("Error adding signature to invoice", e);
      }
    }

    // Save/Download PDF instead of opening window which might be blocked in Tauri
    // Generate PDF Blob

    if (action === 'download') {
      doc.save(`${order.invoiceNumber || order.orderNumber}.pdf`);
      toast.success("PDF descargado correctamente");
    } else {
      toast.info("Preparando impresión...");
      await handlePrint(doc, `${order.invoiceNumber || order.orderNumber}.pdf`);
    }
  };

  // Loading state
  if (!orders || !clients || !technicians || !inventory) {
    return <TableSkeleton columns={5} rows={8} title="Órdenes de Servicio" />;
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Search and Filters Header */}
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

      {/* Main Table Container */}
      {!orders ? <TableSkeleton /> : (
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
                            generateInvoice(order, 'print');
                          }} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all"><Printer size={16} /></button>
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

      {/* DETAIL MODAL (REPAIR WORKBENCH) */}
      {showDetailModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-neutral-900/80 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-5xl rounded-none shadow-xl flex flex-col max-h-[92vh] overflow-hidden border border-neutral-200 dark:border-neutral-800">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-[#1a73e8] text-white rounded-none shadow-sm">
                  <Wrench size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">Workbench <span className="text-[#1a73e8]">#{showDetailModal.orderNumber}</span></h2>
                  <p className="text-xs text-neutral-500 font-medium">Terminal de Reparación Avanzada</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(null)}
                className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-red-500 rounded-none transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 space-y-8">
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
                  <div className="flex items-center space-x-2 text-xs font-bold text-[#1a73e8] uppercase tracking-wide">
                    <User size={14} /> <span>Técnico Responsable</span>
                  </div>
                  <select
                    className="w-full px-4 py-3 bg-[#f1f3f4] dark:bg-neutral-800 dark:text-white border-none rounded-none outline-none focus:bg-white focus:ring-2 focus:ring-[#1a73e8]/20 transition-all text-sm font-medium"
                    value={showDetailModal.technicianId || ''}
                    onChange={e => setShowDetailModal({ ...showDetailModal, technicianId: parseInt(e.target.value) || undefined })}
                  >
                    <option value="">Sin Asignar</option>
                    {technicians?.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                  </select>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block ml-2">Falla Reportada</span>
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-800/20 rounded-none border border-neutral-100 dark:border-neutral-800 text-sm italic opacity-80">
                      {showDetailModal.issueDescription}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block ml-2">Evidencia Fotográfica</span>
                    <div className="flex flex-wrap gap-2">
                      {showDetailModal.photos?.map((p, i) => (
                        <img key={i} src={p} alt="Evidencia" className="w-16 h-16 rounded-none object-cover border border-neutral-200 dark:border-neutral-700 hover:scale-105 transition-transform cursor-pointer" onClick={() => window.open(p, '_blank')} />
                      ))}
                      {(!showDetailModal.photos || showDetailModal.photos.length === 0) && <p className="text-xs text-neutral-400 italic py-2">Sin fotos registradas.</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1a73e8] uppercase tracking-wide">
                      <Package size={14} /> <span>Repuestos y Materiales</span>
                    </div>
                    <select
                      className="bg-[#f1f3f4] dark:bg-neutral-800 px-3 py-1.5 rounded-none text-[10px] font-bold uppercase outline-none border-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-all max-w-[200px]"
                      onChange={e => {
                        const id = parseInt(e.target.value);
                        if (id) addPartToOrder(showDetailModal, id);
                        e.target.value = "";
                      }}
                    >
                      <option value="">+ Añadir Repuesto</option>
                      {inventory?.filter(i => i.quantity > 0).map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {showDetailModal.parts?.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-none border border-neutral-100 dark:border-black/20 group">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-white dark:bg-neutral-800 rounded-none shadow-sm border border-neutral-100 dark:border-neutral-700"><Package size={14} className="text-neutral-400" /></div>
                          <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{p.name} <span className="text-[10px] text-neutral-400 ml-1">x{p.quantity}</span></span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-[#1a73e8]">{formatCurrency(p.price * p.quantity)}</span>
                          <button
                            onClick={() => {
                              const newParts = showDetailModal.parts.filter((_, idx) => idx !== i);
                              setShowDetailModal({ ...showDetailModal, parts: newParts });
                            }}
                            className="p-1.5 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-none transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!showDetailModal.parts || showDetailModal.parts.length === 0) && (
                      <div className="py-8 text-center bg-neutral-50/50 dark:bg-neutral-800/20 rounded-none border border-dashed border-neutral-200 dark:border-neutral-800">
                        <p className="text-xs text-neutral-400 italic">No se han cargado repuestos a esta orden.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
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
                      <span className="font-bold">₡{showDetailModal.parts.reduce((a, p) => a + (p.price * p.quantity), 0).toLocaleString()}</span>
                    </div>
                    <div className="pt-4 border-t border-[#1a73e8]/10 flex justify-between items-end">
                      <span className="text-xs font-bold text-[#1a73e8] uppercase">Inversión Total</span>
                      <span className="text-3xl font-bold text-[#1a73e8]">₡{showDetailModal.total.toLocaleString()}</span>
                    </div>
                  </div>
                </Card>

                <Button variant="primary" className="w-full py-4 text-xs font-bold uppercase tracking-widest" onClick={() => updateOrder(showDetailModal)}>Actualizar Expediente</Button>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => generateInvoice(showDetailModal, 'print')} leftIcon={<Printer size={16} />}>Imprimir</Button>
                    <Button variant="outline" className="flex-1" onClick={() => generateInvoice(showDetailModal, 'download')} leftIcon={<Download size={16} />}>Descargar</Button>
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
            {/* Device Info Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1a73e8] uppercase tracking-wider">
                <Smartphone size={16} /> Datos del Equipo
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-semibold text-[#5f6368] ml-4 text-left">{t('orders.fields.client')}</label>
                  <select
                    required
                    className="bg-[#f1f3f4] dark:bg-neutral-800 px-4 py-3 rounded-none text-sm font-medium outline-none border-none focus:bg-white transition-all appearance-none"
                    onChange={e => setFormData({ ...formData, clientId: parseInt(e.target.value) })}
                  >
                    <option value="">{t('orders.fields.select_client')}</option>
                    {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-semibold text-[#5f6368] ml-4 text-left">{t('orders.fields.device_type')}</label>
                  <select
                    required
                    className="bg-[#f1f3f4] dark:bg-neutral-800 px-4 py-3 rounded-none text-sm font-medium outline-none border-none focus:bg-white transition-all appearance-none"
                    value={formData.deviceType}
                    onChange={e => setFormData({ ...formData, deviceType: e.target.value as DeviceType })}
                  >
                    {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('orders.fields.brand')} required placeholder="Ej: Apple" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
                <Input label={t('orders.fields.model')} required placeholder="Ej: iPhone 15" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('orders.fields.serial')} placeholder="Opcional" value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} />
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-semibold text-[#5f6368] ml-4 text-left">Prioridad</label>
                  <select
                    className="bg-[#f1f3f4] dark:bg-neutral-800 px-4 py-3 rounded-none text-sm font-medium outline-none border-none focus:bg-white transition-all appearance-none"
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                  >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
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

            {/* Documentation Section */}
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
