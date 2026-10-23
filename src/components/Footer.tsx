import React from 'react';
import { Phone, ArrowRight, Headphones, Shield, ExternalLink } from 'lucide-react';
import { BRAND_CONFIG } from '../data/siteContent';
import { ScrollReveal, scrollToSectionAnchor } from './MotionPrimitives';

export const Footer: React.FC = () => {
  return (
    <>
      {/* Final High-Urgency Conversion Banner */}
      <section
        aria-labelledby="conversion-banner-heading"
        className="py-16 sm:py-20"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div
              className="neo-card rounded-3xl p-7 sm:p-10 lg:p-12 relative overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-7">
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5"
                    style={{
                      backgroundColor: 'rgba(46, 144, 250, 0.1)',
                      border: '1px solid rgba(46, 144, 250, 0.28)',
                    }}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#2E90FA] telemetry-dot" aria-hidden="true" />
                    <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.11em] text-[#3898FF]">
                      UK &amp; EU SAME DAY COURIER SPECIALISTS • 60 MIN COLLECTION
                    </span>
                  </div>

                  <h2
                    id="conversion-banner-heading"
                    className="section-h2 mb-4"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Ready to book a dedicated same-day delivery or activate your £0 Standby Account?
                  </h2>

                  <p
                    className="text-[16px] leading-[1.6] max-w-[58ch]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Dispatch a dedicated UK or European vehicle within 60 minutes, or pre-approve
                    your business today with zero monthly retainer and instant access to the NEO
                    Transport Customer Portal.
                  </p>
                </div>

                {/* Dual-Path CTA Cards */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  {/* Path A: Book a Delivery / Customer Portal */}
                  <div
                    className="rounded-2xl p-5"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      border: '1px solid rgba(46, 144, 250, 0.4)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#3898FF]">
                        PATH A • ONLINE BOOKING &amp; PORTAL
                      </span>
                      <span className="font-mono-tech text-[11px] font-bold text-[#10B981]">
                        &lt; 60 MIN SLA
                      </span>
                    </div>
                    <p className="text-[13px] mb-4" style={{ color: 'var(--text-secondary)' }}>
                      Instant access to live booking, GPS tracking, digital PODs, and priority dispatch.
                    </p>
                    <a
                      href={BRAND_CONFIG.portalBookingUrl}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-5 text-[14px] font-semibold text-white transition-colors"
                    >
                      <span>Book a Delivery</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>

                  {/* Path B: 24/7 Emergency Dispatch */}
                  <div
                    className="rounded-2xl p-5"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--text-muted)' }}>
                        PATH B • 24/7 EMERGENCY DISPATCH DESK
                      </span>
                      <span className="font-mono-tech text-[11px] text-[#F59E0B]">
                        {BRAND_CONFIG.dispatchResponseAvg.toUpperCase()}
                      </span>
                    </div>
                    <a
                      href={BRAND_CONFIG.dispatchPhoneHref}
                      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full px-5 text-[14px] font-semibold transition-colors hover:border-[#2E90FA]/60"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Headphones className="h-4 w-4 text-[#2E90FA]" aria-hidden="true" />
                      <span>Call Dispatch ({BRAND_CONFIG.dispatchPhoneDisplay})</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Enterprise Footer */}
      <footer
        role="contentinfo"
        className="pt-14 pb-24 md:pb-14"
        style={{ backgroundColor: 'var(--bg-canvas)' }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 pb-12" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {/* Col 1 (5 cols): Brand Presentation & Operational Status with Official Logo */}
            <div className="lg:col-span-5">
              <a
                href="#top"
                onClick={(e) => scrollToSectionAnchor(e, '#top')}
                aria-label="NEO Transport — Return to top"
                className="inline-flex items-center gap-3 mb-4"
              >
                <img
                  src={BRAND_CONFIG.logoUrl}
                  alt="NEO Transport"
                  className="h-7 sm:h-8 w-auto object-contain"
                />
              </a>

              <div
                className="font-mono-tech text-[10px] font-semibold uppercase tracking-[0.12em] mb-3"
                style={{ color: '#3898FF' }}
              >
                {BRAND_CONFIG.subLabel}
              </div>

              <p
                className="text-[14px] leading-[1.6] max-w-sm mb-5"
                style={{ color: 'var(--text-secondary)' }}
              >
                We&apos;re NEO Transport – your trusted partner for same-day shipping, end-to-end
                logistics, and dedicated business deliveries across the UK and Europe.
              </p>

              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                style={{
                  backgroundColor: 'var(--status-green-bg)',
                  border: '1px solid var(--status-green-border)',
                }}
              >
                <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.09em] text-[#10B981]">
                  LIVE FLEET TRACKING ACTIVE • 24/7/365
                </span>
              </div>
            </div>

            {/* Col 2 (3 cols): Quick Links */}
            <div className="lg:col-span-3">
              <div
                className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.11em] mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                QUICK LINKS
              </div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li>
                  <a
                    href="#services"
                    onClick={(e) => scrollToSectionAnchor(e, '#services')}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Courier &amp; Freight Services
                  </a>
                </li>
                <li>
                  <a
                    href="#fleet"
                    onClick={(e) => scrollToSectionAnchor(e, '#fleet')}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Dedicated Fleet &amp; Payloads
                  </a>
                </li>
                <li>
                  <a
                    href="#coverage"
                    onClick={(e) => scrollToSectionAnchor(e, '#coverage')}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    UK &amp; EU Coverage Hubs
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    onClick={(e) => scrollToSectionAnchor(e, '#how-it-works')}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    How It Works &amp; Live Portal
                  </a>
                </li>
                <li>
                  <a
                    href="#industries"
                    onClick={(e) => scrollToSectionAnchor(e, '#industries')}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Industry Solutions
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    onClick={(e) => scrollToSectionAnchor(e, '#faq')}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Operational FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3 (2 cols): Customer Portal & Legal */}
            <div className="lg:col-span-2">
              <div
                className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.11em] mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                PORTAL &amp; LEGAL
              </div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li>
                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    className="inline-flex items-center gap-1 hover:text-[#2E90FA] transition-colors font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>Book a Delivery</span>
                    <ExternalLink className="h-3 w-3 text-[#3898FF]" aria-hidden="true" />
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_CONFIG.portalLoginUrl}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Customer Login
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_CONFIG.portalTrackingUrl}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Live Shipment Tracking
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_CONFIG.portalUrl}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_CONFIG.portalUrl}
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Terms &amp; Conditions
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4 (2 cols): Follow Us & 24/7 Dispatch */}
            <div className="lg:col-span-2">
              <div
                className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.11em] mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                CONNECT
              </div>
              <ul className="space-y-2.5 text-[13.5px] mb-6">
                <li>
                  <a
                    href="https://www.linkedin.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    X (Twitter)
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Facebook
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2E90FA] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Instagram
                  </a>
                </li>
              </ul>

              <div className="font-mono-tech text-[11px]" style={{ color: 'var(--text-muted)' }}>
                24/7 DISPATCH:
                <a
                  href={BRAND_CONFIG.dispatchPhoneHref}
                  className="block text-[13px] font-bold text-[#3898FF] hover:underline mt-0.5"
                >
                  {BRAND_CONFIG.dispatchPhoneDisplay}
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Row */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            <p>© 2026 NEO Transport. All rights reserved.</p>
            <div className="flex items-center gap-2 font-mono-tech text-[11px]">
              <Shield className="h-3.5 w-3.5 text-[#2E90FA]" aria-hidden="true" />
              <span>UK &amp; EU DEDICATED SAME-DAY LOGISTICS NETWORK</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile (< 768px) Sticky Quick-Action Bar (compact height <= 56px to respect 15% viewport cap) */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 px-3 flex items-center justify-between gap-2 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-header)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <a
          href={BRAND_CONFIG.dispatchPhoneHref}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <Phone className="h-3.5 w-3.5 text-[#2E90FA]" aria-hidden="true" />
          <span>{BRAND_CONFIG.dispatchPhoneDisplay}</span>
        </a>
        <a
          href={BRAND_CONFIG.portalBookingUrl}
          className="flex h-9 flex-1 items-center justify-center rounded-full bg-[#2E90FA] px-3 text-[12px] font-semibold text-white"
        >
          Book a Delivery →
        </a>
      </div>
    </>
  );
};
