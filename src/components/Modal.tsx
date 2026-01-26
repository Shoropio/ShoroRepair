import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
    allowFullscreen?: boolean;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    size = 'lg',
    allowFullscreen = false
}) => {
    const { t } = useTranslation();
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    setIsFullscreen(false);
                } else {
                    onClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose, isFullscreen]);

    // Reset fullscreen when modal closes
    useEffect(() => {
        if (!isOpen) {
            setIsFullscreen(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#202124]/40 dark:bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className={`
                relative w-full bg-white dark:bg-[#202124] shadow-2xl overflow-hidden
                animate-in zoom-in-95 slide-in-from-bottom-2 duration-300
                ${isFullscreen ? 'h-full max-w-full' : sizes[size]}
            `}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 px-8 border-b border-[#f1f3f4] dark:border-white/5">
                    <div>
                        <h2 className="text-xl font-semibold text-[#202124] dark:text-white tracking-tight">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {allowFullscreen && (
                            <button
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 transition-all"
                                title={isFullscreen ? t('common.exit_fullscreen', 'Salir de pantalla completa') : t('common.fullscreen', 'Pantalla completa')}
                            >
                                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className={`p-8 overflow-y-auto ${isFullscreen ? 'h-[calc(100%-140px)]' : 'max-h-[75vh]'}`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-3 p-6 px-8 bg-[#f8f9fa] dark:bg-white/[0.02] border-t border-[#f1f3f4] dark:border-white/5">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
