import React from 'react';
import { ArrowLeft, Download, FileText, CheckCircle2, ShieldCheck, FileCheck2 } from 'lucide-react';
import { WarrantyFormData } from '../types';
import { formatDateForCertificate, parseCustomerAddress, getCommonWarrantySubject } from '../utils/templateParser';
import { getWarrantyRows, getProductBrandSubject } from '../utils/cleanPdfGenerator';

interface CertificateSelectionPageProps {
  formData: WarrantyFormData;
  onBack: () => void;
  onDownloadPdf: () => void;
  onDownloadDocx: () => void;
  isGenerating: boolean;
  isGeneratingDocx?: boolean;
}

export const CertificateSelectionPage: React.FC<CertificateSelectionPageProps> = ({
  formData,
  onBack,
  onDownloadPdf,
  onDownloadDocx,
  isGenerating,
  isGeneratingDocx = false,
}) => {
  const isPoCertificate = formData.letterType === 'po_certificate';
  const parsedAddr = parseCustomerAddress(formData.customerAddress);
  const rows = getWarrantyRows(formData);
  const formattedDate = formatDateForCertificate(formData.date);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Bar with Back Button and Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <button
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-xs cursor-pointer hover:border-slate-300"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Back to Edit Details</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/60 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            {isPoCertificate ? '2. Common Warranty Certificate' : '1. Common Draft Warranty Certificate'}
          </span>
        </div>
      </div>

      {/* Info Card explaining live preview is ready */}
      <div className="bg-white rounded-2xl p-5 border border-blue-50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#0D2447] tracking-tight">
            {isPoCertificate ? 'Common Warranty Certificate' : 'Common Draft Warranty Certificate'}
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Pristine document generated matching your exact sample format without header, logo, watermark, rubber seal, or signature image.
          </p>
        </div>

        {/* Action Buttons Top Quick Access */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDownloadPdf}
            disabled={isGenerating || isGeneratingDocx}
            type="button"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={onDownloadDocx}
            disabled={isGenerating || isGeneratingDocx}
            type="button"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Word (.docx)</span>
          </button>
        </div>
      </div>

      {/* Live Preview Container (Pristine Letter Document - NO header, NO watermark, NO rubber stamp, NO signature image, NO table header shading) */}
      <div className="flex flex-col items-center">
        <div className="text-center mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Live Document Preview (Letter Size 8.5" × 11" · Normal Margins 1" 1" 1" 1" · Times New Roman)
          </p>
        </div>

        {/* A4 Paper Document Preview Container */}
        <div className="w-full max-w-[660px] bg-white rounded-xl shadow-2xl shadow-slate-400/20 border border-slate-300 overflow-hidden relative">
          {/* Pristine Paper Content */}
          <div
            className="p-8 sm:p-12 text-[12px] sm:text-[13px] leading-relaxed text-black space-y-4"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            {/* 1. Date */}
            <div>
              <span className="font-bold">{formattedDate || '[Date]'}</span>
            </div>

            {/* 2. Recipient Address Block (First line like Mr./Ms. [Customer Name] is bold) */}
            <div className="space-y-0.5 leading-snug">
              {parsedAddr.formattedLines.map((line, idx) => (
                <p key={idx} className={idx === 0 ? 'font-bold' : ''}>
                  {line}
                </p>
              ))}
            </div>

            {isPoCertificate ? (
              /* ================= TEMPLATE 2: Common Warranty Certificate ================= */
              <>
                {/* Subject Title (Without "Subject:" and with PO number at the end - Bold) */}
                <p className="font-bold pt-1">
                  {getCommonWarrantySubject(formData.poNumber)}
                </p>

                {/* Salutation (Bold in template) */}
                <p className="font-bold">Dear Sir/Madam,</p>

                {/* Opening Paragraphs */}
                <p className="text-justify">
                  We, <strong className="font-bold">Kevilton Electrical Products (Pvt.) Ltd.</strong>, sincerely appreciate the trust you have placed in our products. We are committed to providing high-quality products that comply with national and international standards.
                </p>

                <p className="text-justify">
                  We hereby confirm that the following products supplied against Purchase Order No. <strong className="font-bold">{formData.poNumber?.trim() || '[PO Number]'}</strong> are covered under the Kevilton warranty program.
                </p>

                <p className="font-bold pt-1">Items Covered Under This Warranty:</p>

                {/* Table for Template 2: 1. Product Description | 2. Product Brand | 3. Warranty Period */}
                <div className="overflow-x-auto my-2">
                  <table className="w-full border-collapse border border-black text-[12px]">
                    <thead>
                      <tr className="bg-transparent font-bold">
                        <th className="border border-black p-2 text-left w-1/2">Product Description</th>
                        <th className="border border-black p-2 text-left w-1/4">Product Brand</th>
                        <th className="border border-black p-2 text-left w-1/4">Warranty Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="border border-black p-2">{row.description}</td>
                          <td className="border border-black p-2">{row.productBrand || 'Wiring Devices'}</td>
                          <td className="border border-black p-2">{row.warrantyPeriod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Note and clauses */}
                <div className="space-y-2 text-[11.5px] leading-normal text-justify">
                  <p>
                    <strong className="font-bold">Note:</strong> The above warranty covers manufacturing defects under normal installation and operating conditions from the date of purchase.
                  </p>
                  <p>
                    This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modifications, negligence, or external causes. Proof of purchase and relevant product identification details are required for any warranty claim.
                  </p>
                  <p>
                    Should you require any further information regarding this warranty, please do not hesitate to contact us.
                  </p>
                </div>

                <div className="pt-2">
                  <p>Thank you.</p>
                  <p className="mt-1">Yours faithfully,</p>

                  {/* Clean text signature area (NO stamp, NO signature image) */}
                  <div className="pt-8">
                    <p className="text-slate-400">……………………..</p>
                    <p className="font-bold text-[12px]">Manager – Quality Assurance</p>
                    <p className="font-bold text-[11px]">Kevilton Electrical Products (Pvt.) Ltd.</p>
                  </div>
                </div>
              </>
            ) : (
              /* ================= TEMPLATE 1: Common Draft Warranty Certificate ================= */
              <>
                {/* Salutation (Bold in template) */}
                <p className="font-bold">Dear Sir/Madam,</p>

                {/* Title (Bold in template) */}
                <p className="font-bold text-[13px] pt-1">
                  Warranty Declaration for {getProductBrandSubject(rows)}
                </p>

                {/* Paragraph 1 */}
                <p className="text-justify">
                  With reference to the product supplied to <strong className="font-bold">{parsedAddr.companyName || '[Company Name]'}</strong>, we hereby confirm that <strong className="font-bold">Kevilton Electrical Products (Pvt.) Ltd.</strong> provides the following warranty for the product detailed below:
                </p>

                {/* Table for Template 1: 1. Product Description | 2. Product Brand | 3. Warranty Period */}
                <div className="overflow-x-auto my-2">
                  <table className="w-full border-collapse border border-black text-[12px]">
                    <thead>
                      <tr className="bg-transparent font-bold">
                        <th className="border border-black p-2 text-left w-1/2">Product Description</th>
                        <th className="border border-black p-2 text-left w-1/4">Product Brand</th>
                        <th className="border border-black p-2 text-left w-1/4">Warranty Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="border border-black p-2">{row.description}</td>
                          <td className="border border-black p-2">{row.productBrand || 'Wiring Devices'}</td>
                          <td className="border border-black p-2">{row.warrantyPeriod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Body Legal Paragraphs */}
                <div className="space-y-2 text-[11.5px] leading-normal text-justify">
                  <p>
                    The above warranty covers manufacturing defects arising under normal installation and operating conditions from the date of delivery.
                  </p>
                  <p>
                    During the warranty period, <strong className="font-bold">Kevilton Electrical Products (Pvt.) Ltd.</strong> will, at its discretion, repair or replace any product found to be defective due to manufacturing faults.
                  </p>
                  <p>
                    This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modification, negligence, incorrect handling, external causes, or normal wear and tear. Proof of purchase and relevant product identification details may be required for any warranty claim.
                  </p>
                  <p>
                    The decision of <strong className="font-bold">Kevilton Electrical Products (Pvt.) Ltd.</strong> shall be final regarding any warranty claim or dispute that may arise. This letter is issued upon request as a warranty reference for the above-mentioned product.
                  </p>
                  <p>
                    Should you require any further information regarding this warranty, please do not hesitate to contact us.
                  </p>
                </div>

                <div className="pt-2">
                  <p>Thank you.</p>
                  <p className="font-bold mt-1">Yours Faithfully,</p>
                  <p className="font-bold">Kevilton Electrical Products (Pvt.) Ltd.</p>

                  {/* Clean text signature line (NO stamp, NO signature image) */}
                  <div className="pt-8">
                    <p className="text-slate-400">.............................................</p>
                    <p className="font-bold text-[12px]">Manager – Quality Assurance</p>
                    <p className="font-bold text-[11px]">Kevilton Electrical Products (Pvt.) Ltd.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons right below the preview */}
        <div className="w-full max-w-[660px] mt-6 flex flex-col sm:flex-row gap-3">
          {/* Primary PDF Download */}
          <button
            onClick={onDownloadPdf}
            disabled={isGenerating || isGeneratingDocx}
            type="button"
            className={`flex-1 py-4 px-6 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2.5 transition-all shadow-xl cursor-pointer ${
              isGenerating
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 via-[#0066FF] to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-[0.99]'
            }`}
          >
            {isGenerating ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5 text-white stroke-[2.5]" />
                <span>
                  Download {isPoCertificate ? 'Warranty Certificate' : 'Draft Certificate'} (PDF)
                </span>
              </>
            )}
          </button>

          {/* Secondary Word (.docx) Download */}
          <button
            onClick={onDownloadDocx}
            disabled={isGenerating || isGeneratingDocx}
            type="button"
            className={`sm:w-auto px-6 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all border cursor-pointer ${
              isGeneratingDocx
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50 hover:border-blue-300 shadow-sm'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Download Word (.docx)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
