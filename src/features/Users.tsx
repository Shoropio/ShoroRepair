import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import { AppUser, ROLES_CONFIG, UserRole } from '../types';
import { toast } from 'sonner';
import {
	Plus, Trash2, Edit2, Shield, User, Hammer, Check, Lock, Settings2
} from 'lucide-react';
import { Card, Button, Input, Modal, Badge } from '../components';
import { usePermissions } from '../hooks/usePermissions';
import { Navigate, Link } from 'react-router-dom';

const UsersPage: React.FC = () => {
	const { t } = useTranslation();
	const { hasPermission } = usePermissions();
	const [showAdd, setShowAdd] = useState(false);
	const [editingUser, setEditingUser] = useState<AppUser | null>(null);
	const [formData, setFormData] = useState<Partial<AppUser>>({
		username: '',
		fullName: '',
		password: '',
		role: 'Technician',
		active: true
	});

	const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
		return (localStorage.getItem('users_view_mode') as 'grid' | 'list') || 'list';
	});

	const toggleViewMode = (mode: 'grid' | 'list') => {
		setViewMode(mode);
		localStorage.setItem('users_view_mode', mode);
	};

	const users = useLiveQuery(() => db.users.toArray());

	if (!hasPermission('canManageUsers')) {
		return <Navigate to="/" replace />;
	}

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.username || !formData.fullName || (!editingUser && !formData.password)) {
			toast.error("Datos incompletos");
			return;
		}

		try {
			const existingUser = await db.users.where('username').equals(formData.username!).first();
			if (existingUser && (!editingUser || existingUser.id !== editingUser.id)) {
				toast.error("El nombre de usuario ya existe");
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
				toast.success("Usuario actualizado");
			} else {
				await db.users.add({
					...formData,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					synced: 0
				} as AppUser);
				toast.success("Usuario creado");
			}
			closeModal();
		} catch (error) {
			toast.error("Error al guardar");
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
		toast.success(`Usuario ${!user.active ? 'reactivado' : 'suspendido'}`);
	};

	const handleDelete = async (user: AppUser) => {
		if (user.role === 'Admin') return;
		if (confirm(`¿Eliminar a ${user.fullName}?`)) {
			await db.users.delete(user.id!);
			toast.success("Usuario eliminado");
		}
	};

	return (
		<div className="space-y-10 animate-in">
			{/* Header Area */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
				<div>
					<h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight text-center md:text-left">{t('users.title')}</h1>
					<p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1 text-center md:text-left">{t('users.subtitle')}</p>
				</div>
				<div className="flex items-center gap-2 justify-center">
					<div className="flex bg-[#f1f3f4] dark:bg-[#2d2f31] p-1 rounded-none">
						<button
							onClick={() => toggleViewMode('grid')}
							className={`p-1.5 rounded-none transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
						</button>
						<button
							onClick={() => toggleViewMode('list')}
							className={`p-1.5 rounded-none transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-sm' : 'text-[#5f6368]'}`}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
						</button>
					</div>
					<Link to="/roles">
						<Button variant="outline" leftIcon={<Settings2 size={18} />}>{t('users.view_permissions')}</Button>
					</Link>
					<Button variant="primary" leftIcon={<Plus size={18} />} onClick={() => setShowAdd(true)}>{t('users.new')}</Button>
				</div>
			</div>

			{/* Users Content */}
			{viewMode === 'grid' ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{users?.map(user => (
						<Card key={user.id} variant="outlined" className="group overflow-hidden">
							<div className="p-1 flex flex-col items-center text-center">
								{/* Actions overlay */}
								<div className="w-full flex justify-end gap-1 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
									<button onClick={() => openEdit(user)} className="p-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-none transition-all cursor-pointer"><Edit2 size={14} /></button>
									{user.role !== 'Admin' && (
										<button onClick={() => handleDelete(user)} className="p-2 text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#ea4335] rounded-none transition-all cursor-pointer"><Trash2 size={14} /></button>
									)}
								</div>

								{/* Avatar */}
								<div className={`w-16 h-16 rounded-none flex items-center justify-center mb-4 transition-transform group-hover:scale-105 ${user.role === 'Admin' ? 'bg-[#e8f0fe] text-[#1a73e8]' : user.role === 'Technician' ? 'bg-[#fef7e0] text-[#f9ab00]' : 'bg-[#e6f4ea] text-[#1e8e3e]'}`}>
									{user.role === 'Admin' ? <Shield size={32} /> : user.role === 'Technician' ? <Hammer size={32} /> : <User size={32} />}
								</div>

								<h3 className="font-semibold text-[#202124] dark:text-white mb-0.5 truncate w-full px-2">{user.fullName}</h3>
								<p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-medium tracking-tight mb-4">@{user.username}</p>

								<Badge variant={user.role === 'Admin' ? 'brand' : user.role === 'Technician' ? 'warning' : 'success'} size="xs" className="mb-6">
									{user.role}
								</Badge>

								<button
									onClick={() => toggleStatus(user)}
									disabled={user.role === 'Admin'}
									className={`w-full py-2.5 px-4 rounded-none text-xs font-bold transition-all border ${user.active
										? 'bg-[#f1f3f4] text-[#3c4043] border-transparent hover:bg-[#e8eaed]'
										: 'bg-[#fdf2f2] text-[#d93025] border-[#fde2e2]'
										} ${user.role === 'Admin' ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
								>
									{user.active ? t('users.status.active') : t('users.status.inactive')}
								</button>
							</div>
						</Card>
					))}
				</div>
			) : (
				<div className="bg-white dark:bg-[#1a1c1e] border border-[#f1f3f4] dark:border-[#3c4043] rounded-none overflow-hidden shadow-sm">
					<div className="overflow-x-auto">
						<table className="w-full text-left">
							<thead>
								<tr className="border-b border-[#f1f3f4] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124]">
									<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('users.table.member')}</th>
									<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('users.table.role')}</th>
									<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">{t('users.table.status')}</th>
									<th className="px-6 py-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider text-right">{t('users.table.actions')}</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
								{users?.map(user => (
									<tr key={user.id} className="hover:bg-[#f8f9fa] dark:hover:bg-white/[0.02] transition-colors group">
										<td className="px-6 py-4">
											<div className="flex items-center gap-3">
												<div className={`w-8 h-8 rounded-none flex items-center justify-center font-bold text-xs ${user.role === 'Admin' ? 'bg-[#e8f0fe] text-[#1a73e8]' : user.role === 'Technician' ? 'bg-[#fef7e0] text-[#f9ab00]' : 'bg-[#e6f4ea] text-[#1e8e3e]'}`}>
													{user.fullName.charAt(0)}
												</div>
												<div>
													<p className="font-semibold text-[#202124] dark:text-white text-sm">{user.fullName}</p>
													<p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] font-medium">@{user.username}</p>
												</div>
											</div>
										</td>
										<td className="px-6 py-4">
											<Badge variant={user.role === 'Admin' ? 'brand' : user.role === 'Technician' ? 'warning' : 'success'} size="xs">
												{user.role}
											</Badge>
										</td>
										<td className="px-6 py-4">
											<button
												onClick={() => toggleStatus(user)}
												disabled={user.role === 'Admin'}
												className={`text-[10px] font-bold uppercase tracking-wider ${user.active ? 'text-[#1e8e3e]' : 'text-[#ea4335]'} ${user.role !== 'Admin' ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
											>
												{user.active ? t('users.status.enabled') : t('users.status.disabled')}
											</button>
										</td>
										<td className="px-6 py-4 text-right">
											<div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<button onClick={() => openEdit(user)} className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-none transition-all cursor-pointer"><Edit2 size={16} /></button>
												{user.role !== 'Admin' && (
													<button onClick={() => handleDelete(user)} className="p-2 text-[#ea4335] hover:bg-[#fce8e6] rounded-none transition-all cursor-pointer"><Trash2 size={16} /></button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<Modal
				isOpen={showAdd}
				onClose={closeModal}
				title={editingUser ? t('users.edit') : t('users.new')}
				subtitle={t('users.subtitle')}
				footer={<>
					<Button variant="ghost" onClick={closeModal}>{t('common.close')}</Button>
					<Button variant="primary" onClick={handleSave}>{t('users.save')}</Button>
				</>}
			>
				<form onSubmit={handleSave} className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Input
							label={t('users.fields.full_name')}
							value={formData.fullName}
							onChange={v => setFormData({ ...formData, fullName: v.target.value })}
							required
							autoComplete="name"
						/>
						<Input
							label={t('users.fields.username')}
							value={formData.username}
							onChange={v => setFormData({ ...formData, username: v.target.value })}
							required
							autoComplete="username"
						/>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Input
							label={editingUser ? t('users.fields.new_password') : t('users.fields.password')}
							type="password"
							value={formData.password}
							onChange={v => setFormData({ ...formData, password: v.target.value })}
							required={!editingUser}
							leftIcon={<Lock size={16} />}
							autoComplete="new-password"
						/>
						<div className="flex flex-col space-y-1.5">
							<label className="text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] ml-4">{t('users.fields.role')}</label>
							<select
								className="bg-[#f1f3f4] dark:bg-[#1a1c1e] border-2 border-transparent px-4 py-3 text-sm focus:bg-white dark:focus:bg-[#1a1c1e] focus:border-[#1a73e8] rounded-none outline-none dark:text-white transition-all appearance-none"
								value={formData.role}
								onChange={v => setFormData({ ...formData, role: v.target.value as UserRole })}
							>
								<option value="Admin">{t('users.roles.admin')}</option>
								<option value="Technician">{t('users.roles.technician')}</option>
								<option value="Receptionist">{t('users.roles.receptionist')}</option>
							</select>
						</div>
					</div>
				</form>
			</Modal>
		</div>
	);
};

export default UsersPage;
