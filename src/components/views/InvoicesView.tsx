import React, { useState } from 'react';
import { Download, CreditCard, CheckCircle2, FileText } from 'lucide-react';
import { Invoice } from '../../types';

interface InvoicesViewProps {
  isDarkMode: boolean;
  invoices: Invoice[];
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({ isDarkMode, invoices }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const cardBg = isDarkMode
    ? 'bg-[#111827] border-[#1e293b]'
    : 'bg-white border border-slate-200/80 shadow-advertz';

  // Dynamic KPI computations from actual invoice dataset
  const outstandingInvoices = invoices.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE');
  const outstandingAmount = outstandingInvoices.reduce((sum, i) => sum + i.amount, 0);
  const paidInvoices = invoices.filter((i) => i.status === 'PAID');
  const paidYtd = paidInvoices.reduce((sum, i) => sum + i.amount, 0);

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
Outstanding Balance: £${outstandingAmount.toLocaleString()}.00
Year-to-date Paid: £${paidYtd.toLocaleString()}.00
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
            <span>Standby billing & statements</span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Invoices
          </h1>
          <p
            className={`text-xs sm:text-sm mt-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Monthly statements and ad-hoc invoices for your standby account.
          </p>
        </div>

        <button
          onClick={handleDownloadStatement}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition-colors self-start sm:self-auto cursor-pointer ${
            isDarkMode
              ? 'border-[#1e222b] bg-[#12151b] hover:bg-[#18202c] text-slate-200'
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
          }`}
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>Download statement</span>
        </button>
      </div>

      {/* 3 KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className={`p-6 sm:p-7 rounded-2xl border transition-all ${cardBg}`}>
          <span
            className={`text-xs font-medium ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Outstanding balance
          </span>
          <div
            className={`text-3xl font-bold tracking-tight mt-1 font-mono tabular-nums ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            £{outstandingAmount.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">30-day standby credit terms</span>
        </div>

        <div className={`p-6 sm:p-7 rounded-2xl border transition-all ${cardBg}`}>
          <span
            className={`text-xs font-medium ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Paid this year (YTD)
          </span>
          <div
            className={`text-3xl font-bold tracking-tight mt-1 font-mono tabular-nums ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            £{paidYtd.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">All prior statements cleared</span>
        </div>

        <div className={`p-6 sm:p-7 rounded-2xl border transition-all ${cardBg}`}>
          <span className="text-xs text-slate-400 font-medium">Next consolidated statement</span>
          <div
            className={`text-3xl font-bold tracking-tight mt-1 font-mono ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            01 Sep
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Automated monthly delivery</span>
        </div>
      </div>

      {/* Invoice Table Card */}
      <div className={`p-6 sm:p-7 rounded-2xl border ${cardBg}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b text-xs font-semibold ${
                  isDarkMode ? 'border-[#1e222b] text-slate-400' : 'border-slate-200/80 bg-slate-50/60 text-slate-600'
                }`}
              >
                <th className="py-3 px-4">Invoice</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-[#1e222b]' : 'divide-slate-100'}`}>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={`transition-colors ${
                    isDarkMode ? 'hover:bg-[#12151b]' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td
                    className={`py-3.5 px-4 font-mono font-medium ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-900'
                    }`}
                  >
                    {inv.reference}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {inv.date}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-medium ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {inv.period}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-medium font-mono tabular-nums ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-900'
                    }`}
                  >
                    £{inv.amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    {inv.status === 'PAID' && (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                          isDarkMode
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        }`}
                      >
                        Paid
                      </span>
                    )}
                    {inv.status === 'DUE' && (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                          isDarkMode
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-blue-50 text-blue-700 border-blue-200/80'
                        }`}
                      >
                        Due
                      </span>
                    )}
                    {inv.status === 'OVERDUE' && (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                          isDarkMode
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-amber-50 text-amber-800 border-amber-200/80'
                        }`}
                      >
                        Overdue
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDownloadInvoice(inv)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
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
