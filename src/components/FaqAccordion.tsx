import React, { useState } from 'react';
import { ChevronDown, Phone, ArrowUpRight } from 'lucide-react';
import { BRAND_CONFIG, FAQ_ITEMS } from '../data/siteContent';
import { ScrollReveal } from './MotionPrimitives';

export const FaqAccordion: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="py-16 sm:py-20 lg:py-24 scroll-mt-16"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left 5 Cols: FAQ Heading & Direct Dispatch Escalation Card */}
          <ScrollReveal className="lg:col-span-5">
            <div className="font-mono-tech text-[12px] font-semibold uppercase tracking-[0.12em] text-[#3898FF] mb-3">
              — OPERATIONAL FAQ
            </div>
            <h2
              id="faq-heading"
              className="section-h2 mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Frequently Asked Questions
            </h2>
            <p
              className="text-[16px] leading-[1.6] mb-8"
              style={{ color: 'var(--text-secondary)' }}
            >
              Clear answers on same-day collection SLAs, how our £0 Emergency Standby Account works,
              European customs coordination, and real-time portal telemetry.
            </p>

            {/* 24/7 Dispatch Direct Escalation Card */}
            <div className="neo-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#10B981]">
                  DISPATCH DESK ONLINE • 24/7/365
                </span>
              </div>
              <h3
                className="text-[17px] font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                Need immediate same-day collection or custom contract rates?
              </h3>
              <p
                className="text-[13.5px] leading-[1.6] mb-5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Speak directly with a NEO Transport controller in under 3 minutes or book your
                delivery online.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={BRAND_CONFIG.dispatchPhoneHref}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{BRAND_CONFIG.dispatchPhoneDisplay}</span>
                </a>
                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>Book a Delivery</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#3898FF]" aria-hidden="true" />
                </a>
              </div>
            </div>
          </ScrollReveal>

          {/* Right 7 Cols: 7 Verified Accordion Items with 75ms stagger */}
          <div className="lg:col-span-7 space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openId === item.id;
              const panelId = `${item.id}-panel`;
              const triggerId = `${item.id}-trigger`;

              return (
                <ScrollReveal key={item.id} delayMs={idx * 75}>
                  <div
                    className="neo-card rounded-2xl overflow-hidden transition-colors"
                    style={{
                      borderColor: isOpen ? 'rgba(46, 144, 250, 0.45)' : 'var(--border-subtle)',
                    }}
                  >
                    <h3>
                      <button
                        id={triggerId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggleItem(item.id)}
                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3898FF] shrink-0">
                            {item.code}
                          </span>
                          <span
                            className="text-[15.5px] sm:text-[16.5px] font-semibold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {item.question}
                          </span>
                        </div>

                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-[#3898FF] transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </h3>

                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={triggerId}
                      hidden={!isOpen}
                      className={isOpen ? 'block' : 'hidden'}
                    >
                      <div
                        className="px-6 pb-5 pt-1 text-[14.5px] leading-[1.65]"
                        style={{
                          color: 'var(--text-secondary)',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        <p className="pt-3">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
