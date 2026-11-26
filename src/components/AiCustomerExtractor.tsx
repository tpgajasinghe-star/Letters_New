import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Upload, X, AlertCircle, Image as ImageIcon, Trash2, CheckCircle2, CornerDownLeft } from 'lucide-react';
import { ParsedCustomerDetails } from '../types';
import { parseCustomerWithAi } from '../utils/customerExtractor';

interface AiCustomerExtractorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: ParsedCustomerDetails) => void;
}

export const AiCustomerExtractor: React.FC<AiCustomerExtractorProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState('image/png');
  const [imageFileName, setImageFileName] = useState('');
  const [imageSizeFormatted, setImageSizeFormatted] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Auto-focus textarea when opened
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image is too large (maximum 10MB). Please choose a smaller screenshot.');
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setImageBase64(dataUrl);
        setImageMimeType(file.type || 'image/png');
        setImageFileName(file.name || 'Pasted Screenshot.png');
        setImageSizeFormatted(sizeStr);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check for image in clipboard
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
          return;
        }
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // reset input so same file can be re-selected if removed
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setImageBase64(null);
    setImageFileName('');
    setImageSizeFormatted('');
  };

  const handleClearAll = () => {
    setSubject('');
    setBodyText('');
    setImageBase64(null);
    setImageFileName('');
    setImageSizeFormatted('');
    setError(null);
  };

  const handleExtract = async () => {
    if (!bodyText.trim() && !subject.trim() && !imageBase64) {
      setError('Please paste email text or attach/paste an image screenshot first.');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const data = await parseCustomerWithAi({
        subject: subject.trim() || undefined,
        bodyText: bodyText.trim() || undefined,
        imageBase64: imageBase64 || undefined,
        imageMimeType: imageMimeType || undefined,
      });

      // Call success callback
      onSuccess(data);

      // Clean up and close
      handleClearAll();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extract customer details.';
      setError(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  if (!isOpen) return null;

  const hasContent = Boolean(bodyText.trim() || subject.trim() || imageBase64);

  return (
    <div
      onPaste={handlePaste}
      className="mb-4 p-4.5 bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 border border-blue-200/90 rounded-2xl shadow-sm transition-all animate-fadeIn"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-blue-100/80 mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>AI Email &amp; Screenshot Extractor</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-md">
                Gemini AI
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Paste raw email text or press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600">Ctrl+V</kbd> to paste a screenshot
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Inputs */}
      <div className="space-y-3">
        {/* Optional Subject */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Email Subject <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Request for Warranty Certificate - Prime Grand Residences"
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
          />
        </div>

        {/* Body Text Area */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Raw Email / Quotation / Order Text
          </label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={3}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Paste email body, forwarded thread, RFQ, or PO text here... You can also press Ctrl+V directly to paste a screenshot image."
              className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y min-h-[75px] shadow-2xs"
            />
          </div>
        </div>

        {/* Image Attachment Preview or Upload Button */}
        {imageBase64 ? (
          <div className="flex items-center justify-between p-2.5 bg-white border border-blue-200 rounded-xl shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={imageBase64}
                alt="Pasted Screenshot"
                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-50"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{imageFileName}</p>
                <p className="text-[11px] text-slate-400">{imageSizeFormatted || 'Image ready for extraction'}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemoveImage}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Remove screenshot"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload Image / Screenshot</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <span className="text-[11px] text-slate-500">
              or paste directly with <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600">Ctrl+V</kbd>
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.2" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isExtracting || !hasContent}
              onClick={handleExtract}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all cursor-pointer ${
                isExtracting || !hasContent
                  ? 'bg-blue-300 cursor-not-allowed opacity-75'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-blue-500/25'
              }`}
            >
              {isExtracting ? (
                <>
                  <svg className="animate-spin -ml-0.5 h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Extracting with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>Extract &amp; Auto-Fill</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
