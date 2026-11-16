import React from 'react';
import { Sun, Moon } from 'lucide-react';

/* =========================================================================
   1. PANEL COMPONENT
   ========================================================================= */
export interface PanelProps {
  children: React.ReactNode;
  isDarkMode: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  isDarkMode,
  className = '',
  title,
  subtitle,
  action,
  compact = false,
}) => {
  return (
    <div
      className={`rounded-2xl border transition-all ${
        compact ? 'p-4 sm:p-5' : 'p-6 sm:p-7'
      } ${
        isDarkMode
          ? 'bg-[#111827] border-[#1e293b] text-white shadow-sm'
          : 'bg-white border-slate-200/80 text-slate-900 shadow-advertz'
      } ${className}`}
    >
      {(title || action) && (
        <div
          className={`flex items-center justify-between pb-4 mb-5 border-b ${
            isDarkMode ? 'border-[#1e293b]' : 'border-slate-100'
          }`}
        >
          <div>
            {title && (
              <h3 className="font-semibold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex items-center gap-2.5">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

/* =========================================================================
   2. PRIMARY BUTTON
   ========================================================================= */
export interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  icon,
  size = 'md',
  className = '',
  disabled,
  loading = false,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs font-medium',
    md: 'px-4.5 py-2 text-xs sm:text-sm font-medium',
    lg: 'px-6 py-2.5 text-sm sm:text-base font-medium',
  }[size];

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-[0.99] ${sizeClasses} ${className}`}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

/* =========================================================================
   3. GHOST BUTTON
   ========================================================================= */
export interface GhostButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isDarkMode: boolean;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
  size?: 'sm' | 'md';
}

export const GhostButton: React.FC<GhostButtonProps> = ({
  children,
  isDarkMode,
  icon,
  variant = 'default',
  size = 'md',
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs font-medium' : 'px-4 py-2 text-xs sm:text-sm font-medium';

  const colorClasses =
    variant === 'danger'
      ? isDarkMode
        ? 'border-rose-900/60 bg-rose-950/20 text-rose-300 hover:bg-rose-900/30'
        : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
      : isDarkMode
      ? 'border-[#1e293b] bg-[#111827] hover:bg-[#1e293b] text-slate-300'
      : 'border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz hover:border-slate-300';

  return (
    <button
      {...props}
      disabled={disabled}
      className={`rounded-full border transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] ${sizeClasses} ${colorClasses} ${className}`}
    >
      {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

/* =========================================================================
   4. STATUS PILL
   ========================================================================= */
export interface StatusPillProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
  isDarkMode?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  size = 'sm',
  className = '',
  isDarkMode,
}) => {
  const upper = (status || '').toUpperCase();

  // Mode-aware soft pastel semantic colors matching Advertz
  let colorClasses = '';

  if (isDarkMode === true) {
    if (['IN TRANSIT', 'IN_TRANSIT', 'ACTIVE', 'DISPATCHED', 'OPEN'].includes(upper)) {
      colorClasses = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    } else if (['DELIVERED', 'PAID', 'APPROVED', 'VERIFIED', 'RESOLVED'].includes(upper)) {
      colorClasses = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    } else if (['SCHEDULED', 'DUE', 'PENDING', 'ASSIGNED', 'IN PROGRESS', 'IN_PROGRESS'].includes(upper)) {
      colorClasses = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    } else if (['CANCELLED', 'OVERDUE', 'REJECTED', 'FAILED', 'SUSPENDED'].includes(upper)) {
      colorClasses = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    } else if (['ADMIN', 'ADMINISTRATOR'].includes(upper)) {
      colorClasses = 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    } else {
      colorClasses = 'bg-slate-500/15 text-slate-400 border-slate-500/25';
    }
  } else if (isDarkMode === false) {
    if (['IN TRANSIT', 'IN_TRANSIT', 'ACTIVE', 'DISPATCHED', 'OPEN'].includes(upper)) {
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200/80';
    } else if (['DELIVERED', 'PAID', 'APPROVED', 'VERIFIED', 'RESOLVED'].includes(upper)) {
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    } else if (['SCHEDULED', 'DUE', 'PENDING', 'ASSIGNED', 'IN PROGRESS', 'IN_PROGRESS'].includes(upper)) {
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-200/80';
    } else if (['CANCELLED', 'OVERDUE', 'REJECTED', 'FAILED', 'SUSPENDED'].includes(upper)) {
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200/80';
    } else if (['ADMIN', 'ADMINISTRATOR'].includes(upper)) {
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
    } else {
      colorClasses = 'bg-slate-50 text-slate-700 border-slate-200';
    }
  } else {
    if (['IN TRANSIT', 'IN_TRANSIT', 'ACTIVE', 'DISPATCHED', 'OPEN'].includes(upper)) {
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30';
    } else if (['DELIVERED', 'PAID', 'APPROVED', 'VERIFIED', 'RESOLVED'].includes(upper)) {
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30';
    } else if (['SCHEDULED', 'DUE', 'PENDING', 'ASSIGNED', 'IN PROGRESS', 'IN_PROGRESS'].includes(upper)) {
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    } else if (['CANCELLED', 'OVERDUE', 'REJECTED', 'FAILED', 'SUSPENDED'].includes(upper)) {
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30';
    } else if (['ADMIN', 'ADMINISTRATOR'].includes(upper)) {
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30';
    } else {
      colorClasses = 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/25';
    }
  }

  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`font-medium rounded-full border inline-flex items-center gap-1.5 shrink-0 transition-colors ${sizeClass} ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{status}</span>
    </span>
  );
};

/* =========================================================================
   5. FIELD
   ========================================================================= */
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  isDarkMode: boolean;
  required?: boolean;
  helperText?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  isDarkMode,
  required,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        className={`block text-xs font-medium ${
          isDarkMode ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {label} {required && <span className="text-blue-600">*</span>}
      </label>
      <input
        {...props}
        required={required}
        className={`w-full text-sm px-3.5 py-2.5 rounded-xl border transition-all ${
          isDarkMode
            ? 'border-[#1e293b] bg-[#111827] text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
            : 'border-slate-200 bg-white text-slate-900 shadow-advertz focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 placeholder:text-slate-400'
        }`}
      />
      {helperText && (
        <p
          className={`text-[11px] mt-1 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

/* =========================================================================
   6. SELECT FIELD
   ========================================================================= */
export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  isDarkMode: boolean;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  helperText?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  isDarkMode,
  options,
  required,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        className={`block text-xs font-medium ${
          isDarkMode ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {label} {required && <span className="text-blue-600">*</span>}
      </label>
      <select
        {...props}
        required={required}
        className={`w-full text-sm px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer ${
          isDarkMode
            ? 'border-[#1e293b] bg-[#111827] text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
            : 'border-slate-200 bg-white text-slate-900 shadow-advertz focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
        }`}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className={isDarkMode ? 'bg-[#111827] text-white' : 'bg-white text-slate-900'}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && (
        <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>
      )}
    </div>
  );
};

/* =========================================================================
   7. EYEBROW
   ========================================================================= */
export interface EyebrowProps {
  text: string;
  className?: string;
}

export const Eyebrow: React.FC<EyebrowProps> = ({ text, className = '' }) => {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60 mb-2 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
      <span>{text}</span>
    </div>
  );
};

/* =========================================================================
   8. LOGO
   ========================================================================= */
export interface LogoProps {
  subtitle?: string;
  onClick?: () => void;
  isAdmin?: boolean;
  isDarkMode?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  subtitle = 'EMERGENCY FREIGHT',
  onClick,
  isAdmin = false,
  isDarkMode = true,
}) => {
  const fullLogoSrc = isDarkMode
    ? '/brand/logos/neo-transport-full-blue-white.svg'
    : '/brand/logos/neo-transport-full-blue-navy.svg';
  const iconLogoSrc = '/brand/logos/neo-transport-icon-blue.svg';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 sm:gap-3 ${onClick ? 'cursor-pointer group' : ''} shrink-0`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={isAdmin ? 'NEO Transport Dispatch Ops Admin' : 'NEO Transport'}
    >
      {/* Mobile: Official icon only */}
      <img
        src={iconLogoSrc}
        alt="NEO Transport"
        className="sm:hidden h-6.5 w-auto object-contain shrink-0"
        style={{ aspectRatio: '267.04 / 191.82' }}
      />

      {/* Desktop: Official NEO TRANSPORT symbol AND complete wordmark */}
      <img
        src={fullLogoSrc}
        alt="NEO TRANSPORT"
        className="hidden sm:block w-[165px] md:w-[190px] h-auto object-contain shrink-0"
        style={{ aspectRatio: '1310.75 / 191.82' }}
      />

      {isAdmin ? (
        <>
          {/* Mobile compact separate label: OPS ADMIN */}
          <div className="flex sm:hidden items-center gap-1 shrink-0">
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm bg-rose-500/20 text-rose-400 border border-rose-500/40 uppercase font-bold tracking-wider">
              OPS ADMIN
            </span>
          </div>

          {/* Desktop divider separating official logo from operations identity */}
          <div className="hidden sm:block h-5 w-px bg-slate-700/60 mx-0.5 shrink-0" />

          {/* Desktop separate operations labels: DISPATCH OPS [ADMIN] */}
          <div className="hidden sm:flex flex-col shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs tracking-wider uppercase opacity-90 whitespace-nowrap">
                DISPATCH OPS
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm bg-rose-500/20 text-rose-400 border border-rose-500/40 uppercase font-bold tracking-wider">
                ADMIN
              </span>
            </div>
            {subtitle && (
              <span className="font-mono text-[9px] text-[#3898EC] tracking-widest uppercase font-semibold mt-0.5 whitespace-nowrap">
                {subtitle}
              </span>
            )}
          </div>
        </>
      ) : (
        subtitle && (
          <span
            className={`hidden md:inline-block font-mono text-[10px] tracking-widest uppercase shrink-0 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
            }`}
          >
            {subtitle}
          </span>
        )
      )}
    </div>
  );
};

/* =========================================================================
   9. THEME TOGGLE
   ========================================================================= */
export interface ThemeToggleProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  isDarkMode,
  onToggleTheme,
}) => {
  return (
    <div
      className={`flex items-center p-1 rounded-full border transition-colors ${
        isDarkMode
          ? 'bg-[#111827] border-[#1e293b]'
          : 'bg-slate-100/80 border-slate-200'
      }`}
    >
      <button
        type="button"
        onClick={isDarkMode ? onToggleTheme : undefined}
        className={`p-1.5 rounded-full transition-all cursor-pointer ${
          !isDarkMode
            ? 'bg-white text-slate-900 shadow-advertz'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="Light mode"
        aria-label="Light mode"
      >
        <Sun className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={!isDarkMode ? onToggleTheme : undefined}
        className={`p-1.5 rounded-full transition-all cursor-pointer ${
          isDarkMode
            ? 'bg-[#1e293b] text-slate-100 shadow-sm'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        title="Dark mode"
        aria-label="Dark mode"
      >
        <Moon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
