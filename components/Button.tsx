import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  // Base: Rounded corners, font weight, flex layout
  const baseStyle = "font-sans font-semibold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl";
  
  const variants = {
    // Primary: Glassy purple gradient with glow
    primary: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] border border-white/10 hover:border-white/20 hover:-translate-y-0.5",
    
    // Secondary: Glass background, white text
    secondary: "bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/30 hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]",
    
    // Danger: Red glow
    danger: "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]",
    
    // Ghost: Transparent with hover effect
    ghost: "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
  };

  const sizes = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-5 py-2.5",
    lg: "text-base px-8 py-3"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};