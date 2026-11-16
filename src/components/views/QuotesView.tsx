import React, { useState, useEffect } from 'react';
import { Plus, Clock } from 'lucide-react';
import { Quote, ViewMode, BookingWizardState } from '../../types';
import {
  getStoredQuotes,
  fetchPersistedQuotes,
  deleteQuote,
  addQuote,
  getPersistedWizardDraft,
  persistWizardDraft,
} from '../../lib/portalStore';

interface QuotesViewProps {
  isDarkMode: boolean;
  quotes?: Quote[];
  onAcceptQuote?: (quote: Quote) => void;
  onDiscardQuote?: (quoteId: string) => void;
  onAddNewQuote?: (newQuote: Quote) => void;
  onNavigate?: (view: ViewMode) => void;
}

export const QuotesView: React.FC<QuotesViewProps> = ({
  isDarkMode,
  quotes,
  onAcceptQuote,
  onDiscardQuote,
  onAddNewQuote,
  onNavigate,
}) => {
  const [quotesList, setQuotesList] = useState<Quote[]>(() => {
    return quotes !== undefined ? quotes : getStoredQuotes();
  });

  // Synchronize when prop changes
  useEffect(() => {
    if (quotes !== undefined) {
      setQuotesList(quotes);
    }
  }, [quotes]);

  // Fetch persisted quotes from Supabase on load
  useEffect(() => {
    fetchPersistedQuotes().then((fetched) => {
      if (fetched) {
        setQuotesList(fetched);
      }
    });
  }, []);

  // Synchronize with portalStore events (cross-tab and admin changes)
  useEffect(() => {
    const handleSync = () => {
      setQuotesList(getStoredQuotes());
    };
    window.addEventListener('neo_portal_sync', handleSync);
    return () => window.removeEventListener('neo_portal_sync', handleSync);
  }, []);

  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [newOrigin, setNewOrigin] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [newVehicle, setNewVehicle] = useState('Sprinter LWB');

  const cardBg = isDarkMode
    ? 'bg-[#111827] border-[#1e293b]'
    : 'bg-white border border-slate-200/80 shadow-advertz';

  const handleAccept = async (quote: Quote) => {
    // Pre-fill booking wizard draft with quote details and locked price
    const currentDraft = getPersistedWizardDraft();
    const updatedDraft: BookingWizardState = {
      ...currentDraft,
      pickupPostcode: quote.origin,
      dropoffPostcode: quote.destination,
      selectedVehicle: quote.vehicle,
      selectedService: quote.serviceType || 'Emergency (ASAP)',
      estimatedTotal: quote.total,
      notes: `Pre-booked from accepted quote ${quote.reference}. Locked price £${quote.total}.`,
    };
    persistWizardDraft(updatedDraft);

    await deleteQuote(quote.id);
    setQuotesList((prev) => prev.filter((q) => q.id !== quote.id && q.reference !== quote.reference));

    if (onAcceptQuote) {
      onAcceptQuote(quote);
    } else if (onNavigate) {
      onNavigate('new-booking');
    }
  };

  const handleDiscard = async (quoteId: string) => {
    await deleteQuote(quoteId);
    setQuotesList((prev) => prev.filter((q) => q.id !== quoteId && q.reference !== quoteId));
    if (onDiscardQuote) {
      onDiscardQuote(quoteId);
    }
  };

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrigin || !newDestination) return;

    const newQuote: Quote = {
      id: `q-${Date.now()}`,
      reference: `Q-${Math.floor(4850 + Math.random() * 100)}`,
      origin: newOrigin,
      destination: newDestination,
      vehicle: newVehicle,
      serviceType: 'Emergency Same-day',
      total: Math.floor(180 + Math.random() * 260),
      expiresText: 'EXPIRES IN 3 DAYS',
      isUrgent: false,
    };
    await addQuote(newQuote);
    setQuotesList((prev) => [newQuote, ...prev.filter((q) => q.id !== newQuote.id)]);
    if (onAddNewQuote) {
      onAddNewQuote(newQuote);
    }
    setIsNewQuoteOpen(false);
    setNewOrigin('');
    setNewDestination('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & New Quote Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
            <span>Guaranteed tariff estimates</span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Quotes
          </h1>
          <p
            className={`text-xs sm:text-sm mt-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Accept a saved quote to convert it straight into a booking.
          </p>
        </div>

        <button
          onClick={() => setIsNewQuoteOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New quote</span>
        </button>
      </div>

      {/* Quote Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quotesList.map((quote) => (
          <div
            key={quote.id}
            className={`p-6 sm:p-7 rounded-2xl border flex flex-col justify-between transition-all shadow-advertz shadow-advertz-hover ${cardBg}`}
          >
            <div>
              {/* Card Header: Ref & Expiry Pill */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`font-mono text-xs font-medium ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {quote.reference}
                </span>

                <span
                  className={`text-[11px] font-medium px-3 py-0.5 rounded-full ${
                    quote.isUrgent
                      ? isDarkMode
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                      : isDarkMode
                      ? 'bg-[#1e2229] text-slate-300 border border-slate-700/60'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {quote.expiresText}
                </span>
              </div>

              {/* Route */}
              <h2
                className={`text-base font-bold tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {quote.origin} → {quote.destination}
              </h2>
              <p
                className={`text-xs mt-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {quote.vehicle} · {quote.serviceType}
              </p>

              {/* Price */}
              <div
                className={`text-3xl font-extrabold font-mono tabular-nums mt-5 mb-5 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                £{quote.total}
              </div>
            </div>

            {/* Buttons: Accept & book / Discard */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => handleAccept(quote)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 px-4 rounded-full text-xs font-medium transition-colors text-center cursor-pointer shadow-xs"
              >
                Accept & book
              </button>
              <button
                onClick={() => handleDiscard(quote.id)}
                className={`flex-1 py-2.5 px-4 rounded-full text-xs font-medium border transition-colors text-center cursor-pointer ${
                  isDarkMode
                    ? 'border-[#1e2229] hover:bg-[#1e2229] text-slate-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
                }`}
              >
                Discard
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Quote Modal */}
      {isNewQuoteOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateQuote}
            className={`p-6 sm:p-7 rounded-3xl border max-w-md w-full ${cardBg} shadow-advertz-lg space-y-4`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isDarkMode ? 'border-[#1e2229]' : 'border-slate-200/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3
                  className={`font-bold text-base tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Create saved quote
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewQuoteOpen(false)}
                className={`p-1 rounded-full cursor-pointer transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                ✕
              </button>
            </div>

            <div>
              <label
                className={`block text-xs font-semibold mb-1.5 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Origin city or postcode
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Manchester"
                value={newOrigin}
                onChange={(e) => setNewOrigin(e.target.value)}
                className={`w-full text-xs p-3 rounded-xl border transition-colors outline-none ${
                  isDarkMode
                    ? 'border-[#1e2229] bg-[#0b0d11] text-white focus:border-blue-500'
                    : 'border-slate-200 bg-white text-slate-900 shadow-advertz focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-xs font-semibold mb-1.5 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Destination city or postcode
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Glasgow"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                className={`w-full text-xs p-3 rounded-xl border transition-colors outline-none ${
                  isDarkMode
                    ? 'border-[#1e2229] bg-[#0b0d11] text-white focus:border-blue-500'
                    : 'border-slate-200 bg-white text-slate-900 shadow-advertz focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-xs font-semibold mb-1.5 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Vehicle type
              </label>
              <select
                value={newVehicle}
                onChange={(e) => setNewVehicle(e.target.value)}
                className={`w-full text-xs p-3 rounded-xl border transition-colors outline-none cursor-pointer ${
                  isDarkMode
                    ? 'border-[#1e2229] bg-[#0b0d11] text-white focus:border-blue-500'
                    : 'border-slate-200 bg-white text-slate-900 shadow-advertz focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                }`}
              >
                <option value="Small Van">Small Van (up to 400kg)</option>
                <option value="Sprinter MWB">Sprinter MWB (up to 950kg)</option>
                <option value="Sprinter LWB">Sprinter LWB (up to 1,250kg)</option>
                <option value="Luton Tail-lift">Luton Tail-lift (up to 1,000kg)</option>
              </select>
            </div>

            <div
              className={`flex justify-end gap-2.5 pt-3 border-t ${
                isDarkMode ? 'border-[#1e2229]' : 'border-slate-200/80'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsNewQuoteOpen(false)}
                className={`px-5 py-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-[#1e2229] text-slate-300 hover:bg-[#1e2229]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-advertz'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer shadow-xs"
              >
                Save quote
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
