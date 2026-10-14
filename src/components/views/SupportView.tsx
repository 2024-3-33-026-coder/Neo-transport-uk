import React, { useState } from 'react';
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
} from 'lucide-react';
import { askDispatchCopilot } from '../../lib/geminiClient';
import { CONTACT_CONFIG } from '../../lib/config';

interface SupportViewProps {
  isDarkMode: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const SupportView: React.FC<SupportViewProps> = ({ isDarkMode }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'NEO 24/7 Dispatch Control: Good morning, Chris. All 6 regional hubs are active. Average driver collection SLA is currently 42 minutes nationwide. How can I assist with your freight recovery or carrier backup today?',
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';

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
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-0.5 bg-[#3898EC]" />
          <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
            DISPATCH 24/7
          </span>
        </div>
        <h1
          className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          Support & Live Dispatch
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Direct telephone lines and AI-assisted emergency fleet allocation.
        </p>
      </div>

      {/* 3 Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 rounded-2xl border flex flex-col justify-between ${cardBg}`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-[#3898EC] mb-4">
              <Phone className="w-5 h-5" />
            </div>
            <span className="font-mono text-[10px] text-[#3898EC] uppercase font-bold tracking-wider">
              PRIORITY DESK
            </span>
            <h2
              className={`text-xl font-bold mt-1 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              <a href={CONTACT_CONFIG.phone.primaryTel} className="hover:underline">
                {CONTACT_CONFIG.phone.primary}
              </a>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Direct line to human duty dispatcher. No automated queues.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center gap-2 font-mono text-[11px] text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-glow" />
            <span>Avg. answer {CONTACT_CONFIG.sla.dispatchResponseSeconds} seconds</span>
          </div>
        </div>

        <div className={`p-6 rounded-2xl border flex flex-col justify-between ${cardBg}`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-[#3898EC] mb-4">
              <Mail className="w-5 h-5" />
            </div>
            <span className="font-mono text-[10px] text-[#3898EC] uppercase font-bold tracking-wider">
              BOOKING EMAIL
            </span>
            <h2
              className={`text-lg font-bold mt-1 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              <a href={`mailto:${CONTACT_CONFIG.email.dispatch}`} className="hover:underline">
                {CONTACT_CONFIG.email.dispatch}
              </a>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Send consignment notes, purchase orders, or shipping manifests.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/40 font-mono text-[11px] text-slate-400">
            Response SLA &lt; 3 minutes
          </div>
        </div>

        <div className={`p-6 rounded-2xl border flex flex-col justify-between ${cardBg}`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-[#3898EC] mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <span className="font-mono text-[10px] text-[#3898EC] uppercase font-bold tracking-wider">
              AVAILABILITY
            </span>
            <h2
              className={`text-lg font-bold mt-1 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              24/7/365 Nationwide
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Standby accounts include late-night and bank holiday recovery.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/40 font-mono text-[11px] text-sky-400">
            100% On-Call Coverage
          </div>
        </div>
      </div>

      {/* Gemini 24/7 AI Dispatch Copilot Chat Card */}
      <div className={`p-6 rounded-2xl border ${cardBg}`}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3898EC]/20 text-[#3898EC] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2
                className={`font-bold text-base ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Gemini 3.8 Flash · Emergency Dispatch Copilot
              </h2>
              <p className="text-xs text-slate-400">
                Ask questions regarding vehicle axle limits, transit times, ADR rules, or instant quotes.
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
            Online
          </span>
        </div>

        {/* Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-none">
          {[
            'Nearest vehicle to Manchester M17 right now?',
            'What is the max pallet capacity on a Luton Tail-lift?',
            'Are weekend emergency collections covered under £0 standby?',
            'How quickly can a driver reach Birmingham B6?',
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => handleSendMessage(chip)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors shrink-0 ${
                isDarkMode
                  ? 'bg-[#060b11] hover:bg-[#0e1622] text-slate-300 border border-slate-800'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
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
                    ? 'bg-[#3898EC] text-white rounded-tr-xs'
                    : isDarkMode
                    ? 'bg-[#060b11] text-slate-200 border border-slate-800 rounded-tl-xs'
                    : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-xs'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className={`rounded-2xl px-4 py-3 text-xs flex items-center gap-2 ${
                  isDarkMode ? 'bg-[#060b11] text-slate-400 border border-slate-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3898EC]" />
                <span>Dispatch Copilot calculating route & fleet telemetry...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-700/40">
          <input
            type="text"
            placeholder="Ask dispatch copilot anything about your shipment or emergency recovery..."
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className={`flex-1 text-xs px-4 py-2.5 rounded-xl border transition-colors ${
              isDarkMode
                ? 'bg-[#060b11] border-[#1a2636] text-white focus:border-[#3898EC]'
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#3898EC]'
            }`}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputQuestion.trim()}
            className="bg-[#3898EC] hover:bg-[#2b85d6] text-white p-2.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
