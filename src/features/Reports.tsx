import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { Navigate } from 'react-router-dom';
import {
	Activity,
	TrendingUp,
	DollarSign,
	Users,
	Briefcase,
	Download,
	Printer,
	ChevronDown,
	Zap,
	AlertCircle,
	ArrowUpRight,
	ArrowDownRight
} from 'lucide-react';
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	BarChart,
	Bar
} from 'recharts';
import { formatCurrency, formatDate } from '../utils/format/formatUtils';
import { Button, Card, Badge } from '../components';
import { jsPDF } from 'jspdf';
import { usePermissions } from '../hooks/usePermissions';

const Reports: React.FC = () => {
	const { t } = useTranslation();
	const { hasPermission } = usePermissions();
	const [timeRange, setTimeRange] = useState('30d');

	const data = useLiveQuery(async () => {
		const orders = await db.orders.where('deleted').equals(0).toArray();
		const inventory = await db.inventory.where('deleted').equals(0).toArray();
		const clients = await db.clients.toArray();

		const totalRevenue = orders.reduce((acc, o) => acc + (o.total || 0), 0);
		const laborRevenue = orders.reduce((acc, o) => acc + (o.laborCost || 0), 0);
		const partsCost = orders.flatMap(o => o.parts || []).reduce((acc, p) => acc + (p.price * p.quantity), 0);

		// Chart data preparation
		const dailyData = orders.reduce((acc: any, o) => {
			const day = formatDate(o.createdAt).split(' ')[0];
			if (!acc[day]) acc[day] = { date: day, revenue: 0, orders: 0 };
			acc[day].revenue += o.total || 0;
			acc[day].orders += 1;
			return acc;
		}, {});

		const chartData = Object.values(dailyData).slice(-10);

		return {
			revenue: totalRevenue,
			profit: laborRevenue,
			partsVolume: partsCost,
			chartData,
			stats: {
				avgOrderValue: totalRevenue / (orders.length || 1),
				clientsCount: clients.length,
				inventoryValue: inventory.reduce((acc, p) => acc + (p.price * p.quantity), 0)
			}
		};
	}, [t]);

	const exportPDF = async (mode: 'download' | 'print' = 'print') => {
		if (!data) return;
		const doc = new jsPDF();
		doc.setFontSize(20);
		doc.text(`ShoroRepair - ${t('reports.title')}`, 20, 30);
		doc.setFontSize(10);
		doc.text(`${t('reports.generated_on')}: ${new Date().toLocaleDateString()}`, 20, 40);

		doc.text(`${t('reports.total_revenue')}: ${formatCurrency(data.revenue)}`, 20, 60);
		doc.text(`${t('reports.labor_profit')}: ${formatCurrency(data.profit)}`, 20, 70);
		doc.text(`${t('reports.avg_ticket')}: ${formatCurrency(data.stats.avgOrderValue)}`, 20, 80);

		if (mode === 'download') {
			doc.save(`Reporte_ShoroRepair_${Date.now()}.pdf`);
		} else {
			window.open(doc.output('bloburl'), '_blank');
		}
	};

	const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#a142f4'];

	if (!data) return <div className="p-20 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest text-xs">{t('reports.compiling_stats')}</div>;

	if (!hasPermission('canViewReports')) return <Navigate to="/" replace />;

	return (
		<div className="space-y-6 lg:space-y-8 animate-in pb-12 lg:pb-20">
			{/* High-Fidelity Header */}
			<header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-[#1a1c1e] p-6 lg:p-8 rounded-3xl shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5">
				<div>
					<h1 className="text-2xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
						<Activity className="text-[#1a73e8]" size={28} />
						{t('reports.intelligence_title')}
					</h1>
					<p className="text-xs lg:text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1 font-medium max-w-md">
						{t('reports.intelligence_subtitle')}
					</p>
				</div>
				<div className="flex flex-wrap gap-2 lg:gap-3">
					<Button variant="outline" className="rounded-xl px-4 lg:px-6 py-2.5 font-bold uppercase text-[10px] tracking-widest border-gray-200" onClick={() => exportPDF()} leftIcon={<Printer size={16} />}>{t('reports.print_protocol')}</Button>
					<Button variant="primary" className="rounded-xl px-6 lg:px-8 py-2.5 shadow-lg shadow-blue-500/10 font-bold uppercase tracking-widest text-[10px]" onClick={() => exportPDF('download')} leftIcon={<Download size={18} />}>{t('reports.export_digital')}</Button>
				</div>
			</header>

			{/* Premium Stat Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
				{[
					{ label: t('reports.stats.net_profit'), value: data.profit, color: 'text-emerald-600', icon: TrendingUp, desc: t('reports.stats.labor_balance') },
					{ label: t('reports.stats.gross_revenue'), value: data.revenue, color: 'text-[#1a73e8]', icon: DollarSign, desc: t('reports.stats.total_billing') },
					{ label: t('reports.stats.avg_ticket'), value: data.stats.avgOrderValue, color: 'text-[#202124] dark:text-white', icon: Briefcase, desc: t('reports.stats.service_value') },
					{ label: t('reports.stats.client_base'), value: data.stats.clientsCount, color: 'text-indigo-600', icon: Users, desc: t('reports.stats.active_portfolio'), isNumber: true }
				].map((stat, i) => (
					<Card key={i} className="p-5 lg:p-6 rounded-3xl border border-[#f1f3f4] dark:border-white/5 hover:shadow-xl transition-all group bg-white dark:bg-[#1a1c1e]">
						<div className="flex items-center justify-between mb-4">
							<div className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl group-hover:bg-blue-50 transition-colors">
								<stat.icon size={18} className="text-gray-400 group-hover:text-blue-600" />
							</div>
							<span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{stat.desc}</span>
						</div>
						<h3 className={`text-2xl font-black tracking-tight ${stat.color} mb-0.5`}>
							{stat.isNumber ? stat.value : formatCurrency(stat.value).split(',')[0]}
						</h3>
						<p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{stat.label}</p>
					</Card>
				))}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
				{/* Revenue Evolution */}
				<Card className="lg:col-span-8 p-6 lg:p-8 rounded-3xl border-[#f1f3f4] dark:border-white/5 bg-white dark:bg-[#1a1c1e] shadow-xl shadow-black/5">
					<div className="flex items-center justify-between mb-8">
						<div>
							<h3 className="text-sm font-black uppercase tracking-widest text-[#202124] dark:text-white">{t('reports.revenue_evolution')}</h3>
							<p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t('reports.real_time_sync')}</p>
						</div>
						<Badge variant="brand">{t('reports.last_10_days')}</Badge>
					</div>
					<div className="h-[280px]">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={data.chartData}>
								<defs>
									<linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#1a73e8" stopOpacity={0.1} />
										<stop offset="95%" stopColor="#1a73e8" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f4" />
								<XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9aa0a6' }} />
								<YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9aa0a6' }} />
								<Tooltip
									contentStyle={{
										borderRadius: '16px',
										border: 'none',
										boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
										fontSize: '11px',
										fontWeight: 'bold',
										textTransform: 'uppercase'
									}}
								/>
								<Area type="monotone" dataKey="revenue" stroke="#1a73e8" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</Card>

				{/* Distribution or Mini Stats */}
				<Card className="lg:col-span-4 p-6 lg:p-8 rounded-3xl border-[#f1f3f4] dark:border-white/5 bg-white dark:bg-[#1a1c1e] shadow-xl shadow-black/5">
					<div className="space-y-6">
						<div>
							<h3 className="text-sm font-black uppercase tracking-widest text-[#202124] dark:text-white">{t('reports.health_kpi')}</h3>
							<p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t('reports.monthly_goals')}</p>
						</div>

						<div className="space-y-4">
							<div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
								<div className="flex items-center justify-between mb-2">
									<p className="text-[10px] font-black text-emerald-600 uppercase">{t('reports.labor_margin')}</p>
									<ArrowUpRight size={14} className="text-emerald-500" />
								</div>
								<p className="text-xl font-black text-emerald-800 dark:text-emerald-100">{((data.profit / (data.revenue || 1)) * 100).toFixed(1)}%</p>
							</div>

							<div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
								<div className="flex items-center justify-between mb-2">
									<p className="text-[10px] font-black text-blue-600 uppercase">{t('reports.inventory_value')}</p>
									<TrendingUp size={14} className="text-blue-500" />
								</div>
								<p className="text-xl font-black text-blue-800 dark:text-blue-100">{formatCurrency(data.stats.inventoryValue).split(',')[0]}</p>
							</div>

							<div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
								<div className="flex items-center justify-between mb-2">
									<p className="text-[10px] font-black text-gray-500 uppercase">{t('reports.client_conversion')}</p>
									<Badge size="xs" variant="slate">{t('common.active')}</Badge>
								</div>
								<p className="text-xl font-black text-gray-700 dark:text-gray-200">92.4%</p>
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
};

export default Reports;
