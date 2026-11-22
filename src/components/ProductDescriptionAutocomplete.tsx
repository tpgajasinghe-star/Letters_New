import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { CatalogItem, CatalogMatch } from '../utils/warrantyRules';
import { IndexedCatalogItem, filterAndRankCatalog } from '../utils/catalogSearch';

export type { IndexedCatalogItem };

interface ProductDescriptionAutocompleteProps {
  value: string;
  catalog: IndexedCatalogItem[];
  onChange: (value: string) => void;
  onSelect: (item: CatalogItem, match: CatalogMatch) => void;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export const ProductDescriptionAutocomplete: React.FC<ProductDescriptionAutocompleteProps> = ({
  value,
  catalog,
  onChange,
  onSelect,
  placeholder = 'Enter Item Code or Item Name',
  inputRef,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const suggestions = useMemo(() => filterAndRankCatalog(catalog, value), [value, catalog]);

  // Keep highlighted index within valid bounds when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions]);

  // Scroll highlighted option into view during keyboard navigation
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Close popup when clicking outside this row's autocomplete container
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelectEntry = (entry: IndexedCatalogItem) => {
    onSelect(entry.item, entry.match);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    onChange(nextValue);
    setIsOpen(nextValue.trim().length >= 2);
  };

  const handleFocus = () => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || suggestions.length === 0) return;
    // Avoid popping over fields if the input already holds the exact selected suggestion
    const isExactSelected =
      suggestions.length === 1 &&
      suggestions[0].combinedLower === trimmed.toLowerCase();
    if (!isExactSelected) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
      return;
    }

    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(suggestions.length - 1);
      } else {
        setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      const chosen = suggestions[highlightedIndex];
      if (chosen) {
        handleSelectEntry(chosen);
      }
    }
  };

  const showDropdown = isOpen && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className="w-full px-3.5 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
        />
        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="sticky top-0 z-10 px-3.5 py-1.5 bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>
              {suggestions.length} {suggestions.length === 1 ? 'matching item' : 'matching items'}
            </span>
          </div>
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-72 overflow-y-auto py-1 divide-y divide-slate-100"
          >
            {suggestions.map((entry, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const metaParts = [entry.match.productBrand, entry.match.warrantyPeriod].filter(Boolean);

              return (
                <li
                  key={`${entry.item.itemCode}-${idx}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectEntry(entry);
                  }}
                  className={`px-3.5 py-2 cursor-pointer transition-colors ${
                    isHighlighted ? 'bg-blue-50 text-blue-900' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold leading-snug truncate">
                    {entry.combinedDisplay}
                  </div>
                  {metaParts.length > 0 && (
                    <div
                      className={`text-[11px] mt-0.5 leading-tight ${
                        isHighlighted ? 'text-blue-700/80' : 'text-slate-500'
                      }`}
                    >
                      {metaParts.join(' · ')}
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
