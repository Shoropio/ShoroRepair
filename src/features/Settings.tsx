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
			toast.success("Logo actualizado en nube");
		} catch (err) {
			toast.error("Error al procesar logo");
		}
	};

	const saveCompanySettings = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!company || !company.id) return;
		await db.settings.update(company.id, { ...company, updatedAt: Date.now(), synced: 0 });
		if (company.language) {
			i18n.changeLanguage(company.language);
		}
		toast.success("Configuración global sincronizada");
	};

	const updateMyProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !profile.fullName || !profile.password) return;
		const updatedUser = { ...user, fullName: profile.fullName, password: profile.password };
		await db.users.update(user.id!, { ...updatedUser, updatedAt: Date.now(), synced: 0 });
		updateUser(updatedUser);
		toast.success("Perfil de operador actualizado");
	};

	if (isLoading) return <div className="p-20 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando Preferencias...</div>;

	const navItems = [
		{ id: 'profile', label: 'Mi Perfil', icon: UserIcon },
		{ id: 'company', label: 'Organización', icon: Shield, adminOnly: true },
		{ id: 'cloud', label: 'Nube & AI', icon: Cloud, adminOnly: true },
		{ id: 'advanced', label: 'Avanzado', icon: Database, adminOnly: true }
	];

	return (
		<div className="space-y-10 animate-in pb-20">
			{/* Premium Settings Header */}
			<header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-[2.5rem] shadow-xl shadow-blue-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
				<div className="relative z-10">
					<h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
						<SettingsIcon className="text-[#1a73e8]" size={32} />
						{t('settings.title')}
					</h1>
					<p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
						Configura la identidad de tu negocio, claves de IA y parámetros del sistema.
					</p>
				</div>
				<div className="flex bg-[#f1f3f4] dark:bg-white/5 p-1.5 rounded-[1.8rem] relative z-10 border border-gray-200 dark:border-white/5 shadow-inner">
					{navItems.map(item => {
						if (item.adminOnly && user?.role !== 'Admin') return null;
						const Icon = item.icon;
						return (
							<button
								key={item.id}
								onClick={() => setActiveTab(item.id as any)}
								className={`px-6 py-3 rounded-[1.3rem] text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === item.id ? 'bg-white dark:bg-[#1a1c1e] text-[#1a73e8] shadow-lg' : 'text-gray-500 hover:text-gray-700'}`}
							>
								<Icon size={16} />
								<span className="hidden sm:inline">{item.label}</span>
							</button>
						);
					})}
				</div>
			</header>

			<div className="max-w-4xl mx-auto space-y-8">
				{activeTab === 'profile' && (
					<Card className="p-10 rounded-[3rem] shadow-2xl shadow-black/5 border-[#f1f3f4] dark:border-white/5" header={<div className="flex items-center gap-4 mb-8"><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><UserIcon size={24} /></div><div><h3 className="text-xl font-black text-[#202124] dark:text-white uppercase tracking-tight">Identidad del Operador</h3><p className="text-xs text-gray-500 font-bold uppercase">Actualiza tus credenciales personales</p></div></div>}>
						<form onSubmit={updateMyProfile} className="space-y-8">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
								<Input label="Nombre Completo" value={profile.fullName} onChange={v => setProfile({ ...profile, fullName: v.target.value })} />
								<Input label="Contraseña Actualizada" type="password" value={profile.password} onChange={v => setProfile({ ...profile, password: v.target.value })} leftIcon={<Lock size={16} />} />
							</div>
							<div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-end">
								<Button type="submit" variant="primary" className="rounded-2xl px-10 py-4 shadow-lg shadow-blue-500/10 font-black uppercase tracking-widest text-[11px]">Actualizar mi perfil</Button>
							</div>
						</form>
					</Card>
				)}

				{activeTab === 'company' && company && (
					<Card className="p-10 rounded-[3rem] shadow-2xl shadow-black/5 border-[#f1f3f4] dark:border-white/5" header={<div className="flex items-center gap-4 mb-8"><div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Shield size={24} /></div><div><h3 className="text-xl font-black text-[#202124] dark:text-white uppercase tracking-tight">Estudio / Taller</h3><p className="text-xs text-gray-500 font-bold uppercase">Identidad corporativa y facturación</p></div></div>}>
						<form onSubmit={saveCompanySettings} className="space-y-10">
							<div className="flex flex-col md:flex-row items-center gap-10 p-8 bg-gray-50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/10">
								<div className="w-24 h-24 bg-white dark:bg-[#1a1c1e] rounded-[1.5rem] shadow-2xl border-4 border-white flex items-center justify-center overflow-hidden shrink-0">
									{company.logo ? <img src={company.logo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon size={40} className="text-gray-200" />}
								</div>
								<div className="space-y-4 text-center md:text-left">
									<h4 className="font-black text-sm uppercase tracking-widest text-gray-700 dark:text-gray-300">Logo de la Empresa</h4>
									<p className="text-[11px] text-gray-500 font-medium">Se recomienda una imagen cuadrada de fondo blanco o transparente (PNG/JPG).</p>
									<Button variant="outline" size="sm" className="rounded-xl font-black uppercase text-[10px]" onClick={() => document.getElementById('logo-upload')?.click()}>Elegir nueva imagen</Button>
									<input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
								<Input label="Nombre Comercial" value={company.businessName} onChange={v => setCompany({ ...company, businessName: v.target.value })} />
								<Input label="ID Tributaria / Cédula" value={company.taxId} onChange={v => setCompany({ ...company, taxId: v.target.value })} />
								<Select label="Idioma del Sistema" value={company.language || 'es'} onChange={e => setCompany({ ...company, language: e.target.value as 'es' | 'en' })}>
									<option value="es">Español (Latam)</option>
									<option value="en">English (US)</option>
								</Select>
								<div className="space-y-2">
									<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Color de Marca</label>
									<div className="flex items-center gap-4 bg-gray-100 dark:bg-white/5 p-2 rounded-2xl h-12">
										<div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: company.accentColor || '#1a73e8' }}></div>
										<input type="text" value={company.accentColor || '#1a73e8'} onChange={v => setCompany({ ...company, accentColor: v.target.value })} className="flex-1 bg-transparent border-none text-xs font-black uppercase tracking-tighter text-gray-700 outline-none" />
									</div>
								</div>
							</div>
							<div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-end">
								<Button type="submit" variant="primary" className="rounded-2xl px-10 py-4 shadow-lg shadow-blue-500/10 font-black uppercase tracking-widest text-[11px]">Guardar Organización</Button>
							</div>
						</form>
					</Card>
				)}

				{activeTab === 'cloud' && company && (
					<Card className="p-10 rounded-[3rem] shadow-2xl shadow-black/5 border-[#f1f3f4] dark:border-white/5" header={<div className="flex items-center gap-4 mb-8"><div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Cloud size={24} /></div><div><h3 className="text-xl font-black text-[#202124] dark:text-white uppercase tracking-tight">Servicios Cloud & AI</h3><p className="text-xs text-gray-500 font-bold uppercase">Gemini AI y Sincronización Firebase</p></div></div>}>
						<form onSubmit={saveCompanySettings} className="space-y-10">
							<div className="p-8 bg-blue-50/50 dark:bg-blue-900/5 rounded-[2rem] border border-blue-100 dark:border-blue-900/20 space-y-4">
								<div className="flex items-center gap-3 text-[#1a73e8]">
									<Sparkles size={20} />
									<h4 className="font-black text-sm uppercase tracking-widest">Inteligencia Artificial (Google Gemini)</h4>
								</div>
								<p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
									Activa el asistente técnico de reparaciones ingresando tu API Key de Google AI Studio. Esto habilita diagnósticos automáticos y sugerencias de reparación.
								</p>
								<Input label="Google Gemini API Key" type="password" value={company.geminiApiKey} onChange={e => setCompany({ ...company, geminiApiKey: e.target.value })} placeholder="Ingresa tu clave de AI Studio..." leftIcon={<Key size={16} />} />
								<a href="https://aistudio.google.com/app/apikey" target="_blank" className="inline-flex items-center gap-2 text-[10px] font-black text-[#1a73e8] uppercase hover:underline">
									Obtener mi API Key <ExternalLink size={12} />
								</a>
							</div>

							<div className="space-y-6">
								<div className="flex items-center gap-3 text-gray-600">
									<Database size={20} />
									<h4 className="font-black text-sm uppercase tracking-widest">Infraestructura Firebase</h4>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<Input label="Project ID" value={company.firebaseProjectId} onChange={e => setCompany({ ...company, firebaseProjectId: e.target.value })} />
									<Input label="App ID" value={company.firebaseAppId} onChange={e => setCompany({ ...company, firebaseAppId: e.target.value })} />
									<Input label="API Key" type="password" value={company.firebaseApiKey} onChange={e => setCompany({ ...company, firebaseApiKey: e.target.value })} />
									<Input label="Storage Bucket" value={company.firebaseStorageBucket} onChange={e => setCompany({ ...company, firebaseStorageBucket: e.target.value })} />
								</div>
							</div>

							<div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-end">
								<Button type="submit" variant="primary" className="rounded-2xl px-10 py-4 shadow-lg shadow-blue-500/10 font-black uppercase tracking-widest text-[11px]">Sincronizar Servicios</Button>
							</div>
						</form>
					</Card>
				)}

				{activeTab === 'advanced' && (
					<div className="space-y-8">
						<Card className="p-10 rounded-[3rem] shadow-2xl shadow-black/5 border-[#f1f3f4] dark:border-white/5" header={<div className="flex items-center gap-4 mb-8"><div className="p-3 bg-red-50 text-red-600 rounded-2xl"><Zap size={24} /></div><div><h3 className="text-xl font-black text-[#202124] dark:text-white uppercase tracking-tight">Zona de Mantenimiento</h3><p className="text-xs text-gray-500 font-bold uppercase">Herramientas críticas del sistema</p></div></div>}>
							<div className="space-y-6">
								<div className="flex items-center justify-between p-6 bg-gray-50 dark:bg-white/5 rounded-[2rem] border border-gray-100 dark:border-white/10">
									<div className="space-y-1">
										<p className="font-black text-sm uppercase text-gray-700 dark:text-white">Respaldo Manual del Sistema</p>
										<p className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter">Tamaño estimado: {backupSize}</p>
									</div>
									<Button variant="outline" className="rounded-xl px-6 font-black uppercase text-[10px]" onClick={() => downloadBackup()} leftIcon={<Download size={14} />}>Exportar SQLITE/JSON</Button>
								</div>

								<div className="flex items-center justify-between p-6 bg-red-50/50 dark:bg-red-900/5 rounded-[2rem] border border-red-100 dark:border-red-900/20">
									<div className="space-y-1">
										<p className="font-black text-sm uppercase text-red-600">Restablecimiento Maestro</p>
										<p className="text-[11px] font-bold text-red-400 uppercase tracking-tighter">Esto eliminará absolutamente todo de forma local</p>
									</div>
									<Button variant="outline" className="rounded-xl px-6 font-black uppercase text-[10px] border-red-200 text-red-600 hover:bg-red-50" onClick={async () => {
										if (confirm("🚨 ATENCIÓN: Se borrarán TODOS los datos locales. ¿Deseas continuar?")) {
											if (confirm("⚠️ ¿REALMENTE ESTÁS SEGURO? Esta acción es irreversible.")) {
												await db.delete();
												localStorage.clear();
												window.location.href = '/';
											}
										}
									}}>Factory Reset</Button>
								</div>
							</div>
						</Card>

						<div className="p-8 bg-amber-50 dark:bg-amber-900/5 rounded-[2.5rem] border border-amber-100 dark:border-amber-900/20 flex gap-4">
							<AlertTriangle size={24} className="text-amber-500 shrink-0" />
							<div className="space-y-1">
								<h4 className="font-black text-xs uppercase text-amber-700 tracking-widest">Aviso de Seguridad</h4>
								<p className="text-[10px] font-medium text-amber-700/80 leading-relaxed uppercase">
									Los cambios realizados en los servicios Cloud requieren el reinicio completo de la aplicación para que las nuevas claves de seguridad sean inyectadas en el entorno técnico.
								</p>
							</div>
						</div>
					</div>
				)}
			</div>

			<Modal
				isOpen={showBackupModal}
				onClose={() => setShowBackupModal(false)}
				title="Consola de Restauración"
				size="xl"
				footer={<div className="flex gap-4 px-8 pb-6"><Button variant="ghost" onClick={() => setShowBackupModal(false)}>Abortar</Button>{backupPreview && !backupErrors.length && <Button variant="primary" onClick={() => { }}>Iniciar Restauración</Button>}</div>}
			>
				{backupErrors.length ? (
					<div className="p-6 bg-red-50 text-red-600 rounded-2xl flex gap-3 items-center">
						<AlertTriangle size={20} />
						<p className="text-xs font-black uppercase tracking-widest">Archivo Inválido: {backupErrors[0]}</p>
					</div>
				) : backupPreview && (
					<div className="space-y-6">
						<div className="p-6 bg-blue-50 text-[#1a73e8] rounded-2xl flex gap-3 items-center">
							<CheckCircle2 size={24} />
							<div>
								<p className="text-sm font-black uppercase tracking-widest leading-none">Cápsula de Datos Detectada</p>
								<p className="text-[10px] font-bold opacity-70">Timestamp: {formatBackupDate(backupPreview.timestamp)}</p>
							</div>
						</div>
						<div className="p-6 border-2 border-dashed border-amber-200 bg-amber-50/50 rounded-2xl text-amber-700">
							<p className="text-xs font-bold leading-relaxed uppercase">
								Se procederá a sobrescribir la base de datos actual. Todos los registros locales actuales se perderán en favor de este respaldo.
							</p>
						</div>
					</div>
				)}
			</Modal>
		</div>
	);
};

export default Settings;
