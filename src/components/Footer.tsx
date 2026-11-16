import React from 'react';
import { Phone, ArrowRight, Headphones, Shield, ExternalLink } from 'lucide-react';
import { BRAND_CONFIG } from '../data/siteContent';
import { ScrollReveal, scrollToSectionAnchor } from './MotionPrimitives';
import { NeoBrandMark } from './Navbar';

export const Footer: React.FC = () => {
  return (
    <>
      {/* Final Centered Conversion Section matching Advertz.ai bottom CTA block */}
      <section
        aria-labelledby="conversion-banner-heading"
        className="py-20 sm:py-28 bg-white border-b border-[#E5E7EB]"
      >
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="h-1.5 w-1.5 rounded-[2px] bg-[#2563EB]" aria-hidden="true" />
              <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                UK &amp; EU SAME DAY COURIER SPECIALISTS • 60 MIN COLLECTION
              </span>
            </div>

            <h2 id="conversion-banner-heading" className="section-h2 text-[#111827] mb-4">
              Ready to book a dedicated same-day delivery or activate your £0 Standby Account?
            </h2>

            <p className="text-[16px] leading-[1.65] text-[#4B5563] max-w-[58ch] mx-auto">
              Dispatch a dedicated UK or European vehicle within 60 minutes, or pre-approve your
              business today with zero monthly retainer and instant access to the NEO Transport
              Customer Portal.
            </p>
          </ScrollReveal>

          {/* Dual-Path CTA Cards */}
          <ScrollReveal delayMs={80} className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Path A: Online Booking & Portal */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#2563EB]">
                      PATH A • ONLINE BOOKING &amp; PORTAL
                    </span>
                    <span className="font-mono-tech text-[11px] font-bold text-[#059669]">
                      &lt; 60 MIN SLA
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-[1.6] text-[#4B5563] mb-5">
                    Instant access to live booking, GPS tracking, digital PODs, and priority dispatch.
                  </p>
                </div>
                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="btn-primary-black flex h-11 w-full items-center justify-center gap-2 rounded-lg px-5 text-[14px] font-semibold"
                >
                  <span>Book a Delivery</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>

              {/* Path B: 24/7 Emergency Dispatch */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">
                      PATH B • 24/7 EMERGENCY DISPATCH DESK
                    </span>
                    <span className="font-mono-tech text-[11px] font-semibold text-[#D97706]">
                      {BRAND_CONFIG.dispatchResponseAvg.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-[1.6] text-[#4B5563] mb-5">
                    Speak directly to a live operations controller for urgent nationwide or European dispatch.
                  </p>
                </div>
                <a
                  href={BRAND_CONFIG.dispatchPhoneHref}
                  className="btn-secondary-light flex h-11 w-full items-center justify-center gap-2.5 rounded-lg px-5 text-[14px] font-semibold"
                >
                  <Headphones className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                  <span>Call Dispatch ({BRAND_CONFIG.dispatchPhoneDisplay})</span>
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Quiet Minimalist Footer matching Advertz.ai */}
      <footer role="contentinfo" className="bg-[#FAFAFA] pt-16 pb-24 md:pb-14">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 pb-12 border-b border-[#E5E7EB]">
            {/* Col 1 (5 cols): Brand Presentation & Operational Status */}
            <div className="lg:col-span-5">
              <a
                href="#top"
                onClick={(e) => scrollToSectionAnchor(e, '#top')}
                aria-label="NEO Transport — Return to top"
                className="inline-flex items-center gap-2.5 mb-3"
              >
                <NeoBrandMark className="h-6 w-8" />
                <span className="text-[17px] font-extrabold tracking-tight text-[#111827]">
                  {BRAND_CONFIG.companyName}
                </span>
              </a>

              <div className="font-mono-tech text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2563EB] mb-3">
                {BRAND_CONFIG.subLabel}
              </div>

              <p className="text-[14px] leading-[1.65] text-[#4B5563] max-w-sm mb-5">
                We&apos;re NEO Transport – your trusted partner for same-day shipping, end-to-end
                logistics, and dedicated business deliveries across the UK and Europe.
              </p>

              <div className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.09em] text-[#059669]">
                  LIVE FLEET TRACKING ACTIVE • 24/7/365
                </span>
              </div>
            </div>

            {/* Col 2 (3 cols): Quick Links */}
            <div className="lg:col-span-3">
              <div className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.11em] text-[#111827] mb-4">
                QUICK LINKS
              </div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li>
                  <a
                    href="#services"
                    onClick={(e) => scrollToSectionAnchor(e, '#services')}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Courier &amp; Freight Services
                  </a>
                </li>
                <li>
                  <a
                    href="#fleet"
                    onClick={(e) => scrollToSectionAnchor(e, '#fleet')}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Dedicated Fleet &amp; Payloads
                  </a>
                </li>
                <li>
                  <a
                    href="#coverage"
                    onClick={(e) => scrollToSectionAnchor(e, '#coverage')}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    UK &amp; EU Coverage Hubs
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    onClick={(e) => scrollToSectionAnchor(e, '#how-it-works')}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    How It Works &amp; Live Portal
                  </a>
                </li>
                <li>
                  <a
                    href="#industries"
                    onClick={(e) => scrollToSectionAnchor(e, '#industries')}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Industry Solutions
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    onClick={(e) => scrollToSectionAnchor(e, '#faq')}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Operational FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3 (2 cols): Customer Portal & Legal */}
            <div className="lg:col-span-2">
              <div className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.11em] text-[#111827] mb-4">
                PORTAL &amp; LEGAL
              </div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li>
                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    className="inline-flex items-center gap-1 text-[#111827] hover:text-[#2563EB] transition-colors font-semibold"
                  >
                    <span>Book a Delivery</span>
                    <ExternalLink className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_CONFIG.portalLoginUrl}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Customer Login
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_CONFIG.portalTrackingUrl}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Live Shipment Tracking
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_CONFIG.portalUrl}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_CONFIG.portalUrl}
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Terms &amp; Conditions
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4 (2 cols): Connect & 24/7 Dispatch */}
            <div className="lg:col-span-2">
              <div className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.11em] text-[#111827] mb-4">
                CONNECT
              </div>
              <ul className="space-y-2.5 text-[13.5px] mb-6">
                <li>
                  <a
                    href="https://www.linkedin.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    X (Twitter)
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Facebook
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#4B5563] hover:text-[#111827] transition-colors"
                  >
                    Instagram
                  </a>
                </li>
              </ul>

              <div className="font-mono-tech text-[11px] text-[#6B7280]">
                24/7 DISPATCH:
                <a
                  href={BRAND_CONFIG.dispatchPhoneHref}
                  className="block text-[13px] font-bold text-[#111827] hover:text-[#2563EB] hover:underline mt-0.5"
                >
                  {BRAND_CONFIG.dispatchPhoneDisplay}
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Row */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12.5px] text-[#6B7280]">
            <p>© 2026 NEO Transport. All rights reserved.</p>
            <div className="flex items-center gap-2 font-mono-tech text-[11px]">
              <Shield className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
              <span>UK &amp; EU DEDICATED SAME-DAY LOGISTICS NETWORK</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile (< 768px) Sticky Quick-Action Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 px-3 flex items-center justify-between gap-2 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB]">
        <a
          href={BRAND_CONFIG.dispatchPhoneHref}
          className="btn-secondary-light flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
        >
          <Phone className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
          <span>{BRAND_CONFIG.dispatchPhoneDisplay}</span>
        </a>
        <a
          href={BRAND_CONFIG.portalBookingUrl}
          className="btn-primary-black flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-[12px] font-semibold"
        >
          Book a Delivery →
        </a>
      </div>
    </>
  );
};
