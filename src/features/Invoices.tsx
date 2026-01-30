import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { ServiceOrder } from '../types';
import {
	FileText,
	Search,
	Printer,
	Download,
	ExternalLink,
	Filter,
	Calendar,
	DollarSign,
	User as UserIcon,
	CloudUpload,
	Receipt,
	History,
	ChevronRight,
	SearchCode,
	Activity,
	CheckCircle2,
	Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../utils/format/formatUtils';
import { generateInvoice } from '../utils/print/invoiceUtils';
import { TableSkeleton, Button, Input, Card, Badge, Modal, Select } from '../components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate } from 'react-router-dom';

const Invoices: React.FC = () => {
	const { t } = useTranslation();
	const { hasPermission } = usePermissions();
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');

	const invoices = useLiveQuery(async () => {
		const orders = await db.orders
			.where('invoiceNumber')
			.notEqual('')
			.reverse()
			.sortBy('createdAt');

		return orders.filter(o => {
			const matchesSearch = !search ||
				o.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
				o.orderNumber.toLowerCase().includes(search.toLowerCase());
			const matchesStatus = statusFilter === 'all' || o.paymentStatus === statusFilter;
			return matchesSearch && matchesStatus;
		});
	}, [search, statusFilter]);

	const stats = useMemo(() => {
		if (!invoices) return { total: 0, revenue: 0, pending: 0 };
		return {
			total: invoices.length,
			revenue: invoices.reduce((a, b) => a + (b.total || 0), 0),
			pending: invoices.filter(i => i.paymentStatus !== 'Pagado').length
		};
	}, [invoices]);

	const clients = useLiveQuery(() => db.clients.toArray());

	const handleHaciendaSync = async (order: ServiceOrder) => {
		toast.promise(new Promise((resolve, reject) => {
			setTimeout(() => reject(new Error("Certificado no configurado")), 2000);
		}), {
			loading: 'Estableciendo túnel con Hacienda API...',
			success: 'Comprobante Aceptado',
			error: (err) => `Fallo en sincronización: ${err.message}`
		});
	};

	if (!hasPermission('canViewReports')) return <Navigate to="/" replace />;

	if (!invoices) return <div className="p-20 text-center animate-pulse text-xs font-black text-gray-400 uppercase tracking-widest">Consultando Ledger Digital...</div>;

	return (
		<div className="space-y-8 animate-in pb-20">
			{/* High-Fidelity Header */}
			<header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-[2.5rem] shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
				<div className="relative z-10">
					<h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
						<Receipt className="text-[#1a73e8]" size={32} />
						Consolidado Tributario
					</h1>
					<p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
						Archivo histórico de comprobantes fiscales, facturas proformas y registros de pago ShoroRepair.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-6 relative z-10">
					<div className="flex gap-4">
						<Card className="px-6 py-4 bg-gray-50 dark:bg-white/5 rounded-2xl border-none flex flex-col items-center">
							<span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Volumen</span>
							<span className="text-xl font-black text-gray-800 dark:text-white">{stats.total}</span>
						</Card>
						<Card className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border-none flex flex-col items-center">
							<span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Neto</span>
							<span className="text-xl font-black text-emerald-600">{formatCurrency(stats.revenue).split(',')[0]}</span>
						</Card>
						<Card className="px-6 py-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border-none flex flex-col items-center">
							<span className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Pasivos</span>
							<span className="text-xl font-black text-amber-600">{stats.pending}</span>
						</Card>
					</div>
				</div>
				<div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-50"></div>
			</header>

			{/* Premium Browser Bar */}
			<div className="flex flex-col lg:flex-row gap-4">
				<div className="relative flex-1 group">
					<Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#1a73e8] transition-colors" size={20} />
					<input
						type="text"
						placeholder="Buscar por #Factura, #Orden o Nombre de Cliente..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-14 pr-6 py-4 bg-white dark:bg-[#1a1c1e] rounded-[1.5rem] outline-none border-2 border-transparent focus:border-[#1a73e8]/20 shadow-xl shadow-black/5 transition-all text-sm font-medium"
					/>
				</div>
				<div className="flex gap-4">
					<Select
						className="w-56 h-auto py-4 rounded-[1.5rem] bg-white border-none shadow-xl shadow-black/5 font-bold text-xs uppercase tracking-widest text-[#5f6368]"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
					>
						<option value="all">Filtrar por Estado</option>
						<option value="Pagado">Solo Cancelados</option>
						<option value="Pendiente">Pendientes Cobro</option>
					</Select>
				</div>
			</div>

			{/* Modern Table Container */}
			<div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-white/5 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5">
				<div className="overflow-x-auto">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
								<th className="px-8 py-6 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">Folio / Referencia</th>
								<th className="px-8 py-6 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">Entidad / Cliente</th>
								<th className="px-8 py-6 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">Fecha Emisión</th>
								<th className="px-8 py-6 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em] text-right">Importe Fiscal</th>
								<th className="px-8 py-6 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em] text-center">Crédito</th>
								<th className="px-8 py-6 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em] text-right">Bio-Acciones</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
							{invoices.map(invoice => {
								const client = clients?.find(c => c.id === invoice.clientId);
								return (
									<tr key={invoice.id} className="hover:bg-blue-50/30 transition-colors group">
										<td className="px-8 py-6">
											<div className="flex flex-col">
												<span className="text-sm font-black text-[#1a73e8] tracking-tight">{invoice.invoiceNumber}</span>
												<span className="text-[10px] text-[#5f6368] font-bold uppercase opacity-60">OS: {invoice.orderNumber}</span>
											</div>
										</td>
										<td className="px-8 py-6">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
													<UserIcon size={14} />
												</div>
												<span className="text-sm text-[#202124] dark:text-white font-black uppercase tracking-tight">{client?.name || '---'}</span>
											</div>
										</td>
										<td className="px-8 py-6">
											<div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
												<Calendar size={14} className="opacity-50" /> {formatDate(invoice.createdAt)}
											</div>
										</td>
										<td className="px-8 py-6 text-right">
											<span className="text-base font-black text-[#202124] dark:text-white tracking-tighter">{formatCurrency(invoice.total)}</span>
										</td>
										<td className="px-8 py-6 text-center">
											<Badge variant={invoice.paymentStatus === 'Pagado' ? 'success' : 'warning'} size="xs" className="px-4 py-1.5 font-black uppercase">
												{invoice.paymentStatus === 'Pagado' ? <><CheckCircle2 size={10} className="mr-1 inline" /> {invoice.paymentStatus}</> : <><Clock size={10} className="mr-1 inline" /> {invoice.paymentStatus}</>}
											</Badge>
										</td>
										<td className="px-8 py-6 text-right">
											<div className="flex justify-end gap-2 opacity-20 group-hover:opacity-100 transition-all">
												<button onClick={() => generateInvoice(invoice, 'print')} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100" title="Impresión Térmica"><Printer size={16} /></button>
												<button onClick={() => generateInvoice(invoice, 'download')} className="p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100" title="Descargar PDF"><Download size={16} /></button>
												<button onClick={() => handleHaciendaSync(invoice)} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100" title="Validar Ministerio"><CloudUpload size={16} /></button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				{invoices.length === 0 && (
					<div className="py-32 flex flex-col items-center justify-center">
						<History size={48} className="text-gray-200 mb-4" />
						<p className="text-xs font-black text-gray-400 uppercase tracking-widest">Memoria de facturación vacía</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default Invoices;
