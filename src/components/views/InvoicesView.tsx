import React, { useState } from 'react';
import { Download, CreditCard, CheckCircle2, FileText } from 'lucide-react';
import { Invoice } from '../../types';

interface InvoicesViewProps {
  isDarkMode: boolean;
  invoices: Invoice[];
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({ isDarkMode, invoices }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';

  const handleDownloadInvoice = (inv: Invoice) => {
    // Generate text invoice summary
    const content = `================================================
NEO TRANSPORT B2B FREIGHT SERVICES
STANDBY LOGISTICS INVOICE
================================================
Invoice Reference: ${inv.reference}
Issue Date: ${inv.date}
Billing Period: ${inv.period}
Customer: Meridian Logistics (Chris Sullivan)
Account Number: NEO-ACT-88412
VAT Reg: GB 894 1238 90

Description: Emergency freight recovery & rapid response dispatch
Total Amount: £${inv.amount.toLocaleString()}.00
Payment Status: ${inv.status}
Settlement Terms: 30 Days End of Month (BACS)

Bank Transfer Details:
Barclays Corporate UK
Sort Code: 20-00-00
Account: 83921049
IBAN: GB29 BARC 2000 0083 9210 49
================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inv.reference}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadStatement = () => {
    const content = `NEO TRANSPORT - CONSOLIDATED STATEMENT
Client: Meridian Logistics
Statement Date: 01 Aug 2026
Outstanding Balance: £960.00
Year-to-date Paid: £31,420.00
Next Scheduled Statement: 01 Sep 2026`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NEO_Statement_Aug2026.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Download Statement */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-0.5 bg-[#3898EC]" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
              BILLING
            </span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Invoices
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monthly statements and ad-hoc invoices for your standby account.
          </p>
        </div>

        <button
          onClick={handleDownloadStatement}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all self-start sm:self-auto ${
            isDarkMode
              ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200'
              : 'border-slate-300 hover:bg-slate-100 text-slate-800'
          }`}
        >
          <Download className="w-4 h-4 text-[#3898EC]" />
          <span>Download statement</span>
        </button>
      </div>

      {/* 3 KPIs Grid (Matching Screenshot 6) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 rounded-2xl border ${cardBg}`}>
          <span className="text-xs text-slate-400 font-medium">Outstanding</span>
          <div
            className={`text-3xl font-extrabold mt-1 font-mono ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            £960
          </div>
        </div>

        <div className={`p-6 rounded-2xl border ${cardBg}`}>
          <span className="text-xs text-slate-400 font-medium">Paid this year</span>
          <div
            className={`text-3xl font-extrabold mt-1 font-mono ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            £31,420
          </div>
        </div>

        <div className={`p-6 rounded-2xl border ${cardBg}`}>
          <span className="text-xs text-sky-400 font-medium">Next statement</span>
          <div
            className={`text-3xl font-extrabold mt-1 font-mono ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            01 Sep
          </div>
        </div>
      </div>

      {/* Invoice Table Card (Matching Screenshot 6) */}
      <div className={`p-5 sm:p-6 rounded-2xl border ${cardBg}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b font-mono text-[10px] uppercase tracking-wider ${
                  isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                <th className="py-3 px-3">INVOICE</th>
                <th className="py-3 px-3">DATE</th>
                <th className="py-3 px-3">PERIOD</th>
                <th className="py-3 px-3">AMOUNT</th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-3 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={`transition-colors ${
                    isDarkMode ? 'hover:bg-[#0e1622]/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-4 px-3 font-mono font-bold text-slate-200">
                    {inv.reference}
                  </td>
                  <td className="py-4 px-3 text-slate-400 font-mono">
                    {inv.date}
                  </td>
                  <td className="py-4 px-3 text-slate-200 font-medium">
                    {inv.period}
                  </td>
                  <td className="py-4 px-3 font-extrabold text-slate-200 font-mono">
                    £{inv.amount.toLocaleString()}
                  </td>
                  <td className="py-4 px-3">
                    {inv.status === 'PAID' && (
                      <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        PAID
                      </span>
                    )}
                    {inv.status === 'DUE' && (
                      <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                        DUE
                      </span>
                    )}
                    {inv.status === 'OVERDUE' && (
                      <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                        OVERDUE
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-right">
                    <button
                      onClick={() => handleDownloadInvoice(inv)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#3898EC] hover:underline font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
