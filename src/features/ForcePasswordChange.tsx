import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Lock, KeyRound, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Card } from '../components';

const ForcePasswordChange: React.FC = () => {
	const { t } = useTranslation();
	const { changePassword } = useAuth();
	const [current, setCurrent] = useState('');
	const [next, setNext] = useState('');
	const [confirm, setConfirm] = useState('');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (current !== '123' && next === current) {
			setError('La nueva contraseña no puede ser igual a la actual.');
			return;
		}
		if (next.length < 6) {
			setError('La nueva contraseña debe tener al menos 6 caracteres.');
			return;
		}
		if (next !== confirm) {
			setError('Las contraseñas no coinciden.');
			return;
		}

		setIsLoading(true);
		try {
			const ok = await changePassword(current, next);
			if (!ok) {
				setError('La contraseña actual es incorrecta.');
				toast.error(t('login.error'));
			} else {
				toast.success(t('settings.profile_updated'));
			}
		} catch {
			setError('Ocurrió un error. Intente de nuevo.');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen w-full flex items-center justify-center p-6 bg-gray-50 dark:bg-[#121416] relative overflow-hidden">
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-none blur-[120px]"></div>
			<div className="w-full max-w-[420px] space-y-6 relative z-10 animate-in fade-in zoom-in duration-700">
				<div className="text-center space-y-3">
					<div className="inline-flex items-center justify-center w-14 h-14 bg-white dark:bg-[#1a1c1e] text-amber-600 rounded-none shadow-2xl border-4 border-white dark:border-white/5">
						<ShieldAlert size={28} strokeWidth={2} />
					</div>
					<h1 className="text-xl font-black text-[#202124] dark:text-white tracking-tighter uppercase leading-none">
						{t('settings.change_required_title')}
					</h1>
					<p className="text-[10px] font-bold text-gray-400 dark:text-[#9aa0a6] uppercase tracking-widest">
						{t('settings.change_required_subtitle')}
					</p>
				</div>

				<Card className="p-6 rounded-none shadow-2xl border-none bg-white dark:bg-[#1a1c1e]">
					<form onSubmit={handleSubmit} className="space-y-5">
						{error && (
							<div className="bg-red-50 text-red-600 p-4 rounded-none text-[10px] font-black uppercase tracking-widest text-center border border-red-100">
								{error}
							</div>
						)}

						<Input
							label={t('login.security_signature')}
							type="password"
							leftIcon={<Lock size={18} className="text-gray-400" />}
							value={current}
							onChange={e => setCurrent(e.target.value)}
							placeholder="••••••••"
							autoComplete="current-password"
							className="h-12 rounded-none"
						/>
						<Input
							label={t('users.fields.new_password')}
							type="password"
							leftIcon={<KeyRound size={18} className="text-gray-400" />}
							value={next}
							onChange={e => setNext(e.target.value)}
							placeholder="••••••••"
							autoComplete="new-password"
							className="h-12 rounded-none"
						/>
						<Input
							label={t('setup.validate_password')}
							type="password"
							leftIcon={<KeyRound size={18} className="text-gray-400" />}
							value={confirm}
							onChange={e => setConfirm(e.target.value)}
							placeholder="••••••••"
							autoComplete="new-password"
							className="h-12 rounded-none"
						/>

						<Button
							type="submit"
							variant="primary"
							className="w-full h-12 rounded-none font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-blue-500/20"
							isLoading={isLoading}
						>
							{t('settings.update_profile')}
						</Button>
					</form>
				</Card>
			</div>
		</div>
	);
};

export default ForcePasswordChange;
