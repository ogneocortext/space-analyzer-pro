import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  disabled = false, 
  className = '',
  type = 'button'
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 
        bg-blue-600 
        text-white 
        rounded-md 
        hover:bg-blue-700 
        disabled:bg-gray-400 
        disabled:cursor-not-allowed
        transition-colors 
        duration-200
        ${className}
      `}
    >
      {children}
    </button>
  );
};