import React from 'react';

interface CardProps {
    children: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    variant?: 'outlined' | 'elevated' | 'tonal';
}

const Card: React.FC<CardProps> = ({
    children,
    header,
    footer,
    className = '',
    variant = 'outlined'
}) => {
    const variants = {
        outlined: 'bg-white dark:bg-[#1a1c1e] border border-[#dadce0] dark:border-[#3c4043]',
        elevated: 'bg-white dark:bg-[#1a1c1e] shadow-md border-none',
        tonal: 'bg-[#f1f3f4] dark:bg-[#2d2f31] border-none'
    };

    return (
        <div className={`
            overflow-hidden rounded-none transition-shadow duration-300
            ${variants[variant]}
            ${className}
        `}>
            {header && (
                <div className="px-6 py-4 border-b border-[#f1f3f4] dark:border-white/5">
                    {header}
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
            {footer && (
                <div className="px-6 py-4 border-t border-[#f1f3f4] dark:border-white/5 bg-[#fafafa]/50 dark:bg-white/[0.02]">
                    {footer}
                </div>
            )}
        </div>
    );
};

export default Card;
