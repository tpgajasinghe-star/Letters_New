import React, { useEffect, useRef, useState } from 'react';
import { User, Package, Calendar, Send, Sparkles, AlertCircle, RotateCcw, Plus, Trash2, FileText, Building2, HelpCircle, CheckCircle2 } from 'lucide-react';
import { WarrantyFormData, ProductItemRow, ReferenceTypeOption, PoInvoiceTypeOption, NoteOption, ParsedCustomerDetails } from '../types';
import { CatalogItem, CatalogMatch } from '../utils/warrantyRules';
import { IndexedCatalogItem, getCachedCatalog, loadCatalogItems } from '../utils/catalogSearch';
import { CustomerRecord, IndexedCustomerRecord, getCachedCustomers, loadCustomerRecords } from '../utils/customerSearch';
import { ProductDescriptionAutocomplete } from './ProductDescriptionAutocomplete';
import { CustomerAutocomplete } from './CustomerAutocomplete';
import { AiCustomerExtractor } from './AiCustomerExtractor';
import { parseCustomerAddress } from '../utils/templateParser';
import { parseCustomerWithAi, isUnstructuredCustomerRecord } from '../utils/customerExtractor';


interface WarrantyFormProps {
  formData: WarrantyFormData;
  onChange: (newData: Partial<WarrantyFormData>) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  step: number;
}

