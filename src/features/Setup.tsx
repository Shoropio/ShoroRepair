import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	Shield,
	User,
	Lock,
	Mail,
	Check,
	ArrowRight,
	Building,
	Cloud,
	Sparkles,
	Zap,
	History,
	Key,
	Smartphone,
	Database,
	Globe,
	ShieldCheck
} from 'lucide-react';
import { Card, Input, Button } from '../components';
import { db } from '../offline/db';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { syncManager } from '../offline/sync';

const Setup: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { login, linkGoogleDrive, googleAccessToken, loginWithGoogle } = useAuth();

	const [step, setStep] = useState(1);
	const [isLoading, setIsLoading] = useState(false);

	const [formData, setFormData] = useState({
		fullName: '',
		username: '',
		password: '',
		confirmPassword: '',
		businessName: 'ShoroRepair Business',
	});

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData(prev => ({ ...prev, [name]: value }));
	};

	const handleCreateAdmin = async () => {
		if (!formData.fullName || !formData.username || !formData.password) {
			toast.error("Complete el perfil operacional");
			return;
		}

		if (formData.password !== formData.confirmPassword) {
			toast.error("Las firmas de seguridad no coinciden");
			return;
		}

		setIsLoading(true);
		try {
			await db.users.add({
				fullName: formData.fullName,
				username: formData.username,
				password: formData.password,
				role: 'Admin',
				active: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				synced: 0
			});

			const settings = await db.settings.toArray();
			if (settings.length > 0 && settings[0].id) {
				await db.settings.update(settings[0].id, { businessName: formData.businessName });
			} else {
				await db.settings.add({
					businessName: formData.businessName,
					legalName: formData.businessName + ' S.A.',
					taxId: 'ID-PENDIENTE',
					address: 'Configure su dirección',
					phone: '',
					email: '',
					invoicePrefix: 'FAC',
					nextInvoiceNumber: 1,
					inactivityTimeout: 5,
					cloudSetupCompleted: !!googleAccessToken,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					synced: 0
				});
			}

			await login(formData.username, formData.password);
			setStep(3);
		} catch (error) {
			toast.error("Fallo estructural en el despliegue");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCloudLink = async () => {
		try {
			const token = await linkGoogleDrive();
			if (token) {
				const settings = await db.settings.toArray();
				if (settings.length > 0 && settings[0].id) {
					await db.settings.update(settings[0].id, { cloudSetupCompleted: true });
				}
				toast.success("Enlace Cloud Establecido");
			}
		} catch (e) {
			toast.error("Error de comunicación Google API");
		}
	};

	const handleRestore = async () => {
		setIsLoading(true);
		try {
			const success = await loginWithGoogle();
			if (success) {
				toast.info("Descargando respaldo de arquitectura...");
				localStorage.removeItem('lastSync_users');
				localStorage.removeItem('lastSync_settings');
				await syncManager.sync();

				const settings = await db.settings.toArray();
				if (settings.length > 0) {
					toast.success("Infraestructura restaurada al 100%");
					navigate('/');
					setTimeout(() => window.location.reload(), 500);
				} else {
					toast.warning("Sesión iniciada. Cloud vacío.");
					setStep(2);
				}
			}
		} catch (error) {
			toast.error("Fallo de restauración");
		} finally {
			setIsLoading(false);
		}
	};

	const finishSetup = async () => {
		try {
			const settings = await db.settings.toArray();
			if (settings.length > 0 && settings[0].id) {
				await db.settings.update(settings[0].id, { cloudSetupCompleted: true });
			}
			toast.success("Sistema listo para operar");
			navigate('/');
			setTimeout(() => window.location.reload(), 1500);
		} catch (error) {
			navigate('/');
			window.location.reload();
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-[#121416] flex items-center justify-center p-8 overflow-hidden relative">
			{/* Background Decorative Elements */}
			<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
			<div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]"></div>
			<div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-blue-600/5 rounded-full blur-[120px]"></div>

			<div className="max-w-3xl w-full relative z-10">
				<div className="text-center mb-16 space-y-6">
					<div className="w-24 h-24 bg-white dark:bg-[#1a1c1e] rounded-[2rem] mx-auto flex items-center justify-center text-[#1a73e8] shadow-2xl shadow-blue-500/10 border-4 border-white dark:border-white/5 group transform transition-transform duration-700 hover:rotate-[360deg]">
						<Shield size={48} className="drop-shadow-sm" />
					</div>
					<div>
						<h1 className="text-4xl font-black text-[#202124] dark:text-white tracking-tighter uppercase">
							{step === 1 ? "Iniciando Protocolo" : step === 2 ? "Perfil de Mando" : "Ledger Digital"}
						</h1>
						<p className="text-sm font-bold text-[#5f6368] dark:text-[#9aa0a6] mt-3 uppercase tracking-widest opacity-60">
							{step === 1 ? "Arquitectura ShoroRepair v8.0" : step === 2 ? "Define al administrador central" : "Protección de datos en la nube"}
						</p>
					</div>
				</div>

				{/* Stepper Progress */}
				<div className="flex items-center justify-center mb-16 gap-12">
					{[1, 2, 3].map((s) => (
						<div key={s} className="flex flex-col items-center gap-3 relative">
							<div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-700 ${s <= step ? 'bg-[#1a73e8] text-white shadow-xl shadow-blue-500/20' : 'bg-white dark:bg-[#1c1e21] text-gray-400'}`}>
								{s < step ? <Check size={20} /> : s}
							</div>
							{s < 3 && <div className={`absolute left-16 top-6 w-8 h-[2px] ${s < step ? 'bg-blue-500' : 'bg-gray-200'}`}></div>}
						</div>
					))}
				</div>

				<Card className="p-12 rounded-[3.5rem] shadow-2xl border-none bg-white dark:bg-[#1a1c1e] relative overflow-hidden">
					{step === 1 && (
						<div className="space-y-10 animate-in slide-in-from-bottom-10 duration-700">
							<div className="p-8 bg-blue-50/50 dark:bg-blue-900/5 rounded-[2.5rem] border border-blue-100 flex gap-4 items-center">
								<Sparkles className="text-blue-500 shrink-0" size={24} />
								<p className="text-xs font-bold text-blue-700 uppercase tracking-widest leading-relaxed">
									Software de gestión técnica de alto rendimiento. Diseñado para control total de reparaciones y stock.
								</p>
							</div>

							<Input
								label="Identidad del Negocio"
								name="businessName"
								value={formData.businessName}
								onChange={handleChange}
								leftIcon={<Building size={20} />}
								placeholder="Nombre comercial de su taller..."
								className="h-16 rounded-2xl"
							/>

							<div className="space-y-4 pt-4">
								<Button variant="primary" className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-blue-500/20" onClick={() => setStep(2)} rightIcon={<ArrowRight size={20} />}>Desplegar Nueva Estación</Button>

								<div className="relative flex items-center py-6">
									<div className="flex-grow border-t border-gray-100 dark:border-white/5"></div>
									<span className="flex-shrink-0 mx-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Backup Protocol</span>
									<div className="flex-grow border-t border-gray-100 dark:border-white/5"></div>
								</div>

								<Button
									variant="outline"
									className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] border-gray-100 bg-gray-50/50 hover:bg-white"
									onClick={handleRestore}
									isLoading={isLoading}
									leftIcon={<Database size={20} className="text-blue-500" />}
								>
									Restablecer Archivo Nube
								</Button>
							</div>
						</div>
					)}

					{step === 2 && (
						<div className="space-y-8 animate-in slide-in-from-right-10 duration-700">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
								<Input label="Nombre del Operador" name="fullName" value={formData.fullName} onChange={handleChange} leftIcon={<User size={18} />} placeholder="Ej: Jorge Murillo" />
								<Input label="ID de Acceso" name="username" value={formData.username} onChange={handleChange} leftIcon={<Globe size={18} />} placeholder="admin_repair" />
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
								<Input label="Contraseña Maestra" type="password" name="password" value={formData.password} onChange={handleChange} leftIcon={<Key size={18} />} />
								<Input label="Validar Contraseña" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} leftIcon={<Check size={18} />} />
							</div>
							<div className="pt-6">
								<Button variant="primary" className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-blue-500/20" onClick={handleCreateAdmin} isLoading={isLoading} rightIcon={<Zap size={20} />}>Inicializar Comandos</Button>
								<button className="w-full mt-6 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-blue-500" onClick={() => setStep(1)}>Volver al Paso 01</button>
							</div>
						</div>
					)}

					{step === 3 && (
						<div className="space-y-12 animate-in slide-in-from-right-10 duration-700 text-center py-6">
							<div className="flex flex-col items-center gap-6">
								<div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center text-blue-600 shadow-inner">
									<Cloud size={40} />
								</div>
								<div className="space-y-2">
									<h3 className="font-black text-2xl uppercase tracking-tight">Sincronización Cloud</h3>
									<p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-relaxed max-w-sm">Vincula tu cuenta para respaldar datos técnicos, clientes y facturación de forma automática.</p>
								</div>
							</div>

							<div className="flex flex-col items-center gap-6">
								{googleAccessToken ? (
									<div className="w-full bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2rem] border-2 border-emerald-100 flex items-center justify-center gap-4 text-emerald-600 font-black uppercase text-xs tracking-widest animate-pulse">
										<ShieldCheck size={24} /> Conexión Activa y Segura
									</div>
								) : (
									<Button variant="outline" className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] bg-white text-gray-800 shadow-xl shadow-black/5" onClick={handleCloudLink} leftIcon={<Globe size={18} />}>Vincular Cuenta Google Drive</Button>
								)}
							</div>

							<div className="pt-10 border-t border-gray-100 dark:border-white/5 flex gap-6">
								<Button variant="ghost" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={finishSetup}>Omitir Nube</Button>
								<Button variant="primary" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/10" onClick={finishSetup} disabled={!googleAccessToken}>Completar Despliegue</Button>
							</div>
						</div>
					)}
				</Card>
				<p className="text-center mt-12 text-[9px] font-black text-gray-400 uppercase tracking-[0.4em]">ShoroRepair Intelligent Enterprise Tool • 2024</p>
			</div>
		</div>
	);
};

export default Setup;
