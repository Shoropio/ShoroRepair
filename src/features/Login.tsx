import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ShieldCheck, ArrowRight, Key} from 'lucide-react';
import { toast } from 'sonner';
import { Input, Button, Card } from '../components';

const Login: React.FC = () => {
	const { t } = useTranslation();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const { login, loginWithGoogle } = useAuth();
	const navigate = useNavigate();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!username || !password) {
			setError(t('login.fill_fields'));
			return;
		}

		setIsLoading(true);
		try {
			const success = await login(username, password);
			if (success) {
				toast.success(t('login.login_success'));
				navigate('/');
			} else {
				setError(t('login.error'));
			}
		} catch {
			setError(t('login.critical_conn_error'));
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleLogin = async () => {
		setError('');
		setIsLoading(true);
		try {
			const success = await loginWithGoogle();
			if (success) {
				toast.success(t('login.google_success'));
				navigate('/');
			} else {
				setError(t('login.google_error'));
			}
		} catch (_err) {
			setError(t('login.google_protocol_error'));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen w-full flex items-center justify-center p-6 bg-gray-50 dark:bg-[#121416] relative overflow-hidden">
			{/* Dynamic Background */}
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-none blur-[120px]"></div>
			<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-none blur-[120px]"></div>

			<div className="w-full max-w-[400px] space-y-6 relative z-10 animate-in fade-in zoom-in duration-700">
				{/* Branding Section */}
				<div className="text-center space-y-3">
					<div className="inline-flex items-center justify-center w-14 h-14 bg-white dark:bg-[#1a1c1e] text-[#1a73e8] rounded-none shadow-2xl shadow-blue-500/10 border-4 border-white dark:border-white/5 transform transition-transform hover:scale-110">
						<ShieldCheck size={28} strokeWidth={2} />
					</div>
					<div className="space-y-0.5">
						<h1 className="text-2xl font-black text-[#202124] dark:text-white tracking-tighter uppercase leading-none">ShoroRepair</h1>
						<p className="text-[9px] font-black text-gray-400 dark:text-[#9aa0a6] uppercase tracking-[0.4em] opacity-80">{t('login.enterprise_system')}</p>
					</div>
				</div>

				<Card className="p-6 rounded-none shadow-2xl shadow-black/5 border-none bg-white dark:bg-[#1a1c1e]">
					<form onSubmit={handleLogin} className="space-y-5">
						{error && (
							<div className="bg-red-50 text-red-600 p-4 rounded-none text-[10px] font-black uppercase tracking-widest text-center border border-red-100 animate-in shake">
								{error}
							</div>
						)}

						<div className="space-y-4">
							<Input
								label={t('login.operator_id')}
								leftIcon={<User size={18} className="text-gray-400" />}
								value={username}
								onChange={e => setUsername(e.target.value)}
								placeholder={t('login.username_placeholder')}
								autoComplete="username"
								className="h-12 rounded-none"
							/>

							<Input
								label={t('login.security_signature')}
								type="password"
								leftIcon={<Key size={18} className="text-gray-400" />}
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="••••••••"
								autoComplete="current-password"
								className="h-12 rounded-none"
							/>
						</div>

						<div className="space-y-3 pt-1">
							<Button
								type="submit"
								variant="primary"
								className="w-full h-12 rounded-none font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-blue-500/20"
								isLoading={isLoading}
								rightIcon={<ArrowRight size={18} />}
							>
								{t('login.access_system')}
							</Button>

							<div className="relative flex items-center py-1">
								<div className="flex-grow border-t border-gray-100 dark:border-white/5"></div>
								<span className="flex-shrink-0 mx-4 text-[9px] font-black text-gray-300 uppercase tracking-widest">{t('login.social_mfa')}</span>
								<div className="flex-grow border-t border-gray-100 dark:border-white/5"></div>
							</div>

							<Button
								type="button"
								variant="outline"
								className="w-full h-12 rounded-none text-[10px] font-black uppercase tracking-widest"
								onClick={handleGoogleLogin}
								disabled={isLoading}
								leftIcon={
									<svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
										<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
										<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
										<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
										<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
									</svg>
								}
							>
								{t('login.google_cloud_signin')}
							</Button>
						</div>
					</form>
				</Card>

				<div className="text-center space-y-2">
					<p className="text-[10px] font-bold text-gray-400 dark:text-[#9aa0a6] uppercase tracking-widest flex items-center justify-center gap-2">
						<Lock size={12} className="text-blue-500" />
						{t('login.authorized_access')}
					</p>
				</div>
			</div>
		</div>
	);
};

export default Login;
