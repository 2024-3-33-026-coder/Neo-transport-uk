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
import { uploadDocumentFile, getDocumentDownloadUrl } from '../../lib/portalStore';
import { isSupabaseConfigured, isDemoModeAllowed } from '../../lib/supabase';

interface DocumentsViewProps {
  isDarkMode: boolean;
  documents: DocumentItem[];
  onAddDocument: (doc: DocumentItem) => void;
  highlightRef?: string;
  companyId?: string;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  isDarkMode,
  documents,
  onAddDocument,
  highlightRef,
  companyId,
}) => {
  const [activeHighlight, setActiveHighlight] = useState<string | undefined>(highlightRef);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<'pod' | 'cmr' | 'label' | 'invoice' | 'compliance'>('pod');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const cardBg = isDarkMode
    ? 'bg-[#111827] border-[#1e293b]'
    : 'bg-white border border-slate-200/80 shadow-advertz';

  const validateAndSetFile = (file: File) => {
    setUploadError(null);
    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
    const validMimes = ['application/pdf', 'image/png', 'image/jpeg'];
    const hasValidMime = file.type ? validMimes.includes(file.type) : true;

    if (!hasValidExt && !hasValidMime) {
      setUploadError('Unsupported file type. Please upload a PDF, PNG, or JPG document.');
      return;
    }

    const maxSize = 15 * 1024 * 1024; // 15 MB
    if (file.size > maxSize) {
      setUploadError('File size exceeds the 15 MB limit. Please select a smaller document.');
      return;
    }

    setSelectedFile(file);
    if (!docName.trim()) {
      setDocName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    setDownloadError(null);
    try {
      const downloadUrl = await getDocumentDownloadUrl(doc.pdf_url);
      if (downloadUrl && (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://') || downloadUrl.startsWith('blob:'))) {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = `${doc.title.replace(/[\s—]/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      setDownloadError(
        isSupabaseConfigured
          ? `Could not generate download link for "${doc.title}". Please verify bucket permissions.`
          : `Download unavailable: "${doc.title}" is a demo record and remote storage is disconnected.`
      );
    } catch (e: any) {
      console.warn('Failed to retrieve signed download URL:', e);
      setDownloadError(e?.message || 'Storage download link generation failed.');
    }
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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) {
      setUploadError('Please provide a document title or reference.');
      return;
    }

    if (!selectedFile) {
      setUploadError('Please select a PDF or image document to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    let storagePath: string | undefined = undefined;

    try {
      const uploadResult = await uploadDocumentFile(selectedFile, companyId);
      storagePath = uploadResult.storagePath || uploadResult.signedUrl;

      const newDoc: DocumentItem = {
        id: `doc-${Date.now()}`,
        title: docName.trim(),
        type: `${docCategory.toUpperCase()} · Today`,
        date: 'Today',
        category: docCategory,
        fileSize: `${Math.round(selectedFile.size / 1024)} KB`,
        verified: true,
        pdf_url: storagePath,
      };

      await onAddDocument(newDoc);
      setIsUploadOpen(false);
      setDocName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Document upload error:', err);
      setUploadError(err?.message || 'Document upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Upload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
            <span>Archive & compliance records</span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Documents
          </h1>
          <p
            className={`text-xs sm:text-sm mt-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Proof of delivery, CMR notes, labels, invoices and compliance.
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-xs font-medium transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
        >
          <Upload className="w-4 h-4" />
          <span>Upload document</span>
        </button>
      </div>

      {/* Storage Download Error Banner */}
      {downloadError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block uppercase text-[10px] tracking-wider font-mono">Download Unavailable</span>
              <p className="mt-0.5 text-rose-300/90">{downloadError}</p>
            </div>
          </div>
          <button
            onClick={() => setDownloadError(null)}
            className="text-slate-400 hover:text-white text-xs font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* Gemini AI Audit Result Banner */}
      {auditResult && (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDarkMode
              ? 'bg-[#09111c] border-[#1e2f46]'
              : 'bg-sky-50/90 border-sky-200/90 shadow-xs'
          }`}
        >
          <div
            className={`flex items-center justify-between pb-3 border-b ${
              isDarkMode ? 'border-slate-700/40' : 'border-sky-200'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-bold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#3898EC]" />
              <span>Gemini Vision OCR & Compliance Audit: {auditResult.documentReference}</span>
            </div>
            <button
              onClick={() => setAuditResult(null)}
              className={`text-xs font-mono transition-colors ${
                isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
            <div>
              <span
                className={`block font-medium ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Signature Status:
              </span>
              <span
                className={`font-bold flex items-center gap-1 mt-0.5 ${
                  isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {auditResult.signerName}
              </span>
            </div>
            <div>
              <span
                className={`block font-medium ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Cargo Condition Check:
              </span>
              <span
                className={`mt-0.5 block font-semibold ${
                  isDarkMode ? 'text-white' : 'text-slate-800'
                }`}
              >
                {auditResult.conditionCheck}
              </span>
            </div>
            <div>
              <span
                className={`block font-medium ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Legal Compliance:
              </span>
              <span
                className={`font-mono mt-0.5 block font-bold ${
                  isDarkMode ? 'text-[#3898EC]' : 'text-sky-700'
                }`}
              >
                {auditResult.complianceRating}
              </span>
            </div>
          </div>
          <p
            className={`text-[11px] mt-2 font-mono ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
            }`}
          >
            {auditResult.extractedNotes}
          </p>
        </div>
      )}

      {/* Highlighted booking POD filter banner */}
      {activeHighlight && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs ${
            isDarkMode
              ? 'bg-[#3898EC]/10 border-[#3898EC]/30'
              : 'bg-sky-50/90 border-sky-200/90 shadow-xs'
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-[#3898EC]" />
            <span>
              Filtering archive for booking:{' '}
              <strong className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {activeHighlight}
              </strong>
            </span>
          </div>
          <button
            onClick={() => setActiveHighlight(undefined)}
            className="text-[#3898EC] hover:underline font-semibold cursor-pointer"
          >
            Show all documents
          </button>
        </div>
      )}

      {/* Documents Grid */}
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
              className={`p-5 rounded-2xl border flex items-center justify-between gap-4 transition-all shadow-advertz ${cardBg} ${
                isHighlighted
                  ? isDarkMode
                    ? 'border-blue-600 ring-1 ring-blue-600/40 bg-[#16202e]'
                    : 'border-blue-400 ring-1 ring-blue-200 bg-blue-50/50'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3.5 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2
                    className={`font-semibold text-xs sm:text-sm truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {doc.title}
                  </h2>
                  <p
                    className={`text-[11px] mt-0.5 truncate ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {doc.type}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleAuditDocument(doc)}
                  title="Verify with Gemini Vision OCR"
                  disabled={isAuditing}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'text-slate-400 hover:text-blue-400 hover:bg-[#18202c]'
                      : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDownload(doc)}
                  title="Download File"
                  className={`p-2 rounded-full transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'text-slate-400 hover:text-white hover:bg-[#1e222b]'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
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
            className={`p-6 sm:p-7 rounded-3xl border max-w-md w-full ${cardBg} shadow-advertz-lg space-y-4`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isDarkMode ? 'border-slate-700/40' : 'border-slate-200/80'
              }`}
            >
              <h3 className={`font-bold text-base tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Upload Logistics Document
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadError(null);
                  setSelectedFile(null);
                }}
                className={`p-1 rounded-full cursor-pointer transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                ✕
              </button>
            </div>

            {/* Storage Gating & Environment Notice */}
            {!isSupabaseConfigured && isDemoModeAllowed && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <span className="font-bold block uppercase text-[10px] tracking-wider font-mono">Demo Mode Active</span>
                  <p className="mt-0.5 text-amber-200/90 text-[11px] leading-relaxed">
                    Uploaded file will be kept as a temporary local preview for testing. Remote cloud bucket is disconnected.
                  </p>
                </div>
              </div>
            )}

            {!isSupabaseConfigured && !isDemoModeAllowed && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <span className="font-bold block uppercase text-[10px] tracking-wider font-mono">Storage Unavailable</span>
                  <p className="mt-0.5 text-rose-200/90 text-[11px] leading-relaxed">
                    Production Supabase Storage bucket is not configured. Document uploads are disabled.
                  </p>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <div>
              <label
                className={`block text-xs font-semibold mb-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                Document Title / Booking Reference
              </label>
              <input
                type="text"
                required
                placeholder="e.g. POD — NT-24817"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className={`w-full text-xs p-2.5 rounded-xl border transition-colors outline-none ${
                  isDarkMode
                    ? 'border-slate-700 bg-[#060b11] text-white focus:border-[#3898EC]'
                    : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500 shadow-xs'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-xs font-semibold mb-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                Category
              </label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as any)}
                className={`w-full text-xs p-2.5 rounded-xl border transition-colors outline-none cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-700 bg-[#060b11] text-white focus:border-[#3898EC]'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-sky-500 shadow-xs'
                }`}
              >
                <option value="pod">POD (Proof of Delivery)</option>
                <option value="cmr">CMR Note (International Road Freight)</option>
                <option value="label">Shipping Labels</option>
                <option value="invoice">Invoice / Delivery Manifest</option>
                <option value="compliance">Insurance / Compliance Cert</option>
              </select>
            </div>

            {/* Hidden native accessible file input */}
            <input
              ref={fileInputRef}
              type="file"
              id="logistics-document-file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) validateAndSetFile(f);
              }}
              className="hidden"
              aria-label="Select logistics document file"
            />

            {/* Accessible Interactive Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) validateAndSetFile(f);
              }}
              className={`p-5 border-2 border-dashed rounded-xl text-center text-xs transition-all cursor-pointer relative ${
                isDragging
                  ? isDarkMode
                    ? 'border-[#3898EC] bg-[#3898EC]/10 text-white'
                    : 'border-sky-500 bg-sky-50 text-sky-900'
                  : selectedFile
                  ? isDarkMode
                    ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400'
                    : 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : isDarkMode
                  ? 'border-slate-700 hover:border-[#3898EC] text-slate-400 hover:text-slate-200'
                  : 'border-slate-300 hover:border-sky-400 text-slate-600 hover:text-slate-800 bg-slate-50/50'
              }`}
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-[#3898EC]" />

              {selectedFile ? (
                <div className="space-y-1.5">
                  <p
                    className={`font-bold truncate max-w-xs mx-auto ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    {selectedFile.name}
                  </p>
                  <p
                    className={`text-[11px] font-mono ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                    }`}
                  >
                    {(selectedFile.size / 1024).toFixed(1)} KB · Ready to upload
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="mt-1 px-3 py-1 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>Remove file</span>
                    <span>✕</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p
                    className={`font-semibold ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    Click to browse or drag & drop document
                  </p>
                  <p
                    className={`text-[11px] ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-500 font-medium'
                    }`}
                  >
                    PDF, PNG, JPG up to 15 MB · Touch & desktop compatible
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-700/40">
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setSelectedFile(null);
                  setUploadError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className={`px-5 py-2.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-advertz'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload & Save</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
