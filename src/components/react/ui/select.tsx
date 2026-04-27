import React, { useState } from "react";

interface SelectProps {
  children: React.ReactNode;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps {
  children: React.ReactNode;
  value: string;
  className?: string;
  // @ts-ignore
  onClick?: () => void;
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  children,
  className = "",
  value,
  onValueChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {value || <SelectValue placeholder="Select an option..." />}
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <SelectContent>{children}</SelectContent>
        </div>
      )}
    </div>
  );
};

export const SelectContent: React.FC<SelectContentProps> = ({ children, className = "" }) => {
  return <div className={`py-1 ${className}`}>{children}</div>;
};

export const SelectItem: React.FC<SelectItemProps> = ({
  children,
  value,
  className = "",
  onClick,
}) => {
  return (
    <div
      onClick={() => {
        // Find parent Select and call onValueChange
        // @ts-ignore
        const selectElement = document.body.closest("[data-select]");
        if (selectElement) {
          // @ts-ignore
          const selectComponent = selectElement.__reactInternalInstance;
          if (selectComponent && selectComponent.props.onValueChange) {
            selectComponent.props.onValueChange(value);
          }
        }
        if (onClick) onClick();
      }}
      className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${className}`}
      data-value={value}
    >
      {children}
    </div>
  );
};

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children, className = "" }) => {
  return <div className={className}>{children}</div>;
};

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder, className = "" }) => {
  return <span className={`block truncate ${className}`}>{placeholder}</span>;
};
