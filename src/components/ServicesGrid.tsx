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
        return <Zap className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'full-half-day-rates':
        return <Clock className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'multi-drop-delivery':
        return <Route className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'european-road-transport':
        return <Globe className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'irregular-and-oversize':
        return <Maximize2 className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'full-load-solutions':
        return <Truck className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'two-man-delivery':
        return <Users className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'air-freight':
      default:
        return <Plane className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
    }
  };

  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="py-16 sm:py-20 lg:py-24 scroll-mt-16"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="flex flex-col md:flex-row md:items-end justify-between mb-12 lg:mb-14 gap-6">
          <div className="max-w-2xl">
            <div className="font-mono-tech text-[12px] font-semibold uppercase tracking-[0.12em] text-[#3898FF] mb-3">
              — OUR SERVICES
            </div>
            <h2
              id="services-heading"
              className="section-h2 mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              End-to-End UK &amp; European Freight Capabilities
            </h2>
            <p
              className="text-[16px] leading-[1.6]"
              style={{ color: 'var(--text-secondary)' }}
            >
              From urgent 60-minute same-day courier collections to scheduled multi-drop routes, full
              truck loads, and cross-border European logistics—all managed through one operational portal.
            </p>
          </div>

          <div className="shrink-0">
            <a
              href={BRAND_CONFIG.portalBookingUrl}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-5 text-[13.5px] font-semibold text-white transition-colors"
            >
              <span>Book a Delivery</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </ScrollReveal>

        {/* 8-Card Bento Grid with 75ms staggered scroll-reveal & electric blue hover glow */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {LOGISTICS_SERVICES.map((service: ServiceItem, idx: number) => (
            <ScrollReveal key={service.id} delayMs={idx * 75} className="h-full">
              <article className="neo-card-interactive rounded-2xl p-6 h-full flex flex-col justify-between group">
                <div>
                  {/* Top Telemetry Header */}
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                      style={{
                        backgroundColor: 'rgba(46, 144, 250, 0.1)',
                        border: '1px solid rgba(46, 144, 250, 0.25)',
                      }}
                    >
                      {renderServiceIcon(service.id)}
                    </div>

                    <span
                      className="font-mono-tech text-[10px] font-semibold uppercase tracking-[0.09em] px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        color: '#3898FF',
                      }}
                    >
                      {service.slaBadge}
                    </span>
                  </div>

                  {/* Monospace Service Code */}
                  <div
                    className="font-mono-tech text-[10.5px] uppercase tracking-[0.08em] mb-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {service.code}
                  </div>

                  {/* Card Title (H3) */}
                  <h3
                    className="card-h3 mb-2.5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p
                    className="text-[14px] leading-[1.6] mb-5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {service.description}
                  </p>

                  {/* Operational Capabilities List */}
                  <ul className="space-y-1.5 mb-6" aria-label={`${service.title} key features`}>
                    {service.capabilities.map((cap) => (
                      <li
                        key={cap}
                        className="flex items-center gap-2 text-[12.5px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" aria-hidden="true" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Action Footer */}
                <div
                  className="pt-4 flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#3898FF] hover:text-[#2E90FA] w-full justify-between"
                  >
                    <span>Book or Quote</span>
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
