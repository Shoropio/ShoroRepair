import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'brand' | 'success' | 'warning' | 'error' | 'slate';
    size?: 'xs' | 'sm';
    className?: string;
}

const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'brand',
    size = 'sm',
    className = ''
}) => {
    const variants = {
        brand: "bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a73e8]/20 dark:text-[#8ab4f8]",
        success: "bg-[#e6f4ea] text-[#1e8e3e] dark:bg-[#34a853]/20 dark:text-[#81c995]",
        warning: "bg-[#fef7e0] text-[#f9ab00] dark:bg-[#fbbc04]/20 dark:text-[#fdd663]",
        error: "bg-[#fce8e6] text-[#d93025] dark:bg-[#ea4335]/20 dark:text-[#f28b82]",
        slate: "bg-[#f1f3f4] text-[#3c4043] dark:bg-[#3c4043]/40 dark:text-[#e8eaed]",
    };

    const sizes = {
        xs: "px-2 py-0.5 text-[10px]",
        sm: "px-3 py-1 text-xs",
    };

    return (
        <span className={`
            inline-flex items-center font-semibold rounded-none
            ${variants[variant]} ${sizes[size]} ${className}
        `}>
            {children}
        </span>
    );
};

export default Badge;
