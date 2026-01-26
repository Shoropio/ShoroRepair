
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { OrderStatus, PaymentStatus } from '../types';
import { FileText, Search, Printer, Download, Eye, DollarSign, Mail, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { handlePrint } from '../utils/printUtils';
import { formatCurrency, formatDate } from '../utils/formatUtils';

import { useDebounce } from '../hooks/useDebounce';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { Badge } from '../src/components';

const Invoices: React.FC = () => {
  const { t } = useTranslation();
  const { role } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  if (role !== 'Admin' && role !== 'Receptionist') {
    return <Navigate to="/" replace />;
  }

  const invoices = useLiveQuery(async () => {
    // Get latest orders first
    const collection = db.orders.orderBy('createdAt').reverse();

    const filtered = collection.filter(order => {
      // 1. Must be Invoice-able (Ready, Delivered OR Paid)
      const isInvoiceable = order.status === OrderStatus.READY || order.status === OrderStatus.DELIVERED || order.paymentStatus === PaymentStatus.PAID;
      if (!isInvoiceable) return false;

      // 2. Search
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return (
        (order.orderNumber && order.orderNumber.toLowerCase().includes(q)) ||
        (order.invoiceNumber && order.invoiceNumber.toLowerCase().includes(q))
      );
    });

    return filtered.limit(50).toArray();
  }, [debouncedSearch]);

  const sendEmail = async (order: any) => {
    const client = await db.clients.get(order.clientId);
    if (!client || !client.email) {
      alert(t('invoices.no_email'));
      return;
    }

    const subject = `Factura ${order.invoiceNumber || order.orderNumber} - ShoroRepair`;
    const body = `Estimado(a) ${client.name},\n\nAdjunto encontrará los detalles de su servicio.\n\nTotal: ₡${order.total.toFixed(2)}\n\nGracias por su preferencia.`;

    window.open(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const reprint = async (order: any, action: 'download' | 'print' = 'download') => {
    const client = await db.clients.get(order.clientId);
    const settings = (await db.settings.toArray())[0];
    if (!client || !settings) {
      toast.error(t('invoices.error_data'));
      return;
    };

    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const accentColor = settings.accentColor || '#3b82f6';

    // --- Modern Header Design ---
    doc.setFillColor(248, 250, 252); // Light background for header
    doc.rect(0, 0, pageWidth, 60, 'F');
    doc.setFillColor(accentColor);
    doc.rect(0, 0, pageWidth, 2, 'F'); // Top accent line

    // Brand / Logo
    let headerY = 15;
    if (settings.logo) {
      try {
        doc.addImage(settings.logo, 'JPEG', margin, headerY, 30, 30);
      } catch (e) {
        console.error("Logo error", e);
        doc.setTextColor(accentColor);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.businessName.charAt(0), margin + 5, headerY + 20);
      }
    }

    const companyX = settings.logo ? margin + 35 : margin;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.businessName.toUpperCase(), companyX, headerY + 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`ID FISCAL: ${settings.taxId}`, companyX, headerY + 14);
    doc.text(settings.address, companyX, headerY + 19);
    doc.text(`Tel: ${settings.phone} | ${settings.email}`, companyX, headerY + 24);

    // Invoice Badge
    const badgeW = 60;
    const badgeH = 25;
    const badgeX = pageWidth - margin - badgeW;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(accentColor);
    doc.roundedRect(badgeX, 15, badgeW, badgeH, 2, 2, 'FD');
    doc.setTextColor(accentColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("D O C U M E N T O", badgeX + badgeW / 2, 22, { align: 'center' });
    doc.setFontSize(14);
    doc.text(order.invoiceNumber || order.orderNumber, badgeX + badgeW / 2, 33, { align: 'center' });

    // --- Info Blocks ---
    let sectionY = 75;

    // Client Info Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(241, 245, 249);
    doc.roundedRect(margin, sectionY, (pageWidth / 2) - margin - 5, 30, 1, 1, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text("CLIENTE:", margin + 5, sectionY + 7);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(client.name.toUpperCase(), margin + 5, sectionY + 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tel: ${client.phone}`, margin + 5, sectionY + 21);
    doc.text(client.email || 'N/A', margin + 5, sectionY + 27);

    // Order Info Box
    doc.roundedRect(pageWidth / 2 + 5, sectionY, (pageWidth / 2) - margin - 5, 30, 1, 1, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text("SERVICIO:", pageWidth / 2 + 10, sectionY + 7);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text(`Fecha: ${formatDate(order.createdAt)}`, pageWidth / 2 + 10, sectionY + 15);
    doc.text(`Equipo: ${order.brand} ${order.model}`, pageWidth / 2 + 10, sectionY + 21);
    doc.text(`Estado: ${order.status.toUpperCase()}`, pageWidth / 2 + 10, sectionY + 27);

    // --- Table ---
    const rows = [
      ['MANO DE OBRA', 'SERVICIO TÉCNICO', '1', formatCurrency(order.laborCost), formatCurrency(order.laborCost)]
    ];
    order.parts.forEach((p: any) => rows.push([
      p.name.toUpperCase(),
      'REPUESTO',
      p.quantity.toString(),
      formatCurrency(p.price),
      formatCurrency(p.price * p.quantity)
    ]));

    doc.autoTable({
      startY: sectionY + 40,
      margin: { left: margin, right: margin },
      head: [['DESCRIPCIÓN', 'TIPO', 'CANT', 'UNITARIO', 'TOTAL']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        textColor: 255
      },
      columnStyles: {
        0: { cellWidth: 80 },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      styles: { fontSize: 8, cellPadding: 5, lineColor: [241, 245, 249] },
      alternateRowStyles: { fillColor: [250, 251, 253] }
    });

    // --- Sums Area ---
    const lastY = (doc as any).lastAutoTable.finalY + 10;
    const totalsX = pageWidth - margin - 60;

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text("TOTAL NETO", totalsX, lastY);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(order.total), pageWidth - margin, lastY, { align: 'right' });

    // --- Footer & Warranty ---
    const footerY = pageHeight - 45;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text("TÉRMINOS Y CONDICIONES", margin, footerY + 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`• Garantía aplicada: ${order.warrantyDays || 0} días tras la entrega.`, margin, footerY + 17);
    doc.text("• El equipo debe ser retirado en un máximo de 30 días naturales.", margin, footerY + 22);

    if (settings.legalFooter) {
      const splitLegal = doc.splitTextToSize(settings.legalFooter, pageWidth - margin * 2);
      doc.setFontSize(7);
      doc.text(splitLegal, margin, footerY + 29);
    }

    // Page signature
    doc.setFontSize(7);
    doc.text(`ShoroRepair MS • Generado digitalmente por ${settings.businessName}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    if (action === 'download') {
      doc.save(`Factura_${order.invoiceNumber || order.orderNumber}.pdf`);
      toast.success(t('messages.downloaded'));
    } else {
      await handlePrint(doc, `Factura_${order.invoiceNumber || order.orderNumber}.pdf`);
    }
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('invoices.title')}</h1>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">{t('invoices.subtitle')}</p>
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

      {/* Table Container */}
      <div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-[#3c4043] rounded-none overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#f1f3f4] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124]">
                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('invoices.table.reference')}</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('common.date')} / {t('common.amount')}</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('invoices.table.status')}</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-right">{t('invoices.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
              {invoices?.map(inv => (
                <tr key={inv.id} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#e8f0fe] text-[#1a73e8] rounded-none">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#202124] dark:text-white uppercase">#{inv.invoiceNumber || inv.orderNumber}</p>
                        <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">Equipo: {inv.brand}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-[#202124] dark:text-white">{formatCurrency(inv.total)}</p>
                    <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] font-medium">{formatDate(inv.createdAt)}</p>
                  </td>
                  <td className="px-6 py-5">
                    <Badge variant={inv.paymentStatus === 'Pagado' ? 'success' : 'warning'} size="xs">
                      {inv.paymentStatus}
                    </Badge>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!inv.haciendaStatus && (
                        <button
                          onClick={async () => {
                            const settings = (await db.settings.toArray())[0];
                            if (!settings?.haciendaUser) {
                              toast.error(t('invoices.hacienda_error'));
                              return;
                            }
                            toast.promise(
                              // Simulate or call utility
                              (async () => {
                                // For now, we simulate the logic since full XML signing is pending
                                await new Promise(r => setTimeout(r, 2000));
                                throw new Error(t('invoices.xml_error'));
                              })(),
                              {
                                loading: t('invoices.connecting'),
                                success: t('invoices.sent'),
                                error: (e) => e.message
                              }
                            );
                          }}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-none transition-all cursor-pointer"
                          title="Enviar a Hacienda"
                        >
                          <Send size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => sendEmail(inv)}
                        className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e8f0fe] hover:text-[#1a73e8] rounded-none transition-all"
                        title="Email"
                      >
                        <Mail size={16} />
                      </button>
                      <button onClick={() => reprint(inv, 'print')} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all" title="Imprimir">
                        <Printer size={16} />
                      </button>
                      <button onClick={() => reprint(inv, 'download')} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all" title="Descargar">
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
