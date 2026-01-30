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
    ChevronDown,
    Activity,
    Zap,
    Lightbulb,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, Button, Input, Badge, TableSkeleton, Select } from '../components';
import { ServiceOrder } from '../types';

const AI_MODELS = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Sónico)', desc: 'Optimizado para diagnósticos instantáneos' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Científico)', desc: 'Razonamiento profundo para micro-electrónica' },
    { id: 'gemini-pro', name: 'Gemini Pro (Legacy)', desc: 'Motor estable para tareas generales' }
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
            toast.error("Protocolo fallido: No se detectó Gemini API Key en Ajustes.");
            return;
        }

        const issueToAnalyze = selectedOrder ?
            `Dispositivo: ${selectedOrder.brand} ${selectedOrder.model}. Problema: ${selectedOrder.issueDescription}` :
            customIssue;

        if (!issueToAnalyze.trim()) {
            toast.error("Introduzca datos de diagnóstico para procesar.");
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const prompt = `Actúa como un técnico experto en reparaciones electrónicas. 
Analiza el siguiente problema técnico y proporciona:
1. Posibles causas por probabilidad.
2. Pasos de diagnóstico.
3. Herramientas técnicas.
4. Nivel de dificultad.
5. Advertencias de seguridad.

Problema: ${issueToAnalyze}

Responde en Markdown profesional, usa emojis técnicos y estructura clara.`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!content) throw new Error("Motor de IA no retornó resultados legibles.");

            setResult(content);
            toast.success("Diagnóstico Cuántico Generado");
        } catch (err: any) {
            toast.error(`Error de Red Neuronal: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in pb-20">
            {/* Premium Header */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-[#1a1c1e] p-10 rounded-[2.5rem] shadow-xl shadow-purple-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-[#202124] dark:text-white tracking-tighter flex items-center gap-3">
                        <BrainCircuit className="text-purple-600" size={32} />
                        ShoroRepair AI Assistant
                    </h1>
                    <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-2 font-medium max-w-md">
                        Motor de diagnóstico inteligente basado en Google Gemini para optimización técnica.
                    </p>
                </div>
                <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[1.8rem] border border-gray-100 shadow-sm relative z-10">
                    {AI_MODELS.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedModel(m.id)}
                            className={`px-6 py-3 rounded-[1.3rem] text-[9px] font-black uppercase tracking-widest transition-all ${selectedModel === m.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {m.name.split(' (')[1].replace(')', '')}
                        </button>
                    ))}
                </div>
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-purple-50 dark:bg-purple-900/10 rounded-full blur-3xl opacity-50"></div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-12 xl:col-span-4 space-y-6">
                    <Card className="p-8 rounded-[3rem] shadow-2xl border-none">
                        <div className="flex items-center gap-3 mb-8">
                            <Zap className="text-amber-500" size={20} />
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-700">Entrada de Datos</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500" size={18} />
                                <input
                                    type="text"
                                    placeholder="Vincular con Orden de Servicio..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-medium text-sm"
                                />
                            </div>

                            {searchQuery && orders && orders.length > 0 && (
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {orders.map(o => (
                                        <button
                                            key={o.id}
                                            onClick={() => { setSelectedOrder(o); setSearchQuery(''); }}
                                            className="w-full text-left p-4 rounded-2xl hover:bg-purple-50 border border-transparent hover:border-purple-100 transition-all bg-white shadow-sm flex items-center justify-between"
                                        >
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-tight">#{o.orderNumber}</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase">{o.brand} {o.model}</p>
                                            </div>
                                            <Badge variant="brand" size="xs">Elegir</Badge>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="relative px-2">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                                <div className="relative flex justify-center text-[10px]"><span className="px-3 bg-white text-gray-400 font-black uppercase tracking-widest">O ingreso libre</span></div>
                            </div>

                            <textarea
                                placeholder="Describe el fallo detalladamente..."
                                value={customIssue}
                                onChange={(e) => { setCustomIssue(e.target.value); setSelectedOrder(null); }}
                                className="w-full h-40 p-6 bg-gray-50 border-none rounded-[2rem] outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-medium text-sm resize-none"
                            ></textarea>

                            {selectedOrder && (
                                <div className="p-6 bg-purple-50 rounded-[2.5rem] border-2 border-dashed border-purple-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <Badge variant="brand" className="bg-purple-600">VINCULADO</Badge>
                                        <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-red-500 transition-colors"><RefreshCw size={14} /></button>
                                    </div>
                                    <p className="text-xs font-black text-purple-900 uppercase">Orden #{selectedOrder.orderNumber}</p>
                                    <p className="text-[11px] text-purple-700 font-medium mt-1 leading-relaxed line-clamp-2">{selectedOrder.issueDescription}</p>
                                </div>
                            )}

                            <Button
                                variant="primary"
                                className="w-full py-6 rounded-[2rem] font-black uppercase tracking-widest text-[11px] bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-500/20"
                                onClick={generateDiagnostic}
                                isLoading={isLoading}
                                leftIcon={<Sparkles size={20} />}
                            >
                                Iniciar Procesamiento Neuronal
                            </Button>
                        </div>
                    </Card>

                    <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 flex gap-4">
                        <ShieldAlert className="text-amber-500 shrink-0" size={24} />
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-relaxed">
                            Aviso: Los resultados generados por IA son sugerencias experimentales. Validar siempre con instrumental técnico.
                        </p>
                    </div>
                </div>

                {/* Analysis Console */}
                <div className="lg:col-span-12 xl:col-span-8">
                    <Card className="min-h-[600px] h-full p-10 rounded-[4rem] shadow-2xl border-none relative overflow-hidden bg-white dark:bg-[#1a1c1e]">
                        {!result && !isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-8 py-20">
                                <div className="w-24 h-24 bg-purple-50 rounded-[2.5rem] flex items-center justify-center text-purple-200">
                                    <Lightbulb size={48} />
                                </div>
                                <div className="text-center space-y-3">
                                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Terminal en Espera</h3>
                                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest max-w-xs">Ingrese un fallo para activar el modelo de razonamiento técnico.</p>
                                </div>
                                <div className="flex gap-4">
                                    <Badge variant="slate" className="opacity-50">Neural Engine v2</Badge>
                                    <Badge variant="slate" className="opacity-50">Gemini Integrated</Badge>
                                </div>
                            </div>
                        ) : isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-10 py-20">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-purple-500 blur-[60px] opacity-20 animate-pulse"></div>
                                    <Loader2 className="animate-spin text-purple-600 relative z-10" size={80} strokeWidth={1} />
                                </div>
                                <div className="text-center space-y-3">
                                    <h3 className="text-xl font-black text-purple-600 uppercase tracking-[0.2em] animate-pulse">Sincronizando Neuronas...</h3>
                                    <p className="text-xs text-gray-400 font-black uppercase tracking-widest">Analizando fallas probables y protocolos de seguridad.</p>
                                </div>
                                <div className="w-64 h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="w-1/2 h-full bg-purple-600 animate-progress"></div>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                                <div className="flex items-center justify-between mb-10 border-b border-gray-100 pb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-500/20">
                                            <MessageSquare size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Reporte de Análisis IA</h3>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Modelo: {selectedModel}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setResult(null)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-red-500 transition-colors"><RefreshCw size={18} /></button>
                                </div>
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                    <div className="bg-gray-50 dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/5 font-medium leading-relaxed text-gray-800 dark:text-gray-200 text-sm whitespace-pre-line tracking-tight">
                                        {result}
                                    </div>
                                </div>
                                <div className="mt-10 flex justify-end gap-3">
                                    <Button variant="outline" className="rounded-2xl px-6 py-4 font-black uppercase text-[10px]" leftIcon={<History size={16} />}>Guardar en Bitácora</Button>
                                    <Button variant="primary" className="rounded-2xl px-8 py-4 bg-purple-600 font-black uppercase tracking-widest text-[11px]" leftIcon={<Activity size={16} />}>Ejecutar Sugerencias</Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AIDiagnostic;
