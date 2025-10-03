import React, { useState } from 'react';

interface HelpTooltipProps {
  content: string;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({ content }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
      >
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <div className="text-xs text-gray-700">{content}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-white" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full border-8 border-transparent border-t-gray-200" />
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpTooltip;
