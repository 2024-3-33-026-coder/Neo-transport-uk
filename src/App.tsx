import React, { useState } from 'react';
import {
  Phone,
  ArrowRight,
  CheckCircle2,
  Sun,
  Moon,
  Building2,
  FileCheck,
  Loader2,
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
      <label className="block text-xs font-semibold text-slate-400">
        {label} {required && <span className="text-[#3898EC]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`w-full text-xs p-2.5 rounded-xl border transition-colors ${
          isDarkMode
            ? 'border-slate-700 bg-[#060b11] text-white focus:outline-none focus:border-[#3898EC]'
            : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#3898EC]'
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
      setSubmittedCode(saved?.account_code || 'NEO-SB-2026');
    } catch {
      setSubmittedCode('NEO-SB-2026');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';

  if (submittedCode) {
    return (
      <div
        className={`p-6 sm:p-10 rounded-3xl border text-center space-y-6 transition-all shadow-xl ${
          isDarkMode ? 'bg-[#09111c] border-emerald-500/30' : 'bg-emerald-50/60 border-emerald-200'
        }`}
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-400 font-bold">
            STANDBY ACCOUNT PRE-APPROVED & ACTIVE
          </span>
          <h3 className={`text-2xl sm:text-3xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {companyName}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            £15,000 credit facility assigned · 30-Day terms active · 24/7 dedicated dispatch priority line: 0800 246 8135.
          </p>
        </div>

        <div className="inline-block px-6 py-3 rounded-2xl bg-[#060b11] border border-emerald-500/40 text-emerald-400 font-mono text-2xl font-extrabold tracking-wider shadow-inner">
          {submittedCode}
        </div>

        <div className="pt-2">
          <button
            onClick={onOpenPortal}
            className="bg-[#3898EC] hover:bg-[#2b85d6] text-white px-8 py-3 rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 mx-auto group"
          >
            <span>Continue to Customer Portal →</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`p-6 sm:p-8 rounded-3xl border shadow-xl ${cardBg} space-y-6`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-0.5 bg-[#3898EC]" />
          <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
            STANDBY FACILITY ONBOARDING
          </span>
        </div>
        <h3 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          60-Second Standby Account Application
        </h3>
        <p className="text-xs text-slate-400">
          £0 fee · 30-day terms pre-cleared · No monthly minimum commitment.
        </p>
      </div>

      {/* 11 Controlled Fields in clean 2-column grid */}
      <div className="space-y-4">
        <h4 className="font-mono text-xs text-[#3898EC] font-semibold uppercase tracking-wider">
          1. Company & Primary Collection Depot
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

        <h4 className="font-mono text-xs text-[#3898EC] font-semibold uppercase tracking-wider pt-2">
          2. Operations & Dispatch Contacts
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

        <h4 className="font-mono text-xs text-[#3898EC] font-semibold uppercase tracking-wider pt-2">
          3. Current Carrier Profile & Contingency Volume
        </h4>

        {/* Selected Carriers */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400">
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
                  className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                    isSelected
                      ? 'bg-[#3898EC] text-white font-semibold'
                      : isDarkMode
                      ? 'bg-[#060b11] text-slate-400 border border-slate-700 hover:text-white'
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
          <label className="block text-xs font-semibold text-slate-400">
            Estimated Emergency / Standby Freight Volume
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {['1-5 recovery loads / mo', '5-15 loads / mo', '15+ loads / mo'].map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVolume(v)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                  volume === v
                    ? 'border-[#3898EC] bg-sky-500/10 text-[#3898EC] font-semibold'
                    : isDarkMode
                    ? 'border-slate-700 bg-[#060b11] text-slate-400 hover:text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900'
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
            className="w-4 h-4 mt-0.5 rounded text-[#3898EC] accent-[#3898EC]"
          />
          <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed cursor-pointer select-none">
            I confirm I am an authorized representative of {companyName} and accept NEO Transport's Standby B2B Terms (£0 standing fee, 30-day net invoicing on emergency dispatch).
          </label>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-slate-700/40">
        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-glow" />
          Pre-approved credit line: £15,000
        </span>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#3898EC] hover:bg-[#2b85d6] text-white px-7 py-2.5 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-2 group disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Activating Standby...</span>
            </>
          ) : (
            <>
              <span>Submit & Activate Standby</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [showPortal, setShowPortal] = useState<boolean>(false);
  const [portalInitialLoggedIn, setPortalInitialLoggedIn] = useState<boolean>(false);

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
    // Only allow instant demo entrance if Supabase is completely unconfigured.
    // In production (when configured), user must authenticate.
    setPortalInitialLoggedIn(!isSupabaseConfigured);
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
        className={`w-full border-b sticky top-0 z-30 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors ${
          isDarkMode
            ? 'bg-[#060b11]/90 border-[#172334]'
            : 'bg-white/95 border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 relative flex items-center justify-center">
              <svg viewBox="0 0 32 32" className="w-8 h-8 fill-none">
                <path d="M6 10L14 4L18 7L10 13L6 10Z" fill="#3898EC" />
                <path d="M14 28L22 22L26 25L18 31L14 28Z" fill="#3898EC" />
                <path d="M10 13L18 7L26 13L18 19L10 13Z" fill="#2b85d6" />
                <path d="M6 19L14 13L18 16L10 22L6 19Z" fill="#3898EC" />
                <path d="M14 19L22 13L26 16L18 22L14 19Z" fill="#60a5fa" />
              </svg>
            </div>
            <span className="font-extrabold tracking-tight text-lg uppercase font-sans">
              NEO TRANSPORT
            </span>
          </div>

          <div className="hidden lg:block h-4 w-px bg-slate-700/60 mx-1" />

          <span
            className={`hidden lg:inline-block font-mono text-[10px] tracking-widest uppercase ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
            }`}
          >
            EMERGENCY FREIGHT & RAPID RESPONSE
          </span>
        </div>

        {/* Right Nav Items: Accessible on both Mobile (<640px) and Desktop */}
        <div className="flex items-center gap-2 sm:gap-6">
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

          {/* Theme switcher pill */}
          <div
            className={`flex items-center p-0.5 rounded-full border ${
              isDarkMode
                ? 'bg-[#0b121c] border-slate-700/60'
                : 'bg-slate-100 border-slate-300'
            }`}
          >
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-full transition-all ${
                !isDarkMode ? 'bg-white text-amber-500 shadow-xs' : 'text-slate-400'
              }`}
              title="Light mode"
              aria-label="Light mode"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-full transition-all ${
                isDarkMode ? 'bg-slate-800 text-sky-400 shadow-xs' : 'text-slate-400'
              }`}
              title="Dark mode"
              aria-label="Dark mode"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Customer Login Button (Mobile Accessible < 640px) */}
          <button
            onClick={handleCustomerLogin}
            className={`text-xs font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all ${
              isDarkMode
                ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200'
                : 'border-slate-300 hover:bg-slate-100 text-slate-800'
            }`}
          >
            Customer Login
          </button>

          <button
            onClick={handleOpenAccount}
            className="hidden sm:inline-flex bg-[#3898EC] hover:bg-[#2b85d6] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all shadow-sm"
          >
            Open account
          </button>
        </div>
      </nav>

      {/* HERO SECTION (Matching Screenshot 2) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3898EC]/10 border border-[#3898EC]/20 text-[#3898EC] font-mono text-xs font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3898EC]" />
              <span>FREE STANDBY ACCOUNT · NO MONTHLY FEE</span>
            </div>

            <h1
              className={`text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              When your carrier fails, we keep{' '}
              <span className="text-[#3898EC] underline decoration-[#3898EC]/40 decoration-4 underline-offset-8">
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

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={handleOpenAccount}
                className="bg-[#3898EC] hover:bg-[#2b85d6] text-white px-7 py-3 rounded-full text-sm font-bold shadow-lg transition-all flex items-center gap-2 group"
              >
                <span>Open £0 Standby Account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <a
                href={CONTACT_CONFIG.phone.primaryTel}
                className={`px-6 py-3 rounded-full text-sm font-semibold border transition-all flex items-center gap-2 ${
                  isDarkMode
                    ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <Phone className="w-4 h-4 text-[#3898EC]" />
                <span>Call Dispatch ({CONTACT_CONFIG.phone.primary})</span>
              </a>

              <button
                onClick={handleEnterDemoPortal}
                className={`text-xs font-semibold px-4 py-2 transition-colors underline underline-offset-4 ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Explore Active Customer Portal →
              </button>
            </div>
          </div>

          {/* Right Hero Card (Matching Screenshot 2) */}
          <div className="lg:col-span-5">
            <div
              className={`rounded-3xl border overflow-hidden shadow-2xl relative transition-all ${
                isDarkMode
                  ? 'bg-[#0b121c] border-[#172334]'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              {/* Top Hub Tag */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white font-mono text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3898EC]" />
                <span>HUB · MANCHESTER, UK</span>
              </div>

              {/* Night Logistics Van Visual */}
              <div className="relative h-72 sm:h-80 w-full overflow-hidden bg-gradient-to-b from-slate-950 via-[#0a111a] to-[#0d1624]">
                <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
                  <defs>
                    <linearGradient id="bayLight" x1="0%" y1="0%" x2="50%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#3898EC" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <rect x="0" y="0" width="600" height="400" fill="#06090e" />
                  <rect x="420" y="60" width="160" height="260" fill="#0d141f" stroke="#172334" strokeWidth="2" />
                  <line x1="420" y1="120" x2="580" y2="120" stroke="#172334" strokeWidth="1" />
                  <line x1="420" y1="180" x2="580" y2="180" stroke="#172334" strokeWidth="1" />
                  <line x1="420" y1="240" x2="580" y2="240" stroke="#172334" strokeWidth="1" />
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
                  <ellipse cx="105" cy="265" rx="8" ry="5" fill="#3898EC" opacity="0.9" />
                  <polygon points="105,265 0,250 0,290" fill="rgba(56, 152, 236, 0.2)" />

                  <circle cx="185" cy="300" r="30" fill="#05070a" stroke="#334155" strokeWidth="4" />
                  <circle cx="185" cy="300" r="14" fill="#1e293b" />
                  <circle cx="425" cy="300" r="30" fill="#05070a" stroke="#334155" strokeWidth="4" />
                  <circle cx="425" cy="300" r="14" fill="#1e293b" />

                  {/* NEO Livery */}
                  <g transform="translate(250, 225)">
                    <path d="M0 8 L6 3 L9 5 L3 10 Z" fill="#3898EC" />
                    <path d="M6 14 L12 9 L15 11 L9 16 Z" fill="#60a5fa" />
                    <text x="22" y="14" fill="#ffffff" fontSize="16" fontFamily="sans-serif" fontWeight="900" letterSpacing="0.5">
                      NEO TRANSPORT
                    </text>
                    <text x="22" y="24" fill="#3898EC" fontSize="7" fontFamily="monospace" letterSpacing="1">
                      EMERGENCY FREIGHT & RAPID RESPONSE
                    </text>
                  </g>

                  <rect x="75" y="275" width="30" height="9" fill="#facc15" rx="2" />
                  <text x="78" y="282" fill="#000000" fontSize="6" fontFamily="monospace" fontWeight="bold">NEO 1</text>
                </svg>
              </div>

              {/* Bottom Card Stats */}
              <div className="p-6 bg-[#0a111a] border-t border-[#172334]">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-800/80">
                  <div>
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block">
                      MONTHLY FEE
                    </span>
                    <div className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                      £0{' '}
                      <span className="text-xs font-normal text-slate-400">
                        / forever
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block">
                      AVAILABLE UNTIL
                    </span>
                    <div className="text-xl sm:text-2xl font-extrabold text-white mt-0.5 font-mono">
                      00:00
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 text-xs font-mono">
                  <span className="text-[#3898EC] font-bold tracking-wider uppercase">
                    STANDBY ACTIVE
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    60-second setup · No commitment
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 border-t border-slate-800/40">
          <div>
            <div
              className={`text-4xl lg:text-5xl font-extrabold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              60 min
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Average emergency collection time nationwide
            </p>
          </div>

          <div>
            <div
              className={`text-4xl lg:text-5xl font-extrabold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              98.7%
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Same-day delivery recovery success rate
            </p>
          </div>

          <div>
            <div
              className={`text-4xl lg:text-5xl font-extrabold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Nationwide
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              UK mainland & European emergency road hubs
            </p>
          </div>
        </div>
      </section>

      {/* HOW STANDBY WORKS SECTION */}
      <section
        id="how-it-works"
        className={`py-16 border-t ${
          isDarkMode ? 'border-[#172334] bg-[#080e16]' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
              CARRIER INSURANCE
            </span>
            <h2
              className={`text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Why UK Supply Chains Run on Standby
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Keep your existing courier. We only step in when they miss a collection, break down, or run out of capacity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className={`p-6 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-[#3898EC] flex items-center justify-center font-bold font-mono mb-4">
                01
              </div>
              <h3 className="font-bold text-base text-white">
                Pre-Approved & Dormant
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Open a £0 account today. All credit vetting, terms, and billing information are pre-cleared so there are zero delays during an operational crisis.
              </p>
            </div>

            <div
              className={`p-6 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-[#3898EC] flex items-center justify-center font-bold font-mono mb-4">
                02
              </div>
              <h3 className="font-bold text-base text-white">
                Dedicated Recovery Fleet
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Single-drop dedicated vehicles from Small Vans to 7.5t Rigids. No multi-drop co-loading or courier sorting hubs. Direct depot-to-door transit.
              </p>
            </div>

            <div
              className={`p-6 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-[#3898EC] flex items-center justify-center font-bold font-mono mb-4">
                03
              </div>
              <h3 className="font-bold text-base text-white">
                Live GPS & 24/7 Dispatch
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Live vehicle tracking link generated automatically for your recipient, with immediate phone escalation to our Manchester and Birmingham duty desks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* #OPEN SECTION: DEDICATED ONBOARDING FORM WITH ALL 11 CONTROLLED FIELDS */}
      <section
        id="open"
        className={`py-16 border-t px-4 sm:px-8 transition-colors ${
          isDarkMode ? 'border-[#172334] bg-[#060b11]' : 'border-slate-200 bg-white'
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
        className={`py-12 border-t px-4 sm:px-8 text-xs ${
          isDarkMode ? 'border-[#172334] bg-[#060b11] text-slate-400' : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase text-white font-sans">
              NEO TRANSPORT
            </span>
            <span>· Emergency Freight Network Ltd · Company No. 12948192</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={handleCustomerLogin} className="hover:text-white">
              Customer Login
            </button>
            <a href={CONTACT_CONFIG.phone.primaryTel} className="hover:text-white font-mono">
              {CONTACT_CONFIG.phone.primary}
            </a>
            <span>Terms & GDP Compliance</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
