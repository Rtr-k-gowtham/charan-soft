// frontend/src/components/production/EwayBillPdfUpload.tsx
// Cheran Soft Goods ERP — Multi-page PDF Document Upload for E-Way Bill Proof
import React, { useState, useRef, useCallback } from 'react';
import {
  FileText,
  UploadCloud,
  Eye,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Download,
  FileCheck2
} from 'lucide-react';
import Modal from '../ui/Modal';

export interface EwayBillDocumentData {
  dataUrl: string | null;
  filename: string;
  fileSize: number;
}

export interface EwayBillPdfUploadProps {
  value: string | null;
  filename?: string;
  fileSize?: number;
  onChange: (doc: EwayBillDocumentData | null) => void;
  ewayBillNumber?: string;
  error?: string;
  required?: boolean;
  maxSizeMB?: number; // default 10MB
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const EwayBillPdfUpload: React.FC<EwayBillPdfUploadProps> = ({
  value,
  filename,
  fileSize,
  onChange,
  ewayBillNumber,
  error,
  required = true,
  maxSizeMB = 10
}) => {
  const [internalError, setInternalError] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Validate and read file
  const processSelectedFile = async (file: File) => {
    setInternalError('');

    // 1. Basic extension / mime check
    const isPdfMime = file.type === 'application/pdf';
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !isPdfExt) {
      setInternalError('Invalid file type. Please select a valid PDF document (.pdf).');
      return;
    }

    // 2. File size check
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setInternalError(
        `File size exceeds ${maxSizeMB} MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please upload a smaller PDF.`
      );
      return;
    }

    // 3. Inspect magic bytes (%PDF-) to prevent spoofed extensions
    try {
      setIsProcessing(true);
      const slice = file.slice(0, 5);
      const arrayBuffer = await slice.arrayBuffer();
      const header = new TextDecoder('ascii').decode(arrayBuffer);
      if (!header.startsWith('%PDF-')) {
        setInternalError('Invalid PDF format. The file header does not match a valid PDF document.');
        setIsProcessing(false);
        return;
      }

      // 4. Read complete file as ArrayBuffer and auto-repair UTF-8 encoding distortion if present
      const fullBuffer = await file.arrayBuffer();
      let uint8 = new Uint8Array(fullBuffer);

      // Auto-repair check: If binary PDF streams contain UTF-8 sequence bytes
      try {
        const text = new TextDecoder('latin1').decode(uint8);
        const streamMatch = text.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/);
        if (streamMatch && /[\xC2\xC3][\x80-\xBF]/.test(streamMatch[1])) {
          const utf8Decoded = new TextDecoder('utf-8').decode(uint8);
          const repaired = new Uint8Array(utf8Decoded.length);
          for (let i = 0; i < utf8Decoded.length; i++) {
            repaired[i] = utf8Decoded.charCodeAt(i) & 0xff;
          }
          uint8 = repaired;
        }
      } catch (repairErr) {
        console.warn('PDF stream auto-repair notice:', repairErr);
      }

      let binaryStr = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binaryStr += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunkSize)));
      }
      const dataUrl = `data:application/pdf;base64,${btoa(binaryStr)}`;
      setIsProcessing(false);
      onChange({
        dataUrl,
        filename: file.name,
        fileSize: uint8.length
      });
    } catch (err: any) {
      setIsProcessing(false);
      console.error('Error validating PDF:', err);
      setInternalError('Failed to process PDF file. Please try again.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    // reset input so user can re-select same file if desired
    if (e.target) e.target.value = '';
  };

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  }, []);

  const handleOpenPicker = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    onChange(null);
    setInternalError('');
  };

  const displayError = error || internalError;
  const isDocumentReady = Boolean(value);

  // Derive display name and size
  const displayName = filename || (ewayBillNumber ? `Eway_Bill_${ewayBillNumber}.pdf` : 'E-Way_Bill_Document.pdf');
  const displaySize = fileSize ? formatBytes(fileSize) : null;

  return (
    <div className="space-y-2">
      {/* Label and Mandatory badge */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-rose-600" />
          <span>E-Way Bill Document (PDF Upload)</span>
          {required && <span className="text-rose-500 font-extrabold text-xs">*</span>}
        </label>
        {required && (
          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            Mandatory Document
          </span>
        )}
      </div>

      {/* Hidden file input strictly for PDF */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* State 1: No document selected yet -> Upload dropzone */}
      {!isDocumentReady ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-4 rounded-xl border-2 border-dashed transition ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/70'
              : displayError
              ? 'border-red-300 bg-red-50/40'
              : 'border-slate-300 bg-slate-50/70 hover:border-emerald-400 hover:bg-slate-50'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-rose-600" />
                <span>Upload Original E-Way Bill (Multi-Page PDF)</span>
              </div>
              <p className="text-[11px] text-slate-500 max-w-md">
                Upload the original 3–4 page E-Way Bill document as a PDF file.
                Maximum size: <span className="font-semibold text-slate-700">{maxSizeMB} MB</span>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenPicker}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload E-Way Bill PDF</span>
                </>
              )}
            </button>
          </div>

          {displayError && (
            <div className="mt-2.5 text-xs font-medium text-red-600 flex items-center gap-1.5 pt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
              <span>{displayError}</span>
            </div>
          )}
        </div>
      ) : (
        /* State 2: Document Selected / Ready */
        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* PDF File Icon with Preview Trigger */}
            <div
              onClick={() => setPreviewModalOpen(true)}
              className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex flex-col items-center justify-center shrink-0 cursor-pointer hover:bg-rose-100 transition shadow-2xs group"
              title="Click to preview PDF document"
            >
              <FileText className="w-5 h-5 group-hover:scale-110 transition" />
              <span className="text-[9px] font-black uppercase tracking-wider font-mono">PDF</span>
            </div>

            {/* Document Metadata */}
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-950 truncate max-w-[260px] sm:max-w-[340px]" title={displayName}>
                  {displayName}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  PDF Validated
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                {displaySize && <span className="font-mono text-slate-700 font-semibold">{displaySize}</span>}
                {displaySize && <span className="text-slate-300">•</span>}
                <span className="text-emerald-700 font-medium">Multi-page document preserved (all pages included)</span>
              </div>
            </div>
          </div>

          {/* Action buttons on confirmed card */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition"
              title="Preview document"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={handleOpenPicker}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-semibold transition"
              title="Replace document"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              <span>Replace</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1 p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
              title="Remove document"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PDF Document Preview Modal */}
      {previewModalOpen && value && (
        <Modal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          title={`E-Way Bill Document Preview — ${displayName}`}
          size="xl"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold">{displayName}</span>
                {displaySize && <span className="text-slate-400 font-mono">({displaySize})</span>}
              </div>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Window</span>
              </a>
            </div>

            {/* Embedded Multi-Page PDF Viewer */}
            <div className="w-full h-[65vh] sm:h-[72vh] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
              <iframe
                src={value}
                title="E-Way Bill PDF Document"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EwayBillPdfUpload;
