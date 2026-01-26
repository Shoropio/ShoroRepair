import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Lock, Mail, Check, ArrowRight, Building } from 'lucide-react';
import { Card, Input, Button } from '../src/components';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const Setup: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { login, linkGoogleDrive, googleAccessToken } = useAuth();

    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        password: '',
        confirmPassword: '',
        businessName: 'ShoroRepair',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateAdmin = async () => {
        if (!formData.fullName || !formData.username || !formData.password) {
            toast.error(t('common.required_fields'));
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }

        setIsLoading(true);
        try {
            // 1. Create Admin User
            await db.users.add({
                fullName: formData.fullName,
                username: formData.username,
                password: formData.password,
                role: 'Admin',
                active: true,
                email: formData.username.includes('@') ? formData.username : undefined,
                syncId: googleAccessToken || undefined // Link if already connected (unlikely in this order, but good practice)
            });

            // 2. Update Company Name if changed
            const settings = await db.settings.toArray();
            if (settings.length > 0 && settings[0].id) {
                await db.settings.update(settings[0].id, {
                    businessName: formData.businessName
                });
            } else {
                await db.settings.add({
                    businessName: formData.businessName,
                    legalName: formData.businessName + ' S.A.',
                    taxId: '000-000000-000',
                    address: 'Sin Dirección',
                    phone: '',
                    email: '',
                    invoicePrefix: 'FAC',
                    nextInvoiceNumber: 1,
                    inactivityTimeout: 5,
                    cloudSetupCompleted: !!googleAccessToken
                });
            }

            // 3. Auto Login
            await login(formData.username, formData.password);

            // 4. Move to next step (Cloud Link) or Finish
            setStep(3);
        } catch (error) {
            console.error(error);
            toast.error("Error al crear administrador");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloudLink = async () => {
        try {
            const token = await linkGoogleDrive();
            if (token) {
                // Actualizar settings para marcar que Google Drive está vinculado
                const settings = await db.settings.toArray();
                if (settings.length > 0 && settings[0].id) {
                    await db.settings.update(settings[0].id, {
                        cloudSetupCompleted: true
                    });
                }
                toast.success("Cuenta vinculada");
            }
        } catch (e) {
            console.error('Error linking Google Drive:', e);
            toast.error("Error linking account");
        }
    };

    const finishSetup = async () => {
        try {
            // Marcar el setup como completado
            const settings = await db.settings.toArray();
            if (settings.length > 0 && settings[0].id) {
                await db.settings.update(settings[0].id, {
                    cloudSetupCompleted: true
                });
            }

            toast.success("¡Configuración completada!");
            navigate('/');
            setTimeout(() => window.location.reload(), 100); // Small delay to ensure DB update completes
        } catch (error) {
            console.error('Error finishing setup:', error);
            navigate('/');
            window.location.reload();
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#1a1c1e] flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">

                {/* Header */}
                <div className="text-center mb-12 space-y-4">
                    <div className="w-16 h-16 bg-[#1a73e8] rounded-none mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                        <Shield size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-[#202124] dark:text-white tracking-tight">
                        {step === 1 ? "Bienvenido a ShoroRepair" : step === 2 ? "Crear Administrador" : "Nube & Sincronización"}
                    </h1>
                    <p className="text-[#5f6368] dark:text-[#9aa0a6]">
                        {step === 1 ? "Configuremos su sistema de taller en pocos pasos." :
                            step === 2 ? "Esta cuenta tendrá control total del sistema." :
                                "Proteja sus datos vinculando una cuenta de Google."}
                    </p>
                </div>

                {/* Steps Indicator */}
                <div className="flex items-center justify-between mb-12 px-12">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${s <= step ? 'bg-[#1a73e8] text-white' : 'bg-[#f1f3f4] dark:bg-[#3c4043] text-[#5f6368]'}`}>
                                {s < step ? <Check size={14} /> : s}
                            </div>
                        </div>
                    ))}
                    {/* Progress Lines would go here but keeping it simple */}
                </div>

                <Card className="p-8 shadow-xl border border-[#dadce0] dark:border-[#3c4043]">

                    {/* STEP 1: WELCOME & BUSINESS */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-8">
                            <div className="bg-[#e8f0fe] dark:bg-[#1a73e8]/10 p-4 rounded-none border border-[#1a73e8]/20 text-[#1a73e8] text-sm font-medium">
                                👋 Gracias por elegir ShoroRepair. Antes de comenzar, necesitamos configurar la identidad de su negocio.
                            </div>

                            <Input
                                label="Nombre del Negocio / Taller"
                                name="businessName"
                                value={formData.businessName}
                                onChange={handleChange}
                                leftIcon={<Building size={18} />}
                                placeholder="Ej: Reparaciones Express"
                            />

                            <Button
                                variant="primary"
                                className="w-full h-12 mt-4"
                                onClick={() => setStep(2)}
                                rightIcon={<ArrowRight size={18} />}
                            >
                                Continuar
                            </Button>
                        </div>
                    )}

                    {/* STEP 2: ADMIN CREATION */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-8">
                            <Input
                                label="Nombre Completo"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                leftIcon={<User size={18} />}
                                placeholder="Ej: Juan Pérez"
                            />
                            <Input
                                label="Usuario / Email"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                leftIcon={<Mail size={18} />}
                                placeholder="admin@taller.com"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Contraseña"
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    leftIcon={<Lock size={18} />}
                                />
                                <Input
                                    label="Confirmar Contraseña"
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    leftIcon={<Lock size={18} />}
                                />
                            </div>

                            <Button
                                variant="primary"
                                className="w-full h-12 mt-4"
                                onClick={handleCreateAdmin}
                                isLoading={isLoading}
                                rightIcon={<ArrowRight size={18} />}
                            >
                                Crear Administrador
                            </Button>
                        </div>
                    )}

                    {/* STEP 3: CLOUD LINK */}
                    {step === 3 && (
                        <div className="space-y-8 animate-in slide-in-from-right-8 text-center">
                            <div className="flex flex-col items-center justify-center gap-4 py-6">
                                <div className="p-4 bg-white dark:bg-[#1a1c1e] shadow-sm rounded-none border border-[#dadce0] dark:border-[#3c4043]">
                                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-8 h-8" />
                                </div>
                                <h3 className="font-bold text-lg">Sincronización en la Nube</h3>
                                <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] max-w-sm">
                                    Vincula tu cuenta de Google Drive para respaldar automáticamente tu base de datos y trabajar desde múltiples dispositivos.
                                </p>
                            </div>

                            {googleAccessToken ? (
                                <div className="bg-green-50 dark:bg-green-900/20 text-green-600 p-4 rounded-none flex items-center justify-center gap-2 font-bold animate-pulse">
                                    <Check size={20} /> Cuenta Vinculada Correctamente
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full max-w-sm mx-auto h-12 bg-white dark:bg-[#202124] text-[#3c4043] dark:text-white border-[#dadce0] dark:border-[#5f6368]"
                                    onClick={handleCloudLink}
                                >
                                    <span className="mr-2">🔗</span> Vincular Google Account
                                </Button>
                            )}

                            <div className="pt-8 border-t border-[#f1f3f4] dark:border-[#3c4043] flex gap-4">
                                <Button variant="ghost" className="flex-1" onClick={finishSetup}>
                                    Saltar por ahora
                                </Button>
                                <Button variant="primary" className="flex-1" onClick={finishSetup} disabled={!googleAccessToken}>
                                    Finalizar Setup
                                </Button>
                            </div>
                        </div>
                    )}

                </Card>
            </div>
        </div>
    );
};

export default Setup;
