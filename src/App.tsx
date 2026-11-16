import React, { useState, useEffect } from 'react';
import {
  Phone,
  ArrowRight,
  CheckCircle2,
  Sun,
  Moon,
  Building2,
  FileCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Portal } from './Portal';
import { saveStandbyApplication, isSupabaseConfigured } from './lib/supabase';
import { CONTACT_CONFIG } from './lib/config';

export interface FieldProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  isDarkMode?: boolean;
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  disabled = false,
  className = '',
  isDarkMode = true,
}: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        className={`block text-xs font-medium ${
          isDarkMode ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {label} {required && <span className="text-[#206bc4]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`w-full text-xs p-2.5 rounded-lg border transition-colors ${
          isDarkMode
            ? 'border-[#1e2229] bg-[#0b0d11] text-white focus:outline-none focus:border-[#206bc4]'
            : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#206bc4]'
        }`}
      />
    </div>
  );
}

export interface OnboardingFormProps {
  isDarkMode: boolean;
  onOpenPortal: () => void;
}

export function OnboardingForm({ isDarkMode, onOpenPortal }: OnboardingFormProps) {
  const [companyName, setCompanyName] = useState('Meridian Logistics Ltd');
  const [tradingName, setTradingName] = useState('Meridian Express Freight');
  const [dispatchAddress, setDispatchAddress] = useState('Unit 4, Trafford Park Industrial Estate');
  const [townCity, setTownCity] = useState('Manchester');
  const [postcode, setPostcode] = useState('M17 1AB');
  const [contactName, setContactName] = useState('Chris Sullivan');
  const [jobTitle, setJobTitle] = useState('Head of Logistics & Supply Chain');
  const [driverMobile, setDriverMobile] = useState('07700 900821');
  const [opsEmail, setOpsEmail] = useState('chris@meridian.co.uk');
  const [accountsEmail, setAccountsEmail] = useState('accounts@meridian.co.uk');
  const [emergencyLine, setEmergencyLine] = useState('0161 555 0134');

  const [selectedCarriers, setSelectedCarriers] = useState<string[]>(['DPD', 'DHL', 'Palletways']);
  const [volume, setVolume] = useState<string>('5-15 loads/month');
  const [accepted, setAccepted] = useState<boolean>(true);

  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const availableCarriers = ['DPD', 'DHL', 'FedEx', 'Palletways', 'DX Freight', 'Tuffnells', 'Evri'];

  const handleCarrierToggle = (carrier: string) => {
    if (selectedCarriers.includes(carrier)) {
      setSelectedCarriers(selectedCarriers.filter((c) => c !== carrier));
    } else {
      setSelectedCarriers([...selectedCarriers, carrier]);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await saveStandbyApplication({
        company_name: companyName,
        trading_name: tradingName,
        dispatch_address: dispatchAddress,
        town_city: townCity,
        postcode: postcode,
        contact_name: contactName,
        job_title: jobTitle,
        driver_mobile: driverMobile,
        ops_email: opsEmail,
        accounts_email: accountsEmail,
        emergency_line: emergencyLine,
        selected_carriers: selectedCarriers,
        volume: volume,
      });
      if (saved?.success) {
        setSubmittedCode('STATUS: PENDING REVIEW');
      }
    } catch (err: any) {
      console.error('[Onboarding] Standby application submission failed:', err);
      setSubmitError(err?.message || 'Standby application submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardBg = isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200/80 shadow-advertz-lg';

  if (submittedCode) {
    return (
      <div
        className={`p-8 sm:p-12 rounded-3xl border text-center space-y-6 transition-all ${
          isDarkMode ? 'bg-[#111827] border-emerald-500/30' : 'bg-emerald-50/70 border-emerald-200 shadow-advertz-lg'
        }`}
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide">
            STANDBY APPLICATION SUBMITTED — PENDING REVIEW
          </span>
          <h3 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {companyName}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Your standby facility application has been securely submitted and is queued for operations review. Credit facility allocation and priority dispatch activation typically complete within 15 minutes during operating hours.
          </p>
        </div>

        <div className="inline-block px-5 py-2.5 rounded-full bg-white dark:bg-[#0b0f19] border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-semibold tracking-wider shadow-xs">
          STATUS: PENDING REVIEW
        </div>

        <div className="pt-2">
          <button
            onClick={onOpenPortal}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-7 py-3 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-2 mx-auto cursor-pointer shadow-xs"
          >
            <span>Continue to customer portal →</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`p-7 sm:p-10 rounded-3xl border ${cardBg} space-y-7`}>
      {submitError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          <span>Standby facility onboarding</span>
        </div>
        <h3 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Standby account application
        </h3>
        <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          £0 standing fee · 30-day terms pre-cleared · No monthly minimum commitment.
        </p>
      </div>

      {/* 11 Controlled Fields in clean 2-column grid */}
      <div className="space-y-4">
        <h4 className="text-xs text-blue-600 font-semibold tracking-wide">
          1. Company &amp; primary collection depot
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Registered Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            isDarkMode={isDarkMode}
          />
          <Field
            label="Trading Name (if different)"
            value={tradingName}
            onChange={(e) => setTradingName(e.target.value)}
            isDarkMode={isDarkMode}
          />
          <Field
            label="Dispatch / Collection Address"
            value={dispatchAddress}
            onChange={(e) => setDispatchAddress(e.target.value)}
            required
            isDarkMode={isDarkMode}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Town / City"
              value={townCity}
              onChange={(e) => setTownCity(e.target.value)}
              required
              isDarkMode={isDarkMode}
            />
            <Field
              label="Postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              required
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        <h4 className="font-mono text-xs text-[#206bc4] font-medium tracking-wide pt-2">
          2. Operations &amp; dispatch contacts
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Primary Contact Name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            isDarkMode={isDarkMode}
          />
          <Field
            label="Job Title / Role"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
            isDarkMode={isDarkMode}
          />
          <Field
            label="Operations Email (Booking Confirmations)"
            type="email"
            value={opsEmail}
            onChange={(e) => setOpsEmail(e.target.value)}
            required
            isDarkMode={isDarkMode}
          />
          <Field
            label="Accounts / Billing Email (Invoicing)"
            type="email"
            value={accountsEmail}
            onChange={(e) => setAccountsEmail(e.target.value)}
            required
            isDarkMode={isDarkMode}
          />
          <Field
            label="Driver / Loading Gate Mobile"
            value={driverMobile}
            onChange={(e) => setDriverMobile(e.target.value)}
            required
            isDarkMode={isDarkMode}
          />
          <Field
            label="24/7 Emergency Escalation Line"
            value={emergencyLine}
            onChange={(e) => setEmergencyLine(e.target.value)}
            required
            isDarkMode={isDarkMode}
          />
        </div>

        <h4 className="font-mono text-xs text-[#206bc4] font-medium tracking-wide pt-2">
          3. Current carrier profile &amp; contingency volume
        </h4>

        {/* Selected Carriers */}
        <div className="space-y-1.5">
          <label className={`block text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
            Current Primary Carriers (Select carriers to backup)
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {availableCarriers.map((carrier) => {
              const isSelected = selectedCarriers.includes(carrier);
              return (
                <button
                  type="button"
                  key={carrier}
                  onClick={() => handleCarrierToggle(carrier)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#206bc4] text-white font-medium'
                      : isDarkMode
                      ? 'bg-[#0b0d11] text-slate-400 border border-[#1e2229] hover:text-white'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {isSelected ? `✓ ${carrier}` : `+ ${carrier}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Volume */}
        <div className="space-y-1.5 pt-2">
          <label className={`block text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
            Estimated Emergency / Standby Freight Volume
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {['1-5 recovery loads / mo', '5-15 loads / mo', '15+ loads / mo'].map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVolume(v)}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                  volume === v
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-xs'
                    : isDarkMode
                    ? 'border-[#1e293b] bg-[#111827] text-slate-300 hover:text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-advertz'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Terms acceptance */}
        <div className="flex items-start gap-3 pt-3">
          <input
            type="checkbox"
            id="terms"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-blue-600"
          />
          <label htmlFor="terms" className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed cursor-pointer select-none">
            I confirm I am an authorized representative of {companyName} and accept NEO Transport's Standby B2B Terms (£0 standing fee, 30-day net invoicing on emergency dispatch).
          </label>
        </div>
      </div>

      <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-[#1e293b]">
        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-center sm:justify-start gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Pre-approved credit line: £15,000</span>
        </span>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-3 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-60 whitespace-nowrap cursor-pointer shrink-0 shadow-xs active:scale-[0.99]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Activating standby...</span>
            </>
          ) : (
            <>
              <span>Submit &amp; activate standby</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [showPortal, setShowPortal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get('payment') || params.get('bookingId'));
    }
    return false;
  });
  const [portalInitialLoggedIn, setPortalInitialLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get('payment') || params.get('bookingId'));
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleCustomerLogin = () => {
    setPortalInitialLoggedIn(false);
    setShowPortal(true);
  };

  const handleOpenAccount = () => {
    const openSection = document.getElementById('open');
    if (openSection) {
      openSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      setPortalInitialLoggedIn(false);
      setShowPortal(true);
    }
  };

  const handleEnterDemoPortal = () => {
    setPortalInitialLoggedIn(false);
    setShowPortal(true);
  };

  if (showPortal) {
    return (
      <Portal
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onBackToLanding={() => setShowPortal(false)}
        initialLoggedIn={portalInitialLoggedIn}
      />
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDarkMode ? 'bg-[#060b11] text-white' : 'bg-white text-slate-900'
      }`}
    >
      {/* Top Navigation Bar */}
      <nav
        className={`w-full border-b sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors ${
          isDarkMode
            ? 'bg-[#0b0f19]/95 backdrop-blur-sm border-[#1e293b]'
            : 'bg-white/95 backdrop-blur-sm border-slate-200/80 shadow-advertz'
        }`}
      >
        <div className="flex items-center gap-3 shrink-0">
          <a href="#hero" className="flex items-center shrink-0" aria-label="NEO Transport Home">
            <img
              src={
                isDarkMode
                  ? '/brand/logos/neo-transport-full-blue-white.svg'
                  : '/brand/logos/neo-transport-full-blue-navy.svg'
              }
              alt="NEO TRANSPORT"
              className="w-[126px] min-[360px]:w-[140px] sm:w-[185px] md:w-[205px] h-auto object-contain shrink-0"
              style={{ aspectRatio: '1310.75 / 191.82' }}
            />
          </a>

          <div className="hidden lg:block h-4 w-px bg-slate-300 dark:bg-slate-700/60 mx-1" />

          <span
            className={`hidden lg:inline-block font-mono text-[10px] tracking-wider uppercase ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Emergency Freight &amp; Rapid Response
          </span>
        </div>

        {/* Right Nav Items */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          <a
            href="#coverage"
            className={`hidden md:block text-xs font-medium transition-colors ${
              isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Coverage
          </a>
          <a
            href="#how-it-works"
            className={`hidden md:block text-xs font-medium transition-colors ${
              isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            How it works
          </a>

          {/* Theme switcher */}
          <div
            className={`flex items-center p-1 rounded-full border transition-colors ${
              isDarkMode
                ? 'bg-[#111827] border-[#1e293b]'
                : 'bg-slate-100/80 border-slate-200'
            }`}
          >
            <button
              onClick={isDarkMode ? toggleTheme : undefined}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                !isDarkMode ? 'bg-white text-slate-900 shadow-advertz' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Light mode"
              aria-label="Light mode"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={!isDarkMode ? toggleTheme : undefined}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                isDarkMode ? 'bg-[#1e293b] text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Dark mode"
              aria-label="Dark mode"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Customer Login Button */}
          <button
            onClick={handleCustomerLogin}
            className={`text-xs font-medium px-4 py-2 rounded-full border transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              isDarkMode
                ? 'border-[#1e293b] hover:bg-[#1e293b] text-slate-200'
                : 'border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
            }`}
          >
            Customer login
          </button>

          <button
            onClick={handleOpenAccount}
            className="hidden sm:inline-flex bg-slate-900 hover:bg-black text-white text-xs font-medium px-5 py-2 rounded-full transition-all shadow-xs cursor-pointer"
          >
            Open account
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-14 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50/80 border border-blue-200/60 text-blue-600 font-mono text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Free standby account · No monthly fee</span>
            </div>

            <h1
              className={`text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              When your carrier fails, we keep{' '}
              <span className="text-blue-600">
                your brand moving.
              </span>
            </h1>

            <p
              className={`text-base sm:text-lg max-w-2xl leading-relaxed ${
                isDarkMode ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              A pre-approved emergency logistics account that sits quietly in the background — ready the moment your main courier lets you down. Same-day collection, nationwide, until midnight.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                onClick={handleOpenAccount}
                className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-full text-xs sm:text-sm font-medium transition-all shadow-advertz flex items-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <span>Open £0 standby account</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href={CONTACT_CONFIG.phone.primaryTel}
                className={`px-5 py-3 rounded-full text-xs sm:text-sm font-medium border transition-all flex items-center gap-2 cursor-pointer ${
                  isDarkMode
                    ? 'border-[#1e293b] hover:bg-[#1e293b] text-slate-200'
                    : 'border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
                }`}
              >
                <Phone className="w-4 h-4 text-blue-600" />
                <span>Call dispatch ({CONTACT_CONFIG.phone.primary})</span>
              </a>

              <button
                onClick={handleEnterDemoPortal}
                className={`text-xs sm:text-sm font-medium px-3 py-2 transition-colors underline underline-offset-4 cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                Explore active customer portal →
              </button>
            </div>
          </div>

          {/* Right Hero Card */}
          <div className="lg:col-span-5">
            <div
              className={`rounded-3xl border overflow-hidden transition-all shadow-advertz-lg ${
                isDarkMode
                  ? 'bg-[#111827] border-[#1e293b]'
                  : 'bg-white border-slate-200/80 text-slate-900'
              }`}
            >
              {/* Top Hub Tag */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0b0d11]/90 border border-[#1e2229] text-white font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#206bc4]" />
                <span>Hub · Manchester, UK</span>
              </div>

              {/* Night Logistics Van Visual */}
              <div className="relative h-72 sm:h-80 w-full overflow-hidden bg-slate-950">
                <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
                  <defs>
                    <linearGradient id="bayLight" x1="0%" y1="0%" x2="50%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#206bc4" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <rect x="0" y="0" width="600" height="400" fill="#0b0d11" />
                  <rect x="420" y="60" width="160" height="260" fill="#12151b" stroke="#1e2229" strokeWidth="2" />
                  <line x1="420" y1="120" x2="580" y2="120" stroke="#1e2229" strokeWidth="1" />
                  <line x1="420" y1="180" x2="580" y2="180" stroke="#1e2229" strokeWidth="1" />
                  <line x1="420" y1="240" x2="580" y2="240" stroke="#1e2229" strokeWidth="1" />
                  <text x="440" y="100" fill="#334155" fontSize="24" fontFamily="monospace" fontWeight="bold">23</text>

                  <polygon points="450,20 200,380 580,380" fill="url(#bayLight)" />

                  <rect x="0" y="320" width="600" height="80" fill="#090d14" />
                  <line x1="0" y1="320" x2="600" y2="320" stroke="#1e293b" strokeWidth="2" />

                  {/* Black Mercedes Sprinter Van Body */}
                  <path
                    d="M 60 300 L 110 240 L 180 200 L 290 195 L 490 195 L 505 240 L 510 300 L 460 300 A 35 35 0 0 1 390 300 L 220 300 A 35 35 0 0 1 150 300 Z"
                    fill="#0f1722"
                    stroke="#223249"
                    strokeWidth="3"
                  />
                  <path d="M 120 240 L 175 205 L 230 205 L 220 240 Z" fill="#1e293b" opacity="0.8" />
                  <ellipse cx="105" cy="265" rx="8" ry="5" fill="#206bc4" opacity="0.9" />
                  <polygon points="105,265 0,250 0,290" fill="rgba(32, 107, 196, 0.2)" />

                  <circle cx="185" cy="300" r="30" fill="#05070a" stroke="#334155" strokeWidth="4" />
                  <circle cx="185" cy="300" r="14" fill="#1e293b" />
                  <circle cx="425" cy="300" r="30" fill="#05070a" stroke="#334155" strokeWidth="4" />
                  <circle cx="425" cy="300" r="14" fill="#1e293b" />

                  {/* NEO Livery */}
                  <g transform="translate(250, 225)">
                    <path d="M0 8 L6 3 L9 5 L3 10 Z" fill="#206bc4" />
                    <path d="M6 14 L12 9 L15 11 L9 16 Z" fill="#60a5fa" />
                    <text x="22" y="14" fill="#ffffff" fontSize="16" fontFamily="sans-serif" fontWeight="700" letterSpacing="0.5">
                      NEO TRANSPORT
                    </text>
                    <text x="22" y="24" fill="#206bc4" fontSize="7" fontFamily="monospace" letterSpacing="1">
                      EMERGENCY FREIGHT &amp; RAPID RESPONSE
                    </text>
                  </g>

                  <rect x="75" y="275" width="30" height="9" fill="#facc15" rx="2" />
                  <text x="78" y="282" fill="#000000" fontSize="6" fontFamily="monospace" fontWeight="bold">NEO 1</text>
                </svg>
              </div>

              {/* Bottom Card Stats */}
              <div className="p-6 bg-white dark:bg-[#0b0d11] border-t border-slate-100 dark:border-[#1e293b]">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-[#1e293b]">
                  <div>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Monthly fee
                    </span>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                      £0{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        / forever
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Available until
                    </span>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                      00:00
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 text-xs font-mono">
                  <span className="text-blue-600 font-semibold tracking-wide">
                    Standby active
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    60-second setup · No commitment
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-slate-200/80 dark:border-[#1e293b]">
          <div>
            <div
              className={`text-3xl lg:text-4xl font-bold tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              60 min
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Average emergency collection time nationwide
            </p>
          </div>

          <div>
            <div
              className={`text-3xl lg:text-4xl font-bold tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              98.7%
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Same-day delivery recovery success rate
            </p>
          </div>

          <div>
            <div
              className={`text-3xl lg:text-4xl font-bold tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Nationwide
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              UK mainland &amp; European emergency road hubs
            </p>
          </div>
        </div>
      </section>

      {/* HOW STANDBY WORKS SECTION */}
      <section
        id="how-it-works"
        className={`py-20 border-t transition-colors ${
          isDarkMode ? 'border-[#1e293b] bg-[#0b0f19]' : 'border-slate-200/80 bg-[#f8fafc]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Contingency carrier coverage</span>
            </div>
            <h2
              className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Why UK supply chains run on standby
            </h2>
            <p className="text-xs sm:text-base text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
              Keep your existing courier. We only step in when they miss a collection, break down, or run out of capacity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            <div
              className={`p-7 rounded-2xl border transition-all ${
                isDarkMode
                  ? 'bg-[#111827] border-[#1e293b]'
                  : 'bg-white border-slate-200/80 shadow-advertz shadow-advertz-hover'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold font-mono text-xs mb-4">
                01
              </div>
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                Pre-approved &amp; dormant
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Open a £0 account today. All credit vetting, terms, and billing information are pre-cleared so there are zero delays during an operational crisis.
              </p>
            </div>

            <div
              className={`p-7 rounded-2xl border transition-all ${
                isDarkMode
                  ? 'bg-[#111827] border-[#1e293b]'
                  : 'bg-white border-slate-200/80 shadow-advertz shadow-advertz-hover'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold font-mono text-xs mb-4">
                02
              </div>
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                Dedicated recovery fleet
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Single-drop dedicated vehicles from Small Vans to 7.5t Rigids. No multi-drop co-loading or courier sorting hubs. Direct depot-to-door transit.
              </p>
            </div>

            <div
              className={`p-7 rounded-2xl border transition-all ${
                isDarkMode
                  ? 'bg-[#111827] border-[#1e293b]'
                  : 'bg-white border-slate-200/80 shadow-advertz shadow-advertz-hover'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold font-mono text-xs mb-4">
                03
              </div>
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                Live GPS &amp; 24/7 dispatch
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Live vehicle tracking link generated automatically for your recipient, with immediate phone escalation to our Manchester and Birmingham duty desks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* #OPEN SECTION: DEDICATED ONBOARDING FORM WITH ALL 11 CONTROLLED FIELDS */}
      <section
        id="open"
        className={`py-20 border-t px-4 sm:px-8 transition-colors ${
          isDarkMode ? 'border-[#1e293b] bg-[#0b0f19]' : 'border-slate-200/80 bg-white'
        }`}
      >
        <div className="max-w-4xl mx-auto">
          <OnboardingForm
            isDarkMode={isDarkMode}
            onOpenPortal={handleEnterDemoPortal}
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className={`py-14 border-t px-4 sm:px-8 text-xs ${
          isDarkMode ? 'border-[#1e293b] bg-[#0b0f19] text-slate-400' : 'border-slate-200/80 bg-[#f8fafc] text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={
                isDarkMode
                  ? '/brand/logos/neo-transport-full-blue-white.svg'
                  : '/brand/logos/neo-transport-full-blue-navy.svg'
              }
              alt="NEO TRANSPORT"
              className="h-5 w-auto object-contain shrink-0"
              style={{ aspectRatio: '1310.75 / 191.82' }}
            />
            <span className="hidden sm:inline">· Emergency Freight Network Ltd · Company No. 12948192</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={handleCustomerLogin} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Customer Login
            </button>
            <a href={CONTACT_CONFIG.phone.primaryTel} className="hover:text-slate-900 dark:hover:text-white font-mono transition-colors">
              {CONTACT_CONFIG.phone.primary}
            </a>
            <span>Terms &amp; GDP Compliance</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
