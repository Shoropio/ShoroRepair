import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../offline/db';
import {
    BrainCircuit,
    Zap,
    Send,
    Sparkles,
    Cpu,
    Microscope,
    Clock,
    CheckCircle2,
    AlertCircle,
    Smartphone,
    Search,
    Wrench,
    Stars,
    Ghost,
    Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Button, Input, Card, Badge } from '../components';

const AI_MODELS = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Veloz)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Preciso)' }
];

const AIDiagnostic: React.FC = () => {
    const { t } = useTranslation();
    const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
    const [searchQuery, setSearchQuery] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const orders = useLiveQuery(() =>
        db.orders
            .where('deleted').equals(0)
            .filter(o => o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || o.brand.toLowerCase().includes(searchQuery.toLowerCase()))
            .limit(5)
            .toArray()
        , [searchQuery]);

    const runDiagnostic = async (order?: any) => {
        const settings = (await db.settings.toArray())[0];
        if (!settings?.geminiApiKey) {
            toast.error(t('settings.api_key_missing') || "API Key missing");
            return;
        }

        setIsLoading(true);
        try {
            const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
            const model = genAI.getGenerativeModel({ model: selectedModel });

            const prompt = order
                ? `${t('orders.diagnosis_ai_instruction', { brand: order.brand, model: order.model, issue: order.issueDescription })}`
                : customPrompt;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();
            setResult(content);
            toast.success(t('ai.diagnostic_completed') || "AI Diagnostic Completed");
        } catch (err: any) {
            toast.error(`${t('messages.error')}: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 lg:space-y-8 animate-in pb-12 lg:pb-20">
            {/* Premium Header */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-[#1a1c1e] p-6 lg:p-8 rounded-none shadow-xl shadow-purple-500/5 border border-[#f1f3f4] dark:border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-2xl font-bold text-[#202124] dark:text-white tracking-tight flex items-center gap-3">
                        <BrainCircuit className="text-purple-600" size={28} />
                        {t('ai.assistant_title')}
                    </h1>
                    <p className="text-xs lg:text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1 font-medium max-w-md">
                        {t('ai.assistant_subtitle')}
                    </p>
                </div>
                <div className="flex bg-[#f1f3f4] dark:bg-white/5 p-1 rounded-none relative z-10 border border-gray-100 dark:border-white/5 shadow-inner">
                    {AI_MODELS.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedModel(m.id)}
                            className={`px-4 lg:px-6 py-2 rounded-none text-[10px] font-black uppercase tracking-widest transition-all ${selectedModel === m.id ? 'bg-white dark:bg-[#1a1c1e] text-purple-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {m.id === 'gemini-1.5-flash' ? t('ai.model_flash') : t('ai.model_pro')}
                        </button>
                    ))}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-12 xl:col-span-4 space-y-6">
                    <Card className="p-6 lg:p-8 rounded-none shadow-xl border-none bg-white dark:bg-[#1a1c1e]">
                        <div className="flex items-center gap-3 mb-6">
                            <Zap className="text-amber-500" size={18} />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#5f6368]">{t('ai.analysis_input')}</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder={t('ai.search_order')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9fa] dark:bg-white/5 rounded-none outline-none focus:ring-2 ring-purple-500/10 border border-transparent focus:border-purple-500/20 text-sm font-medium transition-all"
                                />
                            </div>

                            {searchQuery && orders && (
                                <div className="space-y-2 animate-in slide-in-from-top-2">
                                    {orders.map(o => (
                                        <button
                                            key={o.id}
                                            onClick={() => { runDiagnostic(o); setSearchQuery(''); }}
                                            className="w-full p-3 rounded-none bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 text-left hover:bg-purple-100 transition-colors flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">OS-{o.orderNumber.slice(-4)}</p>
                                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{o.brand} {o.model}</p>
                                            </div>
                                            <Sparkles size={14} className="text-purple-400 group-hover:scale-125 transition-transform" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3 block">{t('ai.custom_analysis')}</label>
                                <textarea
                                    className="w-full p-4 bg-[#f8f9fa] dark:bg-white/5 rounded-none text-xs font-medium min-h-[120px] outline-none focus:ring-2 ring-purple-500/10 border border-transparent focus:border-purple-500/20 transition-all resize-none"
                                    placeholder={t('ai.write_symptoms')}
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                />
                                <Button
                                    variant="primary"
                                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700 shadow-purple-500/20 rounded-none py-3 text-[10px] font-black uppercase tracking-widest"
                                    onClick={() => runDiagnostic()}
                                    disabled={isLoading || (!customPrompt && !searchQuery)}
                                    leftIcon={isLoading ? <Cpu className="animate-spin" size={16} /> : <Stars size={16} />}
                                >
                                    {isLoading ? t('messages.loading') : t('ai.analyze')}
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 lg:p-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-none border-none text-white overflow-hidden relative group">
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-none">
                                <Lightbulb size={24} className="animate-pulse" />
                            </div>
                            <div>
                                <h4 className="font-bold text-xs uppercase tracking-widest opacity-80">{t('ai.technical_tip')}</h4>
                                <p className="text-[10px] font-medium leading-relaxed mt-1">{t('ai.tip_desc')}</p>
                            </div>
                        </div>
                        <Ghost className="absolute -right-4 -bottom-4 opacity-10 group-hover:rotate-12 transition-transform" size={100} />
                    </Card>
                </div>

                {/* Display Panel */}
                <div className="lg:col-span-12 xl:col-span-8">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center py-20 bg-white dark:bg-[#1a1c1e] rounded-none border-2 border-dashed border-purple-100">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-purple-100 border-t-purple-600 rounded-none animate-spin"></div>
                                <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-600" size={24} />
                            </div>
                            <h3 className="mt-8 text-sm font-black uppercase tracking-widest text-purple-600 animate-pulse">{t('ai.analyzing')}</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">{t('ai.consulting_gemini')}</p>
                        </div>
                    ) : result ? (
                        <div className="space-y-6 animate-in zoom-in-95 duration-500">
                            <Card className="p-6 lg:p-10 rounded-none shadow-xl border-none bg-white dark:bg-[#1a1c1e] relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-5">
                                    <Stars size={80} />
                                </div>
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-3 bg-purple-50 dark:bg-purple-900/10 text-purple-600 rounded-none">
                                        <Microscope size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-700">{t('ai.intelligence_report')}</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{t('ai.processed_result')}</p>
                                    </div>
                                </div>

                                <div className="prose prose-purple dark:prose-invert max-w-none">
                                    <div className="whitespace-pre-wrap text-xs lg:text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">
                                        {result}
                                    </div>
                                </div>

                                <div className="mt-10 pt-6 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                                        <Clock size={12} /> {t('ai.processed_in', { time: 1.2 })}
                                    </div>
                                    <Button variant="outline" className="rounded-none px-6 py-2 text-[10px] font-black uppercase" onClick={() => setResult(null)}>{t('ai.new_query')}</Button>
                                </div>
                            </Card>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-[#f8f9fa] dark:bg-[#1a1c1e] rounded-none border-2 border-dashed border-[#dadce0] dark:border-white/10 group">
                            <div className="w-20 h-20 bg-white dark:bg-[#202124] rounded-none shadow-lg flex items-center justify-center text-gray-200 group-hover:scale-110 group-hover:text-purple-300 transition-all duration-500">
                                <Sparkles size={40} />
                            </div>
                            <h3 className="mt-8 text-sm font-black uppercase tracking-widest text-gray-400">{t('ai.results_panel')}</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">{t('ai.start_diagnostic_desc')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIDiagnostic;
