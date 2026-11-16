import React, { useState, useEffect } from 'react';
import { Menu, X, Phone, ArrowRight, ArrowUpRight } from 'lucide-react';
import { BRAND_CONFIG } from '../data/siteContent';
import { scrollToSectionAnchor } from './MotionPrimitives';

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
    viewBox="0 0 268 192"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <polygon
      fill="#2563EB"
      points="111.88 69.08 111.88 133.59 133.69 146.54 133.69 146.53 188.72 178.97 267.04 133.59 267.04 57.09 155.16 122.74 155.16 58.23 133.35 45.28 133.35 45.29 78.32 12.85 0 58.23 0 134.73 111.88 69.08"
    />
    <polygon
      fill="#3898EC"
      points="89.22 108.76 12.91 153.86 78.03 191.82 122.21 166.13 88.65 146.43 89.22 108.76"
    />
    <polygon
      fill="#3898EC"
      points="177.82 83.06 254.13 37.96 189.01 0 144.83 25.69 178.39 45.39 177.82 83.06"
    />
  </svg>
);

export const Navbar: React.FC = () => {
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
    <header className="sticky top-0 z-50 h-[72px] w-full bg-white/92 backdrop-blur-md border-b border-[#E5E7EB]">
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/* Left Zone: Brand Mark + Wordmark + Sub-label */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#"
            onClick={(e) => scrollToSectionAnchor(e, '#')}
            className="flex items-center gap-2.5 text-[#111827] group focus-visible:rounded-md whitespace-nowrap shrink-0"
            aria-label="NEO Transport Home"
          >
            <NeoBrandMark className="h-6 w-8 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[16px] font-extrabold tracking-tight text-[#111827]">
              {BRAND_CONFIG.companyName}
            </span>
          </a>

          <span className="hidden xl:block h-4 w-[1px] bg-[#E5E7EB]" aria-hidden="true" />

          <span className="hidden xl:inline-block font-mono-tech text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280] whitespace-nowrap">
            {BRAND_CONFIG.subLabel}
          </span>
        </div>

        {/* Center Zone: Clean Minimalist Navigation Links */}
        <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-6 xl:gap-7">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => scrollToSectionAnchor(e, item.href)}
              className="text-[13.5px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right Zone: Customer Login + Solid Black Primary CTA */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <a
            href={BRAND_CONFIG.portalUrl}
            className="btn-secondary-light inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-medium whitespace-nowrap shrink-0"
          >
            Customer Login
          </a>

          <a
            href={BRAND_CONFIG.portalUrl}
            className="btn-primary-black inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold whitespace-nowrap shrink-0"
          >
            <span>Book a Delivery</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        {/* Mobile Menu Trigger */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] transition-colors"
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
          className="lg:hidden fixed inset-x-0 top-[72px] z-50 border-b border-[#E5E7EB] bg-white px-4 pt-4 pb-6 shadow-xl"
        >
          <div className="mb-3 pb-3 border-b border-[#E5E7EB]">
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">
              {BRAND_CONFIG.subLabel}
            </span>
          </div>

          <nav aria-label="Mobile Navigation Links" className="grid grid-cols-2 gap-2 mb-5">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => scrollToSectionAnchor(e, item.href, () => setMobileMenuOpen(false))}
                className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F3F4F6] transition-colors"
              >
                <span>{item.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
              </a>
            ))}
          </nav>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <a
              href={BRAND_CONFIG.portalUrl}
              className="btn-primary-black flex h-11 flex-1 items-center justify-center rounded-lg px-5 text-sm font-semibold"
            >
              Book a Delivery
            </a>
            <a
              href={BRAND_CONFIG.portalUrl}
              className="btn-secondary-light flex h-11 flex-1 items-center justify-center rounded-lg px-5 text-sm font-semibold"
            >
              Customer Login
            </a>
            <a
              href={BRAND_CONFIG.dispatchPhoneHref}
              className="btn-secondary-light flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium text-[#4B5563]"
            >
              <Phone className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              <span>{BRAND_CONFIG.dispatchPhoneDisplay}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
