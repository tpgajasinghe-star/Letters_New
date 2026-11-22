import React, { useEffect, useRef, useState } from 'react';
import { User, Package, Calendar, Send, Sparkles, AlertCircle, RotateCcw, Plus, Trash2, FileText } from 'lucide-react';
import { WarrantyFormData, ProductItemRow } from '../types';
import { CatalogItem, CatalogMatch } from '../utils/warrantyRules';
import { IndexedCatalogItem, getCachedCatalog, loadCatalogItems } from '../utils/catalogSearch';
import { ProductDescriptionAutocomplete } from './ProductDescriptionAutocomplete';

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
  }>({});
  const [catalog, setCatalog] = useState<IndexedCatalogItem[]>(() => getCachedCatalog());
  const customerAddressRef = useRef<HTMLTextAreaElement>(null);
  const firstItemInputRef = useRef<HTMLInputElement>(null);
  const itemsSectionRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

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

  const isPoCertificate = formData.letterType === 'po_certificate';

  type InvalidFieldKey = 'customerAddress' | 'items' | 'date';

  const validate = (): InvalidFieldKey | null => {
    const newErrors: {
      customerAddress?: string;
      date?: string;
      items?: string;
    } = {};

    if (!formData.customerAddress.trim()) {
      newErrors.customerAddress = 'Customer / Company address is required.';
    }

    if (!formData.items || formData.items.length === 0) {
      newErrors.items = 'Please add at least one product item.';
    } else {
      // Validate that at least the description field is filled
      const hasValidRow = formData.items.some((item) => {
        return item.description?.trim() || item.itemCode?.trim() || item.productType?.trim();
      });
      if (!hasValidRow) {
        newErrors.items = 'Please enter the Product Description for at least one item.';
      }
    }

    if (!formData.date.trim()) {
      newErrors.date = 'Date of issue is required.';
    }

    setErrors(newErrors);

    // Return the first invalid field in visual top-to-bottom order
    if (newErrors.customerAddress) return 'customerAddress';
    if (newErrors.items) return 'items';
    if (newErrors.date) return 'date';
    return null;
  };

  const scrollToAndFocusField = (field: InvalidFieldKey) => {
    requestAnimationFrame(() => {
      let targetEl: HTMLElement | null = null;
      if (field === 'customerAddress') {
        targetEl = customerAddressRef.current;
      } else if (field === 'items') {
        targetEl = firstItemInputRef.current || itemsSectionRef.current;
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
    const firstInvalidField = validate();
    if (!firstInvalidField) {
      onSubmit();
      return;
    }
    scrollToAndFocusField(firstInvalidField);
  };

  // Switch Letter Type handler
  const handleSelectLetterType = (type: 'declaration' | 'po_certificate') => {
    onChange({
      letterType: type,
      poNumber: formData.poNumber || '',
    });
    setErrors({});
  };

  // Add Item Row
  const handleAddItem = () => {
    const newItem: ProductItemRow = {
      description: '',
      productBrand: '',
      warrantyPeriod: '',
    };

    onChange({ items: [...formData.items, newItem] });
  };

  // Remove Item Row
  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    const updated = formData.items.filter((_, i) => i !== index);
    onChange({ items: updated });
  };

  // Update specific Item field
  const handleItemChange = (index: number, field: keyof ProductItemRow, value: string) => {
    const updated = formData.items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange({ items: updated });
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }));
    }
  };

  // Auto-fill all three fields when a catalog suggestion is selected for a row
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
    if (isPoCertificate) {
      onChange({
        letterType: 'po_certificate',
        date: new Date().toISOString().split('T')[0],
        poNumber: 'PO-2026-089',
        customerAddress: `The General Manager\nPower & Energy Projects Division\nLanka Electricity Services (Pvt) Ltd\nNo. 45, Galle Road, Colombo 03`,
        items: [
          { description: 'KEV-DB-08 - Distribution Boards & Enclosures 8-Way', productBrand: 'Circuit Protection Devices', warrantyPeriod: '10 Years' },
          { description: 'KEV-MOD-01 - Modular Switches and Socket Outlets', productBrand: 'Wiring Devices', warrantyPeriod: '5 Years' },
          { description: 'KEV-MCB-6K - Miniature Circuit Breakers (MCB) 6kA', productBrand: 'Circuit Protection Devices', warrantyPeriod: '2 Years' },
        ],
        wordingOverrides: undefined,
      });
    } else {
      onChange({
        letterType: 'declaration',
        date: new Date().toISOString().split('T')[0],
        customerAddress: `Mr. Kasun Rajapaksha\nSenior Electrical Consultant\nApex Construction & Engineering (Pvt) Ltd\nNo. 128, High Level Road, Nugegoda`,
        items: [
          { description: 'KEV-SW-101 - 1 Gang 1 Way Switch 10A White', productBrand: 'Wiring Devices', warrantyPeriod: '5 Years' },
          { description: 'KEV-SK-202 - 13A Switched Socket Outlet Single', productBrand: 'Wiring Devices', warrantyPeriod: '2 Years' },
          { description: 'KEV-MCB-32 - Single Pole MCB 32A 6kA Curve C', productBrand: 'Circuit Protection Devices', warrantyPeriod: '2 Years' },
        ],
        wordingOverrides: undefined,
      });
    }
    setErrors({});
  };

  const handleReset = () => {
    onChange({
      customerAddress: '',
      date: new Date().toISOString().split('T')[0],
      poNumber: '',
      items: [{ description: '', productBrand: '', warrantyPeriod: '' }],
      wordingOverrides: undefined,
    });
    setErrors({});
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-blue-950/5 border border-blue-50/80 p-6 sm:p-8">
      {/* 3-Step Process Indicator */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-7">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 1
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            1
          </div>
          <span
            className={`text-xs sm:text-sm font-semibold ${
              step === 1 ? 'text-blue-600' : 'text-slate-700'
            }`}
          >
            Enter Details
          </span>
        </div>

        <div className="h-0.5 w-6 sm:w-12 bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 2
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            2
          </div>
          <span
            className={`text-xs sm:text-sm font-medium ${
              step === 2 ? 'text-blue-600 font-semibold' : 'text-slate-400'
            }`}
          >
            Live Preview
          </span>
        </div>

        <div className="h-0.5 w-6 sm:w-12 bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 3
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            3
          </div>
          <span
            className={`text-xs sm:text-sm font-medium ${
              step === 3 ? 'text-emerald-600 font-semibold' : 'text-slate-400'
            }`}
          >
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
        {/* STEP 1: CHOOSE LETTER TYPE FIRST (Front page selection)       */}
        {/* ============================================================ */}
        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            Select Letter Type <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-4">
            Choose which warranty letter type you want to generate:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Option 1: Common Draft Warranty Certificate */}
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
                  1. Common Draft Warranty Certificate
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Declaration letter with: <strong>1. Product Description</strong>, <strong>2. Product Brand</strong>, <strong>3. Warranty Period</strong>
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
                  Certificate asking: <strong>PO Number</strong>, <strong>1. Product Description</strong>, <strong>2. Product Brand</strong>, <strong>3. Warranty Period</strong>
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* ============================================================ */}
        {/* STEP 2: CUSTOMER ADDRESS                                     */}
        {/* ============================================================ */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <label htmlFor="customerAddress" className="block text-sm font-bold text-slate-800">
                Customer Address <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500">
                Recipient name, company &amp; address (one per line)
              </p>
            </div>
          </div>

          <div className="relative">
            <textarea
              ref={customerAddressRef}
              id="customerAddress"
              rows={3}
              value={formData.customerAddress}
              onChange={(e) => {
                onChange({ customerAddress: e.target.value });
                if (errors.customerAddress) {
                  setErrors((prev) => ({ ...prev, customerAddress: undefined }));
                }
              }}
              placeholder="e.g.&#10;Mr. Kasun Rajapaksha&#10;Apex Construction & Engineering (Pvt) Ltd&#10;No. 128, High Level Road, Nugegoda"
              className={`w-full px-4 py-3 text-sm text-slate-800 bg-slate-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 resize-y min-h-[95px] ${
                errors.customerAddress
                  ? 'border-red-400 bg-red-50/20 focus:border-red-500'
                  : 'border-slate-200 focus:border-blue-500 hover:border-slate-300'
              }`}
            />
          </div>
          {errors.customerAddress && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.customerAddress}
            </p>
          )}
        </div>

        {/* PO Number Field (For Common Warranty Certificate) */}
        {isPoCertificate && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <label htmlFor="poNumber" className="block text-sm font-bold text-slate-800">
                  PO Number
                </label>
                <p className="text-xs text-slate-500">
                  Purchase Order number (added to the end of the subject title)
                </p>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                id="poNumber"
                value={formData.poNumber || ''}
                onChange={(e) => onChange({ poNumber: e.target.value })}
                placeholder="e.g. PO-2026-089 or 2026/KEV/PO/441"
                className="w-full px-4 py-3 text-sm text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300 transition-all font-medium placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: DYNAMIC PRODUCT DETAILS ACCORDING TO LETTER TYPE      */}
        {/* If Common Draft: 1. Item Code, 2. Description, 3. Period     */}
        {/* If Common Warranty: 1. Product type, 2. Product Brand, 3. Period */}
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

          {/* Items Row List */}
          <div className="space-y-3">
            {formData.items.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col gap-3 transition-all hover:border-slate-300"
              >
                {/* Top Section: Item Index + Full Width Product Description */}
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

                {/* Bottom Segment: Product Brand + Warranty Period */}
                <div className="pl-10 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  {/* Product Brand */}
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

                  {/* Warranty Period */}
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
        {/* STEP 4: DATE                                                 */}
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

        {/* Submit Button to go directly to Live Preview & Download */}
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
