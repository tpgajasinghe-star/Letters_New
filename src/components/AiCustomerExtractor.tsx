import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Upload, X, AlertCircle, FileText, Trash2, CheckCircle2 } from 'lucide-react';
import { ParsedOrder, ParsedCustomerDetails } from '../types';
import { parseCustomerWithAi } from '../utils/customerExtractor';

export interface AiExtractorResult {
  orders: ParsedOrder[];
  primaryDetails: ParsedCustomerDetails;
}

interface AiCustomerExtractorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: AiExtractorResult) => void;
}

interface UploadedFileItem {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  sizeFormatted: string;
  rawSize: number;
}

export const AiCustomerExtractor: React.FC<AiCustomerExtractorProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [textInput, setTextInput] = useState('');
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setExtractProgress(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const processFile = (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setError('Please upload only PDF documents or image files (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError(`File "${file.name}" exceeds 15MB limit. Please upload a smaller file.`);
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        const newFile: UploadedFileItem = {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          mimeType: file.type || (isPdf ? 'application/pdf' : 'image/png'),
          base64: cleanBase64,
          sizeFormatted: sizeStr,
          rawSize: cleanBase64.length,
        };
        setFiles((prev) => [...prev, newFile]);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError(`Failed to read file "${file.name}".`);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check for image or file in clipboard
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/') || item.type === 'application/pdf') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processFile(file);
          return;
        }
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      Array.from(selectedFiles).forEach(processFile);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setTextInput('');
    setFiles([]);
    setError(null);
    setExtractProgress(null);
  };

  const handleExtract = async () => {
    const trimmedText = textInput.trim();
    if (!trimmedText && files.length === 0) {
      setError('Please paste text or attach PDF/image files to extract.');
      return;
    }

    setIsExtracting(true);
    setError(null);
    setExtractProgress('Analyzing with Gemini 3.8 Flash...');

    try {
      // Vercel serverless request body safe limit: ~3.5MB base64 per request
      const MAX_BATCH_BYTES = 3.5 * 1024 * 1024;
      let finalOrders: ParsedOrder[] = [];
      let primaryDetails: ParsedCustomerDetails | null = null;

      const filePayloads = files.map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        base64: f.base64,
      }));

      const totalFileBytes = filePayloads.reduce((acc, f) => acc + f.base64.length, 0);

      if (totalFileBytes <= MAX_BATCH_BYTES) {
        // Send single request
        const res = await parseCustomerWithAi({
          text: trimmedText || undefined,
          files: filePayloads.length > 0 ? filePayloads : undefined,
        });

        if (res.orders && res.orders.length > 0) {
          finalOrders = res.orders;
        } else if (res.customerName || res.customerAddress || res.poNumber || res.invoiceNumber) {
          finalOrders = [
            {
              customerName: res.customerName || '',
              designation: res.designation || '',
              companyName: res.companyName || '',
              projectName: res.projectName || '',
              customerAddress: res.customerAddress || res.locationAddress || '',
              poNumber: res.poNumber || '',
              invoiceNumber: res.invoiceNumber || '',
              date: res.date || '',
              items: res.items || [],
            },
          ];
        }
        primaryDetails = res;
      } else {
        // Multi-file batching: send files in safe chunks under 3.5MB so payload limit is never exceeded
        let currentBatch: typeof filePayloads = [];
        let currentBytes = 0;
        let batchIndex = 0;

        for (let i = 0; i < filePayloads.length; i++) {
          const file = filePayloads[i];
          if (currentBatch.length > 0 && currentBytes + file.base64.length > MAX_BATCH_BYTES) {
            batchIndex++;
            setExtractProgress(`Processing batch ${batchIndex}...`);
            const res = await parseCustomerWithAi({
              text: batchIndex === 1 ? trimmedText : undefined,
              files: currentBatch,
            });
            if (res.orders) finalOrders.push(...res.orders);
            if (!primaryDetails) primaryDetails = res;
            currentBatch = [];
            currentBytes = 0;
          }
          currentBatch.push(file);
          currentBytes += file.base64.length;
        }

        if (currentBatch.length > 0) {
          batchIndex++;
          setExtractProgress(`Processing final batch...`);
          const res = await parseCustomerWithAi({
            text: finalOrders.length === 0 ? trimmedText : undefined,
            files: currentBatch,
          });
          if (res.orders) finalOrders.push(...res.orders);
          if (!primaryDetails) primaryDetails = res;
        }
      }

      if (finalOrders.length === 0 && !primaryDetails) {
        throw new Error('No customer or order details could be detected in the provided input.');
      }

      // If primaryDetails wasn't populated from response, generate from first order
      if (!primaryDetails && finalOrders.length > 0) {
        const first = finalOrders[0];
        primaryDetails = {
          customerName: first.customerName,
          designation: first.designation,
          companyName: first.companyName,
          projectName: first.projectName,
          locationAddress: first.customerAddress,
          customerAddress: first.customerAddress,
          poNumber: first.poNumber,
          invoiceNumber: first.invoiceNumber,
          date: first.date,
          items: first.items,
          refType: first.poNumber ? 'PO' : (first.invoiceNumber ? 'Invoice' : ''),
          refNumber: first.poNumber || first.invoiceNumber || '',
          formattedAddressBlock: [
            first.customerName,
            first.designation,
            first.companyName,
            first.projectName,
            first.customerAddress,
          ].filter(Boolean).join('\n'),
          orders: finalOrders,
        };
      }

      onSuccess({
        orders: finalOrders,
        primaryDetails: primaryDetails!,
      });

      handleClearAll();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extract customer details.';
      setError(msg);
    } finally {
      setIsExtracting(false);
      setExtractProgress(null);
    }
  };

  if (!isOpen) return null;

  const hasContent = Boolean(textInput.trim() || files.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        onPaste={handlePaste}
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>AI Quick Extract</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-white/20 rounded-full">
                  Text • Image • PDF
                </span>
              </h3>
              <p className="text-xs text-blue-100">
                Extracts customer, project, PO/Invoice, and ordered items via Gemini 3.8 Flash
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Email / Document Text Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Paste Email Body, PO Text, RFQ, or Forwarded Thread
            </label>
            <textarea
              ref={textareaRef}
              rows={4}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste raw email text, quotation request, or purchase order text here... Or press Ctrl+V directly to paste a screenshot."
              className="w-full px-4 py-3 text-xs bg-slate-50/70 border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y min-h-[90px]"
            />
          </div>

          {/* Upload Files Section (PDF / Images) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">
                Attached Documents &amp; Screenshots ({files.length})
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Upload PDF / Images</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {files.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {files.map((file) => {
                  const isPdf = file.mimeType === 'application/pdf' || file.name.endsWith('.pdf');
                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isPdf ? (
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                        ) : (
                          <img
                            src={`data:${file.mimeType};base64,${file.base64}`}
                            alt={file.name}
                            className="w-8 h-8 object-cover rounded-lg border border-slate-200 shrink-0 bg-white"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400">{file.sizeFormatted}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl bg-slate-50/50 hover:bg-blue-50/20 text-center cursor-pointer transition-all"
              >
                <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">
                  Drop PDF files or screenshots here, or click to browse
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supports multiple Purchase Order PDFs, Tax Invoices, and screenshots
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{error}</span>
            </div>
          )}

          {/* Progress Banner */}
          {extractProgress && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium">
              <Sparkles className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <span>{extractProgress}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          {hasContent ? (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer underline underline-offset-2"
            >
              Clear inputs
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isExtracting || !hasContent}
              onClick={handleExtract}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer ${
                isExtracting || !hasContent
                  ? 'bg-blue-300 cursor-not-allowed opacity-75 shadow-none'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] shadow-blue-500/30'
              }`}
            >
              {isExtracting ? (
                <>
                  <svg className="animate-spin -ml-0.5 h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Extracting Details...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>Extract &amp; Auto-Fill Form</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
