import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    children,
    className = '',
    disabled,
    ...props
}) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95';

    const variantClasses = {
        primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm hover:shadow-lg',
        secondary: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus:ring-emerald-500 border border-emerald-200 hover:border-emerald-300',
        danger: 'bg-red-100 text-red-600 hover:bg-red-200 focus:ring-red-500 border border-red-200 hover:border-red-300',
        ghost: 'text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-500 hover:text-emerald-700'
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm gap-1.5',
        md: 'px-4 py-2 gap-2',
        lg: 'px-6 py-3 text-lg gap-2'
    };

    const classes = [
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        isLoading && 'animate-pulse',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            className={classes}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Loading...</span>
                </>
            ) : (
                children
            )}
        </button>
    );
};
