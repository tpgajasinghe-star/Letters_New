import React, { useState } from 'react';
import { User, Package, Calendar, Send, Sparkles, AlertCircle, RotateCcw, Plus, Trash2, FileCheck2, FileText } from 'lucide-react';
import { WarrantyFormData, ProductItemRow } from '../types';

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

  const isPoCertificate = formData.letterType === 'po_certificate';

  const validate = (): boolean => {
    const newErrors: {
      customerAddress?: string;
      date?: string;
      items?: string;
    } = {};

    if (!formData.customerAddress.trim()) {
      newErrors.customerAddress = 'Customer / Company address is required.';
    }
    if (!formData.date.trim()) {
      newErrors.date = 'Date of issue is required.';
    }

    if (!formData.items || formData.items.length === 0) {
      newErrors.items = 'Please add at least one product item.';
    } else {
      // Validate that at least the main field is filled
      const hasValidRow = formData.items.some((item) => {
        if (isPoCertificate) {
          return item.productType?.trim();
        } else {
          return item.description?.trim() || item.itemCode?.trim();
        }
      });
      if (!hasValidRow) {
        newErrors.items = isPoCertificate
          ? 'Please enter the Product type for at least one item.'
          : 'Please enter the Description or Item Code for at least one item.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit();
    }
  };

  // Switch Letter Type handler
  const handleSelectLetterType = (type: 'declaration' | 'po_certificate') => {
    if (type === 'po_certificate') {
      // Prepopulate row format if empty
      const updatedItems = (formData.items && formData.items.length > 0)
        ? formData.items.map((it) => ({
            ...it,
            productType: it.productType || it.description || 'Switches and Sockets',
            productBrand: it.productBrand || 'Kevilton',
            warrantyPeriod: it.warrantyPeriod || '5 Years',
          }))
        : [
            {
              productType: 'Switches and Sockets',
              productBrand: 'Kevilton',
              warrantyPeriod: '5 Years',
            },
          ];

      onChange({
        letterType: 'po_certificate',
        items: updatedItems,
      });
    } else {
      const updatedItems = (formData.items && formData.items.length > 0)
        ? formData.items.map((it) => ({
            ...it,
            itemCode: it.itemCode || 'KEV-SW-101',
            description: it.description || it.productType || '1 Gang 1 Way Switch 10A',
            warrantyPeriod: it.warrantyPeriod || '5 Years',
          }))
        : [
            {
              itemCode: 'KEV-SW-101',
              description: '1 Gang 1 Way Switch 10A',
              warrantyPeriod: '5 Years',
            },
          ];

      onChange({
        letterType: 'declaration',
        items: updatedItems,
      });
    }
    setErrors({});
  };

  // Add Item Row
  const handleAddItem = () => {
    const newItem: ProductItemRow = isPoCertificate
      ? { productType: '', productBrand: 'Kevilton', warrantyPeriod: '5 Years' }
      : { itemCode: '', description: '', warrantyPeriod: '5 Years' };

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

  const handleFillSample = () => {
    if (isPoCertificate) {
      onChange({
        letterType: 'po_certificate',
        date: new Date().toISOString().split('T')[0],
        customerAddress: `The General Manager\nPower & Energy Projects Division\nLanka Electricity Services (Pvt) Ltd\nNo. 45, Galle Road, Colombo 03`,
        items: [
          { productType: 'Distribution Boards & Enclosures', productBrand: 'Kevilton', warrantyPeriod: '10 Years' },
          { productType: 'Modular Switches and Socket Outlets', productBrand: 'Kevilton', warrantyPeriod: '5 Years' },
          { productType: 'Miniature Circuit Breakers (MCB) 6kA', productBrand: 'Kevilton', warrantyPeriod: '2 Years' },
        ],
      });
    } else {
      onChange({
        letterType: 'declaration',
        date: new Date().toISOString().split('T')[0],
        customerAddress: `Mr. Kasun Rajapaksha\nSenior Electrical Consultant\nApex Construction & Engineering (Pvt) Ltd\nNo. 128, High Level Road, Nugegoda`,
        items: [
          { itemCode: 'KEV-SW-101', description: '1 Gang 1 Way Switch 10A White', warrantyPeriod: '5 Years' },
          { itemCode: 'KEV-SK-202', description: '13A Switched Socket Outlet Single', warrantyPeriod: '2 Years' },
          { itemCode: 'KEV-MCB-32', description: 'Single Pole MCB 32A 6kA Curve C', warrantyPeriod: '2 Years' },
        ],
      });
    }
    setErrors({});
  };

  const handleReset = () => {
    onChange({
      customerAddress: '',
      date: new Date().toISOString().split('T')[0],
      items: isPoCertificate
        ? [{ productType: '', productBrand: 'Kevilton', warrantyPeriod: '5 Years' }]
        : [{ itemCode: '', description: '', warrantyPeriod: '5 Years' }],
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
                  Declaration letter asking: <strong>1. Item Code</strong>, <strong>2. Description</strong>, <strong>3. Warranty Period</strong>
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
                  Certificate asking: <strong>1. Product type</strong>, <strong>2. Product Brand</strong>, <strong>3. Warranty Period</strong>
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

        {/* ============================================================ */}
        {/* STEP 3: DYNAMIC PRODUCT DETAILS ACCORDING TO LETTER TYPE      */}
        {/* If Common Draft: 1. Item Code, 2. Description, 3. Period     */}
        {/* If Common Warranty: 1. Product type, 2. Product Brand, 3. Period */}
        {/* ============================================================ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {isPoCertificate
                    ? 'Product Items (Product type · Product Brand · Warranty Period)'
                    : 'Product Items (Item Code · Description · Warranty Period)'}{' '}
                  <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {isPoCertificate
                    ? 'Matching your Common Warranty Certificate table structure'
                    : 'Matching your Common Draft Warranty Certificate table structure'}
                </p>
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
                className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col md:flex-row items-start md:items-center gap-3 transition-all hover:border-slate-300"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 w-6 shrink-0">
                  #{index + 1}
                </div>

                {!isPoCertificate ? (
                  /* ======================================================= */
                  /* Option 1: 1. Item Code | 2. Description | 3. Warranty Period */
                  /* ======================================================= */
                  <>
                    {/* 1. Item Code */}
                    <div className="w-full md:w-1/4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        1. Item Code
                      </label>
                      <input
                        type="text"
                        value={item.itemCode || ''}
                        onChange={(e) => handleItemChange(index, 'itemCode', e.target.value)}
                        placeholder="e.g. KEV-SW-101"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* 2. Description */}
                    <div className="w-full md:w-1/2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        2. Description
                      </label>
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="e.g. 1 Gang 1 Way Switch 10A"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* 3. Warranty Period */}
                    <div className="w-full md:w-1/4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        3. Warranty Period
                      </label>
                      <input
                        type="text"
                        value={item.warrantyPeriod || ''}
                        onChange={(e) => handleItemChange(index, 'warrantyPeriod', e.target.value)}
                        placeholder="e.g. 5 Years"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </>
                ) : (
                  /* ======================================================= */
                  /* Option 2: 1. Product type | 2. Product Brand | 3. Warranty Period */
                  /* ======================================================= */
                  <>
                    {/* 1. Product type */}
                    <div className="w-full md:w-1/2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        1. Product type
                      </label>
                      <input
                        type="text"
                        value={item.productType || ''}
                        onChange={(e) => handleItemChange(index, 'productType', e.target.value)}
                        placeholder="e.g. Distribution Board, Switches & Sockets"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* 2. Product Brand */}
                    <div className="w-full md:w-1/4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        2. Product Brand
                      </label>
                      <input
                        type="text"
                        value={item.productBrand || ''}
                        onChange={(e) => handleItemChange(index, 'productBrand', e.target.value)}
                        placeholder="e.g. Kevilton"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* 3. Warranty Period */}
                    <div className="w-full md:w-1/4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        3. Warranty Period
                      </label>
                      <input
                        type="text"
                        value={item.warrantyPeriod || ''}
                        onChange={(e) => handleItemChange(index, 'warrantyPeriod', e.target.value)}
                        placeholder="e.g. 5 Years"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </>
                )}

                {/* Remove button */}
                {formData.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer self-end md:self-center"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
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
