/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { WarrantyForm } from './components/WarrantyForm';
import { CertificateSelectionPage } from './components/CertificateSelectionPage';
import { FeatureBadges } from './components/FeatureBadges';
import { WarrantyFormData } from './types';
import { generateCleanWarrantyPdf } from './utils/cleanPdfGenerator';
import { generateCleanWarrantyDocx } from './utils/docxGenerator';
import { parseCustomerAddress } from './utils/templateParser';
import { CheckCircle2, Download } from 'lucide-react';

export default function App() {
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<WarrantyFormData>({
    letterType: 'declaration',
    date: today,
    customerAddress: '',
    items: [
      {
        description: '',
        productBrand: '',
        warrantyPeriod: '',
      },
    ],
    poNumber: '',
  });

  // viewMode: 'form' (screen 1) or 'preview' (screen 2)
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [lastBlobUrl, setLastBlobUrl] = useState<string | null>(null);
  const [lastFormat, setLastFormat] = useState<'pdf' | 'docx'>('pdf');

  const handleFormChange = (newData: Partial<WarrantyFormData>) => {
    setFormData((prev) => ({ ...prev, ...newData }));
    setDownloadSuccess(false);
  };

  const handleFormSubmit = () => {
    setViewMode('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // PDF Download Handler (without header logo, watermark, stamp, signature)
  const triggerDownloadPdf = async () => {
    setIsGenerating(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 400));

      const pdfBlob = await generateCleanWarrantyPdf(formData);
      const url = URL.createObjectURL(pdfBlob);
      setLastBlobUrl(url);
      setLastFormat('pdf');

      const parsed = parseCustomerAddress(formData.customerAddress);
      const cleanName = (parsed.customerName || parsed.companyName || 'Customer')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 30);

      const typeLabel =
        formData.letterType === 'po_certificate' ? 'Warranty_Certificate' : 'Draft_Warranty_Certificate';
      const fileName = `Kevilton_${typeLabel}_${cleanName}_${formData.date}.pdf`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloadSuccess(true);

      try {
        confetti({
          particleCount: 65,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#0066FF', '#08407B', '#FFB800', '#10B981'],
        });
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please verify your inputs and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Microsoft Word (.docx) Download Handler (clean format)
  const triggerDownloadDocx = async () => {
    setIsGeneratingDocx(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 400));

      const docxBlob = await generateCleanWarrantyDocx(formData);
      const url = URL.createObjectURL(docxBlob);
      setLastBlobUrl(url);
      setLastFormat('docx');

      const parsed = parseCustomerAddress(formData.customerAddress);
      const cleanName = (parsed.customerName || parsed.companyName || 'Customer')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 30);

      const typeLabel =
        formData.letterType === 'po_certificate' ? 'Warranty_Certificate' : 'Draft_Warranty_Certificate';
      const fileName = `Kevilton_${typeLabel}_${cleanName}_${formData.date}.docx`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloadSuccess(true);
    } catch (error) {
      console.error('Error generating Word document:', error);
      alert('Failed to generate Word document. Please try again.');
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F5FA] flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Bar Header */}
      <Header />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Success Banner if document generated */}
        {downloadSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-900">
                  {formData.letterType === 'po_certificate'
                    ? 'Common Warranty Certificate'
                    : 'Common Draft Warranty Certificate'}{' '}
                  Generated ({lastFormat.toUpperCase()})!
                </h4>
                <p className="text-xs text-emerald-700">
                  The document has been formatted and saved to your downloads.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {lastBlobUrl && (
                <a
                  href={lastBlobUrl}
                  download={`Kevilton_Warranty_${formData.date}.${lastFormat}`}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Again
                </a>
              )}
              <button
                onClick={() => setDownloadSuccess(false)}
                className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-lg text-xs font-medium transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {viewMode === 'form' ? (
          /* Page 1: Form Input Screen with Letter Type First */
          <div className="space-y-8 animate-fadeIn">
            {/* Headline Area */}
            <div className="text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-100/80 border border-sky-200/60 rounded-full text-xs font-bold text-sky-700 uppercase tracking-wider mb-3">
                <span>Warranty Letter Generator</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0D2447] tracking-tight leading-[1.15]">
                Enter Details to Generate <span className="text-[#0066FF]">Warranty Letter</span>
              </h1>

              <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
                First select your letter type, then enter the customer address and product
                details. Click Submit to immediately view the live preview and download.
              </p>
            </div>

            {/* Form Card */}
            <div className="max-w-2xl mx-auto w-full">
              <WarrantyForm
                formData={formData}
                onChange={handleFormChange}
                onSubmit={handleFormSubmit}
                isGenerating={false}
                step={1}
              />
            </div>

            {/* Feature Highlights */}
            <FeatureBadges />
          </div>
        ) : (
          /* Page 2: Direct Live Preview + Download Buttons (No duplicate letter type question) */
          <CertificateSelectionPage
            formData={formData}
            onBack={() => {
              setViewMode('form');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDownloadPdf={triggerDownloadPdf}
            onDownloadDocx={triggerDownloadDocx}
            isGenerating={isGenerating}
            isGeneratingDocx={isGeneratingDocx}
          />
        )}
      </main>
    </div>
  );
}
