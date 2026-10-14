import React, { useState, useEffect } from 'react';
import { Plus, Clock, Sparkles } from 'lucide-react';
import { Quote, ViewMode, BookingWizardState } from '../../types';
import {
  getPersistedQuotes,
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
    return quotes && quotes.length > 0 ? quotes : getPersistedQuotes();
  });

  // Synchronize when prop changes
  useEffect(() => {
    if (quotes && quotes.length > 0) {
      setQuotesList(quotes);
    }
  }, [quotes]);

  // Synchronize with portalStore events (cross-tab and admin changes)
  useEffect(() => {
    const handleSync = () => {
      setQuotesList(getPersistedQuotes());
    };
    window.addEventListener('neo_portal_sync', handleSync);
    return () => window.removeEventListener('neo_portal_sync', handleSync);
  }, []);

  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [newOrigin, setNewOrigin] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [newVehicle, setNewVehicle] = useState('Sprinter LWB');

  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';

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

    if (onAcceptQuote) {
      onAcceptQuote(quote);
    } else {
      await deleteQuote(quote.id);
      setQuotesList((prev) => prev.filter((q) => q.id !== quote.id && q.reference !== quote.reference));
      if (onNavigate) {
        onNavigate('new-booking');
      }
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
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-0.5 bg-[#3898EC]" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
              SAVED
            </span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Quotes
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Accept a saved quote to convert it straight into a booking.
          </p>
        </div>

        <button
          onClick={() => setIsNewQuoteOpen(true)}
          className="flex items-center gap-2 bg-[#3898EC] hover:bg-[#2b85d6] text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New quote</span>
        </button>
      </div>

      {/* Quote Cards Grid (Matching Screenshot 5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quotes.map((quote) => (
          <div
            key={quote.id}
            className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${cardBg}`}
          >
            <div>
              {/* Card Header: Ref & Expiry Pill */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-slate-400 font-semibold">
                  {quote.reference}
                </span>

                <span
                  className={`font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full uppercase ${
                    quote.isUrgent
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {quote.expiresText}
                </span>
              </div>

              {/* Route */}
              <h2
                className={`text-lg font-bold tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {quote.origin} → {quote.destination}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {quote.vehicle} · {quote.serviceType}
              </p>

              {/* Price */}
              <div
                className={`text-3xl font-extrabold font-mono mt-6 mb-6 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                £{quote.total}
              </div>
            </div>

            {/* Buttons: Accept & book / Discard (Matching Screenshot 5) */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => onAcceptQuote(quote)}
                className="flex-1 bg-[#3898EC] hover:bg-[#2b85d6] text-white py-2.5 px-4 rounded-full text-xs font-bold transition-all text-center"
              >
                Accept & book
              </button>
              <button
                onClick={() => onDiscardQuote(quote.id)}
                className={`flex-1 py-2.5 px-4 rounded-full text-xs font-semibold border transition-all text-center ${
                  isDarkMode
                    ? 'border-[#1a2636] hover:bg-slate-800 text-slate-300'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-700'
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateQuote}
            className={`p-6 rounded-2xl border max-w-md w-full ${cardBg} shadow-2xl space-y-4`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3898EC]" />
                <h3 className="font-bold text-sm text-white">Create Saved Quote</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewQuoteOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Origin city or postcode
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Manchester"
                value={newOrigin}
                onChange={(e) => setNewOrigin(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-700 bg-[#060b11] text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Destination city or postcode
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Glasgow"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-700 bg-[#060b11] text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Vehicle Type
              </label>
              <select
                value={newVehicle}
                onChange={(e) => setNewVehicle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-700 bg-[#060b11] text-white"
              >
                <option value="Small Van">Small Van (up to 400kg)</option>
                <option value="Sprinter MWB">Sprinter MWB (up to 950kg)</option>
                <option value="Sprinter LWB">Sprinter LWB (up to 1,250kg)</option>
                <option value="Luton Tail-lift">Luton Tail-lift (up to 1,000kg)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsNewQuoteOpen(false)}
                className="px-4 py-2 rounded-full border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#3898EC] hover:bg-[#2b85d6] text-white px-5 py-2 rounded-full text-xs font-semibold"
              >
                Save Quote
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
