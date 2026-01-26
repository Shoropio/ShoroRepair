import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ShieldCheck, ArrowRight } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Input, Button, Card } from '../src/components';

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
                toast.success(t('dashboard.welcome'));
                navigate('/');
            } else {
                setError(t('login.error'));
                toast.error(t('messages.error'));
            }
        } catch (err: any) {
            console.error("Login error detail:", err);
            setError('Error de conexión');
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
                toast.success('Acceso concedido con Google');
                navigate('/');
            } else {
                setError('No se pudo iniciar sesión con Google o cuenta inactiva');
            }
        } catch (err) {
            setError('Error de autenticación con Google');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-white dark:bg-[#1a1c1e]">
            <div className="w-full max-w-[448px] space-y-8 animate-in">
                {/* Minimalist Logo Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1a73e8] text-white rounded-none shadow-lg">
                        <ShieldCheck size={28} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-semibold text-[#202124] dark:text-white tracking-tight">{t('login.title')}</h1>
                        <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6]">{t('login.subtitle')}</p>
                    </div>
                </div>

                <Card variant="outlined" className="p-10 rounded-none">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-[#fce8e6] text-[#c5221f] p-4 rounded-none text-xs font-semibold text-center border border-[#f5b7b1]">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <Input
                                label={t('login.username')}
                                leftIcon={<User size={18} />}
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder={t('login.username_placeholder')}
                                autoComplete="username"
                            />

                            <Input
                                label={t('login.password')}
                                type="password"
                                leftIcon={<Lock size={18} />}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={t('login.password_placeholder')}
                                autoComplete="current-password"
                            />
                        </div>

                        <div className="space-y-4 pt-2">
                            <Button
                                type="submit"
                                variant="primary"
                                className="w-full py-3 text-sm font-semibold"
                                isLoading={isLoading}
                            >
                                {t('login.next')}
                            </Button>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full py-3 bg-white dark:bg-transparent border border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-white/5 text-[#3c4043] dark:text-[#e2e2e6] flex items-center justify-center gap-3 transition-colors rounded-none text-sm font-semibold"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                {t('login.google_signin')}
                            </button>
                        </div>
                    </form>
                </Card>

                <div className="text-center">
                    <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                        {t('login.footer')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
