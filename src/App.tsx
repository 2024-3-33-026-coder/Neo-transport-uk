/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { StandbyValueSection } from './components/StandbyValueSection';
import { ServicesGrid } from './components/ServicesGrid';
import { FleetSpecs } from './components/FleetSpecs';
import { PortalPreviewSection } from './components/PortalPreviewSection';
import { IndustriesGrid } from './components/IndustriesGrid';
import { FaqAccordion } from './components/FaqAccordion';
import { Footer } from './components/Footer';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('neo-transport-theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('neo-transport-theme', theme);
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div
      className="min-h-screen w-full transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      <Navbar theme={theme} onToggleTheme={handleToggleTheme} />
      <main id="main-content">
        <Hero />
        <StandbyValueSection />
        <ServicesGrid />
        <FleetSpecs />
        <PortalPreviewSection />
        <IndustriesGrid />
        <FaqAccordion />
      </main>
      <Footer />
    </div>
  );
}
