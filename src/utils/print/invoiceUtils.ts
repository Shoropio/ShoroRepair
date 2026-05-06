import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ServiceOrder, Client, CompanySettings, MessageLog, OrderStatus } from '../../types';
import { db } from '../../offline/db';
import { handlePrint } from './printUtils';
import { generateBarcode } from '../barcode/barcodeUtils';
import { generateQRCode } from '../barcode/qrUtils';

// Helper to load image for PDF (handles URLs and Base64)
export const loadImage = async (src: string): Promise<string> => {
    if (src.startsWith('data:')) return src;
    try {
        const resp = await fetch(src);
        const blob = await resp.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result as string);
        });
    } catch (e) {
        console.error("Error loading image:", e);
        return '';
    }
};

const formatPdfAmount = (amount: number): string => {
    const value = Number(amount) || 0;
    return value.toLocaleString('es-CR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const drawCurrencyText = (doc: any, amount: number, rightX: number, y: number, color: number[] = [71, 85, 105]) => {
    const amountText = formatPdfAmount(amount);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(amountText, rightX, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
};

export const generateEntryTicket = async (order: ServiceOrder) => {
    const client = await db.clients.get(order.clientId);
    const settingsArray = await db.settings.toArray();
    const settings = settingsArray[0];
    if (!client || !settings) return;

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

        // Add small QR linking to the order
        try {
            const qrText = (settings as any).website ? `${(settings as any).website}/orders/${order.id || order.orderNumber}` : `OS:${order.orderNumber}`;
            const qrData = await generateQRCode(qrText, { width: 300, margin: 1 });
            const qrSize = 20; // mm
            const qrX = (80 - qrSize) / 2; // center on thermal width
            doc.addImage(qrData, 'PNG', qrX, y, qrSize, qrSize);
            y += qrSize + 4;
        } catch (e) {
            // non-fatal
        }
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
            if (signatureData) {
                doc.text("FIRMA DEL CLIENTE:", margin, y); y += 2;
                doc.addImage(signatureData, 'PNG', margin, y, 70, 20);
                y += 22;
            }
        } catch (e) {
            console.error("Error adding signature to ticket", e);
        }
    }

    doc.setFontSize(7);
    const footer = "Al dejar su equipo acepta nuestros términos de servicio y diagnóstico inicial.";
    const splitFooter = doc.splitTextToSize(footer, 70);
    doc.text(splitFooter, 40, y, { align: 'center' });

    await handlePrint(doc, `Ticket_${order.orderNumber}.pdf`);
};

