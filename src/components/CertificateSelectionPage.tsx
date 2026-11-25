import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { LetterWordingOverrides, ProductItemRow, WarrantyFormData } from '../types';
import {
  formatProductDescription,
  getProductBrandSubject,
  getWarrantyRows,
} from '../utils/cleanPdfGenerator';
import {
  KEVILTON_COMPANY_NAME,
  hasCustomWording,
  parseEditedDateToIso,
  resolveLetterContent,
  splitStyledSpans,
} from '../utils/letterContent';
import { InlineEditableText } from './InlineEditableText';
import { InlineProductAutocomplete } from './InlineProductAutocomplete';
import { CatalogItem, CatalogMatch } from '../utils/warrantyRules';
import { IndexedCatalogItem, getCachedCatalog, loadCatalogItems } from '../utils/catalogSearch';

interface CertificateSelectionPageProps {
  formData: WarrantyFormData;
  onChangeFormData: (newData: Partial<WarrantyFormData>) => void;
  onBack: () => void;
  onDownloadPdf: () => void;
  onDownloadDocx: () => void;
  isGenerating: boolean;
  isGeneratingDocx?: boolean;
}

function renderRichText(text: string, boldTerms: string[]): React.ReactNode {
  const spans = splitStyledSpans(text, boldTerms);
  return spans.map((span, idx) =>
    span.bold ? (
      <strong key={idx} className="font-bold">
        {span.text}
      </strong>
    ) : (
      <React.Fragment key={idx}>{span.text}</React.Fragment>
    )
  );
}

