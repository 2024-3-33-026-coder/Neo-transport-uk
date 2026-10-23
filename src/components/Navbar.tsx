import React, { useState, useEffect } from 'react';
import { Sun, Moon, Menu, X, Phone, ArrowUpRight } from 'lucide-react';
import { BRAND_CONFIG } from '../data/siteContent';
import { scrollToSectionAnchor } from './MotionPrimitives';

interface NavbarProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'Fleet', href: '#fleet' },
  { label: 'Coverage', href: '#coverage' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Industries', href: '#industries' },
  { label: 'FAQ', href: '#faq' },
];

export const NeoBrandMark: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M18 3L31 10.5V25.5L18 33L5 25.5V10.5L18 3Z"
      stroke="#2E90FA"
      strokeWidth="2.5"
      fill="rgba(46, 144, 250, 0.12)"
    />
    <path d="M18 3L31 10.5L18 18L5 10.5L18 3Z" fill="#3898FF" />
    <path d="M18 18L31 10.5V25.5L18 33V18Z" fill="#1D7FEA" />
    <path
      d="M11 14L25 22M25 14L11 22"
      stroke="#05080F"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

export const Navbar: React.FC<NavbarProps> = ({ theme, onToggleTheme }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header
      className="sticky top-0 z-50 h-[72px] w-full backdrop-blur-md transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/* Left Cluster: Official Brand Logo + Divider + Monospace Sub-label */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#"
            onClick={(e) => scrollToSectionAnchor(e, '#')}
            className="flex items-center gap-2.5 text-[var(--text-primary)] group focus-visible:rounded-md"
            aria-label="NEO Transport Home"
          >
            <img
              src={BRAND_CONFIG.logoUrl}
              alt="NEO Transport"
              className="h-7 w-auto shrink-0 transition-transform duration-200 group-hover:scale-105"
            />
          </a>

          <span
            className="hidden xl:block h-4 w-[1px]"
            style={{ backgroundColor: 'var(--border-subtle)' }}
            aria-hidden="true"
          />

          <span
            className="hidden xl:inline-block font-mono-tech text-[10px] font-medium uppercase tracking-[0.08em] whitespace-nowrap"
            style={{ color: 'var(--text-muted)' }}
          >
            {BRAND_CONFIG.subLabel}
          </span>
        </div>

        {/* Right Cluster: Anchor Links + Theme Switcher Pill + Secondary & Primary CTAs */}
        <div className="hidden lg:flex items-center gap-3.5 xl:gap-4 shrink-0">
          <nav aria-label="Primary Navigation" className="flex items-center gap-4 xl:gap-5 mr-1">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => scrollToSectionAnchor(e, item.href)}
                className="text-[13px] font-medium transition-colors duration-150 hover:text-[#2E90FA] whitespace-nowrap"
                style={{ color: 'var(--text-secondary)' }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Dual-icon Sun / Moon Pill Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex items-center gap-1.5 rounded-full p-1 transition-colors duration-150 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                theme === 'light'
                  ? 'bg-[#2E90FA] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                theme === 'dark'
                  ? 'bg-[#162032] text-[#3898FF]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>

          {/* Secondary CTA: Customer Login */}
          <a
            href={BRAND_CONFIG.portalUrl}
            className="inline-flex h-9 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition-all duration-150 hover:border-[#2E90FA]/60 whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            Customer Login
          </a>

          {/* Primary CTA: Book a Delivery */}
          <a
            href={BRAND_CONFIG.portalUrl}
            className="inline-flex h-9 items-center justify-center rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-4 text-[13px] font-semibold text-white transition-colors duration-150 whitespace-nowrap shadow-xs"
          >
            Book a Delivery
          </a>
        </div>

        {/* Tablet / Mobile Controls */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex items-center gap-1 rounded-full p-1"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                theme === 'light' ? 'bg-[#2E90FA] text-white' : 'text-[var(--text-muted)]'
              }`}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                theme === 'dark' ? 'bg-[#162032] text-[#3898FF]' : 'text-[var(--text-muted)]'
              }`}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="lg:hidden fixed inset-x-0 top-[72px] z-50 border-b px-4 pt-4 pb-6 shadow-2xl"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="mb-3 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <span
              className="font-mono-tech text-[11px] uppercase tracking-[0.12em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {BRAND_CONFIG.subLabel}
            </span>
          </div>

          <nav aria-label="Mobile Navigation Links" className="grid grid-cols-2 gap-2 mb-5">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => scrollToSectionAnchor(e, item.href, () => setMobileMenuOpen(false))}
                className="flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>{item.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[#2E90FA]" aria-hidden="true" />
              </a>
            ))}
          </nav>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <a
              href={BRAND_CONFIG.portalUrl}
              className="flex h-11 flex-1 items-center justify-center rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-5 text-sm font-semibold text-white transition-colors"
            >
              Book a Delivery
            </a>
            <a
              href={BRAND_CONFIG.portalUrl}
              className="flex h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              Customer Login
            </a>
            <a
              href={BRAND_CONFIG.dispatchPhoneHref}
              className="flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Phone className="h-4 w-4 text-[#2E90FA]" aria-hidden="true" />
              <span>{BRAND_CONFIG.dispatchPhoneDisplay}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
