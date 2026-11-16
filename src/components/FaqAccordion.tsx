import React, { useState } from 'react';
import { Plus, X, Phone, ArrowUpRight } from 'lucide-react';
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
      className="py-20 sm:py-28 bg-[#FAFAFA] border-b border-[#E5E7EB] scroll-mt-16"
    >
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left 5 Cols: FAQ Heading & Direct Dispatch Escalation Card (mirrors Advertz.ai split FAQ layout) */}
          <ScrollReveal className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 mb-3.5">
              <span className="h-1.5 w-1.5 rounded-[2px] bg-[#2563EB]" aria-hidden="true" />
              <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                FAQ
              </span>
            </div>
            <h2 id="faq-heading" className="section-h2 text-[#111827] mb-4">
              Frequently asked questions
            </h2>
            <p className="text-[16px] leading-[1.65] text-[#4B5563] mb-8">
              Answers on 60-minute pickup times, our £0 standby account, European border paperwork,
              and live GPS tracking.
            </p>

            {/* 24/7 Dispatch Direct Card */}
            <div className="neo-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#059669]">
                  DISPATCH DESK OPEN 24/7
                </span>
              </div>
              <h3 className="text-[17px] font-bold text-[#111827] mb-2">
                Need a collection within 60 minutes or contract rates?
              </h3>
              <p className="text-[13.5px] leading-[1.6] text-[#4B5563] mb-5">
                Speak with a NEO Transport controller in under 3 minutes or book your delivery
                online.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={BRAND_CONFIG.dispatchPhoneHref}
                  className="btn-primary-black inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{BRAND_CONFIG.dispatchPhoneDisplay}</span>
                </a>
                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="btn-secondary-light inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold"
                >
                  <span>Book a delivery</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                </a>
              </div>
            </div>
          </ScrollReveal>

          {/* Right 7 Cols: Single Bordered Divider Accordion List matching Advertz.ai */}
          <ScrollReveal delayMs={75} className="lg:col-span-7">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white divide-y divide-[#E5E7EB] overflow-hidden">
              {FAQ_ITEMS.map((item) => {
                const isOpen = openId === item.id;
                const panelId = `${item.id}-panel`;
                const triggerId = `${item.id}-trigger`;

                return (
                  <div key={item.id}>
                    <h3>
                      <button
                        id={triggerId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggleItem(item.id)}
                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2563EB] shrink-0">
                            {item.code}
                          </span>
                          <span className="text-[15px] sm:text-[16px] font-semibold text-[#111827]">
                            {item.question}
                          </span>
                        </div>

                        {isOpen ? (
                          <X className="h-4 w-4 shrink-0 text-[#6B7280]" aria-hidden="true" />
                        ) : (
                          <Plus className="h-4 w-4 shrink-0 text-[#6B7280]" aria-hidden="true" />
                        )}
                      </button>
                    </h3>

                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={triggerId}
                      hidden={!isOpen}
                      className={isOpen ? 'block' : 'hidden'}
                    >
                      <div className="px-6 pb-5 pt-0 text-[14.5px] leading-[1.65] text-[#4B5563]">
                        <p>{item.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};
