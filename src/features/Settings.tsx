import React, { useEffect, useState, useRef } from 'react';
import {
	Database,
	Download,
	Upload,
	Mail,
	User as UserIcon,
	HardDrive,
	CheckCircle2,
	AlertTriangle,
	FileJson,
	RefreshCw,
	Cloud,
	Trash2,
	ImageIcon,
	Sparkles,
	Key,
	Globe,
	Activity,
	Info,
	ExternalLink,
	AlertOctagon,
	Shield,
	Smartphone,
	Cpu,
	Zap,
	Lock,
	Settings as SettingsIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { db } from '../offline/db';
import { CompanySettings, AppUser } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button, Input, Card, Modal, Badge, Select } from '../components';
import {
	getEstimatedBackupSize,
	BackupData,
	uploadBackupToCloud,
	validateBackup,
	listCloudBackups,
	getBackupFromCloudUrl,
	deleteCloudBackup,
	downloadBackup,
	readBackupFile,
	restoreBackup,
	formatBackupDate
} from '../utils/backup/backupUtils';
import { compressImage } from '../services/upload.service';
import { cleanAllDuplicates } from '../offline/conflict';

const Settings: React.FC = () => {
	const { t } = useTranslation();
	const { user, updateUser, linkGoogleDrive, unlinkGoogleDrive, googleAccessToken } = useAuth();
	const [company, setCompany] = useState<CompanySettings | null>(null);
	const [profile, setProfile] = useState<Partial<AppUser>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'cloud' | 'advanced'>('profile');

	const [showBackupModal, setShowBackupModal] = useState(false);
	const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
	const [backupErrors, setBackupErrors] = useState<string[]>([]);
	const [isRestoring, setIsRestoring] = useState(false);
	const [backupSize, setBackupSize] = useState<string>('');

	useEffect(() => {
		const loadData = async () => {
			const settings = await db.settings.toArray();
			setCompany(settings[0] || null);
			if (user) {
				setProfile({ fullName: user.fullName, password: user.password });
			}
			setIsLoading(false);
			const size = await getEstimatedBackupSize();
			setBackupSize(size);
		};
		loadData();
	}, [user]);

	const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !company) return;
		try {
			const compressed = await compressImage(file, 400, 0.8);
			const path = `settings/logo_${Date.now()}.jpg`;
			const { uploadImage } = await import('../services/upload.service');
			const url = await uploadImage(compressed, path);
			setCompany({ ...company, logo: url });
			toast.success(t('settings.logo_updated'));
		} catch (err) {
			toast.error(t('settings.logo_error'));
		}
	};

	const saveCompanySettings = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!company || !company.id) return;
		await db.settings.update(company.id, { ...company, updatedAt: Date.now(), synced: 0 });
		if (company.language) {
			i18n.changeLanguage(company.language);
		}
		toast.success(t('settings.global_sync'));
	};

	const updateMyProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !profile.fullName || !profile.password) return;
		const updatedUser = { ...user, fullName: profile.fullName, password: profile.password };
		await db.users.update(user.id!, { ...updatedUser, updatedAt: Date.now(), synced: 0 });
		updateUser(updatedUser);
		toast.success(t('settings.profile_updated'));
	};

	if (isLoading) return <div className="p-20 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest text-xs">{t('settings.loading')}</div>;

	const navItems = [
		{ id: 'profile', label: t('settings.tabs.profile'), icon: UserIcon },
		{ id: 'company', label: t('settings.tabs.organization'), icon: Shield, adminOnly: true },
		{ id: 'cloud', label: t('settings.tabs.cloud_ai'), icon: Cloud, adminOnly: true },
		{ id: 'advanced', label: t('settings.tabs.advanced'), icon: Database, adminOnly: true }
	];

	return (
		<div className="space-y-6 lg:space-y-10 animate-in pb-12 lg:pb-20">
			{/* Premium Settings Header */}
			<header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-[#1a1c1e] p-6 lg:p-8 rounded-none shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
				<div className="relative z-10">
					<h1 className="text-2xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
						<SettingsIcon className="text-[#1a73e8]" size={28} />
						{t('settings.title')}
					</h1>
					<p className="text-xs lg:text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
						{t('settings.subtitle_desc')}
					</p>
				</div>
				<div className="flex bg-[#f1f3f4] dark:bg-white/5 p-1 rounded-none relative z-10 border border-gray-200 dark:border-white/5 shadow-inner">
					{navItems.map(item => {
						if (item.adminOnly && user?.role !== 'Admin') return null;
						const Icon = item.icon;
						return (
							<button
								key={item.id}
								onClick={() => setActiveTab(item.id as any)}
								className={`px-4 lg:px-6 py-2 rounded-none text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === item.id ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
							>
								<Icon size={14} />
								<span className="hidden sm:inline">{item.label}</span>
							</button>
						);
					})}
				</div>
			</header>

			<div className="max-w-5xl mx-auto space-y-6 lg:space-y-8">
				{activeTab === 'profile' && (
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
						<Card className="lg:col-span-1 p-6 rounded-none shadow-xl border-none">
							<div className="flex flex-col items-center py-6">
								<div className="w-20 h-20 lg:w-24 lg:h-24 rounded-none bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center text-blue-600 border-4 border-white dark:border-white/5 shadow-xl mb-6">
									<UserIcon size={32} />
								</div>
								<h3 className="text-lg font-bold uppercase tracking-tight">{user?.fullName}</h3>
								<Badge variant="brand" className="mt-2">{t(`users.roles.${user?.role.toLowerCase()}`)}</Badge>
							</div>
						</Card>

						<Card className="lg:col-span-2 p-6 rounded-none shadow-xl border-none">
							<div className="flex items-center gap-3 mb-6">
								<Info className="text-blue-500" size={18} />
								<h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t('settings.profile_credentials')}</h3>
							</div>
							<form onSubmit={updateMyProfile} className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
									<Input label={t('common.name')} value={profile.fullName} onChange={v => setProfile({ ...profile, fullName: v.target.value })} />
									<Input label={t('users.fields.password')} type="password" value={profile.password} onChange={v => setProfile({ ...profile, password: v.target.value })} leftIcon={<Lock size={16} />} />
								</div>
								<div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-end">
									<Button type="submit" variant="primary" className="rounded-none px-6 lg:px-8 py-3 shadow-lg shadow-blue-500/10 font-bold uppercase tracking-widest text-[10px]">{t('settings.update_profile')}</Button>
								</div>
							</form>
						</Card>
					</div>
				)}

				{activeTab === 'company' && company && (
					<form onSubmit={saveCompanySettings} className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
						<Card className="lg:col-span-8 p-6 lg:p-10 rounded-none shadow-xl border-none space-y-8">
							<div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-white/5">
								<Shield className="text-blue-500" size={18} />
								<h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t('settings.corporate_info')}</h3>
							</div>

							<div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-gray-50 dark:bg-white/5 rounded-none border border-dashed border-gray-200 dark:border-white/10 mb-6">
								<div className="w-16 h-16 lg:w-20 lg:h-20 bg-white dark:bg-[#1a1c1e] rounded-none shadow-xl border-4 border-white flex items-center justify-center overflow-hidden shrink-0">
									{company.logo ? <img src={company.logo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon size={24} className="text-gray-200" />}
								</div>
								<div className="space-y-2 text-center md:text-left">
									<h4 className="font-bold text-xs uppercase tracking-widest text-gray-700 dark:text-gray-300">{t('settings.company_logo')}</h4>
									<p className="text-[10px] text-gray-500 font-medium">{t('settings.logo_desc')}</p>
									<Button variant="outline" size="sm" className="rounded-none font-bold text-[10px] py-1.5 px-3" onClick={() => document.getElementById('logo-upload')?.click()}>{t('settings.choose_image')}</Button>
									<input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
								<Input label={t('settings.business_name')} value={company.businessName} onChange={v => setCompany({ ...company, businessName: v.target.value })} />
								<Input label={t('settings.tax_identity')} value={company.taxId} onChange={v => setCompany({ ...company, taxId: v.target.value })} />
								<Select label={t('settings.system_language')} value={company.language || 'es'} onChange={e => setCompany({ ...company, language: e.target.value as 'es' | 'en' })}>
									<option value="es">{t('settings.lang_es')}</option>
									<option value="en">{t('settings.lang_en')}</option>
								</Select>
								<div className="space-y-2">
									<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">{t('settings.brand_color')}</label>
									<div className="flex items-center gap-4 bg-gray-100 dark:bg-white/5 p-2 rounded-none h-10">
										<div className="w-6 h-6 rounded-none shadow-sm" style={{ backgroundColor: company.accentColor || '#1a73e8' }}></div>
										<input type="text" value={company.accentColor || '#1a73e8'} onChange={v => setCompany({ ...company, accentColor: v.target.value })} className="flex-1 bg-transparent border-none text-[10px] font-black uppercase tracking-tighter text-gray-700 outline-none" />
									</div>
								</div>
							</div>
							<div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-end">
								<Button type="submit" variant="primary" className="rounded-none px-10 py-3 shadow-lg shadow-blue-500/10 font-bold uppercase tracking-widest text-[10px]">{t('settings.save_changes')}</Button>
							</div>
						</Card>

						<Card className="lg:col-span-4 p-6 rounded-none shadow-xl border-none space-y-6">
							<div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-white/5">
								<Info className="text-blue-500" size={18} />
								<h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t('settings.about')}</h3>
							</div>
							<div className="space-y-4">
								<div className="flex items-center gap-3">
									<Smartphone size={16} className="text-gray-400" />
									<p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('settings.app_version')}: <span className="font-bold text-[#1a73e8]">v1.0.0</span></p>
								</div>
								<div className="flex items-center gap-3">
									<Cpu size={16} className="text-gray-400" />
									<p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('settings.db_engine')}: <span className="font-bold text-[#1a73e8]">Dexie.js</span></p>
								</div>
								<div className="flex items-center gap-3">
									<Globe size={16} className="text-gray-400" />
									<p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('common.date')}: <span className="font-bold text-[#1a73e8]">{company.language === 'es' ? t('settings.lang_es') : t('settings.lang_en')}</span></p>
								</div>
							</div>
						</Card>
					</form>
				)}

				{activeTab === 'cloud' && company && (
					<form onSubmit={saveCompanySettings} className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
						<Card className="lg:col-span-8 p-6 lg:p-10 rounded-none shadow-xl border-none space-y-8">
							<div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-white/5">
								<Cloud className="text-blue-500" size={18} />
								<h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t('settings.cloud_ai_services')}</h3>
							</div>

							<div className="p-5 lg:p-8 bg-blue-50/10 dark:bg-blue-900/5 rounded-none border border-blue-100/50 dark:border-blue-900/20 space-y-6 mb-10">
								<div className="flex items-center gap-3 text-[#1a73e8]">
									<Sparkles size={18} />
									<h4 className="font-bold text-xs uppercase tracking-widest">{t('settings.ai_title')}</h4>
								</div>
								<p className="text-xs text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
									{t('settings.ai_desc')}
								</p>
								<Input label="Google Gemini API Key" type="password" value={company.geminiApiKey} onChange={e => setCompany({ ...company, geminiApiKey: e.target.value })} placeholder={t('ai.write_symptoms')} leftIcon={<Key size={16} />} />
								<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[10px] font-black text-[#1a73e8] uppercase hover:underline">
									{t('settings.get_api_key')} <ExternalLink size={12} />
								</a>
							</div>

							<div className="space-y-6">
								<div className="flex items-center gap-3 text-gray-600">
									<Database size={18} />
									<h4 className="font-bold text-xs uppercase tracking-widest">{t('settings.firebase_infra')}</h4>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
									<Input label="Project ID" value={company.firebaseProjectId} onChange={e => setCompany({ ...company, firebaseProjectId: e.target.value })} />
									<Input label="App ID" value={company.firebaseAppId} onChange={e => setCompany({ ...company, firebaseAppId: e.target.value })} />
									<Input label="API Key" type="password" value={company.firebaseApiKey} onChange={e => setCompany({ ...company, firebaseApiKey: e.target.value })} />
									<Input label="Storage Bucket" value={company.firebaseStorageBucket} onChange={e => setCompany({ ...company, firebaseStorageBucket: e.target.value })} />
								</div>
							</div>

							<div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-end">
								<Button type="submit" variant="primary" className="rounded-none px-10 py-3 shadow-lg shadow-blue-500/10 font-bold uppercase tracking-widest text-[10px]">{t('settings.update_services')}</Button>
							</div>
						</Card>

						<Card className="lg:col-span-4 p-6 rounded-none shadow-xl border-none space-y-6">
							<div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-white/5 text-amber-600">
								<AlertOctagon size={18} />
								<h3 className="text-[10px] font-black uppercase tracking-widest">{t('settings.advertencia')}</h3>
							</div>
							<p className="text-[10px] font-bold text-amber-700/80 leading-relaxed uppercase">
								{t('settings.firebase_warning')}
							</p>
						</Card>
					</form>
				)}

				{activeTab === 'advanced' && (
					<div className="space-y-6 lg:space-y-8 animate-in slide-in-from-bottom-4">
						<Card className="p-6 lg:p-10 rounded-none shadow-xl border-none" header={<div className="flex items-center gap-4 mb-6 lg:mb-8"><div className="p-3 bg-red-50 text-red-600 rounded-none"><Zap size={24} /></div><div><h3 className="text-lg font-bold text-[#202124] dark:text-white uppercase tracking-tight">{t('settings.maint_zone')}</h3><p className="text-[10px] text-gray-500 font-bold uppercase">{t('settings.maint_subtitle')}</p></div></div>}>
							<div className="space-y-4 lg:space-y-6">
								<div className="flex items-center justify-between p-4 lg:p-6 bg-gray-50 dark:bg-white/5 rounded-none border border-gray-100 dark:border-white/10">
									<div className="space-y-1">
										<p className="font-bold text-sm uppercase text-gray-700 dark:text-white">{t('settings.manual_backup')}</p>
										<p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('settings.estimated_size')}: {backupSize}</p>
									</div>
									<Button variant="outline" className="rounded-none px-4 lg:px-6 py-2 font-bold uppercase text-[10px]" onClick={() => downloadBackup()} leftIcon={<Download size={14} />}>{t('settings.export_sqlite')}</Button>
								</div>

								<div className="flex items-center justify-between p-4 lg:p-6 bg-red-50/50 dark:bg-red-900/5 rounded-none border border-red-100 dark:border-red-900/20">
									<div className="space-y-1">
										<p className="font-bold text-sm uppercase text-red-600">{t('settings.factory_reset_title')}</p>
										<p className="text-[10px] font-bold text-red-400 uppercase tracking-tighter">{t('settings.factory_reset_subtitle')}</p>
									</div>
									<Button variant="outline" className="rounded-none px-4 lg:px-6 py-2 font-bold uppercase text-[10px] border-red-200 text-red-600 hover:bg-red-50" onClick={async () => {
										if (window.confirm(t('settings.confirm_factory_1'))) {
											if (window.confirm(t('settings.confirm_factory_2'))) {
												await db.delete();
												localStorage.clear();
												window.location.href = '/';
											}
										}
									}}>{t('settings.factory_reset')}</Button>
								</div>
							</div>
						</Card>

						<div className="p-6 bg-amber-50 dark:bg-amber-900/5 rounded-none border border-amber-100 dark:border-amber-900/20 flex gap-4">
							<AlertTriangle size={20} className="text-amber-500 shrink-0" />
							<div className="space-y-1">
								<h4 className="font-bold text-[10px] uppercase text-amber-700 tracking-widest">{t('settings.cloud_security_protocol')}</h4>
								<p className="text-[9px] lg:text-[10px] font-medium text-amber-700/80 leading-relaxed uppercase">
									{t('settings.cloud_security_desc')}
								</p>
							</div>
						</div>
					</div>
				)}
			</div>

			<Modal
				isOpen={showBackupModal}
				onClose={() => setShowBackupModal(false)}
				title={t('settings.restore_console')}
				size="xl"
				footer={<div className="flex gap-4 px-6 lg:px-8 pb-6"><Button variant="ghost" onClick={() => setShowBackupModal(false)}>{t('settings.abort')}</Button>{backupPreview && !backupErrors.length && <Button variant="primary" onClick={() => { }}>{t('settings.start')}</Button>}</div>}
			>
				{backupErrors.length ? (
					<div className="p-4 lg:p-6 bg-red-50 text-red-600 rounded-none flex gap-3 items-center">
						<AlertTriangle size={20} />
						<p className="text-xs font-black uppercase tracking-widest">{t('messages.error')}: {backupErrors[0]}</p>
					</div>
				) : backupPreview && (
					<div className="space-y-6">
						<div className="p-4 lg:p-6 bg-blue-50 text-[#1a73e8] rounded-none flex gap-3 items-center">
							<CheckCircle2 size={24} />
							<div>
								<p className="text-sm font-black uppercase tracking-widest">{t('settings.data_capsule_detected')}</p>
								<p className="text-[10px] font-bold opacity-70">{formatBackupDate(backupPreview.timestamp)}</p>
							</div>
						</div>
						<div className="p-4 lg:p-6 border-2 border-dashed border-amber-200 bg-amber-50/50 rounded-none text-amber-700">
							<p className="text-[10px] font-bold leading-relaxed uppercase">
								{t('settings.overwrite_warning')}
							</p>
						</div>
					</div>
				)}
			</Modal>
		</div>
	);
};

export default Settings;
