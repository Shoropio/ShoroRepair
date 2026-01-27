import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db';
import { OrderStatus } from '../types';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Zap,
  Activity,
  ArrowRight,
  Plus
} from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, Badge, Button } from '../src/components';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const stats = useLiveQuery(async () => {
    const totalOrders = await db.orders.count();
    const pending = await db.orders.where('status').anyOf([OrderStatus.RECEIVED, OrderStatus.DIAGNOSTIC]).count();
    const ready = await db.orders.where('status').equals(OrderStatus.READY).count();
    const revenue = await db.orders.toArray().then(orders =>
      orders.filter(o => o.paymentStatus === 'Pagado').reduce((acc, curr) => acc + curr.total, 0)
    );

    const statusGroups = [
      { name: t('orders.status.received'), count: await db.orders.where('status').equals(OrderStatus.RECEIVED).count(), color: '#1a73e8' },
      { name: t('orders.status.diagnostic'), count: await db.orders.where('status').equals(OrderStatus.DIAGNOSTIC).count(), color: '#8b5cf6' },
      { name: t('orders.status.in_repair'), count: await db.orders.where('status').equals(OrderStatus.IN_REPAIR).count(), color: '#f9ab00' },
      { name: t('orders.status.ready'), count: ready, color: '#1e8e3e' },
    ];

    const recentOrders = await db.orders.orderBy('createdAt').reverse().limit(6).toArray();
    const clients = await Promise.all(recentOrders.map(o => db.clients.get(o.clientId)));

    return { totalOrders, pending, ready, revenue, statusGroups, recentOrders, clients };
  }, [t]);

  if (!stats) return <div className="p-8">{t('common.loading')}</div>;

  return (
    <div className="space-y-8 animate-in">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">
            Bienvenido, <span className="font-bold">{user?.fullName}</span>. Gestiona las actividades técnicas de ShoroRepair.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/orders">
            <Button variant="primary" leftIcon={<Plus size={18} />}>{t('orders.new')}</Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="tonal" className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6]">{t('dashboard.stats.active_orders')}</p>
            <h3 className="text-2xl font-semibold text-[#1a73e8] dark:text-[#8ab4f8]">{stats.totalOrders}</h3>
          </div>
          <ClipboardCheck size={32} className="opacity-10" />
        </Card>

        <Card variant="tonal" className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6]">{t('dashboard.stats.pending')}</p>
            <h3 className="text-2xl font-semibold text-[#f9ab00]">{stats.pending}</h3>
          </div>
          <Clock size={32} className="opacity-10" />
        </Card>

        <Card variant="tonal" className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6]">{t('dashboard.stats.delivered_today')}</p>
            <h3 className="text-2xl font-semibold text-[#1e8e3e]">{stats.ready}</h3>
          </div>
          <CheckCircle2 size={32} className="opacity-10" />
        </Card>

        {hasPermission('canViewReports') && (
          <Card variant="tonal" className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6]">{t('dashboard.stats.revenue_month')}</p>
              <h3 className="text-xl font-bold text-[#202124] dark:text-white truncate">{formatCurrency(stats.revenue)}</h3>
            </div>
            <Zap size={32} className="opacity-10" />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productivity Chart */}
        <Card
          className="lg:col-span-2"
          header={
            <h3 className="text-sm font-bold text-[#3c4043] dark:text-white">{t('dashboard.workshop_status')}</h3>
          }
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stats.statusGroups}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f4" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#5f6368', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#5f6368', fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: '#f8f9fa' }}
                  contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                  {stats.statusGroups.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Activity Feed */}
        <Card
          header={
            <h3 className="text-sm font-bold text-[#3c4043] dark:text-white">{t('dashboard.recent_entries')}</h3>
          }
          footer={
            <Link to="/orders" className="text-xs font-bold text-[#1a73e8] hover:underline flex items-center gap-1 justify-center">
              {t('dashboard.view_all')} <ArrowRight size={14} />
            </Link>
          }
        >
          <div className="divide-y divide-[#f1f3f4] dark:divide-white/5">
            {stats.recentOrders.map((order, idx) => (
              <div key={order.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-none bg-[#f1f3f4] dark:bg-[#3c4043] flex items-center justify-center font-bold text-xs text-[#5f6368] dark:text-white">
                    {order.brand.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#202124] dark:text-white truncate max-w-[100px]">{order.brand} {order.model}</p>
                    <p className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">{stats.clients[idx]?.name || 'Cliente'}</p>
                  </div>
                </div>
                <Badge variant={order.status === OrderStatus.READY ? 'success' : 'brand'} size="xs">
                  {order.status.split(' ')[0]}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tonal Bottom Card */}
      <Card variant="tonal" className="p-8 text-center space-y-4">
        <Activity size={32} className="mx-auto text-[#1a73e8]" />
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-[#202124] dark:text-white">{t('dashboard.productivity_tip')}</h3>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6]">{t('dashboard.inventory_reminder')}</p>
        </div>
        <Link to="/inventory" className="mt-6 block">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">{t('dashboard.go_to_inventory')}</Button>
        </Link>
      </Card>
    </div>
  );
};

export default Dashboard;
