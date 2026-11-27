import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  IndexedCustomerRecord,
  filterAndRankCustomers,
  shouldTriggerCustomerSearch,
} from '../utils/customerSearch';

interface CustomerAutocompleteProps {
  value: string;
  customers: IndexedCustomerRecord[];
  onChange: (value: string) => void;
  onSelect: (customer: IndexedCustomerRecord) => void;
  placeholder?: string;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  error?: string;
}

export const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  value,
  customers,
  onChange,
  onSelect,
  placeholder,
  inputRef,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter and rank without any deduplication, grouping, or collapsing
  const suggestions = useMemo(() => {
    return filterAndRankCustomers(customers, value);
  }, [value, customers]);

  // Limit rendering to 50 items for optimal performance while preserving all matches
  const displayedSuggestions = useMemo(() => {
    return suggestions.slice(0, 50);
  }, [suggestions]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [displayedSuggestions]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelect = (item: IndexedCustomerRecord) => {
    onSelect(item);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    onChange(nextVal);
    setIsOpen(shouldTriggerCustomerSearch(nextVal));
  };

  const handleFocus = () => {
    if (shouldTriggerCustomerSearch(value) && suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
      return;
    }
    if (displayedSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev + 1) % displayedSuggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(displayedSuggestions.length - 1);
      } else {
        setHighlightedIndex((prev) => (prev - 1 + displayedSuggestions.length) % displayedSuggestions.length);
      }
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      const chosen = displayedSuggestions[highlightedIndex];
      if (chosen) {
        handleSelect(chosen);
      }
    }
  };

  const showDropdown = isOpen && displayedSuggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <textarea
          ref={inputRef}
          rows={3}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full px-4 py-3 text-sm text-slate-800 bg-slate-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 resize-y min-h-[95px] pr-9 ${
            error
              ? 'border-red-400 bg-red-50/20 focus:border-red-500'
              : 'border-slate-200 focus:border-blue-500 hover:border-slate-300'
          }`}
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="sticky top-0 z-10 px-3.5 py-1.5 bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>
              {suggestions.length === 1
                ? '1 matching customer'
                : suggestions.length > 50
                ? `Showing 50 of ${suggestions.length} matching customers`
                : `${suggestions.length} matching customers`}
            </span>
          </div>

          <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1 divide-y divide-slate-100">
            {displayedSuggestions.map((entry, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const { record } = entry;

              // Unique React key combining SNo, row index, and address
              const itemKey = `${entry.sno || 'row'}-${idx}-${record.locationAddress || ''}`;

              let refBadge = '';
              if (record.refNumber?.trim()) {
                const trimmedNum = record.refNumber.trim();
                if (record.refType && !trimmedNum.toUpperCase().startsWith(record.refType.toUpperCase())) {
                  refBadge = `${record.refType} ${trimmedNum}`;
                } else {
                  refBadge = trimmedNum;
                }
              }

              // Line 2 secondary details: Project and/or Customer name if available and not shown as Primary Name
              const secondaryDetails: { label: string; text: string }[] = [];
              if (record.projectName?.trim() && record.projectName.trim() !== entry.primaryName) {
                secondaryDetails.push({ label: 'Project', text: record.projectName.trim() });
              }
              if (record.customerName?.trim() && record.customerName.trim() !== entry.primaryName) {
                secondaryDetails.push({ label: 'Contact', text: record.customerName.trim() });
              }
              if (record.companyName?.trim() && record.companyName.trim() !== entry.primaryName) {
                secondaryDetails.push({ label: 'Company', text: record.companyName.trim() });
              }

              return (
                <li
                  key={itemKey}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(entry);
                  }}
                  className={`px-3.5 py-2.5 cursor-pointer transition-colors ${
                    isHighlighted ? 'bg-blue-50 text-blue-900' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {/* Line 1: #SNo badge + Primary Name + Ref Badge + Date */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {record.sno && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                          #{record.sno.replace(/^#/, '')}
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-900 truncate">{entry.primaryName}</span>
                      {entry.orders && entry.orders.length > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                          {entry.orders.length} Orders
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {refBadge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                          {refBadge}
                        </span>
                      )}
                      {record.date && (
                        <span className="text-[10px] text-slate-400 font-medium">{record.date}</span>
                      )}
                    </div>
                  </div>

                  {/* Line 2 (when available and not already shown as Primary Name): subtle inline labels */}
                  {secondaryDetails.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] mt-0.5">
                      {secondaryDetails.map((detail, dIdx) => (
                        <span key={dIdx} className="truncate">
                          <span className="font-semibold text-slate-500">{detail.label}: </span>
                          <span className={isHighlighted ? 'text-blue-800 font-medium' : 'text-slate-700'}>
                            {detail.text}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Line 3: locationAddress */}
                  {record.locationAddress && (
                    <div
                      className={`text-[11px] mt-0.5 truncate ${
                        isHighlighted ? 'text-blue-700/90' : 'text-slate-500'
                      }`}
                    >
                      {record.locationAddress}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
