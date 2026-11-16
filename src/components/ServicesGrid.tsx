import React from 'react';
import {
  Zap,
  Clock,
  Route,
  Globe,
  Maximize2,
  Truck,
  Users,
  Plane,
  ArrowRight,
  Check,
} from 'lucide-react';
import { BRAND_CONFIG, LOGISTICS_SERVICES, ServiceItem } from '../data/siteContent';
import { ScrollReveal } from './MotionPrimitives';

export const ServicesGrid: React.FC = () => {
  const renderServiceIcon = (id: string) => {
    switch (id) {
      case 'same-day-delivery':
        return <Zap className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'full-half-day-rates':
        return <Clock className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'multi-drop-delivery':
        return <Route className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'european-road-transport':
        return <Globe className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'irregular-and-oversize':
        return <Maximize2 className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'full-load-solutions':
        return <Truck className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'two-man-delivery':
        return <Users className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'air-freight':
      default:
        return <Plane className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
    }
  };

  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="py-20 sm:py-28 bg-[#FAFAFA] border-b border-[#E5E7EB] scroll-mt-16"
    >
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 mb-3.5">
              <span className="h-1.5 w-1.5 rounded-[2px] bg-[#2563EB]" aria-hidden="true" />
              <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                OUR SERVICES
              </span>
            </div>
            <h2 id="services-heading" className="section-h2 text-[#111827] mb-3">
              End-to-End UK &amp; European Freight Capabilities
            </h2>
            <p className="text-[16px] leading-[1.65] text-[#4B5563]">
              From urgent 60-minute same-day courier collections to scheduled multi-drop routes, full
              truck loads, and cross-border European logistics—all managed through one operational portal.
            </p>
          </div>

          <div className="shrink-0">
            <a
              href={BRAND_CONFIG.portalBookingUrl}
              className="btn-primary-black inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[13.5px] font-semibold whitespace-nowrap"
            >
              <span>Book a Delivery</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </ScrollReveal>

        {/* 8-Card Minimalist Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {LOGISTICS_SERVICES.map((service: ServiceItem, idx: number) => (
            <ScrollReveal key={service.id} delayMs={idx * 75} className="h-full">
              <article className="neo-card-interactive rounded-xl p-6 h-full flex flex-col justify-between group">
                <div>
                  {/* Top Icon + Unboxed SLA Label */}
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
                      {renderServiceIcon(service.id)}
                    </div>
                    <span className="font-mono-tech text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2563EB]">
                      {service.slaBadge}
                    </span>
                  </div>

                  {/* Monospace Service Code */}
                  <div className="font-mono-tech text-[10.5px] uppercase tracking-[0.08em] text-[#6B7280] mb-1.5">
                    {service.code}
                  </div>

                  {/* Card Title (H3) */}
                  <h3 className="card-h3 text-[#111827] mb-2.5">
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className="text-[14px] leading-[1.6] text-[#4B5563] mb-5">
                    {service.description}
                  </p>

                  {/* Operational Capabilities List */}
                  <ul className="space-y-1.5 mb-6" aria-label={`${service.title} key features`}>
                    {service.capabilities.map((cap) => (
                      <li
                        key={cap}
                        className="flex items-center gap-2 text-[12.5px] text-[#4B5563]"
                      >
                        <Check className="h-3.5 w-3.5 text-[#059669] shrink-0" aria-hidden="true" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Action Footer */}
                <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] hover:text-[#2563EB] w-full justify-between"
                  >
                    <span>Book or Quote</span>
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
