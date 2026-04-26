import React, { FC } from 'react';
import { Menu } from 'lucide-react';

interface AppHeaderProps {
    currentView?: string;
    onToggleSidebar?: () => void;
    onCommandPaletteOpen?: () => void;
    onFocusModeToggle?: () => void;
    onFullscreenToggle?: () => void;
    onThemeChange?: (newTheme: string) => void;
    theme?: any;
    isOffline?: boolean;
    performanceMetrics?: any;
}

export const AppHeader: FC<AppHeaderProps> = ({ 
    currentView = 'dashboard',
    onToggleSidebar = () => {},
    onCommandPaletteOpen = () => {},
    onFocusModeToggle = () => {},
    onFullscreenToggle = () => {},
    onThemeChange = () => {},
    theme,
    isOffline = false,
    performanceMetrics
}) => {
    return (
        <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800">
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                    <Menu size={20} className="text-slate-300" />
                </button>
                <h1 className="text-lg text-white font-semibold">
                    {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
                </h1>
            </div>
        </header>
    );
};
