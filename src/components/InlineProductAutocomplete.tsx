import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CatalogItem, CatalogMatch } from '../utils/warrantyRules';
import { IndexedCatalogItem, filterAndRankCatalog } from '../utils/catalogSearch';

interface InlineProductAutocompleteProps {
  value: string;
  catalog: IndexedCatalogItem[];
  onChange: (value: string) => void;
  onSelect: (item: CatalogItem, match: CatalogMatch) => void;
  placeholder?: string;
  ariaLabel?: string;
}

interface DropdownCoords {
  top: number;
  left: number;
  width: number;
  openAbove: boolean;
}

/**
 * Zero-layout-shift auto-resizing inline table cell editor with portal-rendered
 * product catalog autocomplete suggestions (auto-fills Description, Brand & Warranty).
 */
export const InlineProductAutocomplete: React.FC<InlineProductAutocompleteProps> = ({
  value,
  catalog,
  onChange,
  onSelect,
  placeholder = 'Enter Item Code or Item Name',
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState<DropdownCoords | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const suggestions = useMemo(() => filterAndRankCatalog(catalog, value), [catalog, value]);
  const showDropdown = isOpen && suggestions.length > 0;

  const syncHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    syncHeight();
  }, [value]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => syncHeight());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions]);

  // Keep fixed-position portal dropdown aligned to the cell on scroll/resize
  useLayoutEffect(() => {
    if (!showDropdown) return;

    const updatePosition = () => {
      const el = textareaRef.current;
      if (!el) return;
      const cell = el.closest('td') || el;
      const rect = cell.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom;
      const openAbove = spaceBelow < 240 && rect.top > spaceBelow;

      const width = Math.min(Math.max(rect.width, 360), viewportWidth - 24);
      const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));
      const top = openAbove ? rect.top - 4 : rect.bottom + 4;

      setCoords({ top, left, width, openAbove });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showDropdown, value]);

  // Scroll highlighted option into view during keyboard navigation
  useEffect(() => {
    if (!showDropdown || !listRef.current) return;
    const activeEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, showDropdown]);

  // Close popup on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        textareaRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    onChange(nextValue);
    setIsOpen(nextValue.trim().length >= 2);
  };

  const handleFocus = () => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || suggestions.length === 0) return;
    const isExactSelected =
      suggestions.length === 1 &&
      suggestions[0].combinedLower === trimmed.toLowerCase();
    if (!isExactSelected) {
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

    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
      }
      return;
    }

    if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(suggestions.length - 1);
      } else {
        setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown) {
        const chosen = suggestions[highlightedIndex];
        if (chosen) {
          handleSelectEntry(chosen);
          return;
        }
      }
      e.currentTarget.blur();
    }
  };

  return (
    <>
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        spellCheck={false}
        className="inline-edit-field block w-full bg-transparent resize-none overflow-hidden m-0 p-0 border-0 rounded-[2px] outline-none hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-400/80 hover:bg-blue-50/35 focus:outline focus:outline-1 focus:outline-dashed focus:outline-blue-500 focus:bg-blue-50/45 transition-colors placeholder:text-slate-400 placeholder:font-normal print:outline-none print:bg-transparent"
        style={{ fontFamily: 'inherit', lineHeight: 'inherit' }}
      />

      {showDropdown &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-2xl shadow-slate-900/15 overflow-hidden no-print"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.openAbove ? 'translateY(-100%)' : undefined,
              fontFamily:
                "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            <div className="sticky top-0 z-10 px-3.5 py-1.5 bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
              <span>
                {suggestions.length}{' '}
                {suggestions.length === 1 ? 'matching item' : 'matching items'}
              </span>
            </div>
            <ul
              ref={listRef}
              role="listbox"
              className="max-h-64 overflow-y-auto py-1 divide-y divide-slate-100"
            >
              {suggestions.map((entry, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const metaParts = [entry.match.productBrand, entry.match.warrantyPeriod].filter(
                  Boolean
                );

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
                      isHighlighted
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-slate-800 hover:bg-slate-50'
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
          </div>,
          document.body
        )}
    </>
  );
};
