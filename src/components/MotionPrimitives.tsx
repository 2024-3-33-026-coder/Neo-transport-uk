import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}

/**
 * IntersectionObserver-powered scroll reveal component that smoothly fades in
 * and slides up from translateY(20px) to 0, supporting 75ms staggered delays.
 */
export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  delayMs = 0,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0px)' : 'translateY(20px)',
        transition: `opacity 520ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms, transform 520ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
};

interface AnimatedCounterProps {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
}

/**
 * Smooth count-up number counter triggered when the element enters the viewport.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  target,
  decimals = 0,
  prefix = '',
  suffix = '',
  durationMs = 1100,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [displayValue, setDisplayValue] = useState<number>(target);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || hasAnimated) return;

    if (typeof IntersectionObserver === 'undefined') {
      setDisplayValue(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            const startTime = performance.now();

            const tick = (now: number) => {
              const elapsed = now - startTime;
              const progress = Math.min(1, elapsed / durationMs);
              // Ease-out cubic
              const eased = 1 - Math.pow(1 - progress, 3);
              setDisplayValue(target * eased);
              if (progress < 1) {
                requestAnimationFrame(tick);
              } else {
                setDisplayValue(target);
              }
            };

            requestAnimationFrame(tick);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [target, durationMs, hasAnimated]);

  // Also update immediately if target prop changes (e.g., switching dispatch hubs)
  useEffect(() => {
    if (!hasAnimated) {
      setDisplayValue(target);
      return;
    }
    const startTime = performance.now();
    const duration = 550;
    const startVal = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + (target - startVal) * eased);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setDisplayValue(target);
      }
    };
    requestAnimationFrame(tick);
  }, [target, hasAnimated]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/**
 * Smooth offset-aware scroll helper for anchor navigation links.
 */
export function scrollToSectionAnchor(
  e: React.MouseEvent<HTMLAnchorElement>,
  href: string,
  onComplete?: () => void
) {
  if (!href.startsWith('#')) return;
  const targetId = href.slice(1);
  if (!targetId) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onComplete?.();
    return;
  }
  const el = document.getElementById(targetId);
  if (el) {
    e.preventDefault();
    const headerOffset = 80;
    const elementPosition = el.getBoundingClientRect().top + window.scrollY;
    const offsetPosition = Math.max(0, elementPosition - headerOffset);
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
    window.history.pushState(null, '', href);
    onComplete?.();
  }
}
