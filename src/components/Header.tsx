import React from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import { KeviltonLogo } from './KeviltonLogo';

export const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-r from-[#07366B] via-[#094285] to-[#0A4B95] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        {/* Left: Brand & App Title */}
        <div className="flex items-center">
          <KeviltonLogo variant="header" size="md" showText={false} showSubtitle={false} />

          <div className="hidden sm:block h-8 w-[1px] bg-white/25 mx-5" />

          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <FileText className="w-4 h-4 text-sky-200" />
            </div>
            <span className="font-semibold text-base sm:text-lg tracking-tight text-white/95">
              Warranty Letter Generator
            </span>
          </div>
        </div>

        {/* Right: Corporate Motto */}
        <div className="hidden md:flex items-center gap-2 text-sky-100/90 text-xs lg:text-sm font-medium italic tracking-wide">
          <span>Trusted Products</span>
          <span className="text-sky-300/60 font-light">|</span>
          <span>Reliable Support</span>
          <span className="text-sky-300/60 font-light">|</span>
          <span>One Step Ahead</span>
        </div>
      </div>
    </header>
  );
};
