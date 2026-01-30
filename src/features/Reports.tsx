import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { TrendingUp, FileDown, Calendar, Download, Printer, BarChart as BarChartIcon, DollarSign, Users, Briefcase, ChevronRight, Activity } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { handlePrint } from '../utils/print/printUtils';
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from 'sonner';
import { formatCurrency } from '../utils/format/formatUtils';
import { Card, Button, SkeletonChart, SkeletonStatCard, Badge } from '../components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const Reports: React.FC = () => {
	const { t } = useTranslation();
	const { hasPermission } = usePermissions();

	const data = useLiveQuery(async () => {
		const orders = await db.orders.toArray();
		const expenses = await db.expenses.toArray();
		const users = await db.users.toArray();
		const clients = await db.clients.toArray();

		const paidOrders = orders.filter(o => o.paymentStatus === 'Pagado');
		const actualRevenue = paidOrders.reduce((a, c) => a + c.total, 0);
		const totalExpenses = expenses.reduce((a, c) => a + c.amount, 0);

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

		const counts: Record<string, number> = {};
		orders.forEach(o => {
			counts[o.deviceType] = (counts[o.deviceType] || 0) + 1;
		});
		const deviceData = Object.entries(counts).map(([name, value]) => ({ name, value }));

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

	const exportPDF = async (action: 'print' | 'download' = 'print') => {
		if (!data) return;
		const settings = (await db.settings.toArray())[0];
		const doc = new jsPDF() as any;

		doc.setFillColor(26, 115, 232);
		doc.rect(0, 0, 210, 45, 'F');

		doc.setTextColor(255, 255, 255);
		doc.setFontSize(24);
		doc.setFont('helvetica', 'bold');
		doc.text("REPORTE EJECUTIVO", 15, 28);
		doc.setFontSize(10);
		doc.text(settings?.businessName || 'ShoroRepair Business Intelligence', 15, 36);
		doc.text(`${new Date().toLocaleString()}`, 160, 36);

		let y = 60;
		doc.setTextColor(32, 33, 36);
		doc.setFontSize(16);
		doc.text("Consolidado Financiero", 15, y);
		doc.setDrawColor(26, 115, 232);
		doc.line(15, y + 2, 80, y + 2);

		const financialRows = [
			["FACTURACIÓN BRUTA", formatCurrency(data.revenue)],
			["COSTOS & GASTOS", formatCurrency(data.expenses)],
			["MARGEN OPERATIVO", formatCurrency(data.profit)],
			["TICKET PROMEDIO", formatCurrency(data.stats.avgOrderValue)]
		];

		doc.autoTable({
			startY: y + 8,
			margin: { left: 15 },
			body: financialRows,
			theme: 'striped',
			styles: { cellPadding: 6, fontSize: 11 },
			columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
		});

		y = (doc as any).lastAutoTable.finalY + 25;

		doc.text("Métricas Operativas", 15, y);
		doc.line(15, y + 2, 80, y + 2);

		const operationalRows = [
			["ÓRDENES CREADAS", data.totalCount],
			["CLIENTES ÚNICOS", data.stats.clientsCount],
			["LIDER TÉCNICO", data.topTechs[0]?.name || 'N/A']
		];

		doc.autoTable({
			startY: y + 8,
			margin: { left: 15 },
			body: operationalRows,
			theme: 'plain',
			styles: { cellPadding: 6, fontSize: 11 },
			columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
		});

		if (action === 'download') {
			doc.save('BI_Report_ShoroRepair.pdf');
			toast.success("Descarga iniciada");
		} else {
			await handlePrint(doc, 'BI_Report_ShoroRepair.pdf');
		}
	};

	const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#a142f4'];

	if (!data) return <div className="p-20 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest text-xs">Compilando Estadísticas...</div>;

	if (!hasPermission('canViewReports')) return <Navigate to="/" replace />;

	return (
		<div className="space-y-8 animate-in pb-20">
			{/* High-Fidelity Header */}
			<header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-[2.5rem] shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5">
				<div>
					<h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
						<Activity className="text-[#1a73e8]" size={32} />
						Inteligencia de Negocio
					</h1>
					<p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
						Analítica avanzada de ingresos, rendimiento técnico y crecimiento de cartera.
					</p>
				</div>
				<div className="flex flex-wrap gap-3">
					<Button variant="outline" className="rounded-2xl px-6 py-4 font-black uppercase text-[10px] tracking-widest border-gray-200" onClick={exportPDF} leftIcon={<Printer size={18} />}>Protocolo Impreso</Button>
					<Button variant="primary" className="rounded-2xl px-8 py-4 shadow-lg shadow-blue-500/20 font-black uppercase tracking-widest text-[11px]" onClick={() => exportPDF('download')} leftIcon={<Download size={20} />}>Exportar Digital</Button>
				</div>
			</header>

			{/* Premium Stat Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{[
					{ label: 'Utilidad Neta', value: data.profit, color: 'text-emerald-600', icon: TrendingUp, desc: 'Balance Final' },
					{ label: 'Ingreso Bruto', value: data.revenue, color: 'text-[#1a73e8]', icon: DollarSign, desc: 'Facturación Total' },
					{ label: 'Ticket Promedio', value: data.stats.avgOrderValue, color: 'text-gray-900', icon: Briefcase, desc: 'Valor por Servicio' },
					{ label: 'Base Clientes', value: data.stats.clientsCount, color: 'text-indigo-600', icon: Users, desc: 'Cartera de Activos', isNumber: true }
				].map((stat, i) => (
					<Card key={i} className="p-8 rounded-[2rem] border-[#f1f3f4] dark:border-white/5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
						<div className="flex items-center justify-between mb-6">
							<div className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl group-hover:bg-blue-50 transition-colors">
								<stat.icon size={20} className="text-gray-400 group-hover:text-blue-600" />
							</div>
							<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.desc}</span>
						</div>
						<h3 className={`text-3xl font-black tracking-tighter ${stat.color} mb-1`}>
							{stat.isNumber ? stat.value : formatCurrency(stat.value).split(',')[0]}
						</h3>
						<p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{stat.label}</p>
					</Card>
				))}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
				{/* Revenue Evolution */}
				<Card className="lg:col-span-8 p-10 rounded-[3rem] shadow-2xl shadow-black/5" header={<div className="flex items-center justify-between mb-10"><h3 className="text-lg font-black text-[#202124] dark:text-white uppercase tracking-tight">Evolución Semestral</h3><Badge variant="brand" size="xs">Tendencia Positiva</Badge></div>}>
					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={data.monthlyRevenue}>
								<defs>
									<linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#1a73e8" stopOpacity={0.1} />
										<stop offset="95%" stopColor="#1a73e8" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f4" />
								<XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5f6368', fontSize: 10, fontWeight: 'bold' }} />
								<YAxis axisLine={false} tickLine={false} tick={{ fill: '#5f6368', fontSize: 10, fontWeight: 'bold' }} />
								<Tooltip
									contentStyle={{ background: '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
									itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1a73e8' }}
								/>
								<Area type="monotone" dataKey="revenue" stroke="#1a73e8" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</Card>

				{/* Device Dist */}
				<Card className="lg:col-span-4 p-10 rounded-[3rem] shadow-2xl shadow-black/5" header={<div className="mb-8"><h3 className="text-lg font-black text-[#202124] dark:text-white uppercase tracking-tight">Mix de Equipos</h3><p className="text-[10px] text-gray-400 font-bold uppercase">Distribución por categoría</p></div>}>
					<div className="h-60">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={data.deviceData}
									cx="50%"
									cy="50%"
									innerRadius={60}
									outerRadius={80}
									paddingAngle={8}
									dataKey="value"
								>
									{data.deviceData.map((_, index) => (
										<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={10} />
									))}
								</Pie>
								<Tooltip />
							</PieChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-8 space-y-3">
						{data.deviceData.slice(0, 3).map((item, i) => (
							<div key={i} className="flex items-center justify-between text-xs font-bold uppercase text-gray-600">
								<div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }}></div> {item.name}</div>
								<span>{item.value}</span>
							</div>
						))}
					</div>
				</Card>

				{/* Tech Leaderboard */}
				<Card className="lg:col-span-12 p-10 rounded-[3rem] shadow-2xl shadow-black/5" header={<h3 className="text-lg font-black text-[#202124] dark:text-white uppercase tracking-tight mb-8">Performance del Equipo Técnico</h3>}>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
						{data.topTechs.map((tech, idx) => (
							<div key={idx} className="bg-gray-50 dark:bg-white/5 p-8 rounded-[2rem] text-center space-y-4 hover:shadow-xl transition-all group">
								<div className="w-20 h-20 bg-white dark:bg-[#1a1c1e] rounded-[1.5rem] mx-auto flex items-center justify-center font-black text-2xl text-[#1a73e8] shadow-lg shadow-blue-500/5 group-hover:scale-110 transition-transform">
									{tech.name.charAt(0)}
								</div>
								<div>
									<p className="text-sm font-black text-[#202124] dark:text-white uppercase truncate">{tech.name}</p>
									<p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Nivel: Senior</p>
								</div>
								<Badge variant="brand" size="xs" className="px-5 py-1.5">{tech.value} Servicios</Badge>
							</div>
						))}
						{data.topTechs.length === 0 && (
							<div className="col-span-full py-20 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">Sin data técnica consolidada.</div>
						)}
					</div>
				</Card>
			</div>
		</div>
	);
};

export default Reports;
