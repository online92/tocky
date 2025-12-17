import React from 'react';
import { SupportedLanguage, LANGUAGE_OPTIONS } from '../types';

interface LanguageSelectorProps {
  currentLanguage: SupportedLanguage;
  onChange: (lang: SupportedLanguage) => void;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  currentLanguage, 
  onChange,
  disabled = false 
}) => {
  return (
    <div className="flex space-x-2 bg-emerald-100 p-1 rounded-lg">
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.code}
          onClick={() => onChange(option.code)}
          disabled={disabled}
          className={`
            flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
            ${currentLanguage === option.code 
              ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200' 
              : 'text-emerald-600 hover:bg-emerald-200/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <span className="mr-2 text-lg">{option.flag}</span>
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
};