export const generateInvoice = async (order: ServiceOrder, action: 'download' | 'print' = 'download') => {
    const client = await db.clients.get(order.clientId);
    const settingsArray = await db.settings.toArray();
    const settings = settingsArray[0];
    if (!client || !settings) return;

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
            const logoData = await loadImage(settings.logo);
            if (logoData) {
                doc.addImage(logoData, 'JPEG', margin + 5, 10, 25, 25);
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.text(settings.businessName.toUpperCase(), margin + 35, 25);
            } else {
                throw new Error("Logo data empty");
            }
        } catch (e) {
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
    doc.text(`TEL: ${settings.phone}`, margin + 5, 43);

    // Invoice Info Box
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(pageWidth - 85, 15, 65, 30, 'F');
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.rect(pageWidth - 85, 15, 65, 30, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("COMPROBANTE ELECTRÓNICO", pageWidth - 80, 22);
    doc.setFontSize(12);
    doc.setTextColor(accentColor);
    doc.text(order.invoiceNumber || order.orderNumber, pageWidth - 80, 30);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`FECHA: ${new Date(order.createdAt).toLocaleDateString()}`, pageWidth - 80, 38);

    // Client Info Section
    let y = 65;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("DATOS DEL CLIENTE", margin + 5, y);
    y += 2;
    doc.setDrawColor(accentColor);
    doc.line(margin + 5, y, margin + 45, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(client.name.toUpperCase(), margin + 5, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`TELÉFONO: ${client.phone}`, margin + 5, y);
    y += 5;
    doc.text(`EMAIL: ${client.email || 'N/A'}`, margin + 5, y);
    y += 5;
    doc.text(`DIRECCIÓN: ${client.address || 'N/A'}`, margin + 5, y, { maxWidth: 80 });

    // Right Side: Device Info
    let ry = 65;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("DETALLES DEL EQUIPO", pageWidth - 100, ry);
    ry += 10;
    doc.setFontSize(9);
    doc.text(`DISPOSITIVO: ${order.brand} ${order.model}`, pageWidth - 100, ry);
    ry += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`ID/SERIAL: ${order.serialNumber || 'N/A'}`, pageWidth - 100, ry);
    ry += 5;
    doc.text(`TIPO: ${order.deviceType}`, pageWidth - 100, ry);

    // Table of items
    y = 105;
    const tableWidth = pageWidth - ((margin + 5) * 2);
    const tableData = [
        ['SERVICIO TÉCNICO / MANO DE OBRA', '1', formatPdfAmount(order.laborCost), formatPdfAmount(order.laborCost)],
        ...(order.parts || []).map(p => [
            `REPUESTO: ${p.name}`,
            p.quantity.toString(),
            formatPdfAmount(p.price),
            formatPdfAmount(p.price * p.quantity)
        ])
    ];

    doc.autoTable({
        startY: y,
        head: [['DESCRIPCIÓN', 'CANT', 'PRECIO UNIT.', 'TOTAL']],
        body: tableData,
        margin: { left: margin + 5, right: margin + 5 },
        tableWidth,
        styles: {
            fontSize: 8,
            cellPadding: 4,
            font: 'helvetica',
            valign: 'middle',
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: tableWidth * 0.48, halign: 'left' },
            1: { cellWidth: tableWidth * 0.12, halign: 'center' },
            2: { cellWidth: tableWidth * 0.20, halign: 'right', cellPadding: { top: 4, right: 7, bottom: 4, left: 4 } },
            3: { cellWidth: tableWidth * 0.20, halign: 'right', fontStyle: 'bold', cellPadding: { top: 4, right: 7, bottom: 4, left: 4 } }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals Area
    const partsSum = (order.parts || []).reduce((a, b) => a + (b.price * b.quantity), 0);
    const subtotal = order.laborCost + partsSum;
    const tax = subtotal * (order.taxRate / 100);
    const total = subtotal + tax;

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("SUBTOTAL:", pageWidth - 80, finalY);
    drawCurrencyText(doc, subtotal, pageWidth - margin - 5, finalY);

    doc.text(`IMPUESTOS (${order.taxRate}%):`, pageWidth - 80, finalY + 6);
    drawCurrencyText(doc, tax, pageWidth - margin - 5, finalY + 6);

    doc.setFillColor(accentColor);
    doc.rect(pageWidth - 85, finalY + 10, 65, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("TOTAL NETO:", pageWidth - 80, finalY + 18);
    drawCurrencyText(doc, total, pageWidth - margin - 10, finalY + 18, [255, 255, 255]);

    // Footer & Warranty
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("GARANTÍA Y CONDICIONES:", margin + 5, finalY + 40);
    doc.setFont('helvetica', 'normal');
    const warrantyText = `Este servicio cuenta con ${order.warrantyDays || 30} días de garantía a partir de la fecha de entrega. No cubre daños por humedad, golpes o manipulación extraña.`;
    doc.text(doc.splitTextToSize(warrantyText, 120), margin + 5, finalY + 45);

    if (settings.legalFooter) {
        doc.text(doc.splitTextToSize(settings.legalFooter, 170), margin + 5, finalY + 65);
    }

    await handlePrint(doc, `Factura_${order.invoiceNumber || order.orderNumber}.pdf`, { autoPrint: action === 'print' });
};
