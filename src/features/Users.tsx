import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { AppUser, ROLES_CONFIG, UserRole } from '../types';
import { toast } from 'sonner';
import {
	Plus,
	Trash2,
	Edit2,
	Shield,
	User,
	Hammer,
	Check,
	Lock,
	Settings2,
	Users as UsersIcon,
	ShieldCheck,
	Cpu,
	Activity,
	Smartphone,
	Search,
	List,
	LayoutGrid,
	MoreVertical,
	ToggleLeft,
	ToggleRight
} from 'lucide-react';
import { Card, Button, Input, Modal, Badge, Select } from '../components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate, Link } from 'react-router-dom';

const UsersPage: React.FC = () => {
	const { t } = useTranslation();
	const { hasPermission } = usePermissions();
	const [showAdd, setShowAdd] = useState(false);
	const [search, setSearch] = useState('');
	const [editingUser, setEditingUser] = useState<AppUser | null>(null);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
		return (localStorage.getItem('users_view_mode') as 'grid' | 'list') || 'grid';
	});

	const [formData, setFormData] = useState<Partial<AppUser>>({
		username: '',
		fullName: '',
		password: '',
		role: 'Technician',
		active: true
	});

	const users = useLiveQuery(async () => {
		const all = await db.users.toArray();
		if (!search) return all;
		const q = search.toLowerCase();
		return all.filter(u => u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
	}, [search]);

	if (!hasPermission('canManageUsers')) return <Navigate to="/" replace />;

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.username || !formData.fullName || (!editingUser && !formData.password)) {
			toast.error(t('users.fill_required'));
			return;
		}

		try {
			const existingUser = await db.users.where('username').equals(formData.username!).first();
			if (existingUser && (!editingUser || existingUser.id !== editingUser.id)) {
				toast.error(t('users.user_exists'));
				return;
			}

			if (editingUser) {
				const updateData: any = {
					username: formData.username,
					fullName: formData.fullName,
					role: formData.role,
					active: formData.active,
					updatedAt: Date.now(),
					synced: 0
				};
				if (formData.password) updateData.password = formData.password;
				await db.users.update(editingUser.id!, updateData);
				toast.success(t('users.credentials_updated'));
			} else {
				await db.users.add({
					...formData,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					synced: 0
				} as AppUser);
				toast.success(t('users.new_operator_success'));
			}
			closeModal();
		} catch (error) {
			toast.error(t('common.sync_error'));
		}
	};

	const closeModal = () => {
		setShowAdd(false);
		setEditingUser(null);
		setFormData({ username: '', fullName: '', role: 'Technician', active: true, password: '' });
	};

	const openEdit = (user: AppUser) => {
		setEditingUser(user);
		setFormData({ username: user.username, fullName: user.fullName, role: user.role, active: user.active, password: '' });
		setShowAdd(true);
	};

	const toggleStatus = async (user: AppUser) => {
		if (user.role === 'Admin') return;
		await db.users.update(user.id!, { active: !user.active, updatedAt: Date.now(), synced: 0 });
		toast.success(t('users.status_updated', { status: !user.active ? t('users.status.active') : t('users.status.inactive') }));
	};

	const handleDelete = async (user: AppUser) => {
		if (user.role === 'Admin') return;
		if (confirm(`${t('users.delete_confirm')} ${user.fullName}?`)) {
			await db.users.delete(user.id!);
			toast.success(t('users.operator_removed'));
		}
	};

	if (!users) return <div className="p-20 text-center animate-pulse text-xs font-black text-gray-400 uppercase tracking-widest">{t('users.validating_registry')}</div>;

	return (
		<div className="space-y-8 animate-in pb-20">
			{/* Premium Header */}
			<header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-[2.5rem] shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
				<div className="relative z-10">
					<h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
						<UsersIcon className="text-[#1a73e8]" size={32} />
						{t('users.center')}
					</h1>
					<p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
						{t('users.subtitle')}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-4 relative z-10">
					<Link to="/roles">
						<Button variant="outline" className="rounded-2xl px-6 py-4 font-black uppercase text-[10px] tracking-widest border-gray-200" leftIcon={<Settings2 size={18} />}>{t('users.manage_roles')}</Button>
					</Link>
					<Button
						variant="primary"
						className="rounded-2xl px-8 py-4 shadow-lg shadow-blue-500/20 font-black uppercase tracking-widest text-[11px]"
						leftIcon={<Plus size={20} />}
						onClick={() => setShowAdd(true)}
					>
						{t('users.new')}
					</Button>
				</div>
			</header>

			{/* Browser Bar */}
			<div className="flex flex-col md:flex-row gap-4">
				<div className="relative flex-1 group">
					<Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] group-focus-within:text-[#1a73e8] transition-colors" size={20} />
					<input
						type="text"
						placeholder={t('users.search_placeholder')}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-14 pr-6 py-4 bg-white dark:bg-[#1a1c1e] rounded-[1.5rem] outline-none border-2 border-transparent focus:border-[#1a73e8]/20 shadow-xl shadow-black/5 transition-all text-sm font-medium"
					/>
				</div>
				<div className="flex bg-white dark:bg-[#1a1c1e] p-2 rounded-[1.5rem] shadow-xl shadow-black/5 border border-[#f1f3f4] dark:border-white/5">
					<button onClick={() => setViewMode('grid')} className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${viewMode === 'grid' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368]'}`}><LayoutGrid size={16} /> {t('common.grid')}</button>
					<button onClick={() => setViewMode('list')} className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${viewMode === 'list' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368]'}`}><List size={16} /> {t('common.list')}</button>
				</div>
			</div>

			{/* Content Area */}
			{viewMode === 'grid' ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
					{users.map(user => (
						<Card key={user.id} className={`group p-8 rounded-[2.5rem] transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden border-[#f1f3f4] dark:border-white/5 bg-white ${!user.active ? 'opacity-60 grayscale' : ''}`}>
							<div className="flex justify-between items-start mb-6">
								<div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg ${user.role === 'Admin' ? 'bg-blue-50 text-blue-600 shadow-blue-500/10' : user.role === 'Technician' ? 'bg-amber-50 text-amber-600 shadow-amber-500/10' : 'bg-emerald-50 text-emerald-600 shadow-emerald-500/10'}`}>
									{user.fullName.charAt(0)}
								</div>
								<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
									<button onClick={() => openEdit(user)} className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-blue-50 hover:text-blue-600"><Edit2 size={16} /></button>
									{user.role !== 'Admin' && <button onClick={() => handleDelete(user)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><Trash2 size={16} /></button>}
								</div>
							</div>

							<div className="space-y-1 mb-8">
								<h3 className="font-black text-lg text-[#202124] dark:text-white uppercase tracking-tight truncate">{user.fullName}</h3>
								<p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID: @{user.username}</p>
							</div>

							<div className="flex items-center justify-between pt-6 border-t border-gray-100">
								<Badge variant={user.role === 'Admin' ? 'brand' : user.role === 'Technician' ? 'warning' : 'success'} size="xs" className="px-4 py-1 font-black uppercase tracking-widest">{t(`users.roles.${user.role.toLowerCase()}`)}</Badge>
								<button
									onClick={() => toggleStatus(user)}
									disabled={user.role === 'Admin'}
									className={`p-2 transition-all ${user.active ? 'text-emerald-500' : 'text-red-500'}`}
								>
									{user.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
								</button>
							</div>
						</Card>
					))}
				</div>
			) : (
				<div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-white/5 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5">
					<div className="overflow-x-auto">
						<table className="w-full text-left">
							<thead>
								<tr className="bg-[#f8f9fa] dark:bg-white/[0.02] border-b border-[#f1f3f4] dark:border-white/5">
									<th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('users.table.identity')}</th>
									<th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('users.table.range')}</th>
									<th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em]">{t('users.table.status')}</th>
									<th className="px-8 py-5 text-[10px] font-black text-[#5f6368] uppercase tracking-[0.2em] text-right">{t('common.actions')}</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#f1f3f4] dark:divide-white/5">
								{users.map(user => (
									<tr key={user.id} className={`hover:bg-blue-50/20 transition-colors group ${!user.active ? 'opacity-40' : ''}`}>
										<td className="px-8 py-6">
											<div className="flex items-center gap-4">
												<div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${user.role === 'Admin' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500 shadow-sm'}`}>
													{user.fullName.charAt(0)}
												</div>
												<div>
													<p className="text-sm font-black text-[#202124] dark:text-white uppercase tracking-tight">{user.fullName}</p>
													<p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">@{user.username}</p>
												</div>
											</div>
										</td>
										<td className="px-8 py-6">
											<Badge variant={user.role === 'Admin' ? 'brand' : (user.role === 'Technician' ? 'warning' : 'success')} size="xs" className="px-4 font-black uppercase">{t(`users.roles.${user.role.toLowerCase()}`)}</Badge>
										</td>
										<td className="px-8 py-6">
											<div className="flex items-center gap-2">
												<div className={`w-2 h-2 rounded-full ${user.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
												<span className={`text-[10px] font-black uppercase tracking-widest ${user.active ? 'text-emerald-600' : 'text-red-600'}`}>
													{user.active ? t('users.status.synced') : t('users.status.no_access')}
												</span>
											</div>
										</td>
										<td className="px-8 py-6 text-right">
											<div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
												<button onClick={() => openEdit(user)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100"><Edit2 size={16} /></button>
												{user.role !== 'Admin' && <button onClick={() => handleDelete(user)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><Trash2 size={16} /></button>}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* MODAL OPERADOR */}
			<Modal
				isOpen={showAdd}
				onClose={closeModal}
				title={editingUser ? t('users.edit') : t('users.new')}
				subtitle={t('users.security_registry')}
				size="2xl"
				footer={<div className="flex gap-4 px-8 pb-6"><Button variant="ghost" className="rounded-2xl px-8" onClick={closeModal}>{t('common.cancel')}</Button><Button variant="primary" className="rounded-2xl px-12 shadow-xl shadow-blue-500/20 font-black uppercase tracking-widest text-[11px]" onClick={handleSave}>{t('common.save')}</Button></div>}
			>
				<form onSubmit={handleSave} className="space-y-8 py-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<Input label={t('users.fields.full_name')} placeholder={t('orders.fields.name_placeholder')} value={formData.fullName} onChange={v => setFormData({ ...formData, fullName: v.target.value })} required />
						<Input label={t('users.fields.username')} placeholder={t('orders.fields.username_placeholder')} value={formData.username} onChange={v => setFormData({ ...formData, username: v.target.value })} required />
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<Input label={editingUser ? t('users.fields.new_password') : t('users.fields.password')} type="password" value={formData.password} onChange={v => setFormData({ ...formData, password: v.target.value })} required={!editingUser} leftIcon={<Lock size={16} />} />
						<Select label={t('users.fields.role')} value={formData.role} onChange={v => setFormData({ ...formData, role: v.target.value as UserRole })}>
							<option value="Admin">{t('users.roles.admin')}</option>
							<option value="Technician">{t('users.roles.technician')}</option>
							<option value="Receptionist">{t('users.roles.receptionist')}</option>
						</Select>
					</div>
				</form>
			</Modal>
		</div>
	);
};

export default UsersPage;
