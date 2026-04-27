import React from "react";

export const GlassCard = ({
  children,
  className = "",
  softUI = false,
  minimal = false,
  elevated = false,
}: {
  children: React.ReactNode;
  className?: string;
  softUI?: boolean;
  minimal?: boolean;
  elevated?: boolean;
}) => {
  const baseClasses = `
    relative overflow-hidden rounded-2xl transition-all duration-300
    ${softUI ? "soft-ui-card" : ""}
    ${minimal ? "minimal-card" : ""}
    ${elevated ? "shadow-2xl" : ""}
  `;

  const fallbackClasses = `
    /* Fallback for browsers that don't support blur or users with reduced-transparency settings */
    bg-slate-900/80
    /* Modern Glass effect */
    backdrop-blur-md border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]
  `;

  return (
    <div className={`${baseClasses} ${!softUI && !minimal ? fallbackClasses : ""} ${className}`}>
      {/* Decorative inner gradient for "Premium" feel */}
      {!minimal && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      )}

      {/* Soft UI highlight effect */}
      {softUI && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      )}

      {/* Elevated shadow effect */}
      {elevated && (
        <div className="absolute inset-0 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] pointer-events-none" />
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
};
