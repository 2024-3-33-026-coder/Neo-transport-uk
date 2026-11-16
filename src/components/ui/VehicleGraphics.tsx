import React, { useState } from 'react';

interface GraphicProps {
  className?: string;
  isDarkMode?: boolean;
}

/**
 * Modern Freight Truck graphic for the Hero section.
 * Uses high-res generated asset with an inline SVG fallback.
 */
export const NeoTruckHero: React.FC<GraphicProps> = ({ className = '', isDarkMode = false }) => {
  const [imageError, setImageError] = useState(false);

  if (!imageError) {
    return (
      <div className={`relative overflow-hidden flex items-center justify-end select-none pointer-events-none ${className}`}>
        <img
          src="/brand/neo-truck.jpg"
          alt="NEO Transport Heavy Freight Fleet"
          onError={() => setImageError(true)}
          className="w-full h-full object-contain object-right drop-shadow-xl"
          loading="eager"
        />
      </div>
    );
  }

  // Vector SVG Fallback
  return (
    <div className={`relative flex items-center justify-end select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 320 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto max-h-48 drop-shadow-lg"
      >
        <defs>
          <linearGradient id="truckBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isDarkMode ? '#1e2d42' : '#1e3a5f'} />
            <stop offset="50%" stopColor={isDarkMode ? '#131e2d' : '#14253c'} />
            <stop offset="100%" stopColor={isDarkMode ? '#0a1018' : '#0c1827'} />
          </linearGradient>
          <linearGradient id="cabinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a2b40" />
            <stop offset="100%" stopColor="#2a4365" />
          </linearGradient>
          <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="160" cy="165" rx="140" ry="10" fill="black" fillOpacity={isDarkMode ? '0.4' : '0.15'} />

        {/* Box Trailer */}
        <rect x="130" y="30" width="170" height="115" rx="6" fill="url(#truckBodyGrad)" stroke="#334155" strokeWidth="1.5" />
        {/* Trailer top edge light */}
        <line x1="130" y1="31" x2="300" y2="31" stroke="#3898EC" strokeWidth="2" strokeOpacity="0.6" />
        
        {/* NEO Hexagon Logo on Trailer */}
        <g transform="translate(195, 65) scale(0.22)">
          <polygon fill="#3898EC" points="111.88 69.08 111.88 133.59 133.69 146.54 133.69 146.53 188.72 178.97 267.04 133.59 267.04 57.09 155.16 122.74 155.16 58.23 133.35 45.28 133.35 45.29 78.32 12.85 0 58.23 0 134.73 111.88 69.08" />
          <polygon fill="#3898EC" points="89.22 108.76 12.91 153.86 78.03 191.82 122.21 166.13 88.65 146.43 89.22 108.76" />
          <polygon fill="#3898EC" points="177.82 83.06 254.13 37.96 189.01 0 144.83 25.69 178.39 45.39 177.82 83.06" />
        </g>
        <text x="210" y="118" fill="#94a3b8" fontSize="8" fontFamily="sans-serif" fontWeight="700" letterSpacing="2">NEO TRANSPORT</text>

        {/* Tractor Unit Cabin (Cab-over European style) */}
        <path d="M 45 60 L 70 42 L 128 42 L 128 145 L 35 145 L 35 105 L 45 60 Z" fill="url(#cabinGrad)" stroke="#1e293b" strokeWidth="1.5" />
        {/* Windshield */}
        <path d="M 50 63 L 68 47 L 98 47 L 98 85 L 42 85 Z" fill="url(#glassGrad)" />
        {/* Side window */}
        <path d="M 103 48 L 124 48 L 124 85 L 103 85 Z" fill="url(#glassGrad)" />
        {/* Grille */}
        <rect x="33" y="95" width="22" height="42" rx="3" fill="#0f172a" />
        <line x1="36" y1="102" x2="52" y2="102" stroke="#475569" strokeWidth="2" />
        <line x1="36" y1="109" x2="52" y2="109" stroke="#475569" strokeWidth="2" />
        <line x1="36" y1="116" x2="52" y2="116" stroke="#475569" strokeWidth="2" />
        <line x1="36" y1="123" x2="52" y2="123" stroke="#475569" strokeWidth="2" />
        <circle cx="44" cy="112" r="3" fill="#3898EC" />

        {/* LED Headlight */}
        <path d="M 33 138 L 46 138 L 44 133 L 33 134 Z" fill="#38bdf8" />

        {/* Front Wheel */}
        <g transform="translate(62, 145)">
          <circle cx="0" cy="0" r="17" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <circle cx="0" cy="0" r="10" fill="#64748b" />
          <circle cx="0" cy="0" r="4" fill="#0f172a" />
        </g>
        {/* Rear Wheels */}
        <g transform="translate(210, 145)">
          <circle cx="0" cy="0" r="17" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <circle cx="0" cy="0" r="10" fill="#64748b" />
          <circle cx="0" cy="0" r="4" fill="#0f172a" />
        </g>
        <g transform="translate(255, 145)">
          <circle cx="0" cy="0" r="17" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <circle cx="0" cy="0" r="10" fill="#64748b" />
          <circle cx="0" cy="0" r="4" fill="#0f172a" />
        </g>
      </svg>
    </div>
  );
};

/**
 * Modern Mercedes-Benz Sprinter LWB Van graphic for the Active Shipment card.
 * Uses generated asset with high-fidelity vector SVG fallback.
 */
export const NeoSprinterVanCard: React.FC<GraphicProps> = ({ className = '', isDarkMode = false }) => {
  const [imageError, setImageError] = useState(false);

  if (!imageError) {
    return (
      <div className={`relative overflow-hidden flex items-center justify-center select-none pointer-events-none ${className}`}>
        <img
          src="/brand/neo-sprinter-van.jpg"
          alt="NEO Sprinter LWB Delivery Van"
          onError={() => setImageError(true)}
          className="w-full h-full object-contain drop-shadow-md"
          loading="eager"
        />
      </div>
    );
  }

  // Vector SVG Fallback
  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 220 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-md"
      >
        <defs>
          <linearGradient id="vanBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="vanGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="110" cy="110" rx="95" ry="6" fill="black" fillOpacity={isDarkMode ? '0.45' : '0.15'} />

        {/* Van Main Body (Sprinter aerodynamic profile) */}
        <path
          d="M 28 85 L 28 65 L 45 42 L 75 30 L 195 30 L 202 50 L 202 92 L 175 92 A 16 16 0 0 0 143 92 L 85 92 A 16 16 0 0 0 53 92 L 28 92 Z"
          fill="url(#vanBodyGrad)"
          stroke="#334155"
          strokeWidth="1.2"
        />

        {/* Windshield */}
        <path d="M 46 44 L 72 34 L 75 60 L 36 62 Z" fill="url(#vanGlassGrad)" />
        {/* Driver side window */}
        <path d="M 78 34 L 105 34 L 105 60 L 78 60 Z" fill="url(#vanGlassGrad)" />

        {/* Sliding Side Door Outline */}
        <rect x="110" y="34" width="48" height="56" rx="2" stroke="#334155" strokeWidth="1" fill="none" />

        {/* NEO Hexagon Logo on Cargo body */}
        <g transform="translate(132, 48) scale(0.12)">
          <polygon fill="#3898EC" points="111.88 69.08 111.88 133.59 133.69 146.54 133.69 146.53 188.72 178.97 267.04 133.59 267.04 57.09 155.16 122.74 155.16 58.23 133.35 45.28 133.35 45.29 78.32 12.85 0 58.23 0 134.73 111.88 69.08" />
          <polygon fill="#3898EC" points="89.22 108.76 12.91 153.86 78.03 191.82 122.21 166.13 88.65 146.43 89.22 108.76" />
          <polygon fill="#3898EC" points="177.82 83.06 254.13 37.96 189.01 0 144.83 25.69 178.39 45.39 177.82 83.06" />
        </g>
        <text x="140" y="78" fill="#3898EC" fontSize="6" fontFamily="sans-serif" fontWeight="800" letterSpacing="1">NEO</text>

        {/* Headlight */}
        <path d="M 28 66 L 36 66 L 36 74 L 28 72 Z" fill="#38bdf8" />
        <circle cx="32" cy="70" r="1.5" fill="white" />

        {/* Front Wheel */}
        <g transform="translate(69, 92)">
          <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="8" fill="#64748b" />
          <circle cx="0" cy="0" r="3" fill="#0f172a" />
        </g>

        {/* Rear Wheel */}
        <g transform="translate(159, 92)">
          <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="8" fill="#64748b" />
          <circle cx="0" cy="0" r="3" fill="#0f172a" />
        </g>
      </svg>
    </div>
  );
};

/**
 * 7.5T Rigid Truck Thumbnail for Recent Jobs.
 */
export const NeoRigidTruckThumbnail: React.FC<{ isDarkMode?: boolean; className?: string }> = ({
  isDarkMode = false,
  className = 'w-14 h-14',
}) => {
  return (
    <div
      className={`rounded-xl overflow-hidden flex items-center justify-center p-1 shrink-0 border ${
        isDarkMode ? 'bg-[#0f1a2a] border-[#1e2d42]' : 'bg-slate-100 border-slate-200'
      } ${className}`}
    >
      <svg viewBox="0 0 80 50" fill="none" className="w-full h-auto">
        <ellipse cx="40" cy="46" rx="35" ry="3" fill="black" fillOpacity="0.2" />
        {/* Box Cargo */}
        <rect x="26" y="8" width="50" height="32" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1" />
        {/* Cab */}
        <path d="M 6 18 L 16 12 L 26 12 L 26 40 L 4 40 L 4 28 Z" fill="#0f172a" stroke="#334155" strokeWidth="1" />
        {/* Windshield */}
        <path d="M 8 20 L 16 14 L 23 14 L 23 26 L 6 26 Z" fill="#3898EC" fillOpacity="0.7" />
        {/* Mini Logo */}
        <circle cx="51" cy="24" r="5" fill="#3898EC" fillOpacity="0.8" />
        {/* Wheels */}
        <circle cx="15" cy="40" r="6" fill="#020617" stroke="#475569" strokeWidth="1" />
        <circle cx="58" cy="40" r="6" fill="#020617" stroke="#475569" strokeWidth="1" />
      </svg>
    </div>
  );
};

/**
 * Sprinter MWB Van Thumbnail for Recent Jobs.
 */
export const NeoVanThumbnail: React.FC<{ isDarkMode?: boolean; className?: string }> = ({
  isDarkMode = false,
  className = 'w-14 h-14',
}) => {
  return (
    <div
      className={`rounded-xl overflow-hidden flex items-center justify-center p-1 shrink-0 border ${
        isDarkMode ? 'bg-[#0f1a2a] border-[#1e2d42]' : 'bg-slate-100 border-slate-200'
      } ${className}`}
    >
      <svg viewBox="0 0 80 50" fill="none" className="w-full h-auto">
        <ellipse cx="40" cy="45" rx="34" ry="3" fill="black" fillOpacity="0.2" />
        {/* Van body */}
        <path
          d="M 8 36 L 8 26 L 16 18 L 26 14 L 72 14 L 75 22 L 75 38 L 65 38 A 6 6 0 0 0 53 38 L 31 38 A 6 6 0 0 0 19 38 L 8 38 Z"
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="1"
        />
        {/* Windshield */}
        <path d="M 16 19 L 26 15 L 26 26 L 12 26 Z" fill="#3898EC" fillOpacity="0.6" />
        {/* Mini Logo */}
        <circle cx="48" cy="26" r="4" fill="#3898EC" fillOpacity="0.8" />
        {/* Wheels */}
        <circle cx="25" cy="38" r="5.5" fill="#020617" stroke="#475569" strokeWidth="1" />
        <circle cx="59" cy="38" r="5.5" fill="#020617" stroke="#475569" strokeWidth="1" />
      </svg>
    </div>
  );
};