export const CertificateSelectionPage: React.FC<CertificateSelectionPageProps> = ({
  formData,
  onChangeFormData,
  onBack,
  onDownloadPdf,
  onDownloadDocx,
  isGenerating,
  isGeneratingDocx = false,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [catalog, setCatalog] = useState<IndexedCatalogItem[]>(() => getCachedCatalog());

  // Share the cached /data/items.json catalog for inline table autocomplete
  useEffect(() => {
    let active = true;
    loadCatalogItems().then((items) => {
      if (active) {
        setCatalog(items);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Temporarily exit edit visual mode during native browser Print (including Ctrl+P)
  useEffect(() => {
    const handleBeforePrint = () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setIsPrinting(true);
    };
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const effectiveEditMode = isEditMode && !isPrinting;
  const rows = getWarrantyRows(formData);
  const brandSubject = getProductBrandSubject(rows);
  const content = resolveLetterContent(formData, rows, brandSubject);
  const wordingModified = hasCustomWording(formData.wordingOverrides);

  // Editable raw items synced directly to formData.items
  const editableItems: ProductItemRow[] =
    formData.items && formData.items.length > 0
      ? formData.items
      : rows.map((r) => ({
          description: r.description,
          productBrand: r.productBrand || '',
          warrantyPeriod: r.warrantyPeriod,
        }));

  const updateWordingOverride = <K extends keyof LetterWordingOverrides>(
    key: K,
    value: LetterWordingOverrides[K]
  ) => {
    onChangeFormData({
      wordingOverrides: {
        ...formData.wordingOverrides,
        [key]: value,
      },
    });
  };

  const updateBodyParagraph = (idx: number, value: string) => {
    const nextParagraphs = [...content.bodyParagraphs];
    nextParagraphs[idx] = value;
    updateWordingOverride('bodyParagraphs', nextParagraphs);
  };

  const handleResetWording = () => {
    const preservedDateDisplay = formData.wordingOverrides?.dateDisplay;
    onChangeFormData({
      wordingOverrides:
        preservedDateDisplay !== undefined ? { dateDisplay: preservedDateDisplay } : undefined,
    });
  };

  const handleDateChange = (nextText: string) => {
    const parsedIso = parseEditedDateToIso(nextText);
    const nextOverrides: LetterWordingOverrides = {
      ...formData.wordingOverrides,
      dateDisplay: nextText,
    };

    if (parsedIso) {
      onChangeFormData({
        date: parsedIso,
        wordingOverrides: nextOverrides,
      });
    } else {
      onChangeFormData({
        wordingOverrides: nextOverrides,
      });
    }
  };

  const handleDateBlur = () => {
    const currentDisplay = formData.wordingOverrides?.dateDisplay;
    if (currentDisplay === undefined) return;
    const parsedIso = parseEditedDateToIso(currentDisplay);
    if (parsedIso) {
      // Standard calendar date parsed cleanly -> keep formData.date synced and clear custom override
      const rest: LetterWordingOverrides = { ...formData.wordingOverrides };
      delete rest.dateDisplay;
      onChangeFormData({
        date: parsedIso,
        wordingOverrides: Object.keys(rest).length > 0 ? rest : undefined,
      });
    }
  };

  const handleItemCellChange = (
    rowIndex: number,
    field: 'description' | 'productBrand' | 'warrantyPeriod',
    value: string
  ) => {
    const updated = editableItems.map((item, idx) => {
      if (idx !== rowIndex) return item;
      if (field === 'description') {
        return {
          ...item,
          itemCode: undefined,
          productType: undefined,
          description: value,
        };
      }
      return {
        ...item,
        [field]: value,
      };
    });
    onChangeFormData({ items: updated });
  };

  const handleSelectPreviewCatalogItem = (
    rowIndex: number,
    catalogItem: CatalogItem,
    match: CatalogMatch
  ) => {
    const updated = editableItems.map((item, idx) => {
      if (idx !== rowIndex) return item;
      return {
        ...item,
        itemCode: undefined,
        productType: undefined,
        description:
          catalogItem.itemCode && catalogItem.itemName
            ? `${catalogItem.itemCode} - ${catalogItem.itemName}`
            : catalogItem.itemName || catalogItem.itemCode,
        productBrand: match.productBrand,
        warrantyPeriod: match.warrantyPeriod,
      };
    });
    onChangeFormData({ items: updated });
  };

  const handleAddPreviewRow = () => {
    onChangeFormData({
      items: [...editableItems, { description: '', productBrand: '', warrantyPeriod: '' }],
    });
  };

  const handleRemovePreviewRow = (rowIndex: number) => {
    if (editableItems.length <= 1) return;
    onChangeFormData({
      items: editableItems.filter((_, idx) => idx !== rowIndex),
    });
  };

  const blurActiveElement = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handlePrint = () => {
    blurActiveElement();
    setIsPrinting(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setIsPrinting(false);
      });
    });
  };

  const handleCleanDownloadPdf = () => {
    blurActiveElement();
    onDownloadPdf();
  };

  const handleCleanDownloadDocx = () => {
    blurActiveElement();
    onDownloadDocx();
  };

  const getEditableItemDescription = (item: ProductItemRow): string => {
    if (item.itemCode?.trim()) {
      return formatProductDescription(item);
    }
    return item.description ?? item.productType ?? '';
  };

  const renderProductTable = () => (
    <div className="my-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-transparent font-bold">
              <th className="border border-black p-2 text-left w-1/2">Product Description</th>
              <th className="border border-black p-2 text-left w-1/4">Product Brand</th>
              <th className="border border-black p-2 text-left w-1/4">Warranty Period</th>
              {effectiveEditMode && editableItems.length > 1 && (
                <th className="w-7 p-0 border-0 bg-transparent no-print" aria-label="Row actions" />
              )}
            </tr>
          </thead>
          <tbody>
            {effectiveEditMode
              ? editableItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-2 align-top">
                      <InlineProductAutocomplete
                        value={getEditableItemDescription(item)}
                        catalog={catalog}
                        onChange={(val) => handleItemCellChange(idx, 'description', val)}
                        onSelect={(catalogItem, match) =>
                          handleSelectPreviewCatalogItem(idx, catalogItem, match)
                        }
                        placeholder="Enter Item Code or Item Name"
                        ariaLabel={`Row ${idx + 1} product description`}
                      />
                    </td>
                    <td className="border border-black p-2 align-top">
                      <InlineEditableText
                        value={item.productBrand ?? item.productFamily ?? ''}
                        onChange={(val) => handleItemCellChange(idx, 'productBrand', val)}
                        placeholder="Product brand"
                        ariaLabel={`Row ${idx + 1} product brand`}
                      />
                    </td>
                    <td className="border border-black p-2 align-top">
                      <InlineEditableText
                        value={item.warrantyPeriod ?? ''}
                        onChange={(val) => handleItemCellChange(idx, 'warrantyPeriod', val)}
                        placeholder="Warranty period"
                        ariaLabel={`Row ${idx + 1} warranty period`}
                      />
                    </td>
                    {editableItems.length > 1 && (
                      <td className="p-0 pl-1 align-middle border-0 bg-transparent no-print">
                        <button
                          type="button"
                          onClick={() => handleRemovePreviewRow(idx)}
                          title="Remove row"
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              : rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-2">{row.description}</td>
                    <td className="border border-black p-2">
                      {row.productBrand || 'Wiring Devices'}
                    </td>
                    <td className="border border-black p-2">{row.warrantyPeriod}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {effectiveEditMode && (
        <div
          className="mt-1.5 flex justify-end no-print"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          <button
            type="button"
            onClick={handleAddPreviewRow}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Row</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn print:space-y-0">
      {/* Top Bar with Back Button and Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 no-print">
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
            {content.isPoCertificate
              ? '2. Common Warranty Certificate'
              : '1. Draft Warranty Certificate'}
          </span>
        </div>
      </div>

      {/* Info Card & Toolbar Controls */}
      <div className="bg-white rounded-2xl p-5 border border-blue-50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-extrabold text-[#0D2447] tracking-tight">
            {content.isPoCertificate
              ? 'Common Warranty Certificate'
              : 'Draft Warranty Certificate'}
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Pristine document generated matching your exact sample format without header, logo,
            watermark, rubber seal, or signature image.
          </p>
        </div>

        {/* Action Buttons Top Quick Access */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => {
              blurActiveElement();
              setIsEditMode((prev) => !prev);
            }}
            type="button"
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
              isEditMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Done Editing</span>
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5 text-blue-600" />
                <span>Edit Letter</span>
              </>
            )}
          </button>

          {isEditMode && wordingModified && (
            <button
              onClick={handleResetWording}
              type="button"
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Restore default letter wording while keeping customer and product details"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Wording</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            disabled={isGenerating || isGeneratingDocx}
            type="button"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print</span>
          </button>

          <button
            onClick={handleCleanDownloadPdf}
            disabled={isGenerating || isGeneratingDocx}
            type="button"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handleCleanDownloadDocx}
            disabled={isGenerating || isGeneratingDocx}
            type="button"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Word (.docx)</span>
          </button>
        </div>
      </div>

      {/* Live Preview Container */}
      <div className="flex flex-col items-center">
        <div className="text-center mb-2 space-y-1.5 no-print">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Live Document Preview (Letter Size 8.5&quot; × 11&quot; · Normal Margins 1&quot; 1&quot;
            1&quot; 1&quot; · Times New Roman)
          </p>
          {effectiveEditMode && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[11px] font-semibold text-blue-700">
              <Pencil className="w-3 h-3" />
              <span>Click any text on the letter to edit</span>
            </div>
          )}
        </div>

        {/* Paper Document Preview Container */}
        <div
          id="warranty-letter-paper"
          className={`w-full max-w-[660px] bg-white rounded-xl shadow-2xl shadow-slate-400/20 border overflow-hidden relative transition-colors ${
            effectiveEditMode ? 'border-blue-300 ring-2 ring-blue-500/15' : 'border-slate-300'
          }`}
        >
          {/* Pristine Paper Content */}
          <div
            id="warranty-letter-paper-inner"
            className="p-8 sm:p-12 text-[12px] sm:text-[13px] leading-relaxed text-black space-y-4"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            {/* 1. Date */}
            <div>
              {effectiveEditMode ? (
                <InlineEditableText
                  value={content.dateText}
                  onChange={handleDateChange}
                  onBlur={handleDateBlur}
                  className="font-bold"
                  placeholder="September 30, 2026"
                  ariaLabel="Letter date"
                />
              ) : (
                <span className="font-bold">{content.dateText || '[Date]'}</span>
              )}
            </div>

            {/* 2. Recipient Address Block (First line bold in read/print mode) */}
            <div className="space-y-0.5 leading-snug">
              {effectiveEditMode ? (
                <InlineEditableText
                  value={formData.customerAddress}
                  onChange={(val) => onChangeFormData({ customerAddress: val })}
                  allowNewlines
                  className="leading-snug"
                  placeholder={'Mr./Ms. [Customer Name]\n[Designation]\n[Company Name]\n[Company Address]'}
                  ariaLabel="Customer name and address"
                />
              ) : (
                content.addressLines.map((line, idx) => (
                  <p key={idx} className={idx === 0 ? 'font-bold' : ''}>
                    {line}
                  </p>
                ))
              )}
            </div>

            {content.isPoCertificate ? (
              /* ================= TEMPLATE 2: Common Warranty Certificate ================= */
              <>
                {/* Subject Title (Bold) */}
                {effectiveEditMode ? (
                  <div className="pt-1">
                    <InlineEditableText
                      value={content.subject}
                      onChange={(val) => updateWordingOverride('subject', val)}
                      className="font-bold"
                      ariaLabel="Letter subject"
                    />
                  </div>
                ) : (
                  <p className="font-bold pt-1">{content.subject}</p>
                )}

                {/* Salutation (Bold) */}
                {effectiveEditMode ? (
                  <InlineEditableText
                    value={content.salutation}
                    onChange={(val) => updateWordingOverride('salutation', val)}
                    className="font-bold"
                    ariaLabel="Salutation"
                  />
                ) : (
                  <p className="font-bold">{content.salutation}</p>
                )}

                {/* Opening Paragraph 1 */}
                {effectiveEditMode ? (
                  <InlineEditableText
                    value={content.introParagraph1}
                    onChange={(val) => updateWordingOverride('introParagraph1', val)}
                    allowNewlines
                    className="text-justify"
                    ariaLabel="Opening paragraph 1"
                  />
                ) : (
                  content.introParagraph1.trim() && (
                    <p className="text-justify whitespace-pre-line">
                      {renderRichText(content.introParagraph1, [
                        KEVILTON_COMPANY_NAME,
                        content.referenceName,
                      ])}
                    </p>
                  )
                )}

                {/* Opening Paragraph 2 */}
                {effectiveEditMode ? (
                  <InlineEditableText
                    value={content.introParagraph2}
                    onChange={(val) => updateWordingOverride('introParagraph2', val)}
                    allowNewlines
                    className="text-justify"
                    ariaLabel="Opening paragraph 2"
                  />
                ) : (
                  content.introParagraph2.trim() && (
                    <p className="text-justify whitespace-pre-line">
                      {renderRichText(content.introParagraph2, [content.poNumberText])}
                    </p>
                  )
                )}

                {/* Section Header */}
                {effectiveEditMode ? (
                  <div className="pt-1">
                    <InlineEditableText
                      value={content.itemsHeader}
                      onChange={(val) => updateWordingOverride('itemsHeader', val)}
                      className="font-bold"
                      ariaLabel="Items table heading"
                    />
                  </div>
                ) : (
                  content.itemsHeader.trim() && (
                    <p className="font-bold pt-1">{content.itemsHeader}</p>
                  )
                )}

                {/* Product Items Table */}
                {renderProductTable()}

                {/* Optional Note Below Table */}
                {effectiveEditMode ? (
                  formData.noteOption === 'withNote' ? (
                    <div className="my-2.5 p-2 bg-blue-50/40 border border-blue-200/70 rounded-lg">
                      <div className="flex items-start gap-1 text-[11.5px] leading-normal text-justify">
                        <span className="font-bold select-none pt-0.5">Note:</span>
                        <div className="flex-1">
                          <InlineEditableText
                            value={content.noteText}
                            onChange={(val) => {
                              updateWordingOverride('noteContent', val);
                              onChangeFormData({ noteContent: val });
                            }}
                            allowNewlines
                            className="text-justify leading-normal"
                            placeholder="Enter additional note content to appear below the items table..."
                            ariaLabel="Additional note content"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end mt-1 no-print">
                        <button
                          type="button"
                          onClick={() => {
                            onChangeFormData({ noteOption: 'withoutNote', noteContent: '' });
                            updateWordingOverride('noteContent', undefined);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove note</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="my-1.5 no-print">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeFormData({ noteOption: 'withNote', noteContent: '' })
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded border border-dashed border-slate-300 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Note below table</span>
                      </button>
                    </div>
                  )
                ) : (
                  content.hasNote && (
                    <div className="my-2.5 text-[11.5px] leading-normal text-justify whitespace-pre-line">
                      <strong className="font-bold">Note: </strong>
                      <span>{content.noteText}</span>
                    </div>
                  )
                )}

                {/* Clauses */}
                <div className="space-y-2 text-[11.5px] leading-normal text-justify">
                  {content.bodyParagraphs.map((paragraph, idx) =>
                    effectiveEditMode ? (
                      <InlineEditableText
                        key={idx}
                        value={paragraph}
                        onChange={(val) => updateBodyParagraph(idx, val)}
                        allowNewlines
                        className="text-justify leading-normal"
                        ariaLabel={`Warranty term paragraph ${idx + 1}`}
                      />
                    ) : (
                      paragraph.trim() && (
                        <p key={idx} className="whitespace-pre-line">
                          {renderRichText(paragraph, [KEVILTON_COMPANY_NAME])}
                        </p>
                      )
                    )
                  )}
                </div>

                {/* Closing & Signatory */}
                <div className="pt-2">
                  {effectiveEditMode ? (
                    <InlineEditableText
                      value={content.thankYou}
                      onChange={(val) => updateWordingOverride('thankYou', val)}
                      ariaLabel="Thank you line"
                    />
                  ) : (
                    content.thankYou.trim() && <p>{content.thankYou}</p>
                  )}

                  {effectiveEditMode ? (
                    <div className="mt-1">
                      <InlineEditableText
                        value={content.closing}
                        onChange={(val) => updateWordingOverride('closing', val)}
                        ariaLabel="Closing salutation"
                      />
                    </div>
                  ) : (
                    content.closing.trim() && <p className="mt-1">{content.closing}</p>
                  )}

                  {/* Clean text signature area */}
                  <div className="pt-8">
                    {effectiveEditMode ? (
                      <InlineEditableText
                        value={content.signatureLine}
                        onChange={(val) => updateWordingOverride('signatureLine', val)}
                        className="text-slate-400"
                        ariaLabel="Signature dotted line"
                      />
                    ) : (
                      <p className="text-slate-400">{content.signatureLine}</p>
                    )}

                    {effectiveEditMode ? (
                      <InlineEditableText
                        value={content.signatoryTitle}
                        onChange={(val) => updateWordingOverride('signatoryTitle', val)}
                        className="font-bold text-[12px]"
                        ariaLabel="Signatory title"
                      />
                    ) : (
                      <p className="font-bold text-[12px]">{content.signatoryTitle}</p>
                    )}

                    {effectiveEditMode ? (
                      <InlineEditableText
                        value={content.signatoryCompany}
                        onChange={(val) => updateWordingOverride('signatoryCompany', val)}
                        className="font-bold text-[11px]"
                        ariaLabel="Signatory company"
                      />
                    ) : (
                      <p className="font-bold text-[11px]">{content.signatoryCompany}</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* ================= TEMPLATE 1: Common Draft Warranty Certificate ================= */
              <>
                {/* Salutation (Bold) */}
                {effectiveEditMode ? (
                  <InlineEditableText
                    value={content.salutation}
                    onChange={(val) => updateWordingOverride('salutation', val)}
                    className="font-bold"
                    ariaLabel="Salutation"
                  />
                ) : (
                  <p className="font-bold">{content.salutation}</p>
                )}

                {/* Title (Bold) */}
                {effectiveEditMode ? (
                  <div className="pt-1">
                    <InlineEditableText
                      value={content.subject}
                      onChange={(val) => updateWordingOverride('subject', val)}
                      className="font-bold text-[13px]"
                      ariaLabel="Letter subject"
                    />
                  </div>
                ) : (
                  <p className="font-bold text-[13px] pt-1">{content.subject}</p>
                )}

                {/* Opening Paragraph */}
                {effectiveEditMode ? (
                  <InlineEditableText
                    value={content.introParagraph1}
                    onChange={(val) => updateWordingOverride('introParagraph1', val)}
                    allowNewlines
                    className="text-justify"
                    ariaLabel="Opening paragraph"
                  />
                ) : (
                  content.introParagraph1.trim() && (
                    <p className="text-justify whitespace-pre-line">
                      {renderRichText(content.introParagraph1, [
                        content.referenceName,
                        KEVILTON_COMPANY_NAME,
                      ])}
                    </p>
                  )
                )}

                {/* Product Items Table */}
                {renderProductTable()}

                {/* Optional Note Below Table */}
                {effectiveEditMode ? (
                  formData.noteOption === 'withNote' ? (
                    <div className="my-2.5 p-2 bg-blue-50/40 border border-blue-200/70 rounded-lg">
                      <div className="flex items-start gap-1 text-[11.5px] leading-normal text-justify">
                        <span className="font-bold select-none pt-0.5">Note:</span>
                        <div className="flex-1">
                          <InlineEditableText
                            value={content.noteText}
                            onChange={(val) => {
                              updateWordingOverride('noteContent', val);
                              onChangeFormData({ noteContent: val });
                            }}
                            allowNewlines
                            className="text-justify leading-normal"
                            placeholder="Enter additional note content to appear below the items table..."
                            ariaLabel="Additional note content"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end mt-1 no-print">
                        <button
                          type="button"
                          onClick={() => {
                            onChangeFormData({ noteOption: 'withoutNote', noteContent: '' });
                            updateWordingOverride('noteContent', undefined);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove note</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="my-1.5 no-print">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeFormData({ noteOption: 'withNote', noteContent: '' })
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded border border-dashed border-slate-300 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Note below table</span>
                      </button>
                    </div>
                  )
                ) : (
                  content.hasNote && (
                    <div className="my-2.5 text-[11.5px] leading-normal text-justify whitespace-pre-line">
                      <strong className="font-bold">Note: </strong>
                      <span>{content.noteText}</span>
                    </div>
                  )
                )}

                {/* Body Legal Paragraphs */}
                <div className="space-y-2 text-[11.5px] leading-normal text-justify">
                  {content.bodyParagraphs.map((paragraph, idx) =>
                    effectiveEditMode ? (
                      <InlineEditableText
                        key={idx}
                        value={paragraph}
                        onChange={(val) => updateBodyParagraph(idx, val)}
                        allowNewlines
                        className="text-justify leading-normal"
                        ariaLabel={`Warranty clause ${idx + 1}`}
                      />
                    ) : (
                      paragraph.trim() && (
                        <p key={idx} className="whitespace-pre-line">
                          {renderRichText(paragraph, [KEVILTON_COMPANY_NAME])}
                        </p>
                      )
                    )
                  )}
                </div>

                {/* Closing & Signatory */}
                <div className="pt-2">
                  {effectiveEditMode ? (
                    <InlineEditableText
                      value={content.thankYou}
                      onChange={(val) => updateWordingOverride('thankYou', val)}
                      ariaLabel="Thank you line"
                    />
                  ) : (
                    content.thankYou.trim() && <p>{content.thankYou}</p>
                  )}

                  {effectiveEditMode ? (
                    <div className="mt-1">
                      <InlineEditableText
                        value={content.closing}
                        onChange={(val) => updateWordingOverride('closing', val)}
                        className="font-bold"
                        ariaLabel="Closing salutation"
                      />
                    </div>
                  ) : (
                    content.closing.trim() && <p className="font-bold mt-1">{content.closing}</p>
                  )}

                  {effectiveEditMode ? (
                    <InlineEditableText
                      value={content.closingCompany}
                      onChange={(val) => updateWordingOverride('closingCompany', val)}
                      className="font-bold"
                      ariaLabel="Closing company name"
                    />
                  ) : (
                    content.closingCompany.trim() && (
                      <p className="font-bold">{content.closingCompany}</p>
                    )
                  )}

                  {/* Clean text signature line */}
                  <div className="pt-8">
                    {effectiveEditMode ? (
                      <InlineEditableText
                        value={content.signatureLine}
                        onChange={(val) => updateWordingOverride('signatureLine', val)}
                        className="text-slate-400"
                        ariaLabel="Signature dotted line"
                      />
                    ) : (
                      <p className="text-slate-400">{content.signatureLine}</p>
                    )}

                    {effectiveEditMode ? (
                      <InlineEditableText
                        value={content.signatoryTitle}
                        onChange={(val) => updateWordingOverride('signatoryTitle', val)}
                        className="font-bold text-[12px]"
                        ariaLabel="Signatory title"
                      />
                    ) : (
                      <p className="font-bold text-[12px]">{content.signatoryTitle}</p>
                    )}

                    {effectiveEditMode ? (
                      <InlineEditableText
                        value={content.signatoryCompany}
                        onChange={(val) => updateWordingOverride('signatoryCompany', val)}
                        className="font-bold text-[11px]"
                        ariaLabel="Signatory company"
                      />
                    ) : (
                      <p className="font-bold text-[11px]">{content.signatoryCompany}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons right below the preview */}
        <div className="w-full max-w-[660px] mt-6 flex flex-col sm:flex-row gap-3 no-print">
          {/* Primary PDF Download */}
          <button
            onClick={handleCleanDownloadPdf}
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
                  Download {content.isPoCertificate ? 'Warranty Certificate' : 'Draft Certificate'}{' '}
                  (PDF)
                </span>
              </>
            )}
          </button>

          {/* Secondary Word (.docx) Download */}
          <button
            onClick={handleCleanDownloadDocx}
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
