/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
  return (
    <div id="top" className="min-h-screen w-full bg-white text-[#111827]">
      <Navbar />
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
