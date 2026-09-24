import React from 'react';

interface KeviltonLogoProps {
  variant?: 'light' | 'dark' | 'header';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  showText?: boolean;
}

export const KeviltonLogo: React.FC<KeviltonLogoProps> = ({
  variant = 'header',
  className = '',
  size = 'md',
  showSubtitle = true,
  showText = true,
}) => {
  const isLight = variant === 'light';
  const isHeader = variant === 'header';

  const textColor = isHeader || isLight ? 'text-white' : 'text-[#08407B]';
  const subtextColor = isHeader || isLight ? 'text-sky-100/90' : 'text-[#08407B]';
  const boltColor = '#FFB800'; // Electric golden amber

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const subSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div className={`flex flex-col select-none leading-none ${className}`}>
      <div className="flex items-center gap-1.5">
        {/* Stylized Electric Lightning Bolt */}
        <svg
          viewBox="0 0 24 28"
          className={size === 'sm' ? 'w-5 h-6' : size === 'lg' ? 'w-8 h-9' : 'w-6 h-7'}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13.5 1L2 14.5H12L8.5 27L22 11.5H12.5L16.5 1H13.5Z"
            fill={boltColor}
            stroke="#D97706"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </svg>

        {showText && (
          <span
            className={`font-black italic tracking-wider uppercase font-sans ${titleSizes[size]} ${textColor}`}
            style={{ letterSpacing: '0.04em' }}
          >
            KEVILTON
          </span>
        )}
      </div>
      {showSubtitle && showText && (
        <span
          className={`font-medium tracking-normal mt-0.5 pl-0.5 ${subSizes[size]} ${subtextColor}`}
        >
          Electrical Products (Pvt.) Ltd.
        </span>
      )}
    </div>
  );
};
