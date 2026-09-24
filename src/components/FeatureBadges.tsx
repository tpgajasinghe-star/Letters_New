import React from 'react';
import { Clock, ShieldCheck, Download } from 'lucide-react';

export const FeatureBadges: React.FC = () => {
  return (
    <div className="mt-8 pt-4 flex flex-col items-center">
      {/* 3 Pillars */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-xl text-center">
        {/* Fast & Easy */}
        <div className="flex flex-col items-center group">
          <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mb-2 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm sm:text-base">Fast & Easy</h4>
          <p className="text-slate-500 text-xs sm:text-xs mt-0.5 leading-snug">
            Just fill 3 fields and submit.
          </p>
        </div>

        {/* Accurate */}
        <div className="flex flex-col items-center group">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <ShieldCheck className="w-6 h-6 stroke-[2]" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm sm:text-base">Accurate</h4>
          <p className="text-slate-500 text-xs sm:text-xs mt-0.5 leading-snug">
            Auto fills your template.
          </p>
        </div>

        {/* Download PDF */}
        <div className="flex flex-col items-center group">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Download className="w-6 h-6 stroke-[2]" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm sm:text-base">Download PDF</h4>
          <p className="text-slate-500 text-xs sm:text-xs mt-0.5 leading-snug">
            Get your warranty letter instantly.
          </p>
        </div>
      </div>

      {/* Handwritten cursive tag with curved underline */}
      <div className="mt-8 flex flex-col items-center">
        <span
          className="text-2xl sm:text-3xl text-sky-800 font-bold tracking-wide select-none"
          style={{ fontFamily: "'Caveat', cursive, sans-serif" }}
        >
          Simple &nbsp;·&nbsp; Fast &nbsp;·&nbsp; Professional
        </span>
        {/* Curved blue flourish brush stroke */}
        <svg
          viewBox="0 0 220 20"
          className="w-48 sm:w-56 h-4 text-sky-600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 14C45 4 120 2 215 15"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
