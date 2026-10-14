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
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'
      } ${
        isDarkMode
          ? 'bg-[#0b121c] border-[#172334] text-white'
          : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700/30">
          <div>
            {title && (
              <h3 className="font-bold text-base sm:text-lg tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
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
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  icon,
  size = 'md',
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-xs font-bold',
    lg: 'px-6 py-3 text-sm font-bold',
  }[size];

  return (
    <button
      {...props}
      disabled={disabled}
      className={`bg-[#3898EC] hover:bg-[#2b85d6] text-white rounded-full transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
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
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-xs font-semibold';

  const colorClasses =
    variant === 'danger'
      ? isDarkMode
        ? 'border-rose-900/60 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40'
        : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
      : isDarkMode
      ? 'border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300'
      : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700';

  return (
    <button
      {...props}
      disabled={disabled}
      className={`rounded-full border transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${colorClasses} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
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
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  size = 'sm',
  className = '',
}) => {
  const upper = (status || '').toUpperCase();

  let color = 'bg-slate-500/10 text-slate-400 border-slate-500/30';

  if (['IN TRANSIT', 'IN_TRANSIT', 'ACTIVE', 'DISPATCHED'].includes(upper)) {
    color = 'bg-sky-500/10 text-[#3898EC] border-sky-500/30';
  } else if (['DELIVERED', 'PAID', 'APPROVED', 'VERIFIED'].includes(upper)) {
    color = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  } else if (['SCHEDULED', 'DUE', 'PENDING', 'ASSIGNED'].includes(upper)) {
    color = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  } else if (['CANCELLED', 'OVERDUE', 'REJECTED', 'FAILED'].includes(upper)) {
    color = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  }

  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`font-mono font-semibold rounded-full border inline-flex items-center gap-1.5 shrink-0 ${sizeClass} ${color} ${className}`}
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
      <label className="block text-xs font-semibold text-slate-400">
        {label} {required && <span className="text-[#3898EC]">*</span>}
      </label>
      <input
        {...props}
        required={required}
        className={`w-full text-xs p-2.5 rounded-xl border transition-colors ${
          isDarkMode
            ? 'border-slate-700 bg-[#060b11] text-white focus:outline-none focus:border-[#3898EC]'
            : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#3898EC]'
        }`}
      />
      {helperText && (
        <p className="text-[11px] text-slate-400 mt-0.5">{helperText}</p>
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
      <label className="block text-xs font-semibold text-slate-400">
        {label} {required && <span className="text-[#3898EC]">*</span>}
      </label>
      <select
        {...props}
        required={required}
        className={`w-full text-xs p-2.5 rounded-xl border transition-colors cursor-pointer ${
          isDarkMode
            ? 'border-slate-700 bg-[#060b11] text-white focus:outline-none focus:border-[#3898EC]'
            : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#3898EC]'
        }`}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className={isDarkMode ? 'bg-[#0b121c] text-white' : 'bg-white text-slate-900'}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && (
        <p className="text-[11px] text-slate-400 mt-0.5">{helperText}</p>
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
    <div className={`flex items-center gap-2 mb-1 ${className}`}>
      <span className="w-4 h-0.5 bg-[#3898EC]" />
      <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
        {text}
      </span>
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
}

export const Logo: React.FC<LogoProps> = ({
  subtitle = 'EMERGENCY FREIGHT',
  onClick,
  isAdmin = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 ${onClick ? 'cursor-pointer group' : ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="w-8 h-8 relative flex items-center justify-center shrink-0">
        <svg viewBox="0 0 32 32" className="w-8 h-8 fill-none">
          <path d="M6 10L14 4L18 7L10 13L6 10Z" fill="#3898EC" />
          <path d="M14 28L22 22L26 25L18 31L14 28Z" fill="#3898EC" />
          <path
            d="M8 22L16 16L20 19L12 25L8 22Z"
            fill="#3898EC"
            className="opacity-70"
          />
          <path
            d="M12 13L20 7L24 10L16 16L12 13Z"
            fill="#3898EC"
            className="opacity-70"
          />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="font-sans font-black tracking-tight text-lg leading-none">
            NEO
          </span>
          <span className="font-mono font-medium text-xs tracking-wider opacity-80 leading-none">
            {isAdmin ? 'DISPATCH OPS' : 'TRANSPORT'}
          </span>
          {isAdmin && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm bg-rose-500/20 text-rose-400 border border-rose-500/40 uppercase font-bold tracking-wider ml-1">
              ADMIN
            </span>
          )}
        </div>
        <span className="font-mono text-[9px] text-[#3898EC] tracking-widest uppercase font-semibold mt-0.5">
          {subtitle}
        </span>
      </div>
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
      className={`flex items-center p-0.5 rounded-full border ${
        isDarkMode
          ? 'bg-[#0b121c] border-slate-700/60'
          : 'bg-slate-100 border-slate-300'
      }`}
    >
      <button
        type="button"
        onClick={onToggleTheme}
        className={`p-1.5 rounded-full transition-all cursor-pointer ${
          !isDarkMode
            ? 'bg-white text-amber-500 shadow-xs'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="Light mode"
        aria-label="Light mode"
      >
        <Sun className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggleTheme}
        className={`p-1.5 rounded-full transition-all cursor-pointer ${
          isDarkMode
            ? 'bg-slate-800 text-sky-400 shadow-xs'
            : 'text-slate-400 hover:text-slate-700'
        }`}
        title="Dark mode"
        aria-label="Dark mode"
      >
        <Moon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
