import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import {
    Sparkles,
    Search,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    BrainCircuit,
    MessageSquare,
    History,
    Send,
    Loader2,
    RefreshCw,
    Cpu,
    ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, Button, Input, Badge, TableSkeleton, Select } from '../components';
import { ServiceOrder } from '../types';

const AI_MODELS = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Rápido)', desc: 'Ideal para diagnósticos rápidos y sencillos' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Avanzado)', desc: 'Mejor razonamiento para fallas complejas' },
    { id: 'gemini-pro', name: 'Gemini Pro (Legado)', desc: 'Modelo estable de propósito general' }
];

const AIDiagnostic: React.FC = () => {
    const { t } = useTranslation();
    const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
    const [customIssue, setCustomIssue] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
    const [result, setResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const orders = useLiveQuery(async () => {
        if (!searchQuery) return [];
        return db.orders
            .filter(o => o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.model.toLowerCase().includes(searchQuery.toLowerCase()))
            .limit(5)
            .toArray();
    }, [searchQuery]);

    const settings = useLiveQuery(() => db.settings.toCollection().first());

    const generateDiagnostic = async () => {
        const apiKey = settings?.geminiApiKey;
        if (!apiKey) {
            toast.error(t('invoices.hacienda_error', 'Configura tu Gemini API Key en Ajustes primero.'));
            return;
        }

        const issueToAnalyze = selectedOrder ?
            `Dispositivo: ${selectedOrder.brand} ${selectedOrder.model}. Problema: ${selectedOrder.issueDescription}` :
            customIssue;

        if (!issueToAnalyze.trim()) {
            toast.error(t('common.required_fields'));
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const prompt = `Actúa como un técnico experto en reparaciones electrónicas con 20 años de experiencia. 
Analiza el siguiente problema técnico y proporciona:
1. Posibles causas (ordenadas por probabilidad).
2. Pasos recomendados para el diagnóstico.
3. Herramientas necesarias.
4. Estimación de dificultad (1-10).
5. Precauciones de seguridad.

Problema: ${issueToAnalyze}

Responde en formato Markdown, de forma profesional y concisa. Si es posible, incluye códigos de error comunes o valores de consumo esperados.`;

            // Note: v1beta endpoint structure
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message || `Error en la API de Gemini (${data.error.status})`);
            }

            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aiText) {
                setResult(aiText);
                toast.success(t('messages.success'));
            } else {
                throw new Error("No se recibió respuesta de la IA. Verifica si el modelo seleccionado está disponible en tu región.");
            }
        } catch (error: any) {
            console.error("AI Diagnostic Error:", error);
            toast.error(`${t('messages.error')}: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-semibold text-[#202124] dark:text-white tracking-tight flex items-center gap-2">
                        <BrainCircuit className="text-[#1a73e8]" size={28} />
                        {t('ai.title')}
                    </h1>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">
                        {t('ai.subtitle')}
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 space-y-6">
                    <Card variant="tonal" className="p-6 border-blue-100 dark:border-blue-900/20">
                        <h3 className="text-sm font-bold text-[#1a73e8] uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Cpu size={16} /> Configuración de Inteligencia
                        </h3>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase ml-1">Modelo de Lenguaje</label>
                                <Select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="w-full"
                                >
                                    {AI_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </Select>
                                <p className="text-[10px] text-[#5f6368] italic px-1">
                                    {AI_MODELS.find(m => m.id === selectedModel)?.desc}
                                </p>
                            </div>

                            <div className="h-px bg-[#dadce0] dark:bg-[#3c4043] my-2" />

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase ml-1">{t('ai.link_order')}</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368]" size={16} />
                                    <input
                                        type="text"
                                        placeholder={t('common.search')}
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#2d2f31] border border-[#dadce0] dark:border-[#3c4043] rounded-none text-sm outline-none focus:ring-2 focus:ring-[#1a73e8]/20"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                {orders && orders.length > 0 && (
                                    <div className="mt-2 border border-[#dadce0] dark:border-[#3c4043] divide-y divide-[#dadce0] dark:divide-[#3c4043] bg-white dark:bg-[#1a1c1e] shadow-lg">
                                        {orders.map(o => (
                                            <button
                                                key={o.id}
                                                className="w-full p-3 text-left hover:bg-[#f8f9fa] dark:hover:bg-white/5 transition-colors flex items-center justify-between group"
                                                onClick={() => {
                                                    setSelectedOrder(o);
                                                    setSearchQuery('');
                                                    setCustomIssue('');
                                                }}
                                            >
                                                <div>
                                                    <p className="text-xs font-bold text-[#202124] dark:text-white">#{o.orderNumber}</p>
                                                    <p className="text-[10px] text-[#5f6368] font-medium">{o.brand} {o.model}</p>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Badge variant="slate" size="xs">{t('common.view')}</Badge>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase ml-1">{t('ai.custom_description')}</label>
                                <textarea
                                    className="w-full p-4 bg-white dark:bg-[#2d2f31] border border-[#dadce0] dark:border-[#3c4043] rounded-none text-sm outline-none focus:ring-2 focus:ring-[#1a73e8]/20 min-h-[120px] transition-all"
                                    placeholder="..."
                                    value={selectedOrder ? `[ORDEN #${selectedOrder.orderNumber}] ${selectedOrder.issueDescription}` : customIssue}
                                    onChange={(e) => {
                                        setCustomIssue(e.target.value);
                                        setSelectedOrder(null);
                                    }}
                                />
                                {selectedOrder && (
                                    <button
                                        className="text-[10px] text-red-500 font-bold uppercase hover:underline ml-1"
                                        onClick={() => setSelectedOrder(null)}
                                    >
                                        {t('common.clean')}
                                    </button>
                                )}
                            </div>

                            <Button
                                variant="primary"
                                className="w-full py-4 text-xs font-bold uppercase tracking-widest gap-2"
                                onClick={generateDiagnostic}
                                disabled={isLoading}
                                leftIcon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            >
                                {isLoading ? 'Procesando...' : t('ai.analyze')}
                            </Button>
                        </div>
                    </Card>

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/20 rounded-none space-y-2">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold text-xs uppercase">
                            <AlertTriangle size={14} /> {t('common.confirm')}
                        </div>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500/80 leading-relaxed font-medium">
                            {t('ai.disclaimer')}
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-8 flex flex-col h-full min-h-[600px]">
                    {!result && !isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-[#dadce0] dark:border-[#3c4043] rounded-none bg-[#f8f9fa] dark:bg-[#1a1c1e]">
                            <div className="w-20 h-20 bg-white dark:bg-[#2d2f31] rounded-3xl flex items-center justify-center text-[#1a73e8] shadow-xl mb-6">
                                <Cpu size={40} strokeWidth={1.5} />
                            </div>
                            <h2 className="text-xl font-bold text-[#202124] dark:text-white capitalize">{t('common.loading')}</h2>
                            <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 max-w-md">
                                {t('ai.subtitle')}
                            </p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-[#1a73e8]/30 rounded-none bg-[#f1f3f4]/50 dark:bg-[#1a73e8]/5">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-[#1a73e8]/20 border-t-[#1a73e8] rounded-full animate-spin"></div>
                                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#1a73e8]" size={24} />
                            </div>
                            <h2 className="text-lg font-bold text-[#1a73e8] mt-6 animate-pulse uppercase tracking-widest">GEMINI AI...</h2>
                        </div>
                    ) : (
                        <Card className="flex-1 overflow-hidden flex flex-col border-[#1a73e8]/20 shadow-2xl">
                            <div className="bg-[#1a73e8] p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3 text-white">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <BrainCircuit size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-tight">{t('ai.result_title')}</h3>
                                        <p className="text-[10px] text-white/70 font-medium">{selectedOrder ? selectedOrder.model : 'Insight'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setResult(null)} className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors">
                                        <RefreshCw size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 p-8 overflow-y-auto bg-white dark:bg-[#1a1c1e]">
                                <article className="prose prose-blue dark:prose-invert max-w-none text-sm rich-text-diagnostic">
                                    {result?.split('\n').map((line, i) => {
                                        if (line.startsWith('#')) return <h3 key={i} className="text-lg font-bold text-[#1a73e8] mt-4 mb-2">{line.replace(/#/g, '').trim()}</h3>;
                                        if (line.startsWith('-') || line.startsWith('*')) return <li key={i} className="ml-4 mb-1 text-[#3c4043] dark:text-[#bdc1c6] font-medium">{line.replace(/[-*]/, '').trim()}</li>;
                                        if (line.match(/^\d\./)) return <div key={i} className="font-bold text-[#202124] dark:text-white mt-4 mb-2 flex items-center gap-2"><div className="w-5 h-5 bg-[#1a73e8] text-white text-[10px] flex items-center justify-center rounded-full">{line.split('.')[0]}</div> {line.split('.').slice(1).join('.').trim()}</div>;
                                        return <p key={i} className="mb-2 text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed font-medium">{line}</p>;
                                    })}
                                </article>

                                <div className="mt-12 pt-6 border-t border-[#f1f3f4] dark:border-[#3c4043] flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Verified Insights</span>
                                    </div>
                                    <div className="flex gap-3">
                                        {selectedOrder && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-[10px] font-bold uppercase"
                                                onClick={async () => {
                                                    await db.orders.update(selectedOrder.id!, {
                                                        technicalDiagnosis: (selectedOrder.technicalDiagnosis ? selectedOrder.technicalDiagnosis + '\n\n--- AI ASSISTED DIAGNOSIS ---\n' : '') + result,
                                                        updatedAt: Date.now(),
                                                        synced: 0
                                                    });
                                                    toast.success(t('messages.saved'));
                                                }}
                                                leftIcon={<History size={14} />}
                                            >
                                                {t('ai.save_to_order')}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-[10px] font-bold uppercase"
                                            onClick={() => {
                                                navigator.clipboard.writeText(result || '');
                                                toast.success(t('ai.copy'));
                                            }}
                                            leftIcon={<MessageSquare size={14} />}
                                        >
                                            {t('ai.copy')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIDiagnostic;
