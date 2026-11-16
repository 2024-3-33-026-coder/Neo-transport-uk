import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { ResolvedAddress } from '../../types';

export interface AddressAutocompleteProps {
  id?: string;
  name?: string;
  label: string;
  stepBadge?: string;
  value: string;
  placeholder?: string;
  selectedAddress?: ResolvedAddress | null;
  onSelect: (address: ResolvedAddress) => void;
  onChange: (value: string) => void;
  onInvalidate: () => void;
  isDarkMode: boolean;
  inputBg: string;
  required?: boolean;
}

export interface SuggestionItem {
  id: string;
  suggestion: string;
  udprn?: number | string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  id,
  name,
  label,
  stepBadge,
  value,
  placeholder = 'e.g. Manchester M17 1AB',
  selectedAddress,
  onSelect,
  onChange,
  onInvalidate,
  isDarkMode,
  inputBg,
}) => {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle typing with debouncing and invalidation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    onChange(nextVal);

    // Requirement 6: Typing into a selected address again must invalidate the previous selection
    // and its dependent quote until a new address is selected.
    if (selectedAddress) {
      onInvalidate();
    }

    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!nextVal.trim() || nextVal.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address/autocomplete?query=${encodeURIComponent(nextVal.trim())}`);
        const data = await res.json();

        if (data.configured === false) {
          setIsConfigured(false);
          setIsLoading(false);
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        setIsConfigured(true);
        if (data.success && Array.isArray(data.hits)) {
          setSuggestions(data.hits);
          setIsOpen(data.hits.length > 0 || nextVal.trim().length >= 3);
          setHighlightedIndex(-1);
        } else {
          setSuggestions([]);
          if (data.error) {
            setError(data.error);
          }
        }
      } catch (err: any) {
        setError('Network error fetching address suggestions. Manual input supported.');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  // Resolve selected suggestion to full address
  const handleSelectSuggestion = async (item: SuggestionItem) => {
    setIsResolving(true);
    setIsOpen(false);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (item.id) queryParams.set('id', item.id);
      if (item.udprn) queryParams.set('udprn', String(item.udprn));
      if (item.suggestion) queryParams.set('suggestion', item.suggestion);

      const res = await fetch(`/api/address/resolve?${queryParams.toString()}`);
      const data = await res.json();

      if (data.success && data.address) {
        onSelect(data.address);
      } else {
        // Fallback: use suggestion text directly
        const fallbackAddress: ResolvedAddress = {
          id: item.id || String(item.udprn || 'manual'),
          suggestion: item.suggestion,
          formattedAddress: item.suggestion,
          postcode: extractPostcodeFromText(item.suggestion),
          line_1: item.suggestion.split(',')[0] || item.suggestion,
          post_town: extractTownFromText(item.suggestion),
          latitude: null,
          longitude: null,
        };
        onSelect(fallbackAddress);
        if (data.error) {
          setError(data.error);
        }
      }
    } catch (err: any) {
      // Fallback on network resolution failure
      const fallbackAddress: ResolvedAddress = {
        id: item.id || String(item.udprn || 'manual'),
        suggestion: item.suggestion,
        formattedAddress: item.suggestion,
        postcode: extractPostcodeFromText(item.suggestion),
        line_1: item.suggestion.split(',')[0] || item.suggestion,
        post_town: extractTownFromText(item.suggestion),
        latitude: null,
        longitude: null,
      };
      onSelect(fallbackAddress);
    } finally {
      setIsResolving(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Clear current selection
  const handleClearSelection = () => {
    onChange('');
    onInvalidate();
    setSuggestions([]);
    setIsOpen(false);
    setError(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-400"
        >
          {label}
        </label>
        {stepBadge && (
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            {stepBadge}
          </span>
        )}
      </div>

      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${inputBg} ${
            selectedAddress
              ? 'border-emerald-500/50 pr-20 focus:border-emerald-500'
              : 'pr-10 focus:border-[#3898EC]'
          }`}
          placeholder={placeholder}
          autoComplete="off"
        />

        {/* Right input icons / indicators */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-auto">
          {isLoading || isResolving ? (
            <Loader2 className="w-4 h-4 text-[#3898EC] animate-spin" />
          ) : selectedAddress ? (
            <div className="flex items-center gap-1">
              <span title="Address Verified">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
                title="Clear address"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : value ? (
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <MapPin className="w-4 h-4 text-slate-500 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Selected Address Confirmation Pill */}
      {selectedAddress && (
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
          <div className="flex items-center gap-1.5 truncate">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span className="truncate">
              Verified: {selectedAddress.postcode || selectedAddress.formattedAddress}
            </span>
          </div>
          {selectedAddress.latitude && selectedAddress.longitude && (
            <span className="text-[10px] text-emerald-500/80 shrink-0 ml-2">
              GPS: {selectedAddress.latitude.toFixed(3)}, {selectedAddress.longitude.toFixed(3)}
            </span>
          )}
        </div>
      )}

      {/* Error or Configuration Notice */}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {!isConfigured && (
        <div className="mt-1.5 text-[11px] text-slate-400 font-mono bg-slate-800/40 border border-slate-700/50 px-3 py-1 rounded-md">
          Address autocomplete offline (IDEAL_POSTCODES_API_KEY unconfigured). Manual entry active.
        </div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && !selectedAddress && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border shadow-2xl overflow-hidden backdrop-blur-md max-h-64 overflow-y-auto ${
            isDarkMode ? 'bg-[#0a111a]/95 border-[#1e2c40]' : 'bg-white/95 border-slate-200'
          }`}
          role="listbox"
        >
          {suggestions.length > 0 ? (
            <ul className="divide-y divide-slate-800/40">
              {suggestions.map((item, index) => {
                const isHighlighted = highlightedIndex === index;
                return (
                  <li
                    key={item.id || index}
                    role="option"
                    aria-selected={isHighlighted}
                    onClick={() => handleSelectSuggestion(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-4 py-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isHighlighted
                        ? 'bg-[#3898EC]/15 text-[#3898EC]'
                        : isDarkMode
                        ? 'text-slate-200 hover:bg-slate-800/50'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <MapPin className={`w-3.5 h-3.5 shrink-0 ${isHighlighted ? 'text-[#3898EC]' : 'text-slate-400'}`} />
                      <span className="font-medium truncate">{item.suggestion}</span>
                    </div>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 shrink-0 uppercase">
                      PAF
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400 font-medium text-center">
              No matching UK addresses found. You can continue typing manually.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function extractPostcodeFromText(text: string): string {
  const match = text.match(/([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})/i);
  return match ? match[1].toUpperCase() : '';
}

function extractTownFromText(text: string): string {
  const parts = text.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[0] || 'Unknown';
}
