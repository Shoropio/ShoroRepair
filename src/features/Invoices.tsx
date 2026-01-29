import React, { useState } from 'react';
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
	CloudUpload
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../utils/format/formatUtils';
import { generateInvoice } from '../utils/print/invoiceUtils';
import { TableSkeleton, Button, Input, Card, Badge, Modal } from '../components';
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

	const clients = useLiveQuery(() => db.clients.toArray());

	const handleHaciendaSync = async (order: ServiceOrder) => {
		toast.info(t('invoices.connecting'));
		// Mock delay for simulation
		setTimeout(() => {
			toast.error(t('invoices.xml_error'));
		}, 1500);
	};

	if (!hasPermission('canViewReports')) {
		return <Navigate to="/" replace />;
	}

	if (!invoices) return <div className="p-8"><TableSkeleton /></div>;

	return (
		<div className="space-y-8 animate-in">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
				<div>
					<h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">
						{t('invoices.title')}
					</h1>
					<p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">
						{t('invoices.subtitle')}
					</p>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card variant="tonal" className="p-6">
					<div className="flex items-center gap-4">
						<div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-none">
							<FileText size={24} />
						</div>
						<div>
							<p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Total Comprobantes</p>
							<h3 className="text-2xl font-semibold text-[#202124] dark:text-white">{invoices.length}</h3>
						</div>
					</div>
				</Card>
				<Card variant="tonal" className="p-6">
					<div className="flex items-center gap-4">
						<div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-none">
							<DollarSign size={24} />
						</div>
						<div>
							<p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Monto Facturado</p>
							<h3 className="text-2xl font-semibold text-emerald-600">
								{formatCurrency(invoices.reduce((a, b) => a + (b.total || 0), 0))}
							</h3>
						</div>
					</div>
				</Card>
				<Card variant="tonal" className="p-6">
					<div className="flex items-center gap-4">
						<div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-none">
							<Calendar size={24} />
						</div>
						<div>
							<p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Pendientes de Pago</p>
							<h3 className="text-2xl font-semibold text-amber-600">
								{invoices.filter(i => i.paymentStatus !== 'Pagado').length}
							</h3>
						</div>
					</div>
				</Card>
			</div>

			{/* Filters */}
			<Card className="p-4">
				<div className="flex flex-col md:flex-row gap-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368]" size={18} />
						<Input
							placeholder="Buscar por factura o nro de orden..."
							className="pl-10"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<div className="flex gap-2">
						<select
							className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-none text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
						>
							<option value="all">Todos los estados</option>
							<option value="Pagado">Pagado</option>
							<option value="Pendiente">Pendiente</option>
						</select>
					</div>
				</div>
			</Card>

			{/* Invoices Table */}
			<div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-[#3c4043] rounded-none overflow-hidden shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full text-left">
						<thead>
							<tr className="border-b border-[#f1f3f4] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124]">
								<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('invoices.table.reference')}</th>
								<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Cliente</th>
								<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('invoices.table.date')}</th>
								<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-right">{t('invoices.table.amount')}</th>
								<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-center">{t('invoices.table.status')}</th>
								<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-right">{t('invoices.table.actions')}</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
							{invoices.map(invoice => {
								const client = clients?.find(c => c.id === invoice.clientId);
								return (
									<tr key={invoice.id} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors group">
										<td className="px-6 py-4">
											<div className="flex flex-col">
												<span className="text-sm font-bold text-[#1a73e8]">{invoice.invoiceNumber}</span>
												<span className="text-[10px] text-[#5f6368] uppercase font-medium">Ref: {invoice.orderNumber}</span>
											</div>
										</td>
										<td className="px-6 py-4">
											<div className="flex items-center gap-2">
												<UserIcon size={14} className="text-[#5f6368]" />
												<span className="text-sm text-[#202124] dark:text-white font-medium">{client?.name || '---'}</span>
											</div>
										</td>
										<td className="px-6 py-4">
											<span className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">{formatDate(invoice.createdAt)}</span>
										</td>
										<td className="px-6 py-4 text-right">
											<span className="text-sm font-bold text-[#202124] dark:text-white">{formatCurrency(invoice.total)}</span>
										</td>
										<td className="px-6 py-4 text-center">
											<Badge variant={invoice.paymentStatus === 'Pagado' ? 'success' : 'warning'} size="xs">
												{invoice.paymentStatus}
											</Badge>
										</td>
										<td className="px-6 py-4 text-right">
											<div className="flex justify-end gap-2">
												<button
													onClick={() => generateInvoice(invoice, 'print')}
													className="p-2 text-[#5f6368] hover:bg-blue-50 hover:text-blue-600 transition-colors"
													title="Imprimir"
												>
													<Printer size={16} />
												</button>
												<button
													onClick={() => generateInvoice(invoice, 'download')}
													className="p-2 text-[#5f6368] hover:bg-blue-50 hover:text-blue-600 transition-colors"
													title="Descargar PDF"
												>
													<Download size={16} />
												</button>
												<button
													onClick={() => handleHaciendaSync(invoice)}
													className="p-2 text-[#5f6368] hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
													title="Sincronizar con Hacienda"
												>
													<CloudUpload size={16} />
												</button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				{invoices.length === 0 && (
					<div className="p-20 text-center">
						<FileText size={48} className="mx-auto text-[#dadce0] mb-4" />
						<p className="text-[#5f6368] font-medium">No se encontraron comprobantes registrados.</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default Invoices;
