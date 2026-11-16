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
        return <ShoppingBag className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'hard-hat':
        return <HardHat className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'utensils':
        return <Utensils className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'sprout':
        return <Sprout className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'clapperboard':
        return <Clapperboard className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'printer':
      default:
        return <Printer className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
    }
  };

  return (
    <section
      id="industries"
      aria-labelledby="industries-heading"
      className="py-20 sm:py-28 bg-white border-b border-[#E5E7EB] scroll-mt-16"
    >
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 mb-3.5">
              <span className="h-1.5 w-1.5 rounded-[2px] bg-[#2563EB]" aria-hidden="true" />
              <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                SECTOR EXPERTISE
              </span>
            </div>
            <h2 id="industries-heading" className="section-h2 text-[#111827] mb-3">
              Industry-Tailored Courier Services
            </h2>
            <p className="text-[16px] leading-[1.65] text-[#4B5563]">
              Dedicated operational protocols, specialist load restraint, and sector-vetted drivers
              across six high-consequence UK &amp; European industries.
            </p>
          </div>

          <a
            href={BRAND_CONFIG.portalBookingUrl}
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#111827] hover:text-[#2563EB] shrink-0 transition-colors"
          >
            <span>Book Sector Courier Delivery</span>
            <ArrowRight className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          </a>
        </ScrollReveal>

        {/* 6-Card Minimalist Sector Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRY_VERTICALS.map((sector, idx) => (
            <ScrollReveal key={sector.id} delayMs={idx * 75} className="h-full">
              <article className="neo-card-interactive rounded-xl p-7 h-full flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
                      {renderIndustryIcon(sector.iconName)}
                    </div>

                    <span className="font-mono-tech text-[10.5px] font-medium uppercase tracking-[0.07em] text-[#6B7280]">
                      {sector.slaCommitment}
                    </span>
                  </div>

                  <div className="font-mono-tech text-[10.5px] uppercase tracking-[0.09em] text-[#6B7280] mb-1.5">
                    {sector.code}
                  </div>

                  <h3 className="card-h3 text-[#111827] mb-2.5">
                    {sector.title}
                  </h3>

                  <p className="text-[14.5px] leading-[1.65] text-[#4B5563] mb-5">
                    {sector.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E5E7EB] flex flex-col gap-3">
                  <div className="font-mono-tech text-[11px] text-[#6B7280]">
                    TYPICAL FREIGHT:{' '}
                    <span className="text-[#111827] font-medium">{sector.typicalLoads}</span>
                  </div>

                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    className="inline-flex items-center justify-between text-[13px] font-semibold text-[#111827] hover:text-[#2563EB]"
                  >
                    <span>Book {sector.title} Courier</span>
                    <ArrowRight className="h-4 w-4 card-arrow text-[#2563EB]" aria-hidden="true" />
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
