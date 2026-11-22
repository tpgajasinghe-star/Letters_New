import React, { useLayoutEffect, useRef } from 'react';

interface InlineEditableTextProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  allowNewlines?: boolean;
  ariaLabel?: string;
}

/**
 * Transparent auto-resizing textarea that inherits exact document typography so
 * inline editing causes zero layout shift and zero cursor-jumping bugs.
 */
export const InlineEditableText: React.FC<InlineEditableTextProps> = ({
  value,
  onChange,
  onBlur,
  className = '',
  placeholder,
  allowNewlines = false,
  ariaLabel,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const observer = new ResizeObserver(() => {
      syncHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!allowNewlines && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      spellCheck={false}
      className={`inline-edit-field block w-full bg-transparent resize-none overflow-hidden m-0 p-0 border-0 rounded-[2px] outline-none hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-400/80 hover:bg-blue-50/35 focus:outline focus:outline-1 focus:outline-dashed focus:outline-blue-500 focus:bg-blue-50/45 transition-colors placeholder:text-slate-400 placeholder:font-normal print:outline-none print:bg-transparent ${className}`}
      style={{ fontFamily: 'inherit', lineHeight: 'inherit' }}
    />
  );
};
