import React from 'react';
import {
  ShoppingBag,
  HardHat,
  Utensils,
  Sprout,
  Clapperboard,
  Printer,
  ArrowRight,
} from 'lucide-react';
import { BRAND_CONFIG, INDUSTRY_VERTICALS, IndustryVertical } from '../data/siteContent';
import { ScrollReveal } from './MotionPrimitives';

export const IndustriesGrid: React.FC = () => {
  const renderIndustryIcon = (iconName: IndustryVertical['iconName']) => {
    switch (iconName) {
      case 'shopping-bag':
        return <ShoppingBag className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'hard-hat':
        return <HardHat className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'utensils':
        return <Utensils className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'sprout':
        return <Sprout className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'clapperboard':
        return <Clapperboard className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'printer':
      default:
        return <Printer className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
    }
  };

  return (
    <section
      id="industries"
      aria-labelledby="industries-heading"
      className="py-16 sm:py-20 lg:py-24 scroll-mt-16"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="flex flex-col md:flex-row md:items-end justify-between mb-12 lg:mb-14 gap-6">
          <div className="max-w-2xl">
            <div className="font-mono-tech text-[12px] font-semibold uppercase tracking-[0.12em] text-[#3898FF] mb-3">
              — SECTOR EXPERTISE
            </div>
            <h2
              id="industries-heading"
              className="section-h2 mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              Industry-Tailored Courier Services
            </h2>
            <p
              className="text-[16px] leading-[1.6]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Dedicated operational protocols, specialist load restraint, and sector-vetted drivers
              across six high-consequence UK &amp; European industries.
            </p>
          </div>

          <a
            href={BRAND_CONFIG.portalBookingUrl}
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#3898FF] hover:underline shrink-0"
          >
            <span>Book Sector Courier Delivery</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </ScrollReveal>

        {/* 6-Card Sector Grid with 75ms stagger, electric blue hover glow, -translate-y-1 & arrow slide */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRY_VERTICALS.map((sector, idx) => (
            <ScrollReveal key={sector.id} delayMs={idx * 75} className="h-full">
              <article className="neo-card-interactive rounded-2xl p-6 sm:p-7 h-full flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: 'rgba(46, 144, 250, 0.1)',
                        border: '1px solid rgba(46, 144, 250, 0.25)',
                      }}
                    >
                      {renderIndustryIcon(sector.iconName)}
                    </div>

                    <span
                      className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {sector.slaCommitment}
                    </span>
                  </div>

                  <div
                    className="font-mono-tech text-[10.5px] uppercase tracking-[0.09em] mb-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {sector.code}
                  </div>

                  <h3
                    className="card-h3 mb-2.5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {sector.title}
                  </h3>

                  <p
                    className="text-[14.5px] leading-[1.6] mb-5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {sector.description}
                  </p>
                </div>

                <div
                  className="pt-4 flex flex-col gap-3"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div className="font-mono-tech text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    TYPICAL FREIGHT:{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{sector.typicalLoads}</span>
                  </div>

                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    className="inline-flex items-center justify-between text-[13px] font-semibold text-[#3898FF] hover:text-[#2E90FA]"
                  >
                    <span>Book {sector.title} Courier</span>
                    <ArrowRight className="h-4 w-4 card-arrow" aria-hidden="true" />
                  </a>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
