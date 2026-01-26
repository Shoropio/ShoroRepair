import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, FileDown, Calendar, Download, Printer, BarChart } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { handlePrint } from '../utils/printUtils';
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from 'sonner';
import { formatCurrency } from '../utils/formatUtils';
import { Card, Button, SkeletonChart, SkeletonStatCard, Badge } from '../src/components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const ReportsSkeleton: React.FC = () => (
  <div className="space-y-10 animate-in">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />
        <div className="h-4 w-48 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />
      </div>
      <div className="h-10 w-40 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#f8f9fa] dark:bg-[#202124] rounded-none h-80 animate-pulse" />
      <div className="bg-[#f8f9fa] dark:bg-[#202124] rounded-none h-80 animate-pulse" />
    </div>
  </div>
);

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  const data = useLiveQuery(async () => {
    const orders = await db.orders.toArray();
    const expenses = await db.expenses.toArray();
    const users = await db.users.toArray();
    const clients = await db.clients.toArray();

    // Actual revenue from paid orders
    const paidOrders = orders.filter(o => o.paymentStatus === 'Pagado');
    const actualRevenue = paidOrders.reduce((a, c) => a + c.total, 0);
    const totalExpenses = expenses.reduce((a, c) => a + c.amount, 0);

    // Dynamic grouping by month (Last 6 months)
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyRevenue: any[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = monthNames[d.getMonth()];

      const rev = paidOrders
        .filter(o => {
          const od = new Date(o.createdAt);
          return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
        })
        .reduce((sum, current) => sum + current.total, 0);

      monthlyRevenue.push({ month: mLabel, revenue: rev });
    }

    // Devices distribution
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      counts[o.deviceType] = (counts[o.deviceType] || 0) + 1;
    });
    const deviceData = Object.entries(counts).map(([name, value]) => ({ name, value }));

    // Top Technician (by orders count)
    const techCounts: Record<string, number> = {};
    orders.forEach(o => {
      if (o.technicianId) {
        const t = users.find(u => u.id === o.technicianId);
        const name = t?.fullName || 'Desconocido';
        techCounts[name] = (techCounts[name] || 0) + 1;
      }
    });
    const topTechs = Object.entries(techCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      monthlyRevenue,
      deviceData,
      topTechs,
      totalCount: orders.length,
      revenue: actualRevenue,
      expenses: totalExpenses,
      profit: actualRevenue - totalExpenses,
      stats: {
        clientsCount: clients.length,
        avgOrderValue: actualRevenue / (paidOrders.length || 1)
      }
    };
  }, []);

  const exportPDF = async () => {
    if (!data) return;
    const settings = (await db.settings.toArray())[0];
    const doc = new jsPDF() as any;

    doc.setFillColor(15, 23, 42); // Header
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(t('reports.pdf_title').toUpperCase(), 15, 25);
    doc.setFontSize(10);
    doc.text(settings?.businessName || 'ShoroRepair', 15, 32);
    doc.text(`${t('reports.generated')} ${new Date().toLocaleString()}`, 160, 32);

    // --- TOP STATS ---
    let y = 55;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text(t('reports.financial_summary'), 15, y);
    doc.setDrawColor(59, 130, 246);
    doc.line(15, y + 2, 70, y + 2);

    const financialRows = [
      [t('reports.total_revenue').toUpperCase(), formatCurrency(data.revenue)],
      [t('reports.expenses').toUpperCase(), formatCurrency(data.expenses)],
      [t('reports.profit').toUpperCase(), formatCurrency(data.profit)],
      [t('reports.avg_ticket').toUpperCase(), formatCurrency(data.stats.avgOrderValue)]
    ];

    doc.autoTable({
      startY: y + 8,
      margin: { left: 15 },
      body: financialRows,
      theme: 'grid',
      styles: { cellPadding: 5, fontSize: 10 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });

    y = (doc as any).lastAutoTable.finalY + 20;

    // --- OPERATIONAL STATS ---
    doc.text(t('reports.operating_stats'), 15, y);
    doc.line(15, y + 2, 70, y + 2);

    const operationalRows = [
      [t('reports.total_orders').toUpperCase(), data.totalCount],
      [t('reports.unique_clients').toUpperCase(), data.stats.clientsCount],
      [t('reports.top_technician').toUpperCase(), data.topTechs[0]?.name || 'N/A']
    ];

    doc.autoTable({
      startY: y + 8,
      margin: { left: 15 },
      body: operationalRows,
      theme: 'plain',
      styles: { cellPadding: 5, fontSize: 10 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });

    toast.info("Generando vista previa del reporte...");
    await handlePrint(doc, 'Reporte_General_ShoroRepair.pdf');
  };

  const exportCSV = async () => {
    if (!data) return;
    const orders = await db.orders.toArray();

    // Create CSV content
    const headers = ['Orden', 'Fecha', 'Cliente ID', 'Equipo', 'Total', 'Estado'];
    const rows = orders.map(o => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleDateString(),
      o.clientId,
      `${o.brand} ${o.model}`,
      o.total,
      o.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Tauri (Desktop)
    if ((window as any).__TAURI__) {
      try {
        const filePath = await save({
          defaultPath: `reporte_ordenes_${new Date().toISOString().split("T")[0]}.csv`,
          filters: [{ name: "CSV", extensions: ["csv"] }]
        });

        if (!filePath) return;

        await writeTextFile(filePath, csvContent);
        toast.success(t('messages.saved'));
        return;
      } catch (error) {
        console.error("Error saving CSV via Tauri:", error);
        toast.error("Error al guardar el reporte");
      }
    }

    // Browser
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reporte_ordenes_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('messages.downloaded'));
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  if (!data) return <ReportsSkeleton />;

  if (!hasPermission('canViewReports')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-10 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('reports.title')}</h1>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">{t('reports.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} leftIcon={<FileDown size={18} />}>{t('reports.export_csv')}</Button>
          <Button variant="primary" size="sm" onClick={exportPDF} leftIcon={<Printer size={18} />}>{t('reports.generate_pdf')}</Button>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="tonal" className="p-6">
          <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">{t('reports.operating_profit')}</p>
          <h3 className="text-2xl font-semibold text-[#1e8e3e]">{formatCurrency(data.profit)}</h3>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1 italic">{t('reports.operating_profit_desc')}</p>
        </Card>
        <Card variant="tonal" className="p-6">
          <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">{t('reports.total_revenue')}</p>
          <h3 className="text-2xl font-semibold text-[#1a73e8] dark:text-[#8ab4f8]">{formatCurrency(data.revenue)}</h3>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1 italic">{t('reports.revenue_desc')}</p>
        </Card>
        <Card variant="tonal" className="p-6">
          <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">{t('reports.avg_ticket')}</p>
          <h3 className="text-2xl font-semibold text-[#3c4043] dark:text-white">{formatCurrency(data.stats.avgOrderValue)}</h3>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1 italic">{t('reports.avg_ticket_desc')}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          header={<h3 className="text-sm font-bold text-[#3c4043] dark:text-white">{t('reports.revenue_trend')}</h3>}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5f6368', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5f6368', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#1a73e8" strokeWidth={3} dot={{ fill: '#1a73e8', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          header={<h3 className="text-sm font-bold text-[#3c4043] dark:text-white">{t('reports.category_dist')}</h3>}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.deviceData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          header={<h3 className="text-sm font-bold text-[#3c4043] dark:text-white">{t('reports.tech_productivity')}</h3>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {data.topTechs.map((tech, idx) => (
              <div key={idx} className="bg-[#f8f9fa] dark:bg-[#2d2f31] p-5 rounded-none text-center space-y-2">
                <div className="w-10 h-10 bg-white dark:bg-[#1a1c1e] rounded-none mx-auto flex items-center justify-center font-bold text-[#1a73e8]">
                  {tech.name.charAt(0)}
                </div>
                <p className="text-sm font-semibold truncate text-[#202124] dark:text-white">{tech.name}</p>
                <Badge variant="brand" size="xs">{tech.value} Órdenes</Badge>
              </div>
            ))}
            {data.topTechs.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-[#5f6368] italic">No hay suficientes datos técnicos aún.</div>
            )}
          </div>
        </Card>
      </div>

      {/* Tonal Bottom Hero */}
      <Card variant="tonal" className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('reports.summary')}</h2>
          <p className="text-[#5f6368] dark:text-[#9aa0a6] text-sm max-w-md">
            {t('reports.summary_text', { count: data.totalCount })}
          </p>
        </div>
        <Button variant="primary" onClick={exportCSV} leftIcon={<Download size={18} />}>
          {t('reports.download_csv')}
        </Button>
      </Card>
    </div>
  );
};

export default Reports;
