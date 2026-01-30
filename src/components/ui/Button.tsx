import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'premium';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium tracking-tight transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] rounded-none cursor-pointer";

  const variants = {
    primary: "bg-[#1a73e8] text-white hover:bg-[#1557b0] shadow-sm",
    secondary: "bg-[#f1f3f4] dark:bg-[#2d2f31] text-[#3c4043] dark:text-[#e2e2e6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043]",
    outline: "border border-[#dadce0] dark:border-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#e8f0fe] dark:hover:bg-[#1a73e8]/10",
    ghost: "text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-white/5",
    danger: "bg-[#ea4335] text-white hover:bg-[#d93025]",
    premium: "bg-[#1a73e8] text-white shadow-md hover:shadow-lg",
  };

  const sizes = {
    sm: "px-4 py-1.5 text-xs",
    md: "px-6 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div className="mr-2 w-4 h-4 border-2 border-current border-t-transparent rounded-none animate-spin" />
      )}
      {!isLoading && leftIcon && <span className="mr-2 opacity-90">{leftIcon}</span>}
      <span className="truncate">{children}</span>
      {!isLoading && rightIcon && <span className="ml-2 opacity-90">{rightIcon}</span>}
    </button>
  );
};

export default Button;
