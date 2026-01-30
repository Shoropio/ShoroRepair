import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({
    label,
    error,
    leftIcon,
    className = '',
    children,
    ...props
}) => {
    return (
        <div className="flex flex-col space-y-1.5 w-full">
            {label && (
                <label className="text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] ml-4">
                    {label}
                </label>
            )}
            <div className="relative group">
                {leftIcon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] transition-all pointer-events-none">
                        {leftIcon}
                    </div>
                )}

                <select
                    className={`
                        w-full bg-[#f1f3f4] dark:bg-[#1a1c1e] border-2 border-transparent 
                        px-4 py-3 text-sm focus:outline-none focus:bg-white dark:focus:bg-[#1a1c1e]
                        focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] rounded-none
                        transition-all duration-200 text-[#202124] dark:text-white appearance-none
                        ${leftIcon ? 'pl-11' : ''}
                        ${error ? 'border-[#ea4335] focus:border-[#ea4335]' : ''}
                        pr-10 cursor-pointer
                        ${className}
                    `}
                    {...props}
                >
                    {children}
                </select>

                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-[#9aa0a6] pointer-events-none">
                    <ChevronDown size={16} />
                </div>
            </div>
            {error && (
                <p className="text-[11px] font-medium text-[#ea4335] mt-1 ml-4 overflow-hidden animate-in">
                    {error}
                </p>
            )}
        </div>
    );
};

export default Select;
