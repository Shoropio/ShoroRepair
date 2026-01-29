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
	AlertOctagon
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
import { generateDemoData } from '../lib/demoData';

const SettingsSkeleton: React.FC = () => (
	<div className="space-y-10 animate-in pb-10">
		<div className="space-y-2">
			<div className="h-8 w-64 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />
			<div className="h-4 w-48 bg-[#f1f3f4] dark:bg-[#2d2f31] rounded-none animate-pulse" />
		</div>
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div className="bg-white dark:bg-[#1a1c1e] border border-[#dadce0] dark:border-[#3c4043] rounded-none h-96 animate-pulse" />
			<div className="bg-white dark:bg-[#1a1c1e] border border-[#dadce0] dark:border-[#3c4043] rounded-none h-96 animate-pulse" />
		</div>
	</div>
);

const Settings: React.FC = () => {
	const { t } = useTranslation();
	const { user, updateUser, linkGoogleDrive, unlinkGoogleDrive, googleAccessToken } = useAuth();
	const [company, setCompany] = useState<CompanySettings | null>(null);
	const [profile, setProfile] = useState<Partial<AppUser>>({});
	const [isLoading, setIsLoading] = useState(true);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [showBackupModal, setShowBackupModal] = useState(false);
	const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
	const [backupErrors, setBackupErrors] = useState<string[]>([]);
	const [isRestoring, setIsRestoring] = useState(false);
	const [backupSize, setBackupSize] = useState<string>('');
	const [cloudBackups, setCloudBackups] = useState<any[]>([]);
	const [isCloudLoading, setIsCloudLoading] = useState(false);

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
			await refreshCloudList();
		};
		loadData();
	}, [user]);

	const refreshCloudList = async () => {
		if (user?.role !== 'Admin') return;
		setIsCloudLoading(true);
		try {
			const list = await listCloudBackups();
			setCloudBackups(list);
		} catch (e) {
			console.error(e);
		} finally {
			setIsCloudLoading(false);
		}
	};

	const handleCloudBackup = async () => {
		if (!googleAccessToken) return;

		toast.promise(async () => {
			const { uploadBackupToGoogleDrive } = await import('../utils/backup/backupUtils');
			const success = await uploadBackupToGoogleDrive(googleAccessToken);
			if (!success) throw new Error("No se pudo completar el respaldo");
			return success;
		}, {
			loading: 'Subiendo a Google Drive...',
			success: 'Sincronización completada',
			error: (err) => `Error: ${err.message}`
		});
	};

	const handleRestoreFromCloud = async (url: string) => {
		if (!confirm("¿Restaurar este respaldo?")) return;
		setIsRestoring(true);
		try {
			const data = await getBackupFromCloudUrl(url);
			setBackupPreview(data);
			setBackupErrors([]);
			setShowBackupModal(true);
		} catch (error) {
			toast.error('Error al descargar');
		} finally {
			setIsRestoring(false);
		}
	};

	const handleDeleteCloud = async (url: string) => {
		if (!confirm("¿Eliminar permanentemente?")) return;
		await deleteCloudBackup(url);
		refreshCloudList();
	};

	const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !company) return;
		try {
			const compressed = await compressImage(file, 400, 0.8);
			const path = `settings/logo_${Date.now()}.jpg`;
			const { uploadImage } = await import('../services/upload.service');
			const url = await uploadImage(compressed, path);
			setCompany({ ...company, logo: url });
			toast.success("Logo cargado");
		} catch (err) {
			toast.error("Error al procesar logo");
		}
	};

	const saveCompanySettings = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!company || !company.id) return;
		await db.settings.update(company.id, company);
		if (company.language) {
			i18n.changeLanguage(company.language);
		}
		toast.success("Configuración guardada");
	};

	const updateMyProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !profile.fullName || !profile.password) return;
		const updatedUser = { ...user, fullName: profile.fullName, password: profile.password };
		await db.users.update(user.id!, updatedUser);
		updateUser(updatedUser);
		toast.success("Perfil actualizado");
	};

	const handleExportBackup = async () => {
		await downloadBackup();
	};

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const data = await readBackupFile(file);
			const validation = validateBackup(data);
			if (!validation.valid) {
				setBackupErrors(validation.errors);
			} else {
				setBackupPreview(data);
				setBackupErrors([]);
			}
			setShowBackupModal(true);
		} catch (error: any) {
			toast.error('Error de lectura');
		}
	};

	const handleRestoreBackup = async () => {
		if (!backupPreview) return;
		setIsRestoring(true);
		try {
			const result = await restoreBackup(backupPreview, { skipUsers: false });
			if (result.success) {
				toast.success('Restauración completada');
				setShowBackupModal(false);
				setTimeout(() => window.location.reload(), 1000);
			}
		} catch (error) {
			toast.error('Error en restauración');
		} finally {
			setIsRestoring(false);
		}
	};

	if (isLoading) return <SettingsSkeleton />;

	return (
		<div className="space-y-10 animate-in pb-20">
			<div>
				<h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('settings.title')}</h1>
				<p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">{t('settings.subtitle')}</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
				<Card header={<div className="flex items-center gap-2 font-bold text-sm text-[#3c4043] dark:text-white"><UserIcon size={16} className="text-[#1a73e8]" /> {t('settings.my_account')}</div>}>
					<form onSubmit={updateMyProfile} className="space-y-6">
						<Input label={t('settings.fields.full_name')} value={profile.fullName} onChange={v => setProfile({ ...profile, fullName: v.target.value })} autoComplete="name" />
						<Input label={t('settings.fields.password')} type="password" value={profile.password} onChange={v => setProfile({ ...profile, password: v.target.value })} leftIcon={<Key size={16} />} autoComplete="new-password" />
						<Button type="submit" variant="primary" className="w-full">{t('settings.save_profile')}</Button>
					</form>
				</Card>

				{user?.role === 'Admin' && company && (
					<Card header={<div className="flex items-center gap-2 font-bold text-sm text-[#3c4043] dark:text-white"><ImageIcon size={16} className="text-[#1a73e8]" /> {t('settings.company')}</div>}>
						<form onSubmit={saveCompanySettings} className="space-y-6">
							<div className="flex items-center gap-6 p-4 bg-[#f8f9fa] dark:bg-[#202124] rounded-none">
								<div className="w-16 h-16 bg-white dark:bg-[#1a1c1e] rounded-none border border-[#dadce0] dark:border-[#3c4043] flex items-center justify-center overflow-hidden">
									{company.logo ? <img src={company.logo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon size={24} className="text-[#dadce0]" />}
								</div>
								<Button variant="outline" size="sm" onClick={() => document.getElementById('logo-upload')?.click()}>{t('settings.change_logo')}</Button>
								<input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
							</div>
							<Input label={t('settings.fields.business_name')} value={company.businessName} onChange={v => setCompany({ ...company, businessName: v.target.value })} />
							<div className="grid grid-cols-2 gap-4">
								<Input label={t('settings.fields.tax_id')} value={company.taxId} onChange={v => setCompany({ ...company, taxId: v.target.value })} />
								<div className="flex flex-col space-y-1.5 leading-none">
									<label className="text-xs font-semibold text-[#5f6368] ml-4">{t('settings.fields.color')}</label>
									<input type="color" value={company.accentColor || '#1a73e8'} onChange={v => setCompany({ ...company, accentColor: v.target.value })} className="w-full h-10 rounded-none cursor-pointer bg-transparent border-none" />
								</div>
							</div>
							<Button type="submit" variant="primary" className="w-full">{t('settings.save_company')}</Button>
						</form>
					</Card>
				)}

				{user?.role === 'Admin' && company && (
					<Card header={<div className="flex items-center gap-2 font-bold text-sm text-[#3c4043] dark:text-white"><Globe size={16} className="text-[#1a73e8]" /> {t('settings.language')}</div>}>
						<div className="space-y-6">
							<div className="flex flex-col space-y-1.5">
								<label className="text-xs font-semibold text-[#5f6368] ml-4">{t('settings.select_language')}</label>
								<Select value={company.language || 'es'} onChange={e => setCompany({ ...company, language: e.target.value as 'es' | 'en' })}>
									<option value="es">Español (Costa Rica)</option>
									<option value="en">English (Global)</option>
								</Select>
							</div>
							<Button variant="primary" className="w-full" onClick={saveCompanySettings}>{t('common.save')}</Button>
						</div>
					</Card>
				)}

				{user?.role === 'Admin' && company && (
					<Card className="lg:col-span-2" header={<div className="flex items-center gap-2 font-bold text-sm text-[#3c4043] dark:text-white"><Activity size={16} className="text-[#1a73e8]" /> {t('settings.cloud')}</div>}>
						<form onSubmit={saveCompanySettings} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							<Input label="Firebase API Key" value={company.firebaseApiKey} onChange={e => setCompany({ ...company, firebaseApiKey: e.target.value })} placeholder="AIzaSy..." />
							<Input label="Auth Domain" value={company.firebaseAuthDomain} onChange={e => setCompany({ ...company, firebaseAuthDomain: e.target.value })} placeholder="shororepair.firebaseapp.com" />
							<Input label="Project ID" value={company.firebaseProjectId} onChange={e => setCompany({ ...company, firebaseProjectId: e.target.value })} placeholder="shororepair" />
							<Input label="Storage Bucket" value={company.firebaseStorageBucket} onChange={e => setCompany({ ...company, firebaseStorageBucket: e.target.value })} placeholder="shororepair.appspot.com" />
							<Input label="Messaging Sender ID" value={company.firebaseMessagingSenderId} onChange={e => setCompany({ ...company, firebaseMessagingSenderId: e.target.value })} placeholder="1234567890" />
							<Input label="App ID" value={company.firebaseAppId} onChange={e => setCompany({ ...company, firebaseAppId: e.target.value })} placeholder="1:12345:web:abc" />
							<Input label="Measurement ID (Firebase)" value={company.firebaseMeasurementId} onChange={e => setCompany({ ...company, firebaseMeasurementId: e.target.value })} placeholder="G-ABC123XYZ" />
							<Input label="Google Analytics ID" value={company.googleAnalyticsId} onChange={e => setCompany({ ...company, googleAnalyticsId: e.target.value })} placeholder="UA-XXXXX-Y" />
							<Input label="Gemini AI API Key" value={company.geminiApiKey} onChange={e => setCompany({ ...company, geminiApiKey: e.target.value })} placeholder="AIzaSy..." type="password" />
							<div className="lg:col-span-3 space-y-4">
								<div className="p-4 bg-[#fef7e0] dark:bg-[#fbbc04]/10 rounded-none border border-[#f9ab00]/20">
									<h5 className="text-xs font-bold text-[#f9ab00] flex items-center gap-2 mb-2 uppercase tracking-wide">
										<Info size={14} className="inline mr-1 -mt-0.5" /> {t('settings.firebase_guide')}
									</h5>
									<ol className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] list-decimal ml-4 space-y-1">
										<li>{t('settings.firebase_steps.step1')} <a href="https://console.firebase.google.com" target="_blank" className="text-[#1a73e8] underline">Firebase Console</a>.</li>
										<li>{t('settings.firebase_steps.step2')} <b>Authentication</b> (Google Provider) y <b>Firestore Database</b>.</li>
										<li>{t('settings.firebase_steps.step3')} <b>Web App</b> en la configuración del proyecto para obtener tus claves.</li>
										<li>{t('settings.firebase_steps.step4')}</li>
									</ol>
								</div>
								<Button type="submit" variant="primary" className="w-full">{t('settings.sync_cloud')}</Button>
								<p className="text-[10px] text-[#5f6368] mt-3 text-center italic">{t('settings.restart_required')}</p>
							</div>
						</form>
					</Card>
				)}

				{user?.role === 'Admin' && (
					<div className="pt-20">
						<div className="flex items-center gap-3 mb-6 p-4 bg-red-50 dark:bg-red-900/10 rounded-none border border-red-100 dark:border-red-900/20">
							<AlertOctagon className="text-red-500" size={24} />
							<div>
								<h2 className="text-lg font-bold text-red-600 dark:text-red-400 uppercase tracking-tighter">{t('settings.danger_zone')}</h2>
								<p className="text-xs text-red-500/70 font-medium">{t('settings.danger_zone_desc', 'Estas acciones son irreversibles y afectarán permanentemente tu base de datos.')}</p>
							</div>
						</div>

						<Card className="border-red-100 dark:border-red-900/20 overflow-hidden" header={<div className="flex items-center gap-2 font-bold text-sm text-red-600"><AlertTriangle size={16} /> {t('settings.critical_data')}</div>}>
							<div className="divide-y divide-red-50 dark:divide-red-900/10">
								<div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
									<div className="space-y-1">
										<p className="font-bold text-[#202124] dark:text-white text-sm">{t('settings.factory_reset')}</p>
										<p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">{t('settings.factory_reset_desc')}</p>
									</div>
									<Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={async () => { if (confirm("🚨 ATENCIÓN: Se borrarán TODOS los datos locales. ¿Deseas continuar?")) { if (confirm("⚠️ ¿REALMENTE ESTÁS SEGURO? Esta acción es irreversible.")) { await db.delete(); localStorage.clear(); window.location.href = '/'; } } }}>Factory Reset</Button>
								</div>
							</div>
						</Card>
					</div>
				)}

			</div>

			<Modal isOpen={showBackupModal} onClose={() => setShowBackupModal(false)} title="Restauración" footer={<><Button variant="ghost" onClick={() => setShowBackupModal(false)}>Cerrar</Button>{backupPreview && !backupErrors.length && <Button variant="primary" onClick={handleRestoreBackup}>Restaurar</Button>}</>}>
				{backupErrors.length ? <div className="bg-[#fce8e6] p-4 rounded-none text-xs text-[#ea4335]">{t('settings.errors')}: {backupErrors.join(', ')}</div> : backupPreview && (
					<div className="space-y-4">
						<div className="p-4 bg-[#e8f0fe] rounded-none flex items-center gap-3"><CheckCircle2 className="text-[#1a73e8]" size={20} /><p className="text-sm font-bold text-[#1a73e8]">{t('settings.valid_file')}</p></div>
						<p className="text-xs text-[#f9ab00] font-bold p-3 bg-[#fef7e0] rounded-none">{t('settings.restore_warning')}</p>
					</div>
				)}
			</Modal>

		</div>
	);
};

export default Settings;
