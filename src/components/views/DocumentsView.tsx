import React, { useState } from 'react';
import {
  Upload,
  Download,
  CheckSquare,
  FileText,
  ShieldCheck,
  Tag,
  Receipt,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { DocumentItem } from '../../types';
import { analyzeDocumentWithGemini } from '../../lib/geminiClient';

interface DocumentsViewProps {
  isDarkMode: boolean;
  documents: DocumentItem[];
  onAddDocument: (doc: DocumentItem) => void;
  highlightRef?: string;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  isDarkMode,
  documents,
  onAddDocument,
  highlightRef,
}) => {
  const [activeHighlight, setActiveHighlight] = useState<string | undefined>(highlightRef);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<'pod' | 'cmr' | 'label' | 'invoice' | 'compliance'>('pod');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    documentReference: string;
    documentType: string;
    isLegitimate: boolean;
    signatureVerified: boolean;
    signerName: string;
    timestamp: string;
    conditionCheck: string;
    complianceRating: string;
    extractedNotes: string;
  } | null>(null);

  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';

  const handleDownload = (doc: DocumentItem) => {
    const text = `NEO TRANSPORT REPOSITORY\nDocument: ${doc.title}\nType: ${doc.type}\nDate: ${doc.date}\nStatus: Audited & Archived`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.title.replace(/[\s—]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAuditDocument = async (doc: DocumentItem) => {
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const result = await analyzeDocumentWithGemini({
        documentName: doc.title,
        documentType: doc.type,
      });
      setAuditResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName) return;

    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      title: docName,
      type: `${docCategory.toUpperCase()} · Today`,
      date: 'Today',
      category: docCategory,
      fileSize: '412 KB',
      verified: true,
    };
    onAddDocument(newDoc);
    setIsUploadOpen(false);
    setDocName('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Upload Button (Matching Screenshot 8) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-0.5 bg-[#3898EC]" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
              FILES
            </span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Documents
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Proof of delivery, CMR notes, labels, invoices and compliance.
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 bg-[#3898EC] hover:bg-[#2b85d6] text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload document</span>
        </button>
      </div>

      {/* Gemini AI Audit Result Banner */}
      {auditResult && (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDarkMode
              ? 'bg-[#09111c] border-[#1e2f46]'
              : 'bg-sky-50/80 border-sky-200'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Sparkles className="w-4 h-4 text-[#3898EC]" />
              <span>Gemini Vision OCR & Compliance Audit: {auditResult.documentReference}</span>
            </div>
            <button
              onClick={() => setAuditResult(null)}
              className="text-xs font-mono text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Signature Status:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {auditResult.signerName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Cargo Condition Check:</span>
              <span className="text-white mt-0.5 block">{auditResult.conditionCheck}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Legal Compliance:</span>
              <span className="text-[#3898EC] font-mono mt-0.5 block font-bold">
                {auditResult.complianceRating}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">
            {auditResult.extractedNotes}
          </p>
        </div>
      )}

      {/* Highlighted booking POD filter banner */}
      {activeHighlight && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#3898EC]/10 border border-[#3898EC]/30 text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <FileText className="w-4 h-4 text-[#3898EC]" />
            <span>Filtering archive for booking: <strong className="text-white font-mono">{activeHighlight}</strong></span>
          </div>
          <button
            onClick={() => setActiveHighlight(undefined)}
            className="text-[#3898EC] hover:underline font-semibold cursor-pointer"
          >
            Show all documents
          </button>
        </div>
      )}

      {/* Documents Grid (Matching Screenshot 8) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map((doc) => {
          let IconComponent = FileText;
          if (doc.category === 'pod') IconComponent = CheckSquare;
          if (doc.category === 'cmr') IconComponent = FileText;
          if (doc.category === 'label') IconComponent = Tag;
          if (doc.category === 'invoice') IconComponent = Receipt;
          if (doc.category === 'compliance') IconComponent = ShieldCheck;

          const isHighlighted = Boolean(activeHighlight && doc.title.toLowerCase().includes(activeHighlight.toLowerCase()));

          return (
            <div
              key={doc.id}
              className={`p-5 rounded-2xl border flex items-center justify-between gap-4 transition-all group ${cardBg} ${
                isHighlighted ? 'border-[#3898EC] ring-2 ring-[#3898EC]/40 bg-sky-950/20' : ''
              }`}
            >
              <div className="flex items-center gap-3.5 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-[#3898EC] shrink-0">
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    className={`font-bold text-xs sm:text-sm truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {doc.title}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {doc.type}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAuditDocument(doc)}
                  title="Verify with Gemini Vision OCR"
                  disabled={isAuditing}
                  className="p-2 rounded-xl text-slate-400 hover:text-[#3898EC] hover:bg-[#3898EC]/10 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDownload(doc)}
                  title="Download File"
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleUploadSubmit}
            className={`p-6 rounded-2xl border max-w-md w-full ${cardBg} shadow-2xl space-y-4`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
              <h3 className="font-bold text-sm text-white">Upload Logistics Document</h3>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Document Title / Booking Reference
              </label>
              <input
                type="text"
                required
                placeholder="e.g. POD — NT-24817"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-700 bg-[#060b11] text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Category
              </label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as any)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-700 bg-[#060b11] text-white"
              >
                <option value="pod">POD (Proof of Delivery)</option>
                <option value="cmr">CMR Note (International Road Freight)</option>
                <option value="label">Shipping Labels</option>
                <option value="invoice">Invoice / Delivery Manifest</option>
                <option value="compliance">Insurance / Compliance Cert</option>
              </select>
            </div>

            <div className="p-4 border-2 border-dashed border-slate-700 rounded-xl text-center text-xs text-slate-400">
              <Upload className="w-5 h-5 mx-auto mb-1 text-[#3898EC]" />
              <p>Drag and drop PDF, PNG, or scan here</p>
              <span className="text-[10px] text-slate-500">Auto-scanned by Gemini Vision</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="px-4 py-2 rounded-full border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#3898EC] hover:bg-[#2b85d6] text-white px-5 py-2 rounded-full text-xs font-semibold"
              >
                Upload & Audit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