export const WarrantyForm: React.FC<WarrantyFormProps> = ({
  formData,
  onChange,
  onSubmit,
  isGenerating,
  step,
}) => {
  const [errors, setErrors] = useState<{
    customerAddress?: string;
    date?: string;
    items?: string;
    referenceName?: string;
    poNumber?: string;
    noteContent?: string;
  }>({});

  const [catalog, setCatalog] = useState<IndexedCatalogItem[]>(() => getCachedCatalog());
  const [customers, setCustomers] = useState<IndexedCustomerRecord[]>(() => getCachedCustomers());
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [hasManuallyEditedReference, setHasManuallyEditedReference] = useState(false);
  const [isAiExtractingDropdown, setIsAiExtractingDropdown] = useState(false);
  const [isAiBoxOpen, setIsAiBoxOpen] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const showAiSuccessToast = (msg: string) => {
    setAiSuccessMessage(msg);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(() => {
      setAiSuccessMessage(null);
    }, 4500);
  };

  const applyExtractedDetails = (data: ParsedCustomerDetails, successMsg?: string) => {
    const cleanAddress = data.formattedAddressBlock?.trim() || formData.customerAddress;

    let targetRefType: ReferenceTypeOption = formData.referenceType || 'companyName';
    let targetRefName = formData.referenceName || '';

    if (data.projectName?.trim()) {
      targetRefType = 'projectName';
      targetRefName = data.projectName.trim();
    } else if (data.companyName?.trim()) {
      targetRefType = 'companyName';
      targetRefName = data.companyName.trim();
    } else if (data.customerName?.trim()) {
      targetRefType = 'customerName';
      targetRefName = data.customerName.trim();
    }

    let targetPoInvoiceType: PoInvoiceTypeOption = formData.poInvoiceType || 'PO';
    let targetPoNumber = formData.poNumber || '';

    if (data.refType === 'PO' || data.refType === 'Invoice') {
      targetPoInvoiceType = data.refType;
    }
    if (data.refNumber?.trim()) {
      targetPoNumber = data.refNumber.trim();
    } else if (data.poNumber?.trim()) {
      targetPoInvoiceType = 'PO';
      targetPoNumber = data.poNumber.trim();
    } else if (data.invoiceNumber?.trim()) {
      targetPoInvoiceType = 'Invoice';
      targetPoNumber = data.invoiceNumber.trim();
    }

    setHasManuallyEditedReference(false);
    onChange({
      customerAddress: cleanAddress,
      referenceType: targetRefType,
      referenceName: targetRefName,
      poInvoiceType: targetPoInvoiceType,
      poNumber: targetPoNumber,
    });

    setErrors((prev) => ({
      ...prev,
      customerAddress: undefined,
      referenceName: undefined,
      poNumber: undefined,
    }));

    if (successMsg) {
      showAiSuccessToast(successMsg);
    }
  };

  const customerAddressRef = useRef<HTMLTextAreaElement>(null);
  const firstItemInputRef = useRef<HTMLInputElement>(null);
  const itemsSectionRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const referenceNameRef = useRef<HTMLInputElement>(null);
  const poNumberRef = useRef<HTMLInputElement>(null);
  const noteContentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    loadCatalogItems().then((items) => {
      if (active && items.length > 0) {
        setCatalog(items);
      }
    });
    loadCustomerRecords().then((recs) => {
      if (active) {
        setCustomers(recs);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const isPoCertificate = formData.letterType === 'po_certificate';
  const referenceType: ReferenceTypeOption = formData.referenceType || 'companyName';
  const poInvoiceType: PoInvoiceTypeOption = formData.poInvoiceType || 'PO';
  const noteOption: NoteOption = formData.noteOption || 'withoutNote';

  // Smart auto-fill for reference name if typing manually (when no selected customer)
  useEffect(() => {
    if (selectedCustomer || hasManuallyEditedReference) return;
    const parsed = parseCustomerAddress(formData.customerAddress);
    let autoRef = '';
    if (referenceType === 'projectName') {
      autoRef = parsed.companyName || parsed.customerName || '';
    } else if (referenceType === 'customerName') {
      autoRef = parsed.customerName || '';
    } else {
      autoRef = parsed.companyName || parsed.customerName || '';
    }
    if (autoRef && autoRef !== formData.referenceName) {
      onChange({ referenceName: autoRef });
    }
  }, [formData.customerAddress, referenceType, hasManuallyEditedReference, selectedCustomer]);

  type InvalidFieldKey = 'customerAddress' | 'referenceName' | 'poNumber' | 'items' | 'noteContent' | 'date';

  const validate = (): InvalidFieldKey | null => {
    const newErrors: typeof errors = {};

    if (!formData.customerAddress.trim()) {
      newErrors.customerAddress = 'Customer / Company address is required.';
    }

    if (!formData.referenceName?.trim()) {
      newErrors.referenceName = 'Reference name is required for 1st paragraph.';
    }

    if (isPoCertificate && !formData.poNumber?.trim()) {
      newErrors.poNumber = `${poInvoiceType} Number is required.`;
    }

    if (!formData.items || formData.items.length === 0) {
      newErrors.items = 'Please add at least one product item.';
    } else {
      const hasValidRow = formData.items.some((item) => {
        return item.description?.trim() || item.itemCode?.trim() || item.productType?.trim();
      });
      if (!hasValidRow) {
        newErrors.items = 'Please enter the Product Description for at least one item.';
      }
    }

    if (noteOption === 'withNote' && !formData.noteContent?.trim()) {
      newErrors.noteContent = 'Note content is required when "With Note" is selected.';
    }

    if (!formData.date.trim()) {
      newErrors.date = 'Date of issue is required.';
    }

    setErrors(newErrors);

    if (newErrors.customerAddress) return 'customerAddress';
    if (newErrors.referenceName) return 'referenceName';
    if (isPoCertificate && newErrors.poNumber) return 'poNumber';
    if (newErrors.items) return 'items';
    if (noteOption === 'withNote' && newErrors.noteContent) return 'noteContent';
    if (newErrors.date) return 'date';
    return null;
  };

  const scrollToAndFocusField = (field: InvalidFieldKey) => {
    requestAnimationFrame(() => {
      let targetEl: HTMLElement | null = null;
      if (field === 'customerAddress') {
        targetEl = customerAddressRef.current;
      } else if (field === 'referenceName') {
        targetEl = referenceNameRef.current;
      } else if (field === 'poNumber') {
        targetEl = poNumberRef.current;
      } else if (field === 'items') {
        targetEl = firstItemInputRef.current || itemsSectionRef.current;
      } else if (field === 'noteContent') {
        targetEl = noteContentRef.current;
      } else if (field === 'date') {
        targetEl = dateRef.current;
      }

      if (!targetEl) return;
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try {
        targetEl.focus({ preventScroll: true });
      } catch {
        targetEl.focus();
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const firstInvalid = validate();
    if (!firstInvalid) {
      onSubmit();
      return;
    }
    scrollToAndFocusField(firstInvalid);
  };

  const handleSelectCustomer = async (item: IndexedCustomerRecord) => {
    const { record } = item;
    setSelectedCustomer(record);

    // 1. Populate Customer Address cleanly in order: customerName, companyName, projectName, locationAddress
    const addrLines: string[] = [];
    const addUnique = (val?: string) => {
      const trimmed = val?.trim();
      if (!trimmed) return;
      if (!addrLines.some((line) => line.toLowerCase() === trimmed.toLowerCase())) {
        addrLines.push(trimmed);
      }
    };

    addUnique(record.customerName);
    addUnique(record.companyName);
    addUnique(record.projectName);
    addUnique(record.locationAddress);

    const cleanAddress = addrLines.join('\n');

    // 2. Set reference type and name based on priority: projectName -> companyName -> customerName
    let bestRefType: ReferenceTypeOption = 'companyName';
    let bestRefName = '';
    if (record.projectName?.trim()) {
      bestRefType = 'projectName';
      bestRefName = record.projectName.trim();
    } else if (record.companyName?.trim()) {
      bestRefType = 'companyName';
      bestRefName = record.companyName.trim();
    } else if (record.customerName?.trim()) {
      bestRefType = 'customerName';
      bestRefName = record.customerName.trim();
    }

    // 3. PO or Invoice auto-fill (for Letter Type 2 or saved in state)
    let targetPoInvoiceType: PoInvoiceTypeOption = poInvoiceType;
    let targetPoNumber = formData.poNumber || '';
    if (record.refType === 'PO' || record.refType === 'Invoice') {
      targetPoInvoiceType = record.refType;
    }
    if (record.refNumber?.trim()) {
      targetPoNumber = record.refNumber.trim();
    }

    setHasManuallyEditedReference(false);
    onChange({
      customerAddress: cleanAddress,
      referenceType: bestRefType,
      referenceName: bestRefName,
      poInvoiceType: targetPoInvoiceType,
      poNumber: targetPoNumber,
    });
    setErrors((prev) => ({
      ...prev,
      customerAddress: undefined,
      referenceName: undefined,
      poNumber: undefined,
    }));

    // Smart AI Auto-Extract on Dropdown Selection:
    // Check if the selected record has raw/unstructured email content
    if (isUnstructuredCustomerRecord(record)) {
      setIsAiExtractingDropdown(true);
      try {
        const bodyParts = [
          record.customerName,
          record.companyName,
          record.projectName,
          record.locationAddress,
          record.poNumber,
          record.invoiceNumber,
        ].filter(Boolean);

        const extracted = await parseCustomerWithAi({
          subject: record.emailSubject?.trim() || undefined,
          bodyText: bodyParts.join('\n') || undefined,
        });

        applyExtractedDetails(
          extracted,
          '✨ Address & PO details automatically extracted with AI'
        );
      } catch {
        // If the API call fails or is unavailable, fail silently and keep the already-populated fallback fields intact
      } finally {
        setIsAiExtractingDropdown(false);
      }
    }
  };

  const handleSelectLetterType = (type: 'declaration' | 'po_certificate') => {
    const update: Partial<WarrantyFormData> = {
      letterType: type,
    };

    // If switching to Letter Type 2, auto-select PO/Invoice and fill number if customer was selected
    if (type === 'po_certificate' && selectedCustomer) {
      if (selectedCustomer.refType === 'PO' || selectedCustomer.refType === 'Invoice') {
        update.poInvoiceType = selectedCustomer.refType;
      }
      if (selectedCustomer.refNumber?.trim()) {
        update.poNumber = selectedCustomer.refNumber.trim();
      }
    }

    onChange(update);
    setErrors({});
  };

  const handleReferenceTypeChange = (newRefType: ReferenceTypeOption) => {
    let nextName = '';

    // If a suggested customer was selected, swap the reference input to that record's field if available
    if (selectedCustomer) {
      if (newRefType === 'projectName' && selectedCustomer.projectName?.trim()) {
        nextName = selectedCustomer.projectName.trim();
      } else if (newRefType === 'companyName' && selectedCustomer.companyName?.trim()) {
        nextName = selectedCustomer.companyName.trim();
      } else if (newRefType === 'customerName' && selectedCustomer.customerName?.trim()) {
        nextName = selectedCustomer.customerName.trim();
      }
    }

    // Fallback if no selected customer or the field wasn't available
    if (!nextName) {
      const parsed = parseCustomerAddress(formData.customerAddress);
      if (newRefType === 'projectName') {
        nextName = parsed.companyName || parsed.customerName || '';
      } else if (newRefType === 'customerName') {
        nextName = parsed.customerName || '';
      } else {
        nextName = parsed.companyName || parsed.customerName || '';
      }
    }

    setHasManuallyEditedReference(false);
    onChange({
      referenceType: newRefType,
      referenceName: nextName,
    });
    if (errors.referenceName) {
      setErrors((prev) => ({ ...prev, referenceName: undefined }));
    }
  };

  const handleAddItem = () => {
    onChange({
      items: [...formData.items, { description: '', productBrand: '', warrantyPeriod: '' }],
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    onChange({
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleItemChange = (index: number, field: keyof ProductItemRow, value: string) => {
    const updated = formData.items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange({ items: updated });
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }));
    }
  };

  const handleSelectCatalogItem = (index: number, catalogItem: CatalogItem, match: CatalogMatch) => {
    const updated = formData.items.map((item, i) => {
      if (i === index) {
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
      }
      return item;
    });
    onChange({ items: updated });
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }));
    }
  };

  const handleFillSample = () => {
    setHasManuallyEditedReference(false);
    if (isPoCertificate) {
      onChange({
        letterType: 'po_certificate',
        date: new Date().toISOString().split('T')[0],
        customerAddress: `Mr. Kasun Rajapaksha\nApex Construction & Engineering (Pvt) Ltd\nGrand Horizon Towers Project\nNo. 128, High Level Road, Nugegoda`,
        referenceType: 'projectName',
        referenceName: 'Grand Horizon Towers Project',
        poInvoiceType: 'PO',
        poNumber: 'PO-2026-089',
        noteOption: 'withNote',
        noteContent: 'All electrical accessories must be installed by certified Kevilton electricians.',
        items: [
          { description: 'KEV-DB-08 - Distribution Boards & Enclosures 8-Way', productBrand: 'Circuit Protection Devices', warrantyPeriod: '10 Years' },
          { description: 'KEV-MOD-01 - Modular Switches and Socket Outlets', productBrand: 'Wiring Devices', warrantyPeriod: '5 Years' },
        ],
        wordingOverrides: undefined,
      });
    } else {
      onChange({
        letterType: 'declaration',
        date: new Date().toISOString().split('T')[0],
        customerAddress: `Mr. Kasun Rajapaksha\nApex Construction & Engineering (Pvt) Ltd\nNo. 128, High Level Road, Nugegoda`,
        referenceType: 'companyName',
        referenceName: 'Apex Construction & Engineering (Pvt) Ltd',
        noteOption: 'withoutNote',
        noteContent: '',
        items: [
          { description: 'KEV-SW-101 - 1 Gang 1 Way Switch 10A White', productBrand: 'Wiring Devices', warrantyPeriod: '5 Years' },
          { description: 'KEV-SK-202 - 13A Switched Socket Outlet Single', productBrand: 'Wiring Devices', warrantyPeriod: '2 Years' },
        ],
        wordingOverrides: undefined,
      });
    }
    setErrors({});
  };

  const handleReset = () => {
    setHasManuallyEditedReference(false);
    onChange({
      customerAddress: '',
      date: new Date().toISOString().split('T')[0],
      referenceType: 'companyName',
      referenceName: '',
      poInvoiceType: 'PO',
      poNumber: '',
      noteOption: 'withoutNote',
      noteContent: '',
      items: [{ description: '', productBrand: '', warrantyPeriod: '' }],
      wordingOverrides: undefined,
    });
    setErrors({});
  };

  const getRefPlaceholder = () => {
    if (referenceType === 'projectName') return 'e.g. Grand Horizon Towers Project';
    if (referenceType === 'customerName') return 'e.g. Mr. Kasun Rajapaksha';
    return 'e.g. Apex Construction & Engineering (Pvt) Ltd';
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-blue-950/5 border border-blue-50/80 p-6 sm:p-8">
      {/* 3-Step Process Indicator */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-7">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= 1 ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' : 'bg-slate-200 text-slate-650'}`}>
            1
          </div>
          <span className={`text-xs sm:text-sm font-semibold ${step === 1 ? 'text-blue-600' : 'text-slate-700'}`}>
            Enter Details
          </span>
        </div>

        <div className="h-0.5 w-6 sm:w-12 bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= 2 ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' : 'bg-slate-200 text-slate-500'}`}>
            2
          </div>
          <span className={`text-xs sm:text-sm font-medium ${step === 2 ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
            Live Preview
          </span>
        </div>

        <div className="h-0.5 w-6 sm:w-12 bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= 3 ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30' : 'bg-slate-200 text-slate-500'}`}>
            3
          </div>
          <span className={`text-xs sm:text-sm font-medium ${step === 3 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
            Download PDF
          </span>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center justify-between mb-6 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFillSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Fill Sample Data
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Clear form"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* ============================================================ */}
        {/* STEP 1: CHOOSE LETTER TYPE FIRST                             */}
        {/* ============================================================ */}
        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            Select Letter Type <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-4">
            Choose which warranty letter type you want to generate:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Option 1: Draft Warranty Certificate */}
            <label
              onClick={() => handleSelectLetterType('declaration')}
              className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 select-none ${
                !isPoCertificate
                  ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="letterTypeRadio"
                value="declaration"
                checked={!isPoCertificate}
                onChange={() => handleSelectLetterType('declaration')}
                className="mt-1 h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  1. Draft Warranty Certificate
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Declaration letter with: <strong>Product Description</strong>, <strong>Product Brand</strong>, <strong>Warranty Period</strong>
                </span>
              </div>
            </label>

            {/* Option 2: Common Warranty Certificate */}
            <label
              onClick={() => handleSelectLetterType('po_certificate')}
              className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 select-none ${
                isPoCertificate
                  ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="letterTypeRadio"
                value="po_certificate"
                checked={isPoCertificate}
                onChange={() => handleSelectLetterType('po_certificate')}
                className="mt-1 h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  2. Common Warranty Certificate
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Certificate asking: <strong>PO / Invoice No.</strong>, <strong>Product Description</strong>, <strong>Brand</strong>, <strong>Period</strong>
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* ============================================================ */}
        {/* STEP 2: CUSTOMER ADDRESS WITH AUTO-SUGGEST                    */}
        {/* ============================================================ */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <label htmlFor="customerAddress" className="block text-sm font-bold text-slate-800">
                  Customer Address <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500">
                  Type SNo (#1, 1), name, PO/Invoice, or address to search customer database (or enter manually)
                </p>
              </div>
            </div>

            {/* Compact AI Paste Button */}
            <button
              type="button"
              onClick={() => setIsAiBoxOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs self-start sm:self-auto select-none ${
                isAiBoxOpen
                  ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 hover:text-blue-800 border-blue-200/90 hover:border-blue-300 hover:bg-blue-100/70'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiBoxOpen ? 'text-white' : 'text-blue-600'}`} />
              <span>{isAiBoxOpen ? 'Close AI Extractor' : '✨ Paste Email / Image'}</span>
            </button>
          </div>

          {/* AI Extractor Collapsible Box */}
          <AiCustomerExtractor
            isOpen={isAiBoxOpen}
            onClose={() => setIsAiBoxOpen(false)}
            onSuccess={(data) => {
              applyExtractedDetails(data, '✨ Details extracted & auto-filled from email/screenshot!');
            }}
          />

          {/* Inline Loading Indicator for Dropdown AI extraction */}
          {isAiExtractingDropdown && (
            <div className="flex items-center gap-2 px-3.5 py-2 mb-2 bg-blue-50/90 border border-blue-200/80 rounded-xl text-xs font-semibold text-blue-700 animate-pulse shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
              <span>✨ Extracting clean address &amp; PO details...</span>
            </div>
          )}

          {/* Success Banner */}
          {aiSuccessMessage && !isAiBoxOpen && (
            <div className="flex items-center justify-between px-3.5 py-2 mb-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 animate-fadeIn shadow-2xs">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                {aiSuccessMessage}
              </span>
              <button
                type="button"
                onClick={() => setAiSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-bold ml-2 cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          <CustomerAutocomplete
            inputRef={customerAddressRef}
            value={formData.customerAddress}
            customers={customers}
            onChange={(val) => {
              if (selectedCustomer && !val.trim()) {
                setSelectedCustomer(null);
              }
              onChange({ customerAddress: val });
              if (errors.customerAddress) {
                setErrors((prev) => ({ ...prev, customerAddress: undefined }));
              }
            }}
            onSelect={handleSelectCustomer}
            placeholder={'e.g.\nMr. Kasun Rajapaksha\nApex Construction & Engineering (Pvt) Ltd\nNo. 128, High Level Road, Nugegoda'}
            error={errors.customerAddress}
          />
          {errors.customerAddress && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.customerAddress}
            </p>
          )}
        </div>

        {/* ============================================================ */}
        {/* STEP 3: 1ST PARAGRAPH REFERENCE SELECTION                      */}
        {/* ============================================================ */}
        <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/80 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              1st Paragraph Reference <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500">
              Choose which entity name to reference in the opening paragraph of the letter:
            </p>
          </div>

          {/* Three Radio Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label
              onClick={() => handleReferenceTypeChange('projectName')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                referenceType === 'projectName'
                  ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="refTypeRadio"
                value="projectName"
                checked={referenceType === 'projectName'}
                onChange={() => handleReferenceTypeChange('projectName')}
                className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="font-bold text-xs text-slate-900">Project Name</span>
            </label>

            <label
              onClick={() => handleReferenceTypeChange('companyName')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                referenceType === 'companyName'
                  ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="refTypeRadio"
                value="companyName"
                checked={referenceType === 'companyName'}
                onChange={() => handleReferenceTypeChange('companyName')}
                className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="font-bold text-xs text-slate-900">Company Name</span>
            </label>

            <label
              onClick={() => handleReferenceTypeChange('customerName')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                referenceType === 'customerName'
                  ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="refTypeRadio"
                value="customerName"
                checked={referenceType === 'customerName'}
                onChange={() => handleReferenceTypeChange('customerName')}
                className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="font-bold text-xs text-slate-900">Customer Name</span>
            </label>
          </div>

          {/* Editable text input for reference name */}
          <div>
            <div className="relative">
              <input
                ref={referenceNameRef}
                type="text"
                value={formData.referenceName || ''}
                onChange={(e) => {
                  setHasManuallyEditedReference(true);
                  onChange({ referenceName: e.target.value });
                  if (errors.referenceName) {
                    setErrors((prev) => ({ ...prev, referenceName: undefined }));
                  }
                }}
                placeholder={getRefPlaceholder()}
                className={`w-full px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  errors.referenceName ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-500 hover:border-slate-300'
                }`}
              />
            </div>
            {errors.referenceName && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.referenceName}
              </p>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* STEP 4: 2ND PARAGRAPH REFERENCE (PO OR INVOICE)              */}
        {/* ============================================================ */}
        {isPoCertificate && (
          <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900">
                  Reference Document Type &amp; Number <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500">
                  Select whether this certificate is against a PO or an Invoice
                </p>
              </div>
            </div>

            {/* PO Number vs Invoice Number toggle buttons */}
            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => onChange({ poInvoiceType: 'PO' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                  poInvoiceType === 'PO'
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="poInvoiceRadio"
                  value="PO"
                  checked={poInvoiceType === 'PO'}
                  onChange={() => onChange({ poInvoiceType: 'PO' })}
                  className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="font-bold text-xs text-slate-900">PO Number</span>
              </label>

              <label
                onClick={() => onChange({ poInvoiceType: 'Invoice' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                  poInvoiceType === 'Invoice'
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="poInvoiceRadio"
                  value="Invoice"
                  checked={poInvoiceType === 'Invoice'}
                  onChange={() => onChange({ poInvoiceType: 'Invoice' })}
                  className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="font-bold text-xs text-slate-900">Invoice Number</span>
              </label>
            </div>

            {/* Input field for PO or Invoice number */}
            <div>
              <div className="relative">
                <input
                  ref={poNumberRef}
                  type="text"
                  value={formData.poNumber || ''}
                  onChange={(e) => {
                    onChange({ poNumber: e.target.value });
                    if (errors.poNumber) {
                      setErrors((prev) => ({ ...prev, poNumber: undefined }));
                    }
                  }}
                  placeholder={poInvoiceType === 'Invoice' ? 'e.g. INV-2026-0452' : 'e.g. PO-2026-089'}
                  className={`w-full px-4 py-3 text-sm text-slate-800 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all ${
                    errors.poNumber ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-500 hover:border-slate-300'
                  }`}
                />
              </div>
              {errors.poNumber && (
                <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.poNumber}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5: PRODUCT ITEMS TABLE                                  */}
        {/* ============================================================ */}
        <div ref={itemsSectionRef}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Product Items Table <span className="text-red-500">*</span>
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border border-blue-200/60"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
          </div>

          <div className="space-y-3">
            {formData.items.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col gap-3 transition-all hover:border-slate-300"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 flex items-center justify-center shrink-0 mt-5 shadow-xs">
                    #{index + 1}
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Product Description <span className="text-red-500">*</span>
                    </label>
                    <ProductDescriptionAutocomplete
                      inputRef={index === 0 ? firstItemInputRef : undefined}
                      value={item.description || ''}
                      catalog={catalog}
                      onChange={(val) => handleItemChange(index, 'description', val)}
                      onSelect={(catalogItem, match) => handleSelectCatalogItem(index, catalogItem, match)}
                      placeholder="Enter Item Code or Item Name"
                    />
                  </div>

                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 mt-5"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="pl-10 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Product Brand <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={item.productBrand || ''}
                      onChange={(e) => handleItemChange(index, 'productBrand', e.target.value)}
                      placeholder="e.g. Switch & Socket"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Warranty Period <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={item.warrantyPeriod || ''}
                      onChange={(e) => handleItemChange(index, 'warrantyPeriod', e.target.value)}
                      placeholder="e.g. 5 Years"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {errors.items && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.items}
            </p>
          )}
        </div>

        {/* ============================================================ */}
        {/* STEP 6: TABLE FOOTER NOTE OPTION                             */}
        {/* ============================================================ */}
        <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/80 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              Additional Note Below Table
            </label>
            <p className="text-xs text-slate-500">
              Choose whether to include a custom note directly underneath the product items table:
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label
              onClick={() => onChange({ noteOption: 'withoutNote' })}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                noteOption === 'withoutNote'
                  ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="noteRadio"
                value="withoutNote"
                checked={noteOption === 'withoutNote'}
                onChange={() => onChange({ noteOption: 'withoutNote' })}
                className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="font-bold text-xs text-slate-900">Without Note</span>
            </label>

            <label
              onClick={() => onChange({ noteOption: 'withNote' })}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                noteOption === 'withNote'
                  ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="noteRadio"
                value="withNote"
                checked={noteOption === 'withNote'}
                onChange={() => onChange({ noteOption: 'withNote' })}
                className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="font-bold text-xs text-slate-900">With Note</span>
            </label>
          </div>

          {noteOption === 'withNote' && (
            <div className="space-y-1.5 animate-fadeIn pt-1">
              <label htmlFor="noteContent" className="block text-xs font-bold text-slate-700">
                Note Content <span className="text-red-500">*</span>
              </label>
              <textarea
                ref={noteContentRef}
                id="noteContent"
                rows={2}
                value={formData.noteContent || ''}
                onChange={(e) => {
                  onChange({ noteContent: e.target.value });
                  if (errors.noteContent) {
                    setErrors((prev) => ({ ...prev, noteContent: undefined }));
                  }
                }}
                placeholder="e.g. All electrical accessories must be installed by certified Kevilton electricians."
                className={`w-full px-4 py-2.5 text-xs text-slate-800 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  errors.noteContent ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-500 hover:border-slate-300'
                }`}
              />
              {errors.noteContent && (
                <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.noteContent}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* STEP 7: DATE                                                 */}
        {/* ============================================================ */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-bold text-slate-800">
                Date <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500">Date of issue for the warranty letter</p>
            </div>
          </div>

          <div className="relative">
            <input
              ref={dateRef}
              type="date"
              id="date"
              value={formData.date}
              onChange={(e) => {
                onChange({ date: e.target.value });
                if (errors.date) {
                  setErrors((prev) => ({ ...prev, date: undefined }));
                }
              }}
              className={`w-full px-4 py-3 text-sm text-slate-800 bg-slate-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                errors.date
                  ? 'border-red-400 bg-red-50/20 focus:border-red-500'
                  : 'border-slate-200 focus:border-blue-500 hover:border-slate-300'
              }`}
            />
          </div>
          {errors.date && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.date}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={isGenerating}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
              isGenerating
                ? 'bg-blue-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-blue-600 via-[#0066FF] to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.99]'
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5 text-white fill-white/20" />
                <span>Submit &amp; View Live Preview</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
