import React, { useState, useEffect } from 'react';
import {
  Phone,
  Mail,
  Headphones,
  Sparkles,
  Send,
  Loader2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Plus,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { askDispatchCopilot } from '../../lib/geminiClient';
import { CONTACT_CONFIG } from '../../lib/config';
import { SupportTicket, SupportTicketMessage } from '../../types';
import {
  getStoredTickets,
  getPersistedTickets,
  addSupportTicket,
  getPersistedTicketMessages,
  addTicketMessage,
} from '../../lib/portalStore';

interface SupportViewProps {
  isDarkMode: boolean;
  companyId?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const SupportView: React.FC<SupportViewProps> = ({ isDarkMode, companyId }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'NEO 24/7 Dispatch Control: Good morning, Chris. All 6 regional hubs are active. Average driver collection SLA is currently 42 minutes nationwide. How can I assist with your freight recovery or carrier backup today?',
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Support Tickets State
  const [tickets, setTickets] = useState<SupportTicket[]>(() => getStoredTickets());
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [ticketTopic, setTicketTopic] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Ticket Conversation Modal & Messaging State
  const [selectedTicketForChat, setSelectedTicketForChat] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [customerReplyText, setCustomerReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadTickets = () => {
      getPersistedTickets().then((fetched) => {
        if (fetched) {
          setTickets(fetched);
        }
      });
      if (selectedTicketForChat) {
        getPersistedTicketMessages(selectedTicketForChat.id).then(setTicketMessages);
      }
    };

    loadTickets();
    window.addEventListener('neo_portal_sync', loadTickets);
    return () => {
      window.removeEventListener('neo_portal_sync', loadTickets);
    };
  }, [selectedTicketForChat]);

  // Load ticket conversation when a ticket is opened
  useEffect(() => {
    if (selectedTicketForChat) {
      setCustomerReplyText('');
      setReplyError(null);
      setReplySuccess(null);
      setLoadingMessages(true);
      getPersistedTicketMessages(selectedTicketForChat.id)
        .then((msgs) => setTicketMessages(msgs))
        .catch((err) => console.error('Failed fetching ticket conversation:', err))
        .finally(() => setLoadingMessages(false));
    } else {
      setTicketMessages([]);
      setCustomerReplyText('');
      setReplyError(null);
      setReplySuccess(null);
    }
  }, [selectedTicketForChat?.id]);

  const handleRefreshConversation = async () => {
    if (!selectedTicketForChat) return;
    setLoadingMessages(true);
    try {
      const msgs = await getPersistedTicketMessages(selectedTicketForChat.id);
      setTicketMessages(msgs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendCustomerReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketForChat || !customerReplyText.trim() || isSendingReply) return;

    setIsSendingReply(true);
    setReplyError(null);
    setReplySuccess(null);

    try {
      const newMsg = await addTicketMessage(
        selectedTicketForChat.id,
        customerReplyText.trim(),
        'customer'
      );
      setTicketMessages((prev) => [...prev.filter((m) => m.id !== newMsg.id), newMsg]);
      setCustomerReplyText('');
      setReplySuccess('Reply sent to NEO Dispatch.');
      setTimeout(() => setReplySuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Failed sending customer reply:', err);
      const msg = err instanceof Error ? err.message : 'Failed to send reply. Please check connection.';
      setReplyError(msg);
    } finally {
      setIsSendingReply(false);
    }
  };

  const cardBg = isDarkMode
    ? 'bg-[#111827] border-[#1e293b]'
    : 'bg-white border border-slate-200/80 shadow-advertz';

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTopic.trim() || !ticketMessage.trim()) return;

    setTicketError(null);
    setIsSubmittingTicket(true);
    try {
      const updated = await addSupportTicket(
        { topic: ticketTopic.trim(), message: ticketMessage.trim() },
        companyId
      );
      setTickets(updated);
      setIsNewTicketOpen(false);
      setTicketTopic('');
      setTicketMessage('');
    } catch (err: unknown) {
      console.error('Failed creating ticket:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to create support ticket. Please check your connection or company assignment.';
      setTicketError(msg);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputQuestion.trim();
    if (!textToSend || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setInputQuestion('');
    setIsLoading(true);

    try {
      const data = await askDispatchCopilot(
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        textToSend
      );
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || 'Dispatch officer assigned.' },
      ]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Dispatch line active. Please call our 24/7 priority desk directly on ${CONTACT_CONFIG.phone.primary} for immediate vehicle lock.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
          <span>Duty desk 24/7</span>
        </div>
        <h1
          className={`text-2xl sm:text-3xl font-bold tracking-tight ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          Support & Live Dispatch
        </h1>
        <p className={`text-xs sm:text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Direct telephone lines and AI-assisted emergency fleet allocation.
        </p>
      </div>

      {/* 3 Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 sm:p-7 rounded-2xl border flex flex-col justify-between transition-all shadow-advertz shadow-advertz-hover ${cardBg}`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3.5">
              <Phone className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] text-blue-600 uppercase font-semibold tracking-wider">
              Priority Desk · Aircall HQ
            </span>
            <h2
              className={`text-xl font-bold mt-1 tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              <a href={CONTACT_CONFIG.phone.primaryTel} className="hover:underline">
                {CONTACT_CONFIG.phone.primary}
              </a>
            </h2>
            <p
              className={`text-xs mt-1.5 leading-relaxed ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Direct line to human duty dispatcher. Aircall HQ: <a href={CONTACT_CONFIG.phone.aircallHqTel} className="text-blue-600 hover:underline font-mono font-medium">{CONTACT_CONFIG.phone.aircallHq}</a>
            </p>
          </div>
          <div
            className={`mt-5 pt-3.5 border-t flex items-center gap-2 font-mono text-[11px] text-emerald-600 font-medium ${
              isDarkMode ? 'border-[#1e2229]' : 'border-slate-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Avg. answer {CONTACT_CONFIG.sla.dispatchResponseSeconds} seconds</span>
          </div>
        </div>

        <div className={`p-6 sm:p-7 rounded-2xl border flex flex-col justify-between transition-all shadow-advertz shadow-advertz-hover ${cardBg}`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3.5">
              <Mail className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] text-blue-600 uppercase font-semibold tracking-wider">
              Booking Email
            </span>
            <h2
              className={`text-base font-bold mt-1 tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              <a href={`mailto:${CONTACT_CONFIG.email.dispatch}`} className="hover:underline">
                {CONTACT_CONFIG.email.dispatch}
              </a>
            </h2>
            <p
              className={`text-xs mt-1.5 leading-relaxed ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Send consignment notes, purchase orders, or shipping manifests.
            </p>
          </div>
          <div
            className={`mt-5 pt-3.5 border-t font-mono text-[11px] ${
              isDarkMode ? 'border-[#1e2229] text-slate-400' : 'border-slate-100 text-slate-500'
            }`}
          >
            Response SLA &lt; 3 minutes
          </div>
        </div>

        <div className={`p-6 sm:p-7 rounded-2xl border flex flex-col justify-between transition-all shadow-advertz shadow-advertz-hover ${cardBg}`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3.5">
              <Clock className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] text-blue-600 uppercase font-semibold tracking-wider">
              Availability
            </span>
            <h2
              className={`text-base font-bold mt-1 tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              24/7/365 Nationwide
            </h2>
            <p
              className={`text-xs mt-1.5 leading-relaxed ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Standby accounts include late-night and bank holiday recovery.
            </p>
          </div>
          <div
            className={`mt-5 pt-3.5 border-t font-mono text-[11px] text-blue-600 font-medium ${
              isDarkMode ? 'border-[#1e2229]' : 'border-slate-100'
            }`}
          >
            100% On-Call Coverage
          </div>
        </div>
      </div>

      {/* Gemini 24/7 AI Dispatch Copilot Chat Card */}
      <div className={`p-6 sm:p-7 rounded-2xl border ${cardBg} shadow-advertz`}>
        <div
          className={`flex items-center justify-between pb-3.5 border-b ${
            isDarkMode ? 'border-[#1e2229]' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2
                className={`font-bold text-sm tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Dispatch Copilot
              </h2>
              <p
                className={`text-xs ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Ask questions regarding vehicle axle limits, transit times, ADR rules, or instant quotes.
              </p>
            </div>
          </div>
          <span
            className={`text-[11px] px-3 py-0.5 rounded-full font-medium uppercase ${
              isDarkMode
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
            }`}
          >
            Online
          </span>
        </div>

        {/* Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto py-3.5 scrollbar-none">
          {[
            'Nearest vehicle to Manchester M17 right now?',
            'What is the max pallet capacity on a Luton Tail-lift?',
            'Are weekend emergency collections covered under £0 standby?',
            'How quickly can a driver reach Birmingham B6?',
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => handleSendMessage(chip)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                isDarkMode
                  ? 'bg-[#0b0d11] hover:bg-[#1e2229] text-slate-300 border border-[#1e2229]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-advertz'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Messages history */}
        <div className="space-y-3 max-h-80 overflow-y-auto py-3 pr-1">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xl rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                    : isDarkMode
                    ? 'bg-[#0b0d11] text-slate-200 border border-[#1e2229] rounded-bl-xs'
                    : 'bg-slate-50/80 text-slate-900 border border-slate-200/80 rounded-bl-xs shadow-advertz'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className={`rounded-2xl rounded-bl-xs px-4 py-3 text-xs flex items-center gap-2 ${
                  isDarkMode
                    ? 'bg-[#0b0d11] text-slate-400 border border-[#1e2229]'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 shadow-advertz'
                }`}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Dispatch Copilot calculating route & fleet telemetry...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        <div
          className={`flex items-center gap-2 pt-3.5 border-t ${
            isDarkMode ? 'border-[#1e2229]' : 'border-slate-200/80'
          }`}
        >
          <input
            type="text"
            placeholder="Ask dispatch copilot anything about your shipment or emergency recovery..."
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className={`flex-1 text-xs px-4 py-2.5 rounded-xl border transition-colors outline-none ${
              isDarkMode
                ? 'bg-[#0b0d11] border-[#1e2229] text-white focus:border-blue-500'
                : 'bg-white border-slate-200 text-slate-900 shadow-advertz focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
            }`}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputQuestion.trim()}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white p-2.5 rounded-full text-xs font-medium disabled:opacity-50 transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Support Requests & Duty Desk Inquiries Card */}
      <div className={`p-6 sm:p-7 rounded-2xl border ${cardBg} shadow-advertz`}>
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b ${
            isDarkMode ? 'border-[#1e2229]' : 'border-slate-200/80'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h2 className={`font-bold text-sm tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Support tickets & enquiries
              </h2>
            </div>
            <p
              className={`text-xs mt-0.5 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Logged enquiries tracked by our duty dispatchers and logistics coordinators.
            </p>
          </div>

          <button
            onClick={() => {
              setTicketError(null);
              setIsNewTicketOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-full text-xs font-medium transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open ticket</span>
          </button>
        </div>

        {/* Tickets List */}
        <div className={`divide-y pt-2 ${isDarkMode ? 'divide-[#1e2229]' : 'divide-slate-100'}`}>
          {tickets.length === 0 ? (
            <p
              className={`text-xs py-4 text-center ${
                isDarkMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              No open support tickets. Direct phone line active 24/7.
            </p>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-mono text-xs font-medium ${
                        isDarkMode ? 'text-slate-200' : 'text-slate-900'
                      }`}
                    >
                      {t.id}
                    </span>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-md uppercase font-medium ${
                        t.status === 'Resolved'
                          ? isDarkMode
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : t.status === 'In Progress'
                          ? isDarkMode
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                          : isDarkMode
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {t.status}
                    </span>
                    <span
                      className={`text-[11px] ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      · {t.date}
                    </span>
                  </div>
                  <h3
                    className={`text-xs font-semibold ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-900'
                    }`}
                  >
                    {t.topic}
                  </h3>
                  <p
                    className={`text-xs line-clamp-2 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {t.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTicketForChat(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer self-start sm:self-auto shrink-0 ${
                    isDarkMode
                      ? 'border-[#1e2229] bg-[#0b0d11] text-slate-300 hover:bg-[#1e2229]'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Conversation</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {isNewTicketOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateTicket}
            className={`p-6 rounded-xl border max-w-md w-full ${cardBg} space-y-4`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isDarkMode ? 'border-[#1e2229]' : 'border-slate-200'
              }`}
            >
              <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Create support ticket
              </h3>
              <button
                type="button"
                onClick={() => {
                  setTicketError(null);
                  setIsNewTicketOpen(false);
                }}
                className={`text-xs font-mono transition-colors cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                ✕
              </button>
            </div>

            {ticketError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{ticketError}</span>
              </div>
            )}

            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Subject / Consignment topic
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tail-lift access confirmation for Bay 3"
                value={ticketTopic}
                onChange={(e) => setTicketTopic(e.target.value)}
                className={`w-full text-xs p-2.5 rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'border-[#1e2229] bg-[#0b0d11] text-white focus:border-[#206bc4]'
                    : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-[#206bc4]'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Message / Operational details
              </label>
              <textarea
                required
                rows={4}
                placeholder="Provide details regarding your booking reference, required ETA, or depot instructions..."
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                className={`w-full text-xs p-2.5 rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'border-[#1e2229] bg-[#0b0d11] text-white focus:border-[#206bc4]'
                    : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-[#206bc4]'
                }`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewTicketOpen(false)}
                className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-[#1e2229] text-slate-300 hover:bg-[#1e2229]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingTicket}
                className="bg-[#206bc4] hover:bg-[#1a5bb0] active:bg-[#164e96] text-white px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSubmittingTicket ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit ticket</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customer Conversation Modal */}
      {selectedTicketForChat && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 sm:p-4 z-50">
          <div
            className={`p-5 sm:p-6 rounded-xl border max-w-2xl w-full max-h-[92vh] flex flex-col ${cardBg} space-y-4`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between pb-3 border-b shrink-0 ${
                isDarkMode ? 'border-[#1e2229]' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-[#206bc4] flex items-center justify-center shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Conversation · {selectedTicketForChat.id}
                  </h3>
                  <p
                    className={`text-[11px] font-mono truncate max-w-xs sm:max-w-md ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {selectedTicketForChat.topic}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshConversation}
                  disabled={loadingMessages}
                  title="Refresh conversation"
                  className={`text-xs font-mono p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'text-slate-400 hover:text-white hover:bg-[#1e2229]'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin text-[#206bc4]' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTicketForChat(null)}
                  className={`text-xs font-mono p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'text-slate-400 hover:text-white hover:bg-[#1e2229]'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  isDarkMode
                    ? 'bg-[#0b0d11] border-[#1e2229]'
                    : 'bg-slate-50/90 border-slate-200/90'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-mono ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Status:
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md uppercase font-medium ${
                      selectedTicketForChat.status === 'Resolved'
                        ? isDarkMode
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedTicketForChat.status === 'In Progress'
                        ? isDarkMode
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                        : isDarkMode
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedTicketForChat.status}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Logged: {selectedTicketForChat.date}
                </span>
              </div>

              {/* Message History */}
              <div className="space-y-2.5">
                {/* Initial Customer Enquiry */}
                <div
                  className={`p-3.5 rounded-lg border space-y-1.5 ${
                    isDarkMode
                      ? 'bg-[#0b0d11] border-[#1e2229]'
                      : 'bg-slate-50/90 border-slate-200/90'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between gap-2 pb-1.5 border-b ${
                      isDarkMode ? 'border-[#1e2229]' : 'border-slate-200'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-mono font-medium ${
                        isDarkMode ? 'text-slate-300' : 'text-slate-900'
                      }`}
                    >
                      Your initial enquiry
                    </span>
                    <span
                      className={`text-[10px] font-mono ${
                        isDarkMode ? 'text-slate-500' : 'text-slate-500'
                      }`}
                    >
                      {selectedTicketForChat.date}
                    </span>
                  </div>
                  <p
                    className={`text-xs leading-relaxed whitespace-pre-wrap font-sans ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {selectedTicketForChat.message}
                  </p>
                </div>

                {/* Replies */}
                {ticketMessages.map((msg) => {
                  const isStaff = msg.sender_role === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-lg space-y-1.5 transition-colors ${
                        isStaff
                          ? isDarkMode
                            ? 'bg-sky-500/10 border border-sky-500/20 mr-4 sm:mr-8'
                            : 'bg-sky-50/90 border border-sky-200 mr-4 sm:mr-8'
                          : isDarkMode
                          ? 'bg-[#0b0d11] border border-[#1e2229] ml-4 sm:ml-8'
                          : 'bg-white border border-slate-200 ml-4 sm:ml-8'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between gap-2 pb-1.5 border-b ${
                          isStaff
                            ? isDarkMode
                              ? 'border-sky-500/20'
                              : 'border-sky-200'
                            : isDarkMode
                            ? 'border-[#1e2229]'
                            : 'border-slate-200'
                        }`}
                      >
                        <span
                          className={`text-[11px] font-mono font-medium flex items-center gap-1.5 ${
                            isStaff
                              ? isDarkMode
                                ? 'text-sky-400'
                                : 'text-sky-700'
                              : isDarkMode
                              ? 'text-slate-300'
                              : 'text-slate-900'
                          }`}
                        >
                          {isStaff ? (
                            <Headphones className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          )}
                          <span>
                            {isStaff
                              ? `NEO Fleet Dispatch (${msg.sender_name})`
                              : `You (${msg.sender_name})`}
                          </span>
                        </span>
                        <span
                          className={`text-[10px] font-mono ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          ·{' '}
                          {new Date(msg.created_at).toLocaleDateString([], {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p
                        className={`text-xs leading-relaxed whitespace-pre-wrap font-sans ${
                          isDarkMode ? 'text-slate-100' : 'text-slate-800'
                        }`}
                      >
                        {msg.message}
                      </p>
                    </div>
                  );
                })}

                {loadingMessages && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs font-mono text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#206bc4]" />
                    <span>Syncing conversation...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Reply Composer */}
            <form
              onSubmit={handleSendCustomerReply}
              className={`pt-2 border-t space-y-2.5 shrink-0 ${
                isDarkMode ? 'border-[#1e2229]' : 'border-slate-200'
              }`}
            >
              {replyError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{replyError}</span>
                </div>
              )}
              {replySuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{replySuccess}</span>
                </div>
              )}

              <div>
                <textarea
                  rows={3}
                  placeholder="Type a response to the duty dispatch officer..."
                  value={customerReplyText}
                  onChange={(e) => setCustomerReplyText(e.target.value)}
                  disabled={isSendingReply}
                  className={`w-full text-xs p-3 rounded-lg border transition-colors focus:outline-none ${
                    isDarkMode
                      ? 'border-[#1e2229] bg-[#0b0d11] text-white placeholder-slate-500 focus:border-[#206bc4]'
                      : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-[#206bc4]'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span
                  className={`text-[11px] font-mono hidden sm:inline ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Dispatch officer responds directly to your consignment inquiry.
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedTicketForChat(null)}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isDarkMode
                        ? 'border-[#1e2229] text-slate-300 hover:text-white hover:bg-[#1e2229]'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!customerReplyText.trim() || isSendingReply}
                    className="bg-[#206bc4] hover:bg-[#1a5bb0] active:bg-[#164e96] text-white px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isSendingReply ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send response</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
