import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../offline/db';
import { OrderStatus } from '../types';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Zap,
  Activity,
  ArrowRight,
  Plus,
  TrendingUp,
  Cpu,
  Package,
  ArrowUpRight,
  Monitor,
  Sparkles,
  Users
} from 'lucide-react';
import { formatCurrency } from '../utils/format/formatUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, Badge, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const data = useLiveQuery(async () => {
    const orders = await db.orders.where('deleted').equals(0).toArray();
    const clients = await db.clients.where('deleted').equals(0).toArray();
    const inventory = await db.inventory.where('deleted').equals(0).toArray();

    const pending = orders.filter(o => [OrderStatus.RECEIVED, OrderStatus.DIAGNOSTIC, OrderStatus.IN_REPAIR].includes(o.status)).length;
    const ready = orders.filter(o => o.status === OrderStatus.READY).length;
    const revenue = orders.filter(o => o.paymentStatus === 'Pagado').reduce((acc, curr) => acc + curr.total, 0);

    const statusGroups = [
      { name: t('orders.status.received'), count: orders.filter(o => o.status === OrderStatus.RECEIVED).length, color: '#1a73e8' },
      { name: t('orders.status.diagnostic'), count: orders.filter(o => o.status === OrderStatus.DIAGNOSTIC).length, color: '#8b5cf6' },
      { name: t('orders.status.in_repair'), count: orders.filter(o => o.status === OrderStatus.IN_REPAIR).length, color: '#f9ab00' },
      { name: t('orders.status.ready'), count: ready, color: '#1e8e3e' },
    ];

    const recentOrders = orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
    const resolvedClients = await Promise.all(recentOrders.map(o => db.clients.get(o.clientId)));

    return {
      totalOrders: orders.length,
      pending,
      ready,
      revenue,
      statusGroups,
      recentOrders,
      clients: resolvedClients,
      totalClients: clients.length,
      lowStock: inventory.filter(p => p.quantity <= (p.minStock || 5)).length
    };
  }, [t]);

  if (!data) return (
    <div className="space-y-8 animate-in p-8">
      <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse w-full"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse"></div>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in pb-12">
      {/* Premium Welcome Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1a73e8] to-[#1557b0] p-8 md:p-12 text-white shadow-2xl shadow-blue-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <Badge variant="brand" className="bg-white/20 text-white border-none backdrop-blur-md px-4 py-1">
              ShoroRepair OS v2.4
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {t('dashboard.welcome')}, <span className="text-blue-100">{user?.fullName.split(' ')[0]}!</span>
            </h1>
            <p className="text-blue-50/80 text-lg font-medium leading-relaxed">
              Tienes <span className="text-white font-bold">{data.pending} reparaciones</span> activas esperando tu atención técnica hoy.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/orders">
                <Button variant="primary" className="bg-white text-[#1a73e8] hover:bg-blue-50 border-none px-8 py-4 rounded-2xl shadow-xl shadow-black/10 font-bold" leftIcon={<Plus size={20} />}>
                  {t('orders.new')}
                </Button>
              </Link>
              <Link to="/ai-diagnostic">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 backdrop-blur-md px-8 py-4 rounded-2xl font-bold" leftIcon={<Sparkles size={20} />}>
                  AI Assist
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden lg:block relative">
            <div className="absolute inset-0 bg-blue-400 blur-[80px] opacity-30 animate-pulse"></div>
            <div className="relative p-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl">
              <Cpu size={80} strokeWidth={1} className="text-white opacity-80" />
            </div>
          </div>
        </div>
        {/* Decorative Elements */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-10 right-1/4 w-32 h-32 bg-blue-300/20 rounded-full blur-[60px]"></div>
      </div>

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="tonal" className="p-6 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-2xl">
              <ClipboardCheck size={24} />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-green-600">
              <ArrowUpRight size={14} /> 12%
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-widest">{t('dashboard.stats.active_orders')}</p>
            <h3 className="text-3xl font-black text-[#202124] dark:text-white mt-1">{data.totalOrders}</h3>
          </div>
        </Card>

        <Card variant="tonal" className="p-6 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-2xl">
              <Clock size={24} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-widest">{t('dashboard.stats.pending')}</p>
            <h3 className="text-3xl font-black text-amber-600 mt-1">{data.pending}</h3>
          </div>
        </Card>

        <Card variant="tonal" className="p-6 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-widest">{t('dashboard.stats.delivered_today')}</p>
            <h3 className="text-3xl font-black text-emerald-600 mt-1">{data.ready}</h3>
          </div>
        </Card>

        <Card variant="tonal" className="p-6 transition-transform hover:scale-[1.02] duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-widest">{t('dashboard.stats.revenue_month')}</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1 truncate">{formatCurrency(data.revenue)}</h3>
          </div>
        </Card>
      </div>

      {/* Layout Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workshop Flow Chart */}
        <Card className="lg:col-span-2 p-8 shadow-xl shadow-blue-500/5 rounded-[2rem] border-[#f1f3f4] dark:border-white/5" header={<div className="flex items-center justify-between mb-8"><h3 className="text-lg font-bold text-[#202124] dark:text-white flex items-center gap-3"><Monitor className="text-[#1a73e8]" size={20} /> {t('dashboard.workshop_status')}</h3><Badge variant="brand" size="xs">Live Update</Badge></div>}>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.statusGroups} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f3f4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#5f6368', fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5f6368', fontSize: 10, fontWeight: 700 }} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                />
                <Bar dataKey="count" radius={[12, 12, 0, 0]} barSize={50}>
                  {data.statusGroups.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#f1f3f4] dark:border-white/5">
            {data.statusGroups.map(g => (
              <div key={g.name} className="text-center">
                <p className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase mb-1">{g.name.split(' ')[0]}</p>
                <p className="text-lg font-black" style={{ color: g.color }}>{g.count}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Entries */}
        <Card className="shadow-xl shadow-blue-500/5 rounded-[2rem] border-[#f1f3f4] dark:border-white/5" header={<div className="flex items-center justify-between mb-6"><h3 className="text-lg font-bold text-[#202124] dark:text-white">{t('dashboard.recent_entries')}</h3><div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600"><Activity size={16} /></div></div>} footer={<Link to="/orders" className="text-xs font-bold text-[#1a73e8] hover:underline flex items-center gap-2 justify-center py-4">{t('dashboard.view_all')} <ArrowRight size={14} /></Link>}>
          <div className="space-y-4 px-2">
            {data.recentOrders.length === 0 ? (
              <div className="py-20 text-center">
                <Package size={40} className="mx-auto text-gray-200 mb-4" />
                <p className="text-sm font-medium text-gray-400">Sin ingresos recientes</p>
              </div>
            ) : data.recentOrders.map((order, idx) => (
              <div key={order.id} className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1a1c1e] flex items-center justify-center font-black text-lg text-[#1a73e8] shadow-sm group-hover:shadow-md transition-shadow">
                      {order.brand.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#202124] dark:text-white truncate max-w-[120px]">{order.brand} {order.model}</p>
                      <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] font-bold uppercase tracking-wide">{data.clients[idx]?.name || 'Cliente'}</p>
                    </div>
                  </div>
                  <Badge variant={order.status === OrderStatus.READY ? 'success' : order.status === OrderStatus.RECEIVED ? 'brand' : 'warning'} size="xs" className="px-2">
                    {order.status.split(' ')[0]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Notification/Tip Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card variant="tonal" className="p-8 relative overflow-hidden group">
          <div className="relative z-10 flex items-start gap-6">
            <div className="p-4 bg-white dark:bg-white/10 rounded-2xl shadow-lg">
              <Activity size={32} className="text-[#1a73e8]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#202124] dark:text-white">{t('dashboard.productivity_tip')}</h3>
              <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] font-medium leading-relaxed">{t('dashboard.inventory_reminder')}</p>
              <Link to="/inventory" className="inline-flex items-center gap-2 text-sm font-bold text-[#1a73e8] hover:gap-3 transition-all mt-4">
                {t('dashboard.go_to_inventory')} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </Card>

        <Card variant="tonal" className="p-8 relative overflow-hidden bg-emerald-50 dark:bg-emerald-900/5">
          <div className="flex items-start gap-6">
            <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
              <Users size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#202124] dark:text-white">Relación con Clientes</h3>
              <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] font-medium leading-relaxed">
                Tienes <span className="text-emerald-600 font-bold">{data.totalClients} clientes</span> registrados. El 80% de tus ingresos provienen de clientes recurrentes.
              </p>
              <Link to="/clients" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:gap-3 transition-all mt-4">
                Ver directorio <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
