import React, { useState, useEffect } from 'react';
import { Cloud, ArrowRight, Check, X, Shield, Info, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Input, Modal } from '.';
import { db } from '../../db';
import { CompanySettings } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const CloudSetupWizard: React.FC = () => {
    const { t } = useTranslation();
    const { linkGoogleDrive, googleAccessToken, user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState<Partial<CompanySettings>>({});

    useEffect(() => {
        const checkSetup = async () => {
            const settings = await db.settings.toArray();
            if (settings[0] && !settings[0].cloudSetupCompleted && user?.role === 'Admin') {
                setIsOpen(true);
            }
        };
        checkSetup();
    }, [user]);

    const handleComplete = async () => {
        const settings = await db.settings.toArray();
        if (settings[0]) {
            await db.settings.update(settings[0].id!, { ...config, cloudSetupCompleted: true });
            toast.success(t('messages.success'));
            setIsOpen(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-[#1a1c1e] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="max-w-2xl w-full space-y-12">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-[#e8f0fe] dark:bg-[#1a73e8]/20 rounded-none flex items-center justify-center mx-auto text-[#1a73e8] animate-bounce">
                        <Cloud size={40} />
                    </div>
                    <h1 className="text-4xl font-bold text-[#202124] dark:text-white tracking-tight">{t('cloud.welcome')}</h1>
                    <p className="text-lg text-[#5f6368] dark:text-[#9aa0a6]">{t('cloud.welcome_sub')}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 px-12">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`h-1.5 rounded-none transition-all duration-500 ${step >= s ? 'bg-[#1a73e8]' : 'bg-[#f1f3f4] dark:bg-[#3c4043]'}`} />
                    ))}
                </div>

                <Card variant="outlined" className="p-8 shadow-xl border-2 border-[#f1f3f4] dark:border-[#3c4043]">
                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-right-4">
                            <div className="space-y-3">
                                <h3 className="text-xl font-bold text-[#202124] dark:text-white">{t('cloud.step1_title')}</h3>
                                <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6]">{t('cloud.step1_desc')}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setStep(2)}
                                    className="p-6 rounded-none border-2 border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a73e8]/10 text-left space-y-4 hover:scale-[1.02] transition-transform cursor-pointer"
                                >
                                    <div className="w-10 h-10 bg-white dark:bg-[#1a1c1e] rounded-none flex items-center justify-center shadow-sm text-[#1a73e8]"><Cloud size={24} /></div>
                                    <div>
                                        <p className="font-bold text-[#1a73e8]">{t('cloud.hybrid_mode')}</p>
                                        <p className="text-xs opacity-70">{t('cloud.hybrid_desc')}</p>
                                    </div>
                                </button>
                                <button
                                    onClick={handleComplete}
                                    className="p-6 rounded-none border-2 border-transparent bg-[#f8f9fa] dark:bg-[#202124] text-left space-y-4 hover:border-[#dadce0] transition-all cursor-pointer opacity-60 hover:opacity-100"
                                >
                                    <div className="w-10 h-10 bg-white dark:bg-[#1a1c1e] rounded-none flex items-center justify-center shadow-sm text-[#5f6368]"><Shield size={24} /></div>
                                    <div>
                                        <p className="font-bold text-[#202124] dark:text-white">{t('cloud.local_mode')}</p>
                                        <p className="text-xs opacity-70">{t('cloud.local_desc')}</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in slide-in-from-right-4">
                            <div className="space-y-3">
                                <h3 className="text-xl font-bold text-[#202124] dark:text-white">{t('cloud.step2_title')}</h3>
                                <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6]">{t('cloud.step2_desc')}</p>
                            </div>
                            <div className="bg-[#f8f9fa] dark:bg-[#202124] p-6 rounded-none border border-[#dadce0] dark:border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-none flex items-center justify-center shadow-sm">
                                        <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{googleAccessToken ? t('cloud.linked') : t('cloud.google_account')}</p>
                                        <p className="text-xs text-[#5f6368]">{googleAccessToken ? t('cloud.ready') : t('cloud.pending')}</p>
                                    </div>
                                </div>
                                {!googleAccessToken ? (
                                    <Button variant="primary" size="sm" onClick={linkGoogleDrive}>{t('cloud.link_now')}</Button>
                                ) : (
                                    <div className="text-[#1e8e3e] flex items-center gap-1 font-bold text-xs"><Check size={16} /> {t('cloud.done')}</div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-[#f1f3f4] dark:border-white/5">
                                <Button variant="ghost" onClick={() => setStep(1)}>{t('common.back')}</Button>
                                <Button variant="primary" disabled={!googleAccessToken} onClick={() => setStep(3)} rightIcon={<ArrowRight size={16} />}>{t('common.next')}</Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[#1a73e8]">
                                    <Info size={20} />
                                    <h3 className="text-xl font-bold text-[#202124] dark:text-white">{t('cloud.step3_title')}</h3>
                                </div>
                                <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6]">{t('cloud.step3_desc')}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Firebase API Key" placeholder="AIzaSy..." value={config.firebaseApiKey} onChange={v => setConfig({ ...config, firebaseApiKey: v.target.value })} />
                                <Input label="Project ID" placeholder="shororepair-123" value={config.firebaseProjectId} onChange={v => setConfig({ ...config, firebaseProjectId: v.target.value })} />
                            </div>

                            <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-[#fef7e0] text-[#f9ab00] rounded-none text-xs font-bold hover:bg-[#fef2c5] transition-all">
                                <ExternalLink size={14} /> {t('cloud.open_console')}
                            </a>

                            <div className="flex justify-end gap-3 pt-4 border-t border-[#f1f3f4] dark:border-white/5">
                                <Button variant="ghost" onClick={() => setStep(2)}>{t('common.back')}</Button>
                                <Button variant="primary" onClick={handleComplete}>{t('common.finish')}</Button>
                            </div>
                        </div>
                    )}
                </Card>

                <p className="text-center text-[10px] text-neutral-400 font-medium px-20">
                    {t('cloud.disclaimer')}
                </p>
            </div>
        </div>
    );
};

export default CloudSetupWizard;